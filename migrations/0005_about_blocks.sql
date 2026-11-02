ALTER TABLE site_settings ADD COLUMN about_blocks_json TEXT NOT NULL DEFAULT '[]';

UPDATE site_settings
SET about_blocks_json = '[
  {"id":"about-intro","type":"paragraph","content":"Hey, I''m Nathan. I''m someone who genuinely loves learning how systems work, building things from the ground up, and pushing myself into projects that force me to grow. A lot of that energy ends up in my homelab, where I experiment with virtualization, monitoring, security, automation, and self-hosted services."},
  {"id":"about-it","type":"paragraph","content":"I work in IT, balance school alongside hands-on technical work, and spend a lot of my free time building systems that help me learn by doing. I''m especially drawn to infrastructure, Linux, virtualization, security tooling, automation, and the kind of work that turns a pile of hardware and ideas into something useful and reliable."},
  {"id":"about-record","type":"paragraph","content":"nbdevlab is more than a portfolio site for me. It''s a living record of the systems I build, the mistakes I learn from, and the ideas I keep expanding. Some projects are practical, some are experimental, and some are just here because I think they''re fun, but all of them reflect how I learn best: by building real things."},
  {"id":"about-growth","type":"paragraph","content":"Long term, I want to keep growing into deeper infrastructure, systems, and engineering work. It''s the kind of role where I can build, secure, automate, and improve real environments at scale. I care a lot about practical knowledge, doing things the right way, and becoming someone people can trust with important systems."},
  {"id":"about-outside-work","type":"paragraph","content":"Outside of work and lab projects, I also enjoy gaming, D&D, and spending time with friends and family. I like technology because it''s useful, creative, and honestly just fun, and a lot of this site comes from that same mindset."}
]'
WHERE id = 1
  AND (
    about_blocks_json IS NULL
    OR TRIM(about_blocks_json) = ''
    OR TRIM(about_blocks_json) = '[]'
  );
