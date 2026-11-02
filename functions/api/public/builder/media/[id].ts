import type { AppEnv } from '../../../../_shared/types'
import { fail } from '../../../../_shared/response'
import { loadBuilderMediaAsset } from '../../../../_shared/builder'
import { serveStoredImage } from '../../../../_shared/imageResponse'

function parseMediaId(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw
  return Number(value)
}

export const onRequestGet: PagesFunction<AppEnv> = async (context) => {
  try {
    const mediaId = parseMediaId(context.params.id)
    if (!Number.isInteger(mediaId) || mediaId <= 0) {
      return fail('Invalid media id.', 400)
    }

    const asset = await loadBuilderMediaAsset(context.env.DB, mediaId)
    if (!asset) {
      return fail('Media asset not found.', 404)
    }

    const object = await context.env.IMAGES.get(asset.r2Key)
    if (!object?.body) {
      return fail('Media asset not found.', 404)
    }

    const headers: Record<string, string> = {}
    if (asset.originalName) {
      headers['content-disposition'] = `inline; filename="${asset.originalName.replace(/"/g, '\\"')}"`
    }

    return serveStoredImage(
      context,
      { body: object.body, etag: object.httpEtag, size: object.size },
      {
        contentType: asset.mimeType || 'application/octet-stream',
        cacheControl: 'public, max-age=31536000, immutable',
        headers,
      },
    )
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to load builder media.', 500)
  }
}
