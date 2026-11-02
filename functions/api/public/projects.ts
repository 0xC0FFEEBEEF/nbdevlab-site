import type { AppEnv } from '../../_shared/types'
import { ensureSiteContentSync } from '../../_shared/contentSync'
import { ensureDefaultProjects } from '../../_shared/defaultProjects'
import { ok, fail } from '../../_shared/response'
import { loadProjectsWithImages, nowIso } from '../../_shared/utils'

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
      WHERE status = 'published' OR (status = 'scheduled' AND publish_at IS NOT NULL AND publish_at <= ?)
      ORDER BY sort_order ASC, COALESCE(publish_at, created_at) DESC`,
      [nowIso()],
    )

    return ok(projects)
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to load projects.', 500)
  }
}
