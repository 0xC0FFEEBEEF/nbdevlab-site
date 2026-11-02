import type { AppEnv } from '../../_shared/types'
import { fail, ok } from '../../_shared/response'
import { nowIso } from '../../_shared/utils'

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9.\-_]/g, '-').slice(0, 120)
}

function suggestAltText(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export const onRequestPost: PagesFunction<AppEnv> = async (context) => {
  try {
    const formData = await context.request.formData()
    const single = formData.get('image')
    const file =
      single instanceof File && single.size > 0
        ? single
        : formData
            .getAll('images')
            .find((entry): entry is File => entry instanceof File && entry.size > 0)

    if (!file) {
      return fail('No image file was provided.', 400)
    }

    if (!file.type.startsWith('image/')) {
      return fail('Only image files can be uploaded here.', 400)
    }

    const timestamp = nowIso()
    const key = `about/${Date.now()}-${crypto.randomUUID()}-${sanitizeFilename(file.name)}`
    await context.env.IMAGES.put(key, await file.arrayBuffer(), {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream',
      },
    })

    const insert = await context.env.DB
      .prepare(
        `INSERT INTO about_images (r2_key, original_name, mime_type, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(key, file.name, file.type || 'application/octet-stream', timestamp)
      .run()

    const id = Number(insert.meta.last_row_id ?? 0)
    if (!Number.isInteger(id) || id <= 0) {
      return fail('Uploaded image but failed to record it.', 500)
    }

    await context.env.DB
      .prepare('INSERT INTO admin_audit (action, metadata_json, created_at) VALUES (?, ?, ?)')
      .bind(
        'about.images.uploaded',
        JSON.stringify({ imageId: id, filename: file.name }),
        timestamp,
      )
      .run()

    return ok({
      id,
      url: `/api/public/about-images/${id}`,
      filename: file.name,
      suggestedAlt: suggestAltText(file.name),
    })
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to upload About image.', 500)
  }
}
