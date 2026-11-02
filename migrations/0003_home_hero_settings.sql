ALTER TABLE site_settings ADD COLUMN home_eyebrow TEXT NOT NULL DEFAULT 'Homepage';
ALTER TABLE site_settings ADD COLUMN home_title TEXT NOT NULL DEFAULT 'nbdevlab';
ALTER TABLE site_settings ADD COLUMN home_intro TEXT NOT NULL DEFAULT 'Homepage cards are managed from Admin so you can build your own layout blocks.';

UPDATE site_settings
SET
  home_eyebrow = COALESCE(NULLIF(home_eyebrow, ''), 'Homepage'),
  home_title = COALESCE(NULLIF(home_title, ''), 'nbdevlab'),
  home_intro = COALESCE(
    NULLIF(home_intro, ''),
    'Homepage cards are managed from Admin so you can build your own layout blocks.'
  )
WHERE id = 1;
