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
        // Internal devices / service inventory (intake -> repair -> QC -> sale)
        let _ = conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS devices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                imei TEXT,
                serial TEXT,
                model TEXT,
                storage_gb INTEGER,
                color TEXT,
                source_seller TEXT,
                buy_price_eur REAL NOT NULL DEFAULT 0,
                buy_date TEXT,
                buy_notes TEXT,
                status TEXT NOT NULL DEFAULT 'kupljen',
                diagnostics_json TEXT NOT NULL DEFAULT '{}',
                repair_notes TEXT,
                servicer TEXT,
                parts_cost_eur REAL NOT NULL DEFAULT 0,
                hidden_cost_eur REAL NOT NULL DEFAULT 0,
                parts_items_json TEXT NOT NULL DEFAULT '[]',
                qc_json TEXT NOT NULL DEFAULT '{}',
                battery_health INTEGER,
                icloud_clear INTEGER,
                sale_price_eur REAL,
                sale_platform TEXT,
                sale_date TEXT,
                sale_notes TEXT,
                images_before_json TEXT NOT NULL DEFAULT '[]',
                images_after_json TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );"
        );
        let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);", []);
        let _ = conn.execute("ALTER TABLE devices ADD COLUMN previous_status TEXT", []);
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

    // ===== Devices / inventory workflow =====
    fn row_to_device(row: &rusqlite::Row<'_>) -> rusqlite::Result<serde_json::Value> {
        let parse_json = |s: Option<String>, def: &str| -> serde_json::Value {
            serde_json::from_str(&s.unwrap_or_else(|| def.to_string())).unwrap_or_else(|_| serde_json::from_str(def).unwrap_or(serde_json::json!({})))
        };
        let buy = row.get::<_, f64>(6).unwrap_or(0.0);
        let parts = row.get::<_, f64>(13).unwrap_or(0.0);
        let hidden = row.get::<_, f64>(14).unwrap_or(0.0);
        let sale = row.get::<_, Option<f64>>(19).unwrap_or(None);
        let total_cost = buy + parts + hidden;
        let profit = sale.map(|s| s - total_cost);
        let diagnostics_json: Option<String> = row.get(9).ok();
        let parts_items_json: Option<String> = row.get(15).ok();
        let qc_json: Option<String> = row.get(16).ok();
        let images_before_json: Option<String> = row.get(22).ok();
        let images_after_json: Option<String> = row.get(23).ok();
        Ok(serde_json::json!({
            "id": row.get::<_, i64>(0)?,
            "imei": row.get::<_, Option<String>>(1)?,
            "serial": row.get::<_, Option<String>>(2)?,
            "model": row.get::<_, Option<String>>(3)?,
            "storage_gb": row.get::<_, Option<i64>>(4)?,
            "color": row.get::<_, Option<String>>(5)?,
            "buy_price_eur": buy,
            "buy_date": row.get::<_, Option<String>>(7)?,
            "source_seller": row.get::<_, Option<String>>(24)?,
            "buy_notes": row.get::<_, Option<String>>(8)?,
            "status": row.get::<_, String>(10)?,
            "diagnostics": parse_json(diagnostics_json, "{}"),
            "repair_notes": row.get::<_, Option<String>>(11)?,
            "servicer": row.get::<_, Option<String>>(12)?,
            "parts_cost_eur": parts,
            "hidden_cost_eur": hidden,
            "parts_items": parse_json(parts_items_json, "[]"),
            "qc": parse_json(qc_json, "{}"),
            "battery_health": row.get::<_, Option<i64>>(17)?,
            "icloud_clear": row.get::<_, Option<i64>>(18)?.map(|v| v==1),
            "sale_price_eur": sale,
            "sale_platform": row.get::<_, Option<String>>(20)?,
            "sale_date": row.get::<_, Option<String>>(21)?,
            "sale_notes": row.get::<_, Option<String>>(25)?,
            "images_before": parse_json(images_before_json, "[]"),
            "images_after": parse_json(images_after_json, "[]"),
            "created_at": row.get::<_, Option<String>>(26)?,
            "updated_at": row.get::<_, Option<String>>(27)?,
            "previous_status": row.get::<_, Option<String>>(28).unwrap_or(None),
            "total_cost_eur": total_cost,
            "profit_eur": profit,
        }))
    }

    const DEVICE_COLS: &'static str = "id, imei, serial, model, storage_gb, color, buy_price_eur, buy_date, buy_notes, diagnostics_json, status, repair_notes, servicer, parts_cost_eur, hidden_cost_eur, parts_items_json, qc_json, battery_health, icloud_clear, sale_price_eur, sale_platform, sale_date, images_before_json, images_after_json, source_seller, sale_notes, created_at, updated_at, previous_status";

    pub fn list_devices(&self) -> Result<Vec<serde_json::Value>> {
        let conn = self.conn.lock().unwrap();
        let sql = format!("SELECT {} FROM devices ORDER BY updated_at DESC, id DESC", Self::DEVICE_COLS);
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map([], Self::row_to_device)?;
        let mut out = Vec::new();
        for r in rows { out.push(r?); }
        Ok(out)
    }

    pub fn upsert_device(&self, data: &serde_json::Value) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let id = data.get("id").and_then(|v| v.as_i64());
        let imei = data.get("imei").and_then(|v| v.as_str()).map(|s| s.to_string());
        let serial = data.get("serial").and_then(|v| v.as_str()).map(|s| s.to_string());
        let model = data.get("model").and_then(|v| v.as_str()).map(|s| s.to_string());
        let storage_gb = data.get("storage_gb").and_then(|v| v.as_i64());
        let color = data.get("color").and_then(|v| v.as_str()).map(|s| s.to_string());
        let source_seller = data.get("source_seller").and_then(|v| v.as_str()).map(|s| s.to_string());
        let buy_price_eur = data.get("buy_price_eur").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let buy_date = data.get("buy_date").and_then(|v| v.as_str()).map(|s| s.to_string());
        let buy_notes = data.get("buy_notes").and_then(|v| v.as_str()).map(|s| s.to_string());
        let status = data.get("status").and_then(|v| v.as_str()).unwrap_or("kupljen").to_string();
        let diagnostics_json = data.get("diagnostics").map(|v| v.to_string()).unwrap_or_else(|| "{}".to_string());
        let repair_notes = data.get("repair_notes").and_then(|v| v.as_str()).map(|s| s.to_string());
        let servicer = data.get("servicer").and_then(|v| v.as_str()).map(|s| s.to_string());
        let parts_cost_eur = data.get("parts_cost_eur").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let hidden_cost_eur = data.get("hidden_cost_eur").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let parts_items_json = data.get("parts_items").map(|v| v.to_string()).unwrap_or_else(|| "[]".to_string());
        let qc_json = data.get("qc").map(|v| v.to_string()).unwrap_or_else(|| "{}".to_string());
        let battery_health = data.get("battery_health").and_then(|v| v.as_i64());
        let icloud_clear = data.get("icloud_clear").and_then(|v| v.as_bool()).map(|b| if b {1} else {0});
        let sale_price_eur = data.get("sale_price_eur").and_then(|v| v.as_f64());
        let sale_platform = data.get("sale_platform").and_then(|v| v.as_str()).map(|s| s.to_string());
        let sale_date = data.get("sale_date").and_then(|v| v.as_str()).map(|s| s.to_string());
        let sale_notes = data.get("sale_notes").and_then(|v| v.as_str()).map(|s| s.to_string());
        let images_before_json = data.get("images_before").map(|v| v.to_string()).unwrap_or_else(|| "[]".to_string());
        let images_after_json = data.get("images_after").map(|v| v.to_string()).unwrap_or_else(|| "[]".to_string());

        if let Some(dev_id) = id {
            let old_status: Option<String> = conn.query_row("SELECT status FROM devices WHERE id=?1", rusqlite::params![dev_id], |r| r.get(0)).ok();
            let old_prev: Option<String> = conn.query_row("SELECT previous_status FROM devices WHERE id=?1", rusqlite::params![dev_id], |r| r.get(0)).unwrap_or(None);
            let mut prev_to_store = data.get("previous_status").and_then(|v| v.as_str()).map(|s| s.to_string()).or(old_prev);
            if let Some(os) = old_status.as_ref() {
                if os != &status { prev_to_store = Some(os.clone()); }
            }
            conn.execute(
                "UPDATE devices SET imei=?1, serial=?2, model=?3, storage_gb=?4, color=?5, source_seller=?6, buy_price_eur=?7, buy_date=?8, buy_notes=?9, status=?10, diagnostics_json=?11, repair_notes=?12, servicer=?13, parts_cost_eur=?14, hidden_cost_eur=?15, parts_items_json=?16, qc_json=?17, battery_health=?18, icloud_clear=?19, sale_price_eur=?20, sale_platform=?21, sale_date=?22, sale_notes=?23, images_before_json=?24, images_after_json=?25, previous_status=?26, updated_at=datetime('now') WHERE id=?27",
                rusqlite::params![imei, serial, model, storage_gb, color, source_seller, buy_price_eur, buy_date, buy_notes, status, diagnostics_json, repair_notes, servicer, parts_cost_eur, hidden_cost_eur, parts_items_json, qc_json, battery_health, icloud_clear, sale_price_eur, sale_platform, sale_date, sale_notes, images_before_json, images_after_json, prev_to_store, dev_id],
            )?;
            Ok(dev_id)
        } else {
            conn.execute(
                "INSERT INTO devices (imei, serial, model, storage_gb, color, source_seller, buy_price_eur, buy_date, buy_notes, status, diagnostics_json, repair_notes, servicer, parts_cost_eur, hidden_cost_eur, parts_items_json, qc_json, battery_health, icloud_clear, sale_price_eur, sale_platform, sale_date, sale_notes, images_before_json, images_after_json, previous_status, created_at, updated_at)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25,NULL,datetime('now'),datetime('now'))",
                rusqlite::params![imei, serial, model, storage_gb, color, source_seller, buy_price_eur, buy_date, buy_notes, status, diagnostics_json, repair_notes, servicer, parts_cost_eur, hidden_cost_eur, parts_items_json, qc_json, battery_health, icloud_clear, sale_price_eur, sale_platform, sale_date, sale_notes, images_before_json, images_after_json],
            )?;
            Ok(conn.last_insert_rowid())
        }
    }

    pub fn delete_device(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM devices WHERE id=?1", rusqlite::params![id])?;
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
        let mut rows = stmt.query(rusqlite::params![key])?;
        if let Some(row) = rows.next()? { Ok(Some(row.get(0)?)) } else { Ok(None) }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.execute("INSERT INTO settings(key,value) VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value", rusqlite::params![key, value])?;
        Ok(())
    }

    pub fn revert_device_status(&self, id: i64) -> Result<Option<String>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let (status, prev): (String, Option<String>) = conn.query_row("SELECT status, previous_status FROM devices WHERE id=?1", rusqlite::params![id], |r| Ok((r.get(0)?, r.get(1)?)))?;
        if let Some(p) = prev.clone() {
            conn.execute("UPDATE devices SET status=?1, previous_status=?2, updated_at=datetime('now') WHERE id=?3", rusqlite::params![p, status, id])?;
        }
        Ok(prev)
    }
}
