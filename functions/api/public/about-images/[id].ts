import type { AppEnv } from '../../../_shared/types'
import { fail } from '../../../_shared/response'
import { serveStoredImage } from '../../../_shared/imageResponse'

export const onRequestGet: PagesFunction<AppEnv> = async (context) => {
  const imageId = Number(context.params.id)
  if (!Number.isInteger(imageId) || imageId <= 0) {
    return fail('Invalid image id.', 400)
  }

  try {
    const image = await context.env.DB
      .prepare('SELECT r2_key FROM about_images WHERE id = ? LIMIT 1')
      .bind(imageId)
      .first<{ r2_key: string }>()

    if (!image) {
      return fail('Image not found.', 404)
    }

    const object = await context.env.IMAGES.get(image.r2_key)
    if (!object) {
      return fail('Image not found in storage.', 404)
    }

    const meta = new Headers()
    object.writeHttpMetadata(meta)
    const contentType = meta.get('content-type') ?? 'application/octet-stream'
    meta.delete('content-type')
    meta.delete('cache-control')

    return serveStoredImage(
      context,
      { body: object.body, etag: object.httpEtag, size: object.size },
      { contentType, cacheControl: 'public, max-age=3600', headers: Object.fromEntries(meta) },
    )
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to load image.', 500)
  }
}
