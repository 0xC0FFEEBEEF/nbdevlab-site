import type { HomeCard, Project, ProjectImage, ProjectStatus, SiteSettings } from './types'
import { parseAboutBlocks } from './aboutBlocks'
import { parseSkillGroups } from './skillsGroups'
import { legacySiteSettings, targetSiteSettings } from './contentDefaults'
import { defaultAnnouncement, normalizeAnnouncement } from '../../shared/announcement'
import { defaultGateSettings, normalizeGateSettings } from '../../shared/gateSettings'
import { normalizeMaintenanceMessage } from '../../shared/maintenance'
import { normalizeStatusPowerMode } from '../../shared/statusPowerMode'
import {
  getLegacyProjectUrls,
  normalizeProjectDetailCards,
  normalizeProjectLinks,
} from '../../shared/projectContent'
import { normalizeProjectBlocks, type ProjectBlock } from '../../shared/projectBlocks'

interface ProjectRow {
  id: number
  slug: string
  title: string
  summary: string
  details: string | null
  tech_json: string
  demo_url: string | null
  repo_url: string | null
  links_json: string | null
  detail_cards_json: string | null
  status: ProjectStatus
  publish_at: string | null
  is_featured: number
  sort_order: number
  created_at: string
  updated_at: string
}

interface ImageRow {
  id: number
  project_id: number
  alt_text: string | null
  position: number
  created_at: string
}

interface HomeCardRow {
  id: number
  title: string
  subtitle: string | null
  body: string | null
  cta_label: string | null
  cta_url: string | null
  width_units: number
  height_units: number
  sort_order: number
  is_visible: number
  created_at: string
  updated_at: string
}

export function nowIso() {
  return new Date().toISOString()
}

export function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90)
}

export function toIsoOrNull(input: unknown): string | null {
  if (typeof input !== 'string' || !input.trim()) {
    return null
  }

  const normalized = input.trim()
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

export async function parseBody<T>(request: Request): Promise<T> {
  return (await request.json()) as T
}

function isDuplicateGateSettingsColumnError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('duplicate column name: gate_settings_json')
}

function isDuplicateMaintenanceModeColumnError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('duplicate column name: maintenance_mode')
}

function isDuplicateMaintenanceMessageColumnError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('duplicate column name: maintenance_message')
}

function isDuplicateStatusPowerModeColumnError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('duplicate column name: status_power_mode')
}

function isDuplicateAnnouncementColumnError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('duplicate column name: announcement_json')
}

function isDuplicateProjectDetailsColumnError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('duplicate column name: details')
}

function isDuplicateProjectLinksColumnError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('duplicate column name: links_json')
}

function isDuplicateProjectContentBlocksColumnError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('duplicate column name: content_blocks_json')
}

function isDuplicateProjectDetailCardsColumnError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('duplicate column name: detail_cards_json')
}

export async function ensureGateSettingsColumn(db: D1Database): Promise<void> {
  const existingColumn = await db
    .prepare("SELECT name FROM pragma_table_info('site_settings') WHERE name = ? LIMIT 1")
    .bind('gate_settings_json')
    .first<{ name: string }>()

  if (existingColumn) {
    return
  }

  try {
    await db
      .prepare("ALTER TABLE site_settings ADD COLUMN gate_settings_json TEXT NOT NULL DEFAULT '{}'")
      .run()
  } catch (error) {
    if (!isDuplicateGateSettingsColumnError(error)) {
      throw error
    }
  }
}

export async function ensureMaintenanceColumns(db: D1Database): Promise<void> {
  const existingColumns = await db
    .prepare("SELECT name FROM pragma_table_info('site_settings')")
    .all<{ name: string }>()

  const columnNames = new Set((existingColumns.results ?? []).map((column) => column.name))

  if (!columnNames.has('maintenance_mode')) {
    try {
      await db
        .prepare("ALTER TABLE site_settings ADD COLUMN maintenance_mode INTEGER NOT NULL DEFAULT 0")
        .run()
    } catch (error) {
      if (!isDuplicateMaintenanceModeColumnError(error)) {
        throw error
      }
    }
  }

  if (!columnNames.has('maintenance_message')) {
    try {
      await db
        .prepare("ALTER TABLE site_settings ADD COLUMN maintenance_message TEXT NOT NULL DEFAULT ''")
        .run()
    } catch (error) {
      if (!isDuplicateMaintenanceMessageColumnError(error)) {
        throw error
      }
    }
  }
}

export async function ensureStatusPowerModeColumn(db: D1Database): Promise<void> {
  const existingColumn = await db
    .prepare("SELECT name FROM pragma_table_info('site_settings') WHERE name = ? LIMIT 1")
    .bind('status_power_mode')
    .first<{ name: string }>()

  if (existingColumn) {
    return
  }

  try {
    await db
      .prepare("ALTER TABLE site_settings ADD COLUMN status_power_mode TEXT NOT NULL DEFAULT 'live'")
      .run()
  } catch (error) {
    if (!isDuplicateStatusPowerModeColumnError(error)) {
      throw error
    }
  }
}

export async function ensureAnnouncementColumn(db: D1Database): Promise<void> {
  const existingColumn = await db
    .prepare("SELECT name FROM pragma_table_info('site_settings') WHERE name = ? LIMIT 1")
    .bind('announcement_json')
    .first<{ name: string }>()

  if (existingColumn) {
    return
  }

  try {
    await db
      .prepare("ALTER TABLE site_settings ADD COLUMN announcement_json TEXT NOT NULL DEFAULT '{}'")
      .run()
  } catch (error) {
    if (!isDuplicateAnnouncementColumnError(error)) {
      throw error
    }
  }
}

export async function ensureProjectDetailsColumn(db: D1Database): Promise<void> {
  const existingColumns = await db
    .prepare("SELECT name FROM pragma_table_info('projects')")
    .all<{ name: string }>()

  const columnNames = new Set((existingColumns.results ?? []).map((column) => column.name))

  if (!columnNames.has('details')) {
    try {
      await db
        .prepare("ALTER TABLE projects ADD COLUMN details TEXT NOT NULL DEFAULT ''")
        .run()
    } catch (error) {
      if (!isDuplicateProjectDetailsColumnError(error)) {
        throw error
      }
    }
  }

  if (!columnNames.has('links_json')) {
    try {
      await db
        .prepare("ALTER TABLE projects ADD COLUMN links_json TEXT NOT NULL DEFAULT '[]'")
        .run()
    } catch (error) {
      if (!isDuplicateProjectLinksColumnError(error)) {
        throw error
      }
    }
  }

  if (!columnNames.has('detail_cards_json')) {
    try {
      await db
        .prepare("ALTER TABLE projects ADD COLUMN detail_cards_json TEXT NOT NULL DEFAULT '[]'")
        .run()
    } catch (error) {
      if (!isDuplicateProjectDetailCardsColumnError(error)) {
        throw error
      }
    }
  }

  if (!columnNames.has('content_blocks_json')) {
    try {
      await db
        .prepare("ALTER TABLE projects ADD COLUMN content_blocks_json TEXT NOT NULL DEFAULT '[]'")
        .run()
    } catch (error) {
      if (!isDuplicateProjectContentBlocksColumnError(error)) {
        throw error
      }
    }
  }
}

export function mapProject(
  row: ProjectRow,
  images: ProjectImage[],
  contentBlocks: ProjectBlock[] = [],
): Project {
  const links = normalizeProjectLinks(parseJson<unknown>(row.links_json, []), {
    demoUrl: row.demo_url,
    repoUrl: row.repo_url,
  })
  const detailCards = normalizeProjectDetailCards(parseJson<unknown>(row.detail_cards_json, []))
  const legacyUrls = getLegacyProjectUrls(links)

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    details: row.details ?? '',
    tech: parseJson<string[]>(row.tech_json, []),
    links,
    detailCards,
    contentBlocks,
    demoUrl: row.demo_url ?? legacyUrls.demoUrl,
    repoUrl: row.repo_url ?? legacyUrls.repoUrl,
    status: row.status,
    publishAt: row.publish_at,
    isFeatured: row.is_featured === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    images,
  }
}

export async function loadProjectsWithImages(
  db: D1Database,
  query: string,
  bindings: (string | number | null)[],
): Promise<Project[]> {
  await ensureProjectDetailsColumn(db)

  const rows = await db.prepare(query).bind(...bindings).all<ProjectRow>()
  const projects = rows.results ?? []
  const ids = projects.map((project) => project.id)

  if (ids.length === 0) {
    return []
  }

  const placeholders = ids.map(() => '?').join(', ')
  const imageRows = await db
    .prepare(
      `SELECT id, project_id, alt_text, position, created_at FROM project_images WHERE project_id IN (${placeholders}) ORDER BY position ASC, id ASC`,
    )
    .bind(...ids)
    .all<ImageRow>()

  const imageMap = new Map<number, ProjectImage[]>()
  for (const image of imageRows.results ?? []) {
    const next = imageMap.get(image.project_id) ?? []
    next.push({
      id: image.id,
      projectId: image.project_id,
      url: `/api/public/images/${image.id}`,
      altText: image.alt_text ?? '',
      position: image.position,
      createdAt: image.created_at,
    })
    imageMap.set(image.project_id, next)
  }

  // The page blocks are read here, by id, so the callers' column lists do not all have to name the column.
  const blockRows = await db
    .prepare(`SELECT id, content_blocks_json FROM projects WHERE id IN (${placeholders})`)
    .bind(...ids)
    .all<{ id: number; content_blocks_json: string | null }>()
  const blockMap = new Map<number, ProjectBlock[]>()
  for (const row of blockRows.results ?? []) {
    blockMap.set(row.id, normalizeProjectBlocks(parseJson<unknown>(row.content_blocks_json, [])))
  }

  return projects.map((project) =>
    mapProject(project, imageMap.get(project.id) ?? [], blockMap.get(project.id) ?? []),
  )
}

export async function loadSiteSettings(db: D1Database): Promise<SiteSettings> {
  await ensureGateSettingsColumn(db)
  await ensureMaintenanceColumns(db)
  await ensureStatusPowerModeColumn(db)
  await ensureAnnouncementColumn(db)

  const result = await db
    .prepare(
      `SELECT
        email,
        phone,
        location,
        socials_json,
        contact_intro,
        maintenance_mode,
        maintenance_message,
        announcement_json,
        status_power_mode,
        home_eyebrow,
        home_title,
        home_tagline,
        home_intro,
        gate_settings_json,
        about_blocks_json,
        skills_groups_json
      FROM site_settings
      WHERE id = 1`,
    )
    .first<{
      email: string
      phone: string | null
      location: string | null
      socials_json: string | null
      contact_intro: string | null
      maintenance_mode: number | null
      maintenance_message: string | null
      announcement_json: string | null
      status_power_mode: string | null
      home_eyebrow: string | null
      home_title: string | null
      home_tagline: string | null
      home_intro: string | null
      gate_settings_json: string | null
      about_blocks_json: string | null
      skills_groups_json: string | null
    }>()

  if (!result) {
    return {
      email: '',
      phone: '',
      location: targetSiteSettings.location,
      socials: {},
      contactIntro: targetSiteSettings.contactIntro,
      maintenanceMode: false,
      maintenanceMessage: normalizeMaintenanceMessage(targetSiteSettings.maintenanceMessage),
      announcement: { ...defaultAnnouncement },
      statusPowerMode: targetSiteSettings.statusPowerMode,
      homeEyebrow: targetSiteSettings.homeEyebrow,
      homeTitle: targetSiteSettings.homeTitle,
      homeTagline: targetSiteSettings.homeTagline,
      homeIntro: targetSiteSettings.homeIntro,
      gateSettings: defaultGateSettings,
      aboutBlocks: parseAboutBlocks(null),
      skillsGroups: parseSkillGroups(null),
    }
  }

  const useTargetWhenLegacy = (
    current: string | null,
    target: string,
    legacyValues: readonly string[],
  ): string => {
    const normalized = current?.trim() ?? ''
    if (!normalized || legacyValues.some((legacyValue) => normalized === legacyValue)) {
      return target
    }

    return normalized
  }

  return {
    email: result.email,
    phone: result.phone ?? '',
    location: useTargetWhenLegacy(result.location, targetSiteSettings.location, legacySiteSettings.location),
    socials: parseJson<Record<string, string>>(result.socials_json, {}),
    contactIntro: useTargetWhenLegacy(
      result.contact_intro,
      targetSiteSettings.contactIntro,
      legacySiteSettings.contactIntro,
    ),
    maintenanceMode: result.maintenance_mode === 1,
    maintenanceMessage: normalizeMaintenanceMessage(
      result.maintenance_message ?? targetSiteSettings.maintenanceMessage,
    ),
    announcement: normalizeAnnouncement(parseJson<unknown>(result.announcement_json, {})),
    statusPowerMode: normalizeStatusPowerMode(result.status_power_mode, targetSiteSettings.statusPowerMode),
    homeEyebrow: useTargetWhenLegacy(
      result.home_eyebrow,
      targetSiteSettings.homeEyebrow,
      legacySiteSettings.homeEyebrow,
    ),
    homeTitle: useTargetWhenLegacy(result.home_title, targetSiteSettings.homeTitle, legacySiteSettings.homeTitle),
    homeTagline: useTargetWhenLegacy(
      result.home_tagline,
      targetSiteSettings.homeTagline,
      legacySiteSettings.homeTagline,
    ),
    homeIntro: useTargetWhenLegacy(result.home_intro, targetSiteSettings.homeIntro, legacySiteSettings.homeIntro),
    gateSettings: normalizeGateSettings(parseJson(result.gate_settings_json, defaultGateSettings)),
    aboutBlocks: parseAboutBlocks(result.about_blocks_json),
    skillsGroups: parseSkillGroups(result.skills_groups_json),
  }
}

export function mapHomeCard(row: HomeCardRow): HomeCard {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle ?? '',
    body: row.body ?? '',
    ctaLabel: row.cta_label ?? '',
    ctaUrl: row.cta_url ?? '',
    widthUnits: row.width_units,
    heightUnits: row.height_units,
    sortOrder: row.sort_order,
    isVisible: row.is_visible === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function loadHomeCards(
  db: D1Database,
  onlyVisible: boolean,
): Promise<HomeCard[]> {
  const filter = onlyVisible ? 'WHERE is_visible = 1' : ''
  const rows = await db
    .prepare(
      `SELECT
        id,
        title,
        subtitle,
        body,
        cta_label,
        cta_url,
        width_units,
        height_units,
        sort_order,
        is_visible,
        created_at,
        updated_at
      FROM home_cards
      ${filter}
      ORDER BY sort_order ASC, id ASC`,
    )
    .all<HomeCardRow>()

  return (rows.results ?? []).map(mapHomeCard)
}
