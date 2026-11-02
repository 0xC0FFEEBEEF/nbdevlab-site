import type { AppEnv } from '../../../../_shared/types'
import { isAdminAuthenticated } from '../../../../_shared/auth'
import { fail, ok } from '../../../../_shared/response'
import { deleteBuilderMediaAsset } from '../../../../_shared/builder'

function parseMediaId(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw
  return Number(value)
}

export const onRequestDelete: PagesFunction<AppEnv> = async (context) => {
  try {
    const authenticated = await isAdminAuthenticated(context.request, context.env)
    if (!authenticated) {
      return fail('Unauthorized.', 401)
    }

    const mediaId = parseMediaId(context.params.id)
    if (!Number.isInteger(mediaId) || mediaId <= 0) {
      return fail('Invalid media id.', 400)
    }

    const deleted = await deleteBuilderMediaAsset(context.env.DB, context.env.IMAGES, mediaId)
    if (!deleted) {
      return fail('Media asset not found.', 404)
    }

    return ok({ id: mediaId })
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to delete builder media.', 500)
  }
}
