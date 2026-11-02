import {
  contentSyncKey,
  legacySiteSettings,
  targetHomeCardBodies,
  targetProjectProfiles,
  targetSiteSettings,
} from './contentDefaults'
import { projectIdentityMatches } from '../../shared/projectIdentity'
import { nowIso } from './utils'

interface SyncStateRow {
  sync_key: string
  status: string
  started_at: string
}

interface ProjectRow {
  id: number
  slug: string
  title: string
  summary: string
  tech_json: string
  demo_url: string | null
  repo_url: string | null
  is_featured: number
  sort_order: number
  created_at: string
  updated_at: string
}

interface SiteSettingsRow {
  id: number
  email: string
  phone: string | null
  location: string | null
  socials_json: string | null
  contact_intro: string | null
  home_eyebrow: string | null
  home_title: string | null
  home_tagline: string | null
  home_intro: string | null
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

function valueNeedsUpdate(current: string | null, target: string, legacyValues: readonly string[]): boolean {
  const normalizedCurrent = current?.trim() ?? ''
  if (!normalizedCurrent) {
    return true
  }

  return legacyValues.some((legacyValue) => normalizedCurrent === legacyValue)
}

async function claimSyncState(db: D1Database): Promise<{ claimed: boolean; startedAt: string }> {
  const startedAt = `${nowIso()}-${crypto.randomUUID()}`

  await db
    .prepare(
      `INSERT OR IGNORE INTO content_sync_state (sync_key, status, started_at, completed_at, metadata_json)
       VALUES (?, 'running', ?, NULL, '{}')`,
    )
    .bind(contentSyncKey, startedAt)
    .run()

  const row = await db
    .prepare(
      'SELECT sync_key, status, started_at FROM content_sync_state WHERE sync_key = ? LIMIT 1',
    )
    .bind(contentSyncKey)
    .first<SyncStateRow>()

  if (!row) {
    return { claimed: false, startedAt }
  }

  if (row.status === 'completed') {
    return { claimed: false, startedAt: row.started_at }
  }

  return {
    claimed: row.started_at === startedAt,
    startedAt: row.started_at,
  }
}

async function waitForCompletedSync(db: D1Database): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const row = await db
      .prepare('SELECT status FROM content_sync_state WHERE sync_key = ? LIMIT 1')
      .bind(contentSyncKey)
      .first<{ status: string }>()

    if (!row || row.status === 'completed') {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 75))
  }
}

function buildProjectMatchAliases(
  title: string,
  slug: string,
  aliases: readonly string[],
  legacyTitles: readonly string[],
): string[] {
  return [slug, title, ...aliases, ...legacyTitles]
}

function buildProjectStatements(
  db: D1Database,
  rows: ProjectRow[],
): Array<ReturnType<D1Database['prepare']>> {
  const statements: Array<ReturnType<D1Database['prepare']>> = []
  const usedRowIds = new Set<number>()

  const getMatch = (aliases: readonly string[]) => {
    for (const row of rows) {
      if (usedRowIds.has(row.id)) {
        continue
      }

      if (projectIdentityMatches([row.slug, row.title], aliases)) {
        usedRowIds.add(row.id)
        return row
      }
    }

    return null
  }

  const aicms = targetProjectProfiles.aicms
  const aicmsMatch = getMatch(buildProjectMatchAliases(aicms.title, aicms.slug, aicms.aliases, aicms.legacyTitles))
  if (aicmsMatch) {
    const nextTitle = valueNeedsUpdate(aicmsMatch.title, aicms.title, aicms.legacyTitles)
      ? aicms.title
      : aicmsMatch.title
    const nextSummary = valueNeedsUpdate(aicmsMatch.summary, aicms.summary, aicms.legacySummaries)
      ? aicms.summary
      : aicmsMatch.summary

    if (nextTitle !== aicmsMatch.title || nextSummary !== aicmsMatch.summary) {
      statements.push(
        db
          .prepare('UPDATE projects SET title = ?, summary = ?, updated_at = ? WHERE id = ?')
          .bind(nextTitle, nextSummary, nowIso(), aicmsMatch.id),
      )
    }
  } else {
    const sortOrder = rows.reduce((max, row) => Math.max(max, row.sort_order), 0) + 1
    const timestamp = nowIso()
    statements.push(
      db
        .prepare(
          `INSERT INTO projects
            (slug, title, summary, tech_json, demo_url, repo_url, status, publish_at, is_featured, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'published', NULL, ?, ?, ?, ?)`,
        )
        .bind(
          aicms.slug,
          aicms.title,
          aicms.summary,
          JSON.stringify(aicms.tech),
          aicms.demoUrl,
          aicms.repoUrl,
          1,
          sortOrder,
          timestamp,
          timestamp,
        ),
    )
  }

  const proxmox = targetProjectProfiles.pveDashboard
  const proxmoxMatch = getMatch(
    buildProjectMatchAliases(proxmox.title, proxmox.slug, proxmox.aliases, proxmox.legacyTitles),
  )
  if (proxmoxMatch) {
    const nextTitle = valueNeedsUpdate(proxmoxMatch.title, proxmox.title, proxmox.legacyTitles)
      ? proxmox.title
      : proxmoxMatch.title
    const nextSummary = valueNeedsUpdate(
      proxmoxMatch.summary,
      proxmox.summary,
      proxmox.legacySummaries,
    )
      ? proxmox.summary
      : proxmoxMatch.summary

    if (nextTitle !== proxmoxMatch.title || nextSummary !== proxmoxMatch.summary) {
      statements.push(
        db
          .prepare('UPDATE projects SET title = ?, summary = ?, updated_at = ? WHERE id = ?')
          .bind(nextTitle, nextSummary, nowIso(), proxmoxMatch.id),
      )
    }
  }

  const compute = targetProjectProfiles.computeExperiments
  const computeMatch = getMatch(
    buildProjectMatchAliases(compute.title, compute.slug, compute.aliases, compute.legacyTitles),
  )
  if (computeMatch) {
    const nextSummary = valueNeedsUpdate(computeMatch.summary, compute.summary, compute.legacySummaries)
      ? compute.summary
      : computeMatch.summary

    if (nextSummary !== computeMatch.summary) {
      statements.push(
        db
          .prepare('UPDATE projects SET summary = ?, updated_at = ? WHERE id = ?')
          .bind(nextSummary, nowIso(), computeMatch.id),
      )
    }
  }

  const cloudflare = targetProjectProfiles.cloudflareTunnelZeroTrustAccess
  const cloudflareMatch = getMatch(
    buildProjectMatchAliases(cloudflare.title, cloudflare.slug, cloudflare.aliases, cloudflare.legacyTitles),
  )
  if (cloudflareMatch) {
    const nextSummary = valueNeedsUpdate(
      cloudflareMatch.summary,
      cloudflare.summary,
      cloudflare.legacySummaries,
    )
      ? cloudflare.summary
      : cloudflareMatch.summary

    if (nextSummary !== cloudflareMatch.summary) {
      statements.push(
        db
          .prepare('UPDATE projects SET summary = ?, updated_at = ? WHERE id = ?')
          .bind(nextSummary, nowIso(), cloudflareMatch.id),
      )
    }
  }

  return statements
}

function buildHomeCardStatements(
  db: D1Database,
  rows: HomeCardRow[],
): Array<ReturnType<D1Database['prepare']>> {
  const statements: Array<ReturnType<D1Database['prepare']>> = []

  for (const row of rows) {
    const match = row.cta_url ? targetHomeCardBodies[row.cta_url as keyof typeof targetHomeCardBodies] : null
    if (!match) {
      continue
    }

    if (valueNeedsUpdate(row.body, match.body, match.legacyBodies)) {
      statements.push(
        db
          .prepare('UPDATE home_cards SET body = ?, updated_at = ? WHERE id = ?')
          .bind(match.body, nowIso(), row.id),
      )
    }
  }

  return statements
}

function buildSiteSettingsStatements(
  db: D1Database,
  row: SiteSettingsRow | null,
): Array<ReturnType<D1Database['prepare']>> {
  if (!row) {
    return []
  }

  const statements: Array<ReturnType<D1Database['prepare']>> = []
  const target = targetSiteSettings

  const nextHomeEyebrow = valueNeedsUpdate(row.home_eyebrow, target.homeEyebrow, legacySiteSettings.homeEyebrow)
    ? target.homeEyebrow
    : row.home_eyebrow ?? ''
  const nextHomeTitle = valueNeedsUpdate(row.home_title, target.homeTitle, legacySiteSettings.homeTitle)
    ? target.homeTitle
    : row.home_title ?? ''
  const nextHomeTagline = valueNeedsUpdate(row.home_tagline, target.homeTagline, legacySiteSettings.homeTagline)
    ? target.homeTagline
    : row.home_tagline ?? ''
  const nextHomeIntro = valueNeedsUpdate(row.home_intro, target.homeIntro, legacySiteSettings.homeIntro)
    ? target.homeIntro
    : row.home_intro ?? ''
  const nextContactIntro = valueNeedsUpdate(
    row.contact_intro,
    target.contactIntro,
    legacySiteSettings.contactIntro,
  )
    ? target.contactIntro
    : row.contact_intro ?? ''
  const nextLocation = valueNeedsUpdate(row.location, target.location, legacySiteSettings.location)
    ? target.location
    : row.location ?? ''

  if (
    nextHomeEyebrow !== (row.home_eyebrow ?? '') ||
    nextHomeTitle !== (row.home_title ?? '') ||
    nextHomeTagline !== (row.home_tagline ?? '') ||
    nextHomeIntro !== (row.home_intro ?? '') ||
    nextContactIntro !== (row.contact_intro ?? '') ||
    nextLocation !== (row.location ?? '')
  ) {
    statements.push(
      db
        .prepare(
          `UPDATE site_settings
           SET home_eyebrow = ?,
               home_title = ?,
               home_tagline = ?,
               home_intro = ?,
               contact_intro = ?,
               location = ?,
               updated_at = ?
           WHERE id = 1`,
        )
        .bind(
          nextHomeEyebrow,
          nextHomeTitle,
          nextHomeTagline,
          nextHomeIntro,
          nextContactIntro,
          nextLocation,
          nowIso(),
        ),
    )
  }

  return statements
}

export async function ensureSiteContentSync(db: D1Database): Promise<void> {
  const state = await claimSyncState(db)
  if (!state.claimed) {
    await waitForCompletedSync(db)
    return
  }

  try {
    const [siteSettingsRow, homeCardsRows, projectRows] = await Promise.all([
      db
        .prepare(
          `SELECT
            id,
            email,
            phone,
            location,
            socials_json,
            contact_intro,
            home_eyebrow,
            home_title,
            home_tagline,
            home_intro
           FROM site_settings
           WHERE id = 1`,
        )
        .first<SiteSettingsRow>(),
      db
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
          FROM home_cards`,
        )
        .all<HomeCardRow>(),
      db
        .prepare(
          `SELECT
            id,
            slug,
            title,
            summary,
            tech_json,
            demo_url,
            repo_url,
            is_featured,
            sort_order,
            created_at,
            updated_at
          FROM projects`,
        )
        .all<ProjectRow>(),
    ])

    const projectStatements = buildProjectStatements(db, projectRows.results ?? [])
    const homeCardStatements = buildHomeCardStatements(db, homeCardsRows.results ?? [])
    const siteSettingsStatements = buildSiteSettingsStatements(db, siteSettingsRow)

    const statements = [...siteSettingsStatements, ...homeCardStatements, ...projectStatements]
    if (statements.length > 0) {
      await db.batch(statements)
    }

    const completedAt = nowIso()
    await db
      .prepare(
        `UPDATE content_sync_state
         SET status = 'completed',
             completed_at = ?,
             metadata_json = ?
         WHERE sync_key = ? AND status = 'running' AND started_at = ?`,
      )
      .bind(
        completedAt,
        JSON.stringify({
          synced: true,
          siteSettings: Boolean(siteSettingsStatements.length),
          homeCards: homeCardStatements.length,
          projects: projectStatements.length,
        }),
        contentSyncKey,
        state.startedAt,
      )
      .run()

    await db
      .prepare('INSERT INTO admin_audit (action, metadata_json, created_at) VALUES (?, ?, ?)')
      .bind(
        'site.content_sync.v3.completed',
        JSON.stringify({
          siteSettingsUpdates: siteSettingsStatements.length,
          homeCardUpdates: homeCardStatements.length,
          projectUpdates: projectStatements.length,
        }),
        completedAt,
      )
      .run()
  } catch (error) {
    await db
      .prepare('DELETE FROM content_sync_state WHERE sync_key = ? AND status = ? AND started_at = ?')
      .bind(contentSyncKey, 'running', state.startedAt)
      .run()

    await db
      .prepare('INSERT INTO admin_audit (action, metadata_json, created_at) VALUES (?, ?, ?)')
      .bind(
        'site.content_sync.v3.failed',
        JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown sync error' }),
        nowIso(),
      )
      .run()

    throw error
  }
}
