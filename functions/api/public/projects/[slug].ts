import type { AppEnv } from '../../../_shared/types'
import { ensureSiteContentSync } from '../../../_shared/contentSync'
import { ensureDefaultProjects } from '../../../_shared/defaultProjects'
import { fail, ok } from '../../../_shared/response'
import { loadProjectsWithImages, nowIso } from '../../../_shared/utils'

export const onRequestGet: PagesFunction<AppEnv> = async (context) => {
  const slug = context.params.slug
  if (!slug) {
    return fail('Missing project slug.', 400)
  }

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
      WHERE slug = ?
        AND (status = 'published' OR (status = 'scheduled' AND publish_at IS NOT NULL AND publish_at <= ?))
      LIMIT 1`,
      [slug, nowIso()],
    )

    const project = projects[0]
    if (!project) {
      return fail('Project not found.', 404)
    }

    return ok(project)
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to load project.', 500)
  }
}
