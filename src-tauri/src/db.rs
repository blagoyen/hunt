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
        Ok(())
    }

    pub fn upsert_listing(&self, s: &crate::scrape::ScrapedListing) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let price_cents = s.price.map(|p| (p * 100.0) as i64);
        conn.execute(
            "INSERT INTO listings (source, external_id, url, title, price_cents, location, seller, first_seen, last_seen, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'), datetime('now'), 'new')
             ON CONFLICT(source, external_id) DO UPDATE SET
               title = excluded.title,
               price_cents = excluded.price_cents,
               location = excluded.location,
               last_seen = datetime('now')",
            rusqlite::params![
                s.source,
                s.external_id,
                s.url,
                s.title,
                price_cents,
                s.location,
                s.seller
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
            "SELECT id, source, external_id, url, title, price_cents, location, seller, posted_at, first_seen, last_seen, status FROM listings ORDER BY first_seen DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "source": row.get::<_, String>(1)?,
                "external_id": row.get::<_, String>(2)?,
                "url": row.get::<_, String>(3)?,
                "title": row.get::<_, String>(4)?,
                "price": row.get::<_, Option<i64>>(5)?.map(|c| c as f64 / 100.0).unwrap_or(0.0),
                "location": row.get::<_, Option<String>>(6)?,
                "seller": row.get::<_, Option<String>>(7)?,
                "posted_days": 0,
                "status": row.get::<_, String>(11)?,
            }))
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }
}
