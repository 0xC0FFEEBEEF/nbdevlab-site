ALTER TABLE projects ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0;

UPDATE projects
SET is_featured = 1
WHERE lower(slug) IN (
    'aicms',
    'proxmox-dashboard',
    'cryo-ai',
    'home-assistant',
    'wazuh',
    'cloudflare-tunnel-zero-trust-access'
  )
  OR lower(title) IN (
    'aicms',
    'proxmox dashboard',
    'pve dashboard',
    'cryo-ai',
    'cryo ai',
    'home assistant',
    'wazuh',
    'cloudflare tunnel / zero trust access',
    'cloudflare tunnel zero trust access'
  );
