ALTER TABLE site_settings ADD COLUMN skills_groups_json TEXT NOT NULL DEFAULT '[]';

UPDATE site_settings
SET skills_groups_json = '[{"id":"skills-infrastructure","title":"Infrastructure","items":["Proxmox","Virtual Machines","LXC","Self-Hosted Services","Backups","DNS","UPS Awareness"]},{"id":"skills-monitoring-operations","title":"Monitoring and Operations","items":["Zabbix","Grafana","Wazuh","Observability","Status Dashboards","Alerting","Systems Visibility"]},{"id":"skills-security-access","title":"Security and Access","items":["Cloudflare Zero Trust","Remote Access","Access Control","Firewall Platforms","Malware Analysis","Segmentation"]},{"id":"skills-development","title":"Development","items":["React","TypeScript","Vite","Cloudflare Workers","Pages Functions","SQL","API Design"]},{"id":"skills-automation-tooling","title":"Automation and Tooling","items":["Deployment Automation","Scripts","Dashboard Tooling","Lab Workflows","Service Integration"]}]'
WHERE skills_groups_json IS NULL
  OR TRIM(skills_groups_json) = ''
  OR TRIM(skills_groups_json) = '[]';
