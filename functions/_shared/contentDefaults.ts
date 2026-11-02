export const contentSyncKey = 'site.content_sync.v3'

export const targetSiteSettings = {
  homeEyebrow: '',
  homeTitle: 'Hello There',
  homeTagline: 'I build and document homelab infrastructure, self-hosted services, and hands-on systems projects.',
  homeIntro:
    "I build and document real homelab infrastructure around Proxmox, self-hosted services, monitoring, security, automation, and live operational visibility. nbdevlab is where I share what I'm running, what I'm learning, and what I'm building next.",
  contactIntro:
    'Have a question, want to talk homelab infrastructure, or just want to reach out? Send me a message below or contact me directly.',
  maintenanceMessage:
    'The lab is under maintenance right now. Live server status is temporarily unavailable, and the status page will show maintenance placeholders until everything is back up.',
  statusPowerMode: 'live',
  location: 'Mississippi, USA',
} as const

export const legacySiteSettings = {
  homeEyebrow: ['Homepage'],
  homeTitle: ['nbdevlab'],
  homeTagline: ['', 'Homelab builder, infrastructure tinkerer, and systems-focused problem solver.'],
  homeIntro: ['Homepage cards are managed from Admin so you can build your own layout blocks.'],
  contactIntro: ['Use the form below or contact me directly.', 'Use the form below or reach out directly.'],
  location: ['', 'Mississippi'],
} as const

export const targetHomeCardBodies = {
  '/about': {
    body: 'Who I am, what I do, and why I built this lab.',
    legacyBodies: ['Engineering focused on clarity, maintainability, and shipping quality systems.'],
  },
  '/projects': {
    body: "The systems, services, and experiments I'm actively building.",
    legacyBodies: ['Browse published builds and experiments.'],
  },
  '/skills': {
    body: 'The tools, platforms, and capabilities behind the lab.',
    legacyBodies: ['Frontend, backend, and cloud platform capabilities.'],
  },
  '/contact': {
    body: 'Ways to reach me directly or send a message.',
    legacyBodies: ['Send a message or use direct contact details.'],
  },
} as const

export const targetProjectProfiles = {
  aicms: {
    aliases: ['aicms', 'ai cms', 'ai-cms'],
    slug: 'aicms',
    title: 'AICMS',
    summary:
      "AICMS is a project I'm building to help my AI understand my infrastructure the way I do. It scans my VMs, services, and hypervisors, figures out how they relate to each other, and helps turn that raw technical data into clean project descriptions, reports, and website-ready content. It's basically my attempt to merge homelab discovery, AI-assisted documentation, and project publishing into one system.",
    tech: ['AI', 'LLM', 'Proxmox', 'LXC', 'VM', 'CLI'],
    demoUrl: null,
    repoUrl: null,
    legacyTitles: [] as string[],
    legacySummaries: [] as string[],
  },
  pveDashboard: {
    aliases: ['proxmox dashboard', 'proxmox-dashboard', 'pve dashboard', 'pve-dashboard'],
    slug: 'proxmox-dashboard',
    title: 'PVE Dashboard',
    summary:
      'A custom dashboard project built to surface the real state of my Proxmox environment in a cleaner, more public-facing way. Instead of living only inside the default hypervisor interface, this project is meant to show node placement, VM state, uptime, storage usage, and service health in a format that feels closer to an operations portal.',
    tech: ['Proxmox', 'Dashboard', 'Monitoring', 'Telemetry', 'Operations'],
    demoUrl: null,
    repoUrl: null,
    legacyTitles: ['Proxmox Dashboard'],
    legacySummaries: [
      'A custom dashboard project built to surface the real state of my Proxmox environment in a cleaner, more public-facing way. Instead of living only inside the default hypervisor interface, this project is meant to show node placement, VM state, uptime, storage usage, and service health in a format that feels closer to an operations portal.',
    ],
  },
  computeExperiments: {
    aliases: ['compute experiments', 'compute-experiments'],
    slug: 'compute-experiments',
    title: 'Compute Experiments',
    summary:
      'A branch of the lab focused on distributed or monetized compute experiments, including systems like Golem, Golem2, and Hivello. This includes background compute workloads like Golem and Golem2, which can intentionally use spare lab resources to earn a small amount of GLM when primary systems are not under heavy active use. These projects explore whether spare hardware and virtualized resources can be turned into something productive beyond traditional hosting.',
    tech: ['Distributed Compute', 'Golem', 'Hivello', 'Experiments', 'Virtualization'],
    demoUrl: null,
    repoUrl: null,
    legacyTitles: [] as string[],
    legacySummaries: [
      'A branch of the lab focused on distributed or monetized compute experiments, including systems like Golem, Golem2, and Hivello. These projects explore whether spare hardware and virtualized resources can be turned into something productive beyond traditional hosting.',
    ],
  },
  cloudflareTunnelZeroTrustAccess: {
    aliases: [
      'cloudflare tunnel / zero trust access',
      'cloudflare tunnel zero trust access',
      'cloudflare-tunnel-zero-trust-access',
    ],
    slug: 'cloudflare-tunnel-zero-trust-access',
    title: 'Cloudflare Tunnel / Zero Trust Access',
    summary:
      'A core part of how I securely reach internal lab resources from outside the network. I use Cloudflare Zero Trust to protect and publish selected services such as Nextcloud, Technitium DNS, Proxmox-related systems, and remote Windows lab access, giving me controlled external access without directly exposing the full environment.',
    tech: ['Cloudflare Tunnel', 'Zero Trust', 'Remote Access', 'Access Control', 'Networking'],
    demoUrl: null,
    repoUrl: null,
    legacyTitles: [] as string[],
    legacySummaries: [
      'A core part of how I securely reach internal lab resources from outside the network. I use Cloudflare Zero Trust to protect and publish selected services such as Nextcloud, Technitium DNS, Proxmox-related systems, and remote Windows lab access, which gives me controlled external access without directly exposing the full environment.',
    ],
  },
} as const
