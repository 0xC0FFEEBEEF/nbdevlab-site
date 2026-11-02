export interface ProjectIdentityInput {
  slug?: string | null
  title?: string | null
}

export type ProjectIdentityKey =
  | 'aicms'
  | 'pve-dashboard'
  | 'cryo-ai'
  | 'home-assistant'
  | 'wazuh'
  | 'cloudflare-zero-trust-access'
  | 'compute-experiments'

function normalizeIdentityPart(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"’"`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

const projectIdentityAliases: Record<ProjectIdentityKey, string[]> = {
  aicms: ['aicms'],
  'pve-dashboard': ['pve dashboard', 'proxmox dashboard', 'proxmox-dashboard'],
  'cryo-ai': ['cryo ai', 'cryo-ai'],
  'home-assistant': ['home assistant', 'home-assistant'],
  wazuh: ['wazuh'],
  'cloudflare-zero-trust-access': [
    'cloudflare tunnel zero trust access',
    'cloudflare tunnel / zero trust access',
    'cloudflare-tunnel-zero-trust-access',
  ],
  'compute-experiments': ['compute experiments', 'compute-experiments'],
}

const normalizedAliasMap = Object.fromEntries(
  Object.entries(projectIdentityAliases).map(([key, aliases]) => [
    key,
    aliases.map((alias) => normalizeIdentityPart(alias)),
  ]),
) as Record<ProjectIdentityKey, string[]>

export const featuredProjectOrder: readonly ProjectIdentityKey[] = [
  'aicms',
  'pve-dashboard',
  'cryo-ai',
  'home-assistant',
  'wazuh',
  'cloudflare-zero-trust-access',
]

export function normalizeProjectIdentity(value: string): string {
  return normalizeIdentityPart(value)
}

export function projectIdentityMatches(
  candidateValues: readonly (string | null | undefined)[],
  aliases: readonly string[],
): boolean {
  const normalizedAliases = new Set(aliases.map((alias) => normalizeProjectIdentity(alias)))

  for (const candidate of candidateValues) {
    if (!candidate) {
      continue
    }

    if (normalizedAliases.has(normalizeProjectIdentity(candidate))) {
      return true
    }
  }

  return false
}

export function matchesProjectIdentity(
  project: ProjectIdentityInput,
  identity: ProjectIdentityKey,
): boolean {
  return projectIdentityMatches([project.slug, project.title], normalizedAliasMap[identity])
}

export function getProjectIdentityKey(project: ProjectIdentityInput): ProjectIdentityKey | null {
  for (const identity of Object.keys(normalizedAliasMap) as ProjectIdentityKey[]) {
    if (matchesProjectIdentity(project, identity)) {
      return identity
    }
  }

  return null
}

export function shouldPreserveLegacyProxmoxSlug(
  slug: string,
  title?: string | null,
): boolean {
  if (normalizeProjectIdentity(slug) !== 'proxmox dashboard') {
    return false
  }

  if (!title) {
    return true
  }

  return projectIdentityMatches([title], ['pve dashboard', 'proxmox dashboard', 'proxmox-dashboard'])
}
