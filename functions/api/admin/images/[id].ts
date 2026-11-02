import type { AppEnv } from '../../../_shared/types'
import { fail, ok } from '../../../_shared/response'
import { nowIso } from '../../../_shared/utils'

function parseImageId(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw
  return Number(value)
}

export const onRequestDelete: PagesFunction<AppEnv> = async (context) => {
  const imageId = parseImageId(context.params.id)
  if (!Number.isInteger(imageId) || imageId <= 0) {
    return fail('Invalid image id.', 400)
  }

  try {
    const image = await context.env.DB
      .prepare('SELECT id, r2_key, project_id FROM project_images WHERE id = ? LIMIT 1')
      .bind(imageId)
      .first<{ id: number; r2_key: string; project_id: number }>()

    if (!image) {
      return fail('Image not found.', 404)
    }

    await context.env.IMAGES.delete(image.r2_key)
    await context.env.DB.prepare('DELETE FROM project_images WHERE id = ?').bind(imageId).run()

    const timestamp = nowIso()
    await context.env.DB
      .prepare('INSERT INTO admin_audit (action, metadata_json, created_at) VALUES (?, ?, ?)')
      .bind(
        'project.image.deleted',
        JSON.stringify({ imageId, projectId: image.project_id }),
        timestamp,
      )
      .run()

    return ok({ id: imageId })
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to delete image.', 500)
  }
}
