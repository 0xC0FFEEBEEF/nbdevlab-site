import { projectIdentityMatches } from '../../shared/projectIdentity'

interface DefaultProjectSeed {
  slug: string
  title: string
  summary: string
  tech: string[]
  demoUrl: string | null
  repoUrl: string | null
  isFeatured?: boolean
  aliases?: string[]
}

export const defaultProjectSeeds: readonly DefaultProjectSeed[] = [
  {
    slug: 'aicms',
    title: 'AICMS',
    summary:
      "AICMS is a project I'm building to help my AI understand my infrastructure the way I do. It scans my VMs, services, and hypervisors, figures out how they relate to each other, and helps turn that raw technical data into clean project descriptions, reports, and website-ready content. It's basically my attempt to merge homelab discovery, AI-assisted documentation, and project publishing into one system.",
    tech: ['AI', 'LLM', 'Proxmox', 'LXC', 'VM', 'CLI'],
    demoUrl: null,
    repoUrl: null,
    isFeatured: true,
    aliases: ['AI CMS', 'AI-CMS'],
  },
  {
    slug: 'byteme2-byteme3',
    title: 'Byteme2 & Byteme3',
    summary:
      'Byteme2 and Byteme3 are the foundation of my lab. Byteme2 is my primary Proxmox compute node and runs most of the day-to-day services, while Byteme3 is used mainly for backup and overflow workloads. Together they form the backbone of my self-hosted environment for virtualization, monitoring, security, storage, and remote access.',
    tech: ['Proxmox', 'Virtualization', 'Compute', 'Backup', 'Self-Hosted'],
    demoUrl: null,
    repoUrl: null,
  },
  {
    slug: 'proxmox-dashboard',
    title: 'PVE Dashboard',
    summary:
      'A custom dashboard project built to surface the real state of my Proxmox environment in a cleaner, more public-facing way. Instead of living only inside the default hypervisor interface, this project is meant to show node placement, VM state, uptime, storage usage, and service health in a format that feels closer to an operations portal.',
    tech: ['Proxmox', 'Dashboard', 'Monitoring', 'Telemetry', 'Operations'],
    demoUrl: null,
    repoUrl: null,
    isFeatured: true,
    aliases: ['Proxmox Dashboard', 'proxmox-dashboard', 'pve-dashboard'],
  },
  {
    slug: 'nextcloud',
    title: 'Nextcloud',
    summary:
      'My private cloud platform for file storage, sync, and self-hosted collaboration. This replaced my older ownCloud setup and gives me a more complete long-term platform for managing personal data, lab files, and shared access across devices. It is one of the services I publish securely through Cloudflare Zero Trust so I can reach it remotely without opening up my internal network.',
    tech: ['Nextcloud', 'Cloudflare Zero Trust', 'Storage', 'Sync', 'Self-Hosted'],
    demoUrl: null,
    repoUrl: null,
  },
  {
    slug: 'gitea',
    title: 'Gitea',
    summary:
      'My self-hosted Git platform for source control, internal repositories, and project organization. I use it to keep code, scripts, configs, and experiments under my own control while building a more independent development workflow inside the lab.',
    tech: ['Gitea', 'Git', 'Source Control', 'Dev Workflow', 'Self-Hosted'],
    demoUrl: null,
    repoUrl: null,
  },
  {
    slug: 'cryo-ai',
    title: 'Cryo-AI',
    summary:
      'A dedicated AI-focused VM for running local models, experimenting with offline AI workflows, and developing private automation ideas without depending completely on cloud-hosted tools. It plays a big role in my long-term vision of building a local assistant that can help with coding, analysis, and infrastructure tasks inside my own environment.',
    tech: ['AI', 'Local Models', 'Automation', 'VM', 'Private Workflows'],
    demoUrl: null,
    repoUrl: null,
    isFeatured: true,
  },
  {
    slug: 'ai-sandbox',
    title: 'AI-Sandbox',
    summary:
      'A separate experimental environment for testing AI tools, model behavior, and automation ideas in isolation. This gives me a safe place to try new workflows without risking more important services in the lab.',
    tech: ['AI', 'Sandbox', 'Testing', 'Automation', 'Isolation'],
    demoUrl: null,
    repoUrl: null,
  },
  {
    slug: 'mcp',
    title: 'MCP',
    summary:
      'A tooling bridge for controlled interaction between AI workflows and the rest of my infrastructure. This project fits into the bigger goal of making my lab more interactive, where services and assistants can eventually perform useful actions through structured tools instead of just generating text.',
    tech: ['MCP', 'AI Tooling', 'Automation', 'Infrastructure', 'Integration'],
    demoUrl: null,
    repoUrl: null,
  },
  {
    slug: 'archangel',
    title: 'Archangel',
    summary:
      'My Arch Linux VM and one of my main personal working environments. It has served as a Linux workstation, development box, and cross-platform bridge for projects involving Rider, Syncthing, remote workflows, and experimentation outside of my Windows systems.',
    tech: ['Arch Linux', 'Workstation', 'Development', 'Rider', 'Syncthing'],
    demoUrl: null,
    repoUrl: null,
  },
  {
    slug: 'wazuh',
    title: 'Wazuh',
    summary:
      'My primary security monitoring platform. I use Wazuh to centralize security events, improve visibility across systems, and build real detection and analysis capability into the lab instead of treating security as an afterthought.',
    tech: ['Wazuh', 'Security', 'SIEM', 'Monitoring', 'Detection'],
    demoUrl: null,
    repoUrl: null,
    isFeatured: true,
  },
  {
    slug: 'zabbix',
    title: 'Zabbix',
    summary:
      'My infrastructure monitoring layer for watching servers, services, and system health across the environment. Zabbix helps me track performance, availability, and trends so I can catch issues early and build more reliable infrastructure.',
    tech: ['Zabbix', 'Monitoring', 'Infrastructure', 'Performance', 'Availability'],
    demoUrl: null,
    repoUrl: null,
  },
  {
    slug: 'grafana',
    title: 'Grafana',
    summary:
      'The visualization layer for my homelab. Grafana turns raw metrics and logs into dashboards that are actually useful, helping me monitor infrastructure health, service behavior, and long-term trends in a way that feels more like a real operations center.',
    tech: ['Grafana', 'Dashboards', 'Observability', 'Metrics', 'Visualization'],
    demoUrl: null,
    repoUrl: null,
  },
  {
    slug: 'home-assistant',
    title: 'Home Assistant',
    summary:
      'One of the most personal projects in my lab. I use Home Assistant as the automation brain for weather alerts, sensor data, voice announcements, environmental monitoring, and smart-home logic. It has grown well beyond simple home automation and has become a platform for real-time decision making, alerting, and experimentation.',
    tech: ['Home Assistant', 'Automation', 'Sensors', 'Alerts', 'Smart Home'],
    demoUrl: null,
    repoUrl: null,
    isFeatured: true,
  },
  {
    slug: 'technitium-dns',
    title: 'Technitium DNS',
    summary:
      'My self-hosted DNS platform for local network control, privacy, and cleaner name resolution across the lab. It fits into my larger goal of making the network easier to manage and more independent from default ISP or consumer-grade behavior. It is also one of the internal services I publish securely through Cloudflare Zero Trust for remote administrative access.',
    tech: ['Technitium DNS', 'DNS', 'Cloudflare Zero Trust', 'Networking', 'Self-Hosted'],
    demoUrl: null,
    repoUrl: null,
  },
  {
    slug: 'pi-hole',
    title: 'Pi-hole',
    summary:
      'A network-wide filtering service for blocking ads, trackers, and other junk at the DNS level. It improves everyday quality of life in the lab while also giving me more insight into how devices behave on the network.',
    tech: ['Pi-hole', 'DNS', 'Ad Blocking', 'Privacy', 'Network Filtering'],
    demoUrl: null,
    repoUrl: null,
  },
  {
    slug: 'proxmox-backup-server',
    title: 'Proxmox Backup Server',
    summary:
      'My backup platform for protecting virtual machines, containers, and critical lab services. It gives me a more serious recovery path and supports the bigger goal of treating the homelab like real infrastructure instead of disposable experiments.',
    tech: ['Proxmox Backup Server', 'Backup', 'Recovery', 'Proxmox', 'Infrastructure'],
    demoUrl: null,
    repoUrl: null,
  },
  {
    slug: 'proxmox-mail-gateway',
    title: 'Proxmox Mail Gateway',
    summary:
      'A mail-security lab project focused on filtering, hygiene, and email protection. It gives me hands-on experience with spam filtering, mail flow, and security controls in a way that ties directly into real-world infrastructure work.',
    tech: ['Proxmox Mail Gateway', 'Mail Security', 'Spam Filtering', 'Email', 'Security'],
    demoUrl: null,
    repoUrl: null,
  },
  {
    slug: 'firewall-lab',
    title: 'Firewall Lab',
    summary:
      'A multi-platform firewall and routing lab built around pfSense, OPNsense, and FortiGate. This part of my environment exists to help me compare platforms, practice secure network design, and gain hands-on experience with routing, segmentation, filtering, VPNs, and enterprise-style edge security.',
    tech: ['pfSense', 'OPNsense', 'FortiGate', 'Firewall', 'Networking'],
    demoUrl: null,
    repoUrl: null,
  },
  {
    slug: 'remnux',
    title: 'REMnux',
    summary:
      'A dedicated malware analysis and reverse-engineering lab VM. I use it as a safe environment for learning and experimenting on the security side of the lab without mixing that work into my general-purpose systems.',
    tech: ['REMnux', 'Malware Analysis', 'Reverse Engineering', 'Security', 'Lab VM'],
    demoUrl: null,
    repoUrl: null,
  },
  {
    slug: 'cloudflare-tunnel-zero-trust-access',
    title: 'Cloudflare Tunnel / Zero Trust Access',
    summary:
      'A core part of how I securely reach internal lab resources from outside the network. I use Cloudflare Zero Trust to protect and publish selected services such as Nextcloud, Technitium DNS, Proxmox-related systems, and remote Windows lab access, giving me controlled external access without directly exposing the full environment.',
    tech: ['Cloudflare Tunnel', 'Zero Trust', 'Remote Access', 'Access Control', 'Networking'],
    demoUrl: null,
    repoUrl: null,
    isFeatured: true,
  },
  {
    slug: 'windows-lab-fleet',
    title: 'Windows Lab Fleet',
    summary:
      'A collection of Windows Server and Windows 11 virtual machines used for remote access testing, administration practice, system validation, and Microsoft-side infrastructure work. These systems let me build hands-on experience with Windows environments inside Proxmox, and selected systems are reached securely through Cloudflare Zero Trust.',
    tech: ['Windows Server', 'Windows 11', 'Remote Access', 'Proxmox', 'Lab VMs'],
    demoUrl: null,
    repoUrl: null,
  },
  {
    slug: 'web-platform-lab',
    title: 'Web Platform Lab',
    summary:
      'A self-hosted CMS playground built around WordPress and Drupal. This part of the lab is for testing web platforms, deployment workflows, plugin/module behavior, and the realities of maintaining content systems on infrastructure I control.',
    tech: ['WordPress', 'Drupal', 'CMS', 'Self-Hosted', 'Web Platforms'],
    demoUrl: null,
    repoUrl: null,
  },
  {
    slug: 'compute-experiments',
    title: 'Compute Experiments',
    summary:
      'A branch of the lab focused on distributed or monetized compute experiments, including systems like Golem, Golem2, and Hivello. This includes background compute workloads like Golem and Golem2, which can intentionally use spare lab resources to earn a small amount of GLM when primary systems are not under heavy active use. These projects explore whether spare hardware and virtualized resources can be turned into something productive beyond traditional hosting.',
    tech: ['Distributed Compute', 'Golem', 'Hivello', 'Experiments', 'Virtualization'],
    demoUrl: null,
    repoUrl: null,
  },
  {
    slug: '5etools',
    title: '5eTools',
    summary:
      'My dedicated D&D VM. It is a fun but very real example of how I use the lab to support actual hobbies, not just infrastructure practice. It lets me host tools I care about on systems I manage myself, which is a big part of why I enjoy self-hosting in the first place.',
    tech: ['5eTools', 'D&D', 'Self-Hosted', 'Hobby Project', 'VM'],
    demoUrl: null,
    repoUrl: null,
  },
  {
    slug: 'sentinel',
    title: 'Sentinel',
    summary:
      "Sentinel was my original Wazuh VM and served as an early step in building out the lab's security monitoring side. It is no longer in use, but it was part of the path that led to my current Wazuh setup.",
    tech: ['Wazuh', 'Security', 'Legacy', 'Monitoring', 'Homelab History'],
    demoUrl: null,
    repoUrl: null,
  },
]

export async function ensureDefaultProjects(db: D1Database): Promise<void> {
  const seedAction = 'project.defaults.seeded.v1'
  const hasSeedRun = await db
    .prepare('SELECT id FROM admin_audit WHERE action = ? LIMIT 1')
    .bind(seedAction)
    .first<{ id: number }>()

  if (hasSeedRun) {
    return
  }

  if (defaultProjectSeeds.length === 0) {
    return
  }

  const existingRows = await db
    .prepare('SELECT id, slug, title FROM projects')
    .all<{ id: number; slug: string; title: string }>()

  const existingProjects = existingRows.results ?? []
  const usedProjectIds = new Set<number>()
  const missingProjects = defaultProjectSeeds.filter((project) => {
    const aliases = [project.slug, project.title, ...(project.aliases ?? [])]
    const matchedProject = existingProjects.find(
      (row) =>
        !usedProjectIds.has(row.id) && projectIdentityMatches([row.slug, row.title], aliases),
    )

    if (matchedProject) {
      usedProjectIds.add(matchedProject.id)
      return false
    }

    return true
  })

  if (missingProjects.length === 0) {
    return
  }

  const currentSort = await db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM projects')
    .first<{ max_sort: number }>()

  const timestamp = new Date().toISOString()
  let nextSortOrder = Number(currentSort?.max_sort ?? 0)

  const statements = missingProjects.map((project) =>
    db
      .prepare(
        `INSERT INTO projects
          (slug, title, summary, tech_json, demo_url, repo_url, status, publish_at, is_featured, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'published', NULL, ?, ?, ?, ?)`,
      )
      .bind(
        project.slug,
        project.title,
        project.summary,
        JSON.stringify(project.tech),
        project.demoUrl,
        project.repoUrl,
        project.isFeatured ? 1 : 0,
        nextSortOrder += 1,
        timestamp,
        timestamp,
      ),
  )

  if (statements.length > 0) {
    await db.batch(statements)
  }

  await db
    .prepare('INSERT INTO admin_audit (action, metadata_json, created_at) VALUES (?, ?, ?)')
    .bind(seedAction, JSON.stringify({ inserted: missingProjects.map((project) => project.slug) }), timestamp)
    .run()
}
