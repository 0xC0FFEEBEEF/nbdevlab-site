ALTER TABLE site_settings ADD COLUMN home_tagline TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS content_sync_state (
  sync_key TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

