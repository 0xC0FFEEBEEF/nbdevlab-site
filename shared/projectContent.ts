export const projectLinkKinds = ['primary', 'secondary', 'demo', 'repo', 'docs', 'external'] as const

export type ProjectLinkKind = (typeof projectLinkKinds)[number]

export interface ProjectLink {
  id: string
  label: string
  url: string
  kind: ProjectLinkKind
}

export interface ProjectDetailCard {
  id: string
  title: string
  body: string
  linkLabel: string
  linkUrl: string
  x: number
  y: number
  width: number
  height: number
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function normalizeLinkKind(value: unknown): ProjectLinkKind {
  return projectLinkKinds.includes(value as ProjectLinkKind) ? (value as ProjectLinkKind) : 'external'
}

export function createProjectLink(overrides: Partial<ProjectLink> = {}): ProjectLink {
  return {
    id: overrides.id?.trim() || createId('project-link'),
    label: overrides.label?.trim() || 'Open Link',
    url: overrides.url?.trim() || '',
    kind: overrides.kind && projectLinkKinds.includes(overrides.kind) ? overrides.kind : 'external',
  }
}

export function createProjectDetailCard(overrides: Partial<ProjectDetailCard> = {}): ProjectDetailCard {
  return {
    id: overrides.id?.trim() || createId('project-detail-card'),
    title: overrides.title?.trim() || 'Detail Card',
    body: overrides.body?.trim() || '',
    linkLabel: overrides.linkLabel?.trim() || '',
    linkUrl: overrides.linkUrl?.trim() || '',
    x: clamp(overrides.x ?? 5, 0, 82),
    y: clamp(overrides.y ?? 8, 0, 82),
    width: clamp(overrides.width ?? 38, 18, 100),
    height: clamp(overrides.height ?? 34, 18, 100),
  }
}

export function normalizeProjectLinks(
  value: unknown,
  legacy?: {
    demoUrl?: string | null
    repoUrl?: string | null
  },
): ProjectLink[] {
  const nextLinks: ProjectLink[] = []

  if (Array.isArray(value)) {
    value.forEach((item) => {
      const record = asRecord(item)
      if (!record) {
        return
      }

      const url = asString(record.url)
      if (!url) {
        return
      }

      nextLinks.push(
        createProjectLink({
          id: asString(record.id),
          label: asString(record.label) || 'Open Link',
          url,
          kind: normalizeLinkKind(record.kind),
        }),
      )
    })
  }

  if (nextLinks.length > 0) {
    return nextLinks
  }

  const demoUrl = asString(legacy?.demoUrl)
  const repoUrl = asString(legacy?.repoUrl)

  if (demoUrl) {
    nextLinks.push(
      createProjectLink({
        label: 'Demo',
        url: demoUrl,
        kind: 'demo',
      }),
    )
  }

  if (repoUrl) {
    nextLinks.push(
      createProjectLink({
        label: 'Repo',
        url: repoUrl,
        kind: 'repo',
      }),
    )
  }

  return nextLinks
}

export function normalizeProjectDetailCards(value: unknown): ProjectDetailCard[] {
  if (!Array.isArray(value)) {
    return []
  }

  const nextCards: ProjectDetailCard[] = []

  value.forEach((item) => {
    const record = asRecord(item)
    if (!record) {
      return
    }

    nextCards.push(
      createProjectDetailCard({
        id: asString(record.id),
        title: asString(record.title) || 'Detail Card',
        body: asString(record.body),
        linkLabel: asString(record.linkLabel),
        linkUrl: asString(record.linkUrl),
        x: asNumber(record.x) ?? undefined,
        y: asNumber(record.y) ?? undefined,
        width: asNumber(record.width) ?? undefined,
        height: asNumber(record.height) ?? undefined,
      }),
    )
  })

  return nextCards
}

export function getLegacyProjectUrls(links: readonly ProjectLink[]): {
  demoUrl: string | null
  repoUrl: string | null
} {
  const demoLink =
    links.find((link) => link.kind === 'demo') ??
    links.find((link) => /demo|live/i.test(link.label)) ??
    null
  const repoLink =
    links.find((link) => link.kind === 'repo') ??
    links.find((link) => /repo|github|source|code/i.test(link.label)) ??
    null

  return {
    demoUrl: demoLink?.url ?? null,
    repoUrl: repoLink?.url ?? null,
  }
}
