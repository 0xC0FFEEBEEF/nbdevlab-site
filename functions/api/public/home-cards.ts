import type { AppEnv } from '../../_shared/types'
import { fail, ok } from '../../_shared/response'
import { ensureSiteContentSync } from '../../_shared/contentSync'
import { loadHomeCards } from '../../_shared/utils'

export const onRequestGet: PagesFunction<AppEnv> = async (context) => {
  try {
    await ensureSiteContentSync(context.env.DB)
    const cards = await loadHomeCards(context.env.DB, true)
    return ok(cards)
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to load home cards.', 500)
  }
}
