CREATE TABLE IF NOT EXISTS builder_documents (
  doc_key TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  document_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS builder_media_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  r2_key TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_builder_media_assets_created ON builder_media_assets(created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS builder_bootstrap_state (
  bootstrap_key TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);
