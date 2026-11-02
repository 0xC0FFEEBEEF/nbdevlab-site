import type { AppEnv } from '../../_shared/types'
import { fail, ok } from '../../_shared/response'
import { ensureSiteContentSync } from '../../_shared/contentSync'
import { loadHomeCards, nowIso, parseBody } from '../../_shared/utils'

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

function normalizeUnits(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return fallback
  }
  return Math.max(1, Math.min(4, value))
}

export const onRequestGet: PagesFunction<AppEnv> = async (context) => {
  try {
    await ensureSiteContentSync(context.env.DB)
    const cards = await loadHomeCards(context.env.DB, false)
    return ok(cards)
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to load home cards.', 500)
  }
}

export const onRequestPost: PagesFunction<AppEnv> = async (context) => {
  try {
    const payload = await parseBody<HomeCardPayload>(context.request)
    const title = payload.title?.trim() ?? ''

    if (!title) {
      return fail('Card title is required.', 400)
    }

    const sortResult = await context.env.DB
      .prepare('SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM home_cards')
      .first<{ max_sort: number }>()

    const sortOrder = Number(sortResult?.max_sort ?? 0) + 1
    const timestamp = nowIso()

    const insert = await context.env.DB
      .prepare(
        `INSERT INTO home_cards
          (title, subtitle, body, cta_label, cta_url, width_units, height_units, sort_order, is_visible, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        title,
        payload.subtitle?.trim() ?? '',
        payload.body?.trim() ?? '',
        payload.ctaLabel?.trim() ?? '',
        payload.ctaUrl?.trim() ?? '',
        normalizeUnits(payload.widthUnits, 1),
        normalizeUnits(payload.heightUnits, 1),
        sortOrder,
        payload.isVisible === false ? 0 : 1,
        timestamp,
        timestamp,
      )
      .run()

    await context.env.DB
      .prepare('INSERT INTO admin_audit (action, metadata_json, created_at) VALUES (?, ?, ?)')
      .bind('home_card.created', JSON.stringify({ id: insert.meta.last_row_id }), timestamp)
      .run()

    const cards = await loadHomeCards(context.env.DB, false)
    const created = cards.find((card) => card.id === Number(insert.meta.last_row_id))

    if (!created) {
      return fail('Card created but could not be loaded.', 500)
    }

    return ok(created, 201)
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to create home card.', 500)
  }
}
