export type SkillGroup = {
  id: string
  title: string
  items: string[]
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeId(value: string, fallbackPrefix: string, index: number): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || `${fallbackPrefix}-${index + 1}`
}

export const defaultSkillGroups: readonly SkillGroup[] = [
  {
    id: 'skills-infrastructure',
    title: 'Infrastructure',
    items: ['Proxmox', 'Virtual Machines', 'LXC', 'Self-Hosted Services', 'Backups', 'DNS', 'UPS Awareness'],
  },
  {
    id: 'skills-monitoring-operations',
    title: 'Monitoring and Operations',
    items: ['Zabbix', 'Grafana', 'Wazuh', 'Observability', 'Status Dashboards', 'Alerting', 'Systems Visibility'],
  },
  {
    id: 'skills-security-access',
    title: 'Security and Access',
    items: ['Cloudflare Zero Trust', 'Remote Access', 'Access Control', 'Firewall Platforms', 'Malware Analysis', 'Segmentation'],
  },
  {
    id: 'skills-development',
    title: 'Development',
    items: ['React', 'TypeScript', 'Vite', 'Cloudflare Workers', 'Pages Functions', 'SQL', 'API Design'],
  },
  {
    id: 'skills-automation-tooling',
    title: 'Automation and Tooling',
    items: ['Deployment Automation', 'Scripts', 'Dashboard Tooling', 'Lab Workflows', 'Service Integration'],
  },
] as const

export function normalizeSkillGroups(input: unknown): SkillGroup[] {
  if (!Array.isArray(input)) {
    return []
  }

  const groups: SkillGroup[] = []

  input.forEach((item, index) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return
    }

    const title = asTrimmedString((item as { title?: unknown }).title)
    const rawItems = (item as { items?: unknown }).items
    const items = Array.isArray(rawItems)
      ? rawItems.map((value) => asTrimmedString(value)).filter(Boolean)
      : []

    if (!title) {
      return
    }

    groups.push({
      id: normalizeId(asTrimmedString((item as { id?: unknown }).id), 'skills-group', index),
      title,
      items,
    })
  })

  return groups
}

export function parseSkillGroups(raw: string | null): SkillGroup[] {
  const trimmed = raw?.trim() ?? ''
  if (!trimmed) {
    return defaultSkillGroups.map((group) => ({ ...group, items: [...group.items] }))
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (!Array.isArray(parsed)) {
      return defaultSkillGroups.map((group) => ({ ...group, items: [...group.items] }))
    }

    return normalizeSkillGroups(parsed)
  } catch {
    return defaultSkillGroups.map((group) => ({ ...group, items: [...group.items] }))
  }
}

export function serializeSkillGroups(groups: unknown): string {
  return JSON.stringify(normalizeSkillGroups(groups))
}
