ALTER TABLE site_settings ADD COLUMN maintenance_mode INTEGER NOT NULL DEFAULT 0;
ALTER TABLE site_settings ADD COLUMN maintenance_message TEXT NOT NULL DEFAULT '';
