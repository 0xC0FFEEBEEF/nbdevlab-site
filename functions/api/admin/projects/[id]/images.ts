import type { AppEnv } from '../../../../_shared/types'
import { fail, ok } from '../../../../_shared/response'
import { loadProjectsWithImages, nowIso, parseBody } from '../../../../_shared/utils'

function parseProjectId(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw
  return Number(value)
}

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9.\-_]/g, '-').slice(0, 120)
}

async function loadProject(db: D1Database, projectId: number) {
  const projects = await loadProjectsWithImages(
    db,
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

  return projects[0] ?? null
}

export const onRequestPost: PagesFunction<AppEnv> = async (context) => {
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

    const formData = await context.request.formData()
    const files = formData
      .getAll('images')
      .filter((entry): entry is File => entry instanceof File && entry.size > 0)

    if (files.length === 0) {
      return fail('No image files were provided.', 400)
    }

    const maxPosition = await context.env.DB
      .prepare('SELECT COALESCE(MAX(position), 0) as max_position FROM project_images WHERE project_id = ?')
      .bind(projectId)
      .first<{ max_position: number }>()

    const timestamp = nowIso()
    const basePosition = Number(maxPosition?.max_position ?? 0)

    for (const [index, file] of files.entries()) {
      const key = `projects/${projectId}/${Date.now()}-${crypto.randomUUID()}-${sanitizeFilename(file.name)}`
      await context.env.IMAGES.put(key, await file.arrayBuffer(), {
        httpMetadata: {
          contentType: file.type || 'application/octet-stream',
        },
      })

      await context.env.DB
        .prepare(
          `INSERT INTO project_images (project_id, r2_key, alt_text, position, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(projectId, key, file.name, basePosition + index + 1, timestamp)
        .run()
    }

    await context.env.DB
      .prepare('INSERT INTO admin_audit (action, metadata_json, created_at) VALUES (?, ?, ?)')
      .bind(
        'project.images.uploaded',
        JSON.stringify({ projectId, fileCount: files.length }),
        timestamp,
      )
      .run()

    const project = await loadProject(context.env.DB, projectId)
    if (!project) {
      return fail('Uploaded images but project reload failed.', 500)
    }

    return ok(project)
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to upload image.', 500)
  }
}

interface ReorderImagesPayload {
  orderedIds?: number[]
}

export const onRequestPut: PagesFunction<AppEnv> = async (context) => {
  const projectId = parseProjectId(context.params.id)
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return fail('Invalid project id.', 400)
  }

  try {
    const payload = await parseBody<ReorderImagesPayload>(context.request)
    const orderedIds = Array.isArray(payload.orderedIds)
      ? payload.orderedIds.filter((id) => Number.isInteger(id) && id > 0)
      : []

    const existing = await context.env.DB
      .prepare('SELECT id FROM project_images WHERE project_id = ?')
      .bind(projectId)
      .all<{ id: number }>()
    const existingIds = (existing.results ?? []).map((row) => row.id)

    // The order must name every image of this project exactly once, and nothing else.
    const isSameSet =
      orderedIds.length === existingIds.length &&
      new Set(orderedIds).size === orderedIds.length &&
      orderedIds.every((id) => existingIds.includes(id))

    if (existingIds.length === 0 || !isSameSet) {
      return fail('orderedIds must list every image of this project exactly once.', 400)
    }

    await context.env.DB.batch(
      orderedIds.map((id, index) =>
        context.env.DB
          .prepare('UPDATE project_images SET position = ? WHERE id = ? AND project_id = ?')
          .bind(index + 1, id, projectId),
      ),
    )

    await context.env.DB
      .prepare('INSERT INTO admin_audit (action, metadata_json, created_at) VALUES (?, ?, ?)')
      .bind('project.images.reordered', JSON.stringify({ projectId, orderedIds }), nowIso())
      .run()

    const project = await loadProject(context.env.DB, projectId)
    if (!project) {
      return fail('Saved the image order but project reload failed.', 500)
    }

    return ok(project)
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to reorder images.', 500)
  }
}
