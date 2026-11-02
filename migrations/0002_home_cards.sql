CREATE TABLE IF NOT EXISTS home_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subtitle TEXT,
  body TEXT,
  cta_label TEXT,
  cta_url TEXT,
  width_units INTEGER NOT NULL DEFAULT 1,
  height_units INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible INTEGER NOT NULL DEFAULT 1 CHECK (is_visible IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_home_cards_order ON home_cards(sort_order, id);
CREATE INDEX IF NOT EXISTS idx_home_cards_visible ON home_cards(is_visible, sort_order);

INSERT INTO home_cards (
  title,
  subtitle,
  body,
  cta_label,
  cta_url,
  width_units,
  height_units,
  sort_order,
  is_visible,
  created_at,
  updated_at
)
SELECT
  seed.title,
  seed.subtitle,
  seed.body,
  seed.cta_label,
  seed.cta_url,
  seed.width_units,
  seed.height_units,
  seed.sort_order,
  seed.is_visible,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (
  SELECT 'About' AS title, 'Who I am' AS subtitle, 'Engineering focused on clarity, maintainability, and shipping quality systems.' AS body, 'Open About' AS cta_label, '/about' AS cta_url, 2 AS width_units, 1 AS height_units, 1 AS sort_order, 1 AS is_visible
  UNION ALL
  SELECT 'Projects', 'Recent work', 'Browse published builds and experiments.', 'Open Projects', '/projects', 2, 1, 2, 1
  UNION ALL
  SELECT 'Skills', 'Toolbox', 'Frontend, backend, and cloud platform capabilities.', 'Open Skills', '/skills', 1, 1, 3, 1
  UNION ALL
  SELECT 'Contact', 'Reach out', 'Send a message or use direct contact details.', 'Open Contact', '/contact', 1, 1, 4, 1
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM home_cards);
