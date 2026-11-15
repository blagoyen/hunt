use rusqlite::{Connection, Result};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Db {
    pub conn: Mutex<Connection>,
}

impl Db {
    pub fn open(path: PathBuf) -> Result<Self> {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let conn = Connection::open(&path)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        let db = Db { conn: Mutex::new(conn) };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(include_str!("../migrations/001_init.sql"))?;
        // Add description column if missing (for existing DBs)
        let _ = conn.execute("ALTER TABLE listings ADD COLUMN description TEXT", []);
        // Parts catalog (model -> part -> price data)
        let _ = conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS parts_prices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                model TEXT NOT NULL,
                part TEXT NOT NULL,
                quality TEXT NOT NULL DEFAULT 'standard',
                price_eur REAL NOT NULL DEFAULT 0,
                labor_eur REAL NOT NULL DEFAULT 0,
                supplier TEXT,
                note TEXT,
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(model, part, quality)
            );"
        );
        Ok(())
    }

    pub fn upsert_listing(&self, s: &crate::scrape::ScrapedListing) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let price_cents = s.price.map(|p| (p * 100.0) as i64);
        conn.execute(
            "INSERT INTO listings (source, external_id, url, title, price_cents, location, seller, description, first_seen, last_seen, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'), datetime('now'), 'new')
             ON CONFLICT(source, external_id) DO UPDATE SET
               title = excluded.title,
               price_cents = excluded.price_cents,
               location = excluded.location,
               description = excluded.description,
               last_seen = datetime('now')",
            rusqlite::params![
                s.source,
                s.external_id,
                s.url,
                s.title,
                price_cents,
                s.location,
                s.seller,
                s.description
            ],
        )?;
        let id: i64 = conn.query_row(
            "SELECT id FROM listings WHERE source = ?1 AND external_id = ?2",
            rusqlite::params![s.source, s.external_id],
            |r| r.get(0),
        )?;
        Ok(id)
    }

    pub fn upsert_attrs(&self, listing_id: i64, a: &crate::extract::ExtractedAttrs) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let damage_json = serde_json::to_string(&a.damage).unwrap_or_else(|_| "[]".to_string());
        conn.execute(
            "INSERT INTO parsed_attrs (listing_id, model, storage_gb, battery_health, icloud_locked, carrier_locked, damage_json, screen_replaced, extractor, confidence)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT(listing_id) DO UPDATE SET
               model = excluded.model,
               storage_gb = excluded.storage_gb,
               battery_health = excluded.battery_health,
               icloud_locked = excluded.icloud_locked,
               carrier_locked = excluded.carrier_locked,
               damage_json = excluded.damage_json,
               screen_replaced = excluded.screen_replaced,
               extractor = excluded.extractor,
               confidence = excluded.confidence",
            rusqlite::params![
                listing_id,
                a.model,
                a.storage_gb,
                a.battery_health,
                a.icloud_locked.map(|b| if b { 1 } else { 0 }),
                a.carrier_locked.map(|b| if b { 1 } else { 0 }),
                damage_json,
                a.screen_replaced.map(|b| if b { 1 } else { 0 }),
                a.extractor,
                a.confidence
            ],
        )?;
        Ok(())
    }

    pub fn list_listings(&self) -> Result<Vec<serde_json::Value>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT l.id, l.source, l.external_id, l.url, l.title, l.price_cents, l.location, l.seller, l.first_seen, l.last_seen, l.status,
                    p.model, p.storage_gb, p.battery_health, p.icloud_locked, p.damage_json, p.confidence, p.carrier_locked, p.screen_replaced, l.description
             FROM listings l
             LEFT JOIN parsed_attrs p ON p.listing_id = l.id
             ORDER BY l.first_seen DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            let id: i64 = row.get(0)?;
            let damage_json: Option<String> = row.get(15)?;
            let damage: Vec<String> = damage_json
                .as_deref()
                .and_then(|s| serde_json::from_str(s).ok())
                .unwrap_or_default();
            Ok((id, serde_json::json!({
                "id": id,
                "source": row.get::<_, String>(1)?,
                "external_id": row.get::<_, String>(2)?,
                "url": row.get::<_, String>(3)?,
                "title": row.get::<_, String>(4)?,
                "price": row.get::<_, Option<i64>>(5)?.map(|c| c as f64 / 100.0).unwrap_or(0.0),
                "location": row.get::<_, Option<String>>(6)?,
                "seller": row.get::<_, Option<String>>(7)?,
                "first_seen": row.get::<_, String>(8)?,
                "status": row.get::<_, String>(10)?,
                "model": row.get::<_, Option<String>>(11)?,
                "storage": row.get::<_, Option<i64>>(12)?.unwrap_or(0),
                "battery": row.get::<_, Option<i64>>(13)?,
                "icloud": row.get::<_, Option<i64>>(14)?.map(|v| v == 1).unwrap_or(false),
                "damage": damage,
                "confidence": row.get::<_, Option<f64>>(16)?.unwrap_or(0.0),
                "carrier_locked": row.get::<_, Option<i64>>(17)?.map(|v| v == 1).unwrap_or(false),
                "screen_replaced": row.get::<_, Option<i64>>(18)?.map(|v| v == 1).unwrap_or(false),
                "description": row.get::<_, Option<String>>(19)?.unwrap_or_default(),
            })))
        })?;
        let mut out = Vec::new();
        for r in rows {
            let (id, mut v) = r?;
            // Fetch images for this listing
            let mut img_stmt = conn.prepare("SELECT local_path, url FROM listing_images WHERE listing_id = ?1 ORDER BY id ASC")?;
            let img_rows = img_stmt.query_map(rusqlite::params![id], |ir| {
                Ok(serde_json::json!({
                    "local_path": ir.get::<_, String>(0)?,
                    "url": ir.get::<_, String>(1)?,
                }))
            })?;
            let mut imgs = Vec::new();
            for ir in img_rows { if let Ok(i) = ir { imgs.push(i); } }
            v["images"] = serde_json::json!(imgs);
            out.push(v);
        }
        Ok(out)
    }

    pub fn clear_listings(&self) -> Result<usize> {
        let conn = self.conn.lock().unwrap();
        let count: usize = conn
            .query_row("SELECT COUNT(*) FROM listings", [], |r| r.get::<_, i64>(0))
            .unwrap_or(0) as usize;
        conn.execute("DELETE FROM listings", [])?;
        Ok(count)
    }

    pub fn save_manual_listing(&self, data: &serde_json::Value) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let title = data.get("title").and_then(|v| v.as_str()).unwrap_or("Ručni unos").to_string();
        let model = data.get("model").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let storage = data.get("storage").and_then(|v| v.as_i64()).unwrap_or(0);
        let price = data.get("price").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let location = data.get("location").and_then(|v| v.as_str()).map(|s| s.to_string());
        let seller = data.get("seller").and_then(|v| v.as_str()).map(|s| s.to_string());
        let description = data.get("description").and_then(|v| v.as_str()).map(|s| s.to_string());
        let battery = data.get("battery").and_then(|v| v.as_i64());
        let icloud = data.get("icloud").and_then(|v| v.as_bool()).unwrap_or(false);
        let carrier_locked = data.get("carrier_locked").and_then(|v| v.as_bool()).unwrap_or(false);
        let screen_replaced = data.get("screen_replaced").and_then(|v| v.as_bool()).unwrap_or(false);
        let damage: Vec<String> = data.get("damage").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect()).unwrap_or_default();
        let external_id = format!("manual-{}", chrono::Utc::now().timestamp_millis());
        let price_cents = if price > 0.0 { Some((price * 100.0) as i64) } else { None };
        let url = format!("manual://{}", external_id);
        conn.execute(
            "INSERT INTO listings (source, external_id, url, title, price_cents, location, seller, description, first_seen, last_seen, status)
             VALUES ('manual', ?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'), datetime('now'), 'new')",
            rusqlite::params![external_id, url, title, price_cents, location, seller, description],
        )?;
        let id: i64 = conn.query_row("SELECT id FROM listings WHERE source='manual' AND external_id=?1", rusqlite::params![external_id], |r| r.get(0))?;
        let attrs = crate::extract::ExtractedAttrs {
            model: if model.is_empty() { None } else { Some(model) },
            storage_gb: if storage > 0 { Some(storage) } else { None },
            battery_health: battery,
            icloud_locked: Some(icloud),
            carrier_locked: Some(carrier_locked),
            screen_replaced: Some(screen_replaced),
            damage,
            confidence: 1.0,
            extractor: "manual".to_string(),
        };
        drop(conn);
        let _ = self.upsert_attrs(id, &attrs);
        Ok(id)
    }

    pub fn list_parts_prices(&self) -> Result<Vec<serde_json::Value>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT model, part, quality, price_eur, labor_eur, supplier, note, updated_at FROM parts_prices ORDER BY model, part, quality")?;
        let rows = stmt.query_map([], |r| {
            Ok(serde_json::json!({
                "model": r.get::<_, String>(0)?,
                "part": r.get::<_, String>(1)?,
                "quality": r.get::<_, String>(2)?,
                "price_eur": r.get::<_, f64>(3)?,
                "labor_eur": r.get::<_, f64>(4)?,
                "supplier": r.get::<_, Option<String>>(5)?,
                "note": r.get::<_, Option<String>>(6)?,
                "updated_at": r.get::<_, String>(7)?,
            }))
        })?;
        let mut out = Vec::new();
        for r in rows { out.push(r?); }
        Ok(out)
    }

    pub fn upsert_part_price(&self, item: &serde_json::Value) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let model = item.get("model").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
        let part = item.get("part").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
        if model.is_empty() || part.is_empty() { return Ok(()); }
        let quality = item.get("quality").and_then(|v| v.as_str()).unwrap_or("standard").to_string();
        let price_eur = item.get("price_eur").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let labor_eur = item.get("labor_eur").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let supplier = item.get("supplier").and_then(|v| v.as_str()).map(|s| s.to_string());
        let note = item.get("note").and_then(|v| v.as_str()).map(|s| s.to_string());
        conn.execute(
            "INSERT INTO parts_prices (model, part, quality, price_eur, labor_eur, supplier, note, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))
             ON CONFLICT(model, part, quality) DO UPDATE SET
               price_eur=excluded.price_eur, labor_eur=excluded.labor_eur, supplier=excluded.supplier, note=excluded.note, updated_at=datetime('now')",
            rusqlite::params![model, part, quality, price_eur, labor_eur, supplier, note],
        )?;
        Ok(())
    }

    pub fn delete_part_price(&self, model: &str, part: &str, quality: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM parts_prices WHERE model=?1 AND part=?2 AND quality=?3", rusqlite::params![model, part, quality])?;
        Ok(())
    }
}
