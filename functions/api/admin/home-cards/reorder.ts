import type { AppEnv } from '../../../_shared/types'
import { fail, ok } from '../../../_shared/response'
import { nowIso, parseBody } from '../../../_shared/utils'

interface ReorderPayload {
  orderedIds?: number[]
}

export const onRequestPost: PagesFunction<AppEnv> = async (context) => {
  try {
    const payload = await parseBody<ReorderPayload>(context.request)
    const orderedIds = Array.isArray(payload.orderedIds)
      ? payload.orderedIds.filter((id) => Number.isInteger(id) && id > 0)
      : []

    if (orderedIds.length === 0) {
      return fail('orderedIds must contain at least one card id.', 400)
    }

    const timestamp = nowIso()
    const statements = orderedIds.map((id, index) =>
      context.env.DB
        .prepare('UPDATE home_cards SET sort_order = ?, updated_at = ? WHERE id = ?')
        .bind(index + 1, timestamp, id),
    )

    await context.env.DB.batch(statements)

    await context.env.DB
      .prepare('INSERT INTO admin_audit (action, metadata_json, created_at) VALUES (?, ?, ?)')
      .bind('home_card.reordered', JSON.stringify({ orderedIds }), timestamp)
      .run()

    return ok({ updated: orderedIds.length })
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to reorder home cards.', 500)
  }
}
