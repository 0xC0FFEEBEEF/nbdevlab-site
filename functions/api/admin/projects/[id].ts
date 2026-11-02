import type { AppEnv, ProjectStatus } from '../../../_shared/types'
import { fail, ok } from '../../../_shared/response'
import type { ProjectDetailCard, ProjectLink } from '../../../../shared/projectContent'
import {
  getLegacyProjectUrls,
  normalizeProjectDetailCards,
  normalizeProjectLinks,
} from '../../../../shared/projectContent'
import { normalizeProjectBlocks } from '../../../../shared/projectBlocks'
import {
  ensureProjectDetailsColumn,
  loadProjectsWithImages,
  nowIso,
  parseBody,
  slugify,
  toIsoOrNull,
} from '../../../_shared/utils'
import { shouldPreserveLegacyProxmoxSlug } from '../../../../shared/projectIdentity'
import { isProjectStatus } from '../../../_shared/validation'

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

async function ensureUniqueSlug(
  db: D1Database,
  source: string,
  projectId: number,
  existingSlug?: string,
): Promise<string> {
  if (existingSlug && shouldPreserveLegacyProxmoxSlug(existingSlug, source)) {
    return existingSlug
  }

  const base = slugify(source) || 'project'
  let candidate = base
  let suffix = 1

  while (true) {
    const existing = await db
      .prepare('SELECT id FROM projects WHERE slug = ? LIMIT 1')
      .bind(candidate)
      .first<{ id: number }>()

    if (!existing || existing.id === projectId) {
      return candidate
    }

    candidate = `${base}-${suffix}`
    suffix += 1
  }
}

function parseProjectId(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw
  return Number(value)
}

export const onRequestPut: PagesFunction<AppEnv> = async (context) => {
  const projectId = parseProjectId(context.params.id)
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return fail('Invalid project id.', 400)
  }

  try {
    await ensureProjectDetailsColumn(context.env.DB)

    const existing = await context.env.DB
      .prepare('SELECT id, slug FROM projects WHERE id = ? LIMIT 1')
      .bind(projectId)
      .first<{ id: number; slug: string }>()

    if (!existing) {
      return fail('Project not found.', 404)
    }

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
    // Left out of the request means leave the saved page alone.
    const contentBlocksJson =
      payload.contentBlocks === undefined ? null : JSON.stringify(normalizeProjectBlocks(payload.contentBlocks))
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

    const slug = await ensureUniqueSlug(context.env.DB, title, projectId, existing.slug)
    const timestamp = nowIso()

    await context.env.DB
      .prepare(
        `UPDATE projects
         SET slug = ?,
             title = ?,
             summary = ?,
             details = ?,
             tech_json = ?,
             demo_url = ?,
             repo_url = ?,
             links_json = ?,
             detail_cards_json = ?,
             content_blocks_json = COALESCE(?, content_blocks_json),
             status = ?,
             publish_at = ?,
             is_featured = ?,
             updated_at = ?
         WHERE id = ?`,
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
        contentBlocksJson,
        status,
        publishAt,
        isFeatured ? 1 : 0,
        timestamp,
        projectId,
      )
      .run()

    await context.env.DB
      .prepare('INSERT INTO admin_audit (action, metadata_json, created_at) VALUES (?, ?, ?)')
      .bind('project.updated', JSON.stringify({ id: projectId, status }), timestamp)
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
      return fail('Project was updated but could not be loaded.', 500)
    }

    return ok(project)
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to update project.', 500)
  }
}

export const onRequestDelete: PagesFunction<AppEnv> = async (context) => {
  const projectId = parseProjectId(context.params.id)
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return fail('Invalid project id.', 400)
  }

  try {
    const existing = await context.env.DB
      .prepare('SELECT id FROM projects WHERE id = ? LIMIT 1')
      .bind(projectId)
      .first<{ id: number }>()

    if (!existing) {
      return fail('Project not found.', 404)
    }

    const images = await context.env.DB
      .prepare('SELECT id, r2_key FROM project_images WHERE project_id = ?')
      .bind(projectId)
      .all<{ id: number; r2_key: string }>()

    for (const image of images.results ?? []) {
      await context.env.IMAGES.delete(image.r2_key)
    }

    await context.env.DB.prepare('DELETE FROM project_images WHERE project_id = ?').bind(projectId).run()
    await context.env.DB.prepare('DELETE FROM projects WHERE id = ?').bind(projectId).run()

    const timestamp = nowIso()
    await context.env.DB
      .prepare('INSERT INTO admin_audit (action, metadata_json, created_at) VALUES (?, ?, ?)')
      .bind('project.deleted', JSON.stringify({ id: projectId }), timestamp)
      .run()

    return ok({ id: projectId })
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to delete project.', 500)
  }
}
