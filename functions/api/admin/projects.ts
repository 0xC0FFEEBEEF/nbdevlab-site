import type { AppEnv, ProjectStatus } from '../../_shared/types'
import { ensureSiteContentSync } from '../../_shared/contentSync'
import { ensureDefaultProjects } from '../../_shared/defaultProjects'
import { fail, ok } from '../../_shared/response'
import { projectIdentityMatches } from '../../../shared/projectIdentity'
import type { ProjectDetailCard, ProjectLink } from '../../../shared/projectContent'
import {
  getLegacyProjectUrls,
  normalizeProjectDetailCards,
  normalizeProjectLinks,
} from '../../../shared/projectContent'
import { normalizeProjectBlocks } from '../../../shared/projectBlocks'
import {
  ensureProjectDetailsColumn,
  loadProjectsWithImages,
  nowIso,
  parseBody,
  slugify,
  toIsoOrNull,
} from '../../_shared/utils'
import { isProjectStatus } from '../../_shared/validation'

interface ProjectPayload {
  title?: string
  summary?: string
  details?: string
  tech?: string[]
  links?: ProjectLink[]
  detailCards?: ProjectDetailCard[]
  contentBlocks?: unknown
  demoUrl?: string | null
  repoUrl?: string | null
  status?: ProjectStatus
  publishAt?: string | null
  isFeatured?: boolean
}

async function ensureUniqueSlug(db: D1Database, source: string): Promise<string> {
  const base =
    projectIdentityMatches([source], ['pve dashboard', 'proxmox dashboard', 'proxmox-dashboard'])
      ? 'proxmox-dashboard'
      : slugify(source) || 'project'
  let candidate = base
  let suffix = 1

  while (true) {
    const existing = await db
      .prepare('SELECT id FROM projects WHERE slug = ? LIMIT 1')
      .bind(candidate)
      .first<{ id: number }>()

    if (!existing) {
      return candidate
    }

    candidate = `${base}-${suffix}`
    suffix += 1
  }
}

export const onRequestGet: PagesFunction<AppEnv> = async (context) => {
  try {
    await ensureDefaultProjects(context.env.DB)
    await ensureSiteContentSync(context.env.DB)

    const projects = await loadProjectsWithImages(
      context.env.DB,
      `SELECT
        id,
        slug,
        title,
        summary,
        details,
        tech_json,
        demo_url,
        repo_url,
        links_json,
        detail_cards_json,
        status,
        publish_at,
        is_featured,
        sort_order,
        created_at,
        updated_at
      FROM projects
      ORDER BY sort_order ASC, created_at DESC`,
      [],
    )

    return ok(projects)
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to load projects.', 500)
  }
}

export const onRequestPost: PagesFunction<AppEnv> = async (context) => {
  try {
    await ensureProjectDetailsColumn(context.env.DB)

    const payload = await parseBody<ProjectPayload>(context.request)
    const title = payload.title?.trim() ?? ''
    const summary = payload.summary?.trim() ?? ''
    const details = payload.details?.trim() ?? ''
    const status = payload.status
    const tech = Array.isArray(payload.tech) ? payload.tech.filter(Boolean) : []
    const links = normalizeProjectLinks(payload.links, {
      demoUrl: payload.demoUrl,
      repoUrl: payload.repoUrl,
    })
    const detailCards = normalizeProjectDetailCards(payload.detailCards)
    const contentBlocks = normalizeProjectBlocks(payload.contentBlocks)
    const legacyUrls = getLegacyProjectUrls(links)
    const isFeatured = payload.isFeatured === true

    if (!title || !summary) {
      return fail('Title and summary are required.', 400)
    }

    if (!isProjectStatus(status)) {
      return fail('Invalid project status.', 400)
    }

    const publishAt = toIsoOrNull(payload.publishAt ?? null)
    if (status === 'scheduled' && !publishAt) {
      return fail('Scheduled projects require a publish timestamp.', 400)
    }

    const slug = await ensureUniqueSlug(context.env.DB, title)
    const currentSort = await context.env.DB
      .prepare('SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM projects')
      .first<{ max_sort: number }>()

    const timestamp = nowIso()
    const sortOrder = Number(currentSort?.max_sort ?? 0) + 1

    const insertResult = await context.env.DB
      .prepare(
        `INSERT INTO projects
          (slug, title, summary, details, tech_json, demo_url, repo_url, links_json, detail_cards_json, content_blocks_json, status, publish_at, is_featured, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        slug,
        title,
        summary,
        details,
        JSON.stringify(tech),
        legacyUrls.demoUrl,
        legacyUrls.repoUrl,
        JSON.stringify(links),
        JSON.stringify(detailCards),
        JSON.stringify(contentBlocks),
        status,
        publishAt,
        isFeatured ? 1 : 0,
        sortOrder,
        timestamp,
        timestamp,
      )
      .run()

    const projectId = Number(insertResult.meta.last_row_id)

    await context.env.DB
      .prepare('INSERT INTO admin_audit (action, metadata_json, created_at) VALUES (?, ?, ?)')
      .bind('project.created', JSON.stringify({ id: projectId, status }), timestamp)
      .run()

    const projects = await loadProjectsWithImages(
      context.env.DB,
      `SELECT
        id,
        slug,
        title,
        summary,
        details,
        tech_json,
        demo_url,
        repo_url,
        links_json,
        detail_cards_json,
        status,
        publish_at,
        is_featured,
        sort_order,
        created_at,
        updated_at
      FROM projects
      WHERE id = ?
      LIMIT 1`,
      [projectId],
    )

    const project = projects[0]
    if (!project) {
      return fail('Project was created but could not be loaded.', 500)
    }

    return ok(project, 201)
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to create project.', 500)
  }
}
