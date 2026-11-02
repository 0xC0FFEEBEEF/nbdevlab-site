import type { AppEnv } from '../../_shared/types'
import { fail, ok } from '../../_shared/response'
import { ensureSiteContentSync } from '../../_shared/contentSync'
import { loadSiteSettings } from '../../_shared/utils'
import { defaultAnnouncement } from '../../../shared/announcement'

export const onRequestGet: PagesFunction<AppEnv> = async (context) => {
  try {
    await ensureSiteContentSync(context.env.DB)
    const settings = await loadSiteSettings(context.env.DB)
    // An announcement that is switched off is still a draft, so visitors get an empty one instead of its text.
    return ok({
      ...settings,
      announcement: settings.announcement.enabled ? settings.announcement : { ...defaultAnnouncement },
    })
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to load site settings.', 500)
  }
}
