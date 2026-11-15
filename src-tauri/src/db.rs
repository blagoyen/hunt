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
}
