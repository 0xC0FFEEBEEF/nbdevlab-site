ALTER TABLE projects ADD COLUMN links_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE projects ADD COLUMN detail_cards_json TEXT NOT NULL DEFAULT '[]';
