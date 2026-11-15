CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  price_cents INTEGER,
  price_eur_cents INTEGER,
  location TEXT,
  seller TEXT,
  posted_at TEXT,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  UNIQUE(source, external_id)
);

CREATE TABLE IF NOT EXISTS listing_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
  fetched_at TEXT NOT NULL,
  price_cents INTEGER,
  content_hash TEXT
);

CREATE TABLE IF NOT EXISTS listing_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  local_path TEXT,
  dhash INTEGER,
  phash INTEGER
);

CREATE TABLE IF NOT EXISTS parsed_attrs (
  listing_id INTEGER PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  model TEXT,
  storage_gb INTEGER,
  color TEXT,
  battery_health INTEGER,
  icloud_locked INTEGER,
  carrier_locked INTEGER,
  damage_json TEXT,
  screen_replaced INTEGER,
  extractor TEXT,
  confidence REAL
);

CREATE VIRTUAL TABLE IF NOT EXISTS listings_fts USING fts5(
  title, description, content='listings', content_rowid='id'
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
