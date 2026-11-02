import type { SkillGroup } from '../types/models'

export const defaultSkillGroups: SkillGroup[] = [
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
]

export function cloneSkillGroups(groups: SkillGroup[]): SkillGroup[] {
  return groups.map((group) => ({
    ...group,
    items: [...group.items],
  }))
}

export function createSkillGroupId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `skills-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function createSkillGroup(): SkillGroup {
  return {
    id: createSkillGroupId(),
    title: '',
    items: [''],
  }
}

export function normalizeSkillGroups(groups: SkillGroup[] | null | undefined): SkillGroup[] {
  if (!Array.isArray(groups)) {
    return cloneSkillGroups(defaultSkillGroups)
  }

  if (groups.length === 0) {
    return []
  }

  return groups.map((group) => ({
    id: group.id || createSkillGroupId(),
    title: group.title ?? '',
    items: Array.isArray(group.items) ? group.items.map((item) => item ?? '') : [],
  }))
}
