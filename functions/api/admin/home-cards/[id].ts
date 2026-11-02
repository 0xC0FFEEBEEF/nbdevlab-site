import type { AppEnv } from '../../../_shared/types'
import { fail, ok } from '../../../_shared/response'
import { loadHomeCards, nowIso, parseBody } from '../../../_shared/utils'

interface HomeCardPayload {
  title?: string
  subtitle?: string
  body?: string
  ctaLabel?: string
  ctaUrl?: string
  widthUnits?: number
  heightUnits?: number
  isVisible?: boolean
}

function parseCardId(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw
  return Number(value)
}

function normalizeUnits(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return fallback
  }
  return Math.max(1, Math.min(4, value))
}

export const onRequestPut: PagesFunction<AppEnv> = async (context) => {
  const cardId = parseCardId(context.params.id)
  if (!Number.isInteger(cardId) || cardId <= 0) {
    return fail('Invalid card id.', 400)
  }

  try {
    const exists = await context.env.DB
      .prepare('SELECT id FROM home_cards WHERE id = ? LIMIT 1')
      .bind(cardId)
      .first<{ id: number }>()

    if (!exists) {
      return fail('Card not found.', 404)
    }

    const payload = await parseBody<HomeCardPayload>(context.request)
    const title = payload.title?.trim() ?? ''

    if (!title) {
      return fail('Card title is required.', 400)
    }

    const timestamp = nowIso()

    await context.env.DB
      .prepare(
        `UPDATE home_cards
         SET title = ?,
             subtitle = ?,
             body = ?,
             cta_label = ?,
             cta_url = ?,
             width_units = ?,
             height_units = ?,
             is_visible = ?,
             updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        title,
        payload.subtitle?.trim() ?? '',
        payload.body?.trim() ?? '',
        payload.ctaLabel?.trim() ?? '',
        payload.ctaUrl?.trim() ?? '',
        normalizeUnits(payload.widthUnits, 1),
        normalizeUnits(payload.heightUnits, 1),
        payload.isVisible === false ? 0 : 1,
        timestamp,
        cardId,
      )
      .run()

    await context.env.DB
      .prepare('INSERT INTO admin_audit (action, metadata_json, created_at) VALUES (?, ?, ?)')
      .bind('home_card.updated', JSON.stringify({ id: cardId }), timestamp)
      .run()

    const cards = await loadHomeCards(context.env.DB, false)
    const updated = cards.find((card) => card.id === cardId)

    if (!updated) {
      return fail('Card updated but could not be loaded.', 500)
    }

    return ok(updated)
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to update home card.', 500)
  }
}

export const onRequestDelete: PagesFunction<AppEnv> = async (context) => {
  const cardId = parseCardId(context.params.id)
  if (!Number.isInteger(cardId) || cardId <= 0) {
    return fail('Invalid card id.', 400)
  }

  try {
    const exists = await context.env.DB
      .prepare('SELECT id FROM home_cards WHERE id = ? LIMIT 1')
      .bind(cardId)
      .first<{ id: number }>()

    if (!exists) {
      return fail('Card not found.', 404)
    }

    await context.env.DB.prepare('DELETE FROM home_cards WHERE id = ?').bind(cardId).run()

    await context.env.DB
      .prepare('INSERT INTO admin_audit (action, metadata_json, created_at) VALUES (?, ?, ?)')
      .bind('home_card.deleted', JSON.stringify({ id: cardId }), nowIso())
      .run()

    return ok({ id: cardId })
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to delete home card.', 500)
  }
}
