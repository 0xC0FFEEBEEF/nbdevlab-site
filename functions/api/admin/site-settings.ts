import type { AppEnv, SiteSettings } from '../../_shared/types'
import { fail, ok } from '../../_shared/response'
import { normalizeAboutBlocks, serializeAboutBlocks } from '../../_shared/aboutBlocks'
import { normalizeSkillGroups, serializeSkillGroups } from '../../_shared/skillsGroups'
import { ensureSiteContentSync } from '../../_shared/contentSync'
import {
  ensureAnnouncementColumn,
  ensureGateSettingsColumn,
  ensureMaintenanceColumns,
  ensureStatusPowerModeColumn,
  loadSiteSettings,
  nowIso,
  parseBody,
} from '../../_shared/utils'
import { normalizeAnnouncement, stampAnnouncement } from '../../../shared/announcement'
import { normalizeGateSettings } from '../../../shared/gateSettings'
import { normalizeMaintenanceMessage } from '../../../shared/maintenance'
import { normalizeStatusPowerMode } from '../../../shared/statusPowerMode'

interface SettingsPayload {
  email?: string
  phone?: string
  location?: string
  socials?: Record<string, string>
  contactIntro?: string
  maintenanceMode?: boolean
  maintenanceMessage?: string
  announcement?: unknown
  statusPowerMode?: unknown
  homeEyebrow?: string
  homeTitle?: string
  homeTagline?: string
  homeIntro?: string
  gateSettings?: unknown
  aboutBlocks?: unknown
  skillsGroups?: unknown
}

export const onRequestGet: PagesFunction<AppEnv> = async (context) => {
  try {
    await ensureSiteContentSync(context.env.DB)
    const settings = await loadSiteSettings(context.env.DB)
    return ok(settings)
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to load site settings.', 500)
  }
}

export const onRequestPut: PagesFunction<AppEnv> = async (context) => {
  try {
    await ensureSiteContentSync(context.env.DB)
    await ensureGateSettingsColumn(context.env.DB)
    await ensureMaintenanceColumns(context.env.DB)
    await ensureStatusPowerModeColumn(context.env.DB)
    await ensureAnnouncementColumn(context.env.DB)
    const existing = await loadSiteSettings(context.env.DB)
    const payload = await parseBody<SettingsPayload>(context.request)

    const settings: SiteSettings = {
      email: payload.email?.trim() ?? existing.email,
      phone: payload.phone?.trim() ?? existing.phone,
      location: payload.location?.trim() ?? existing.location,
      socials: payload.socials ?? existing.socials,
      contactIntro: payload.contactIntro?.trim() ?? existing.contactIntro,
      maintenanceMode: payload.maintenanceMode ?? existing.maintenanceMode,
      maintenanceMessage:
        payload.maintenanceMessage === undefined
          ? existing.maintenanceMessage
          : normalizeMaintenanceMessage(payload.maintenanceMessage),
      announcement:
        payload.announcement === undefined
          ? existing.announcement
          : stampAnnouncement(
              normalizeAnnouncement(payload.announcement, existing.announcement),
              existing.announcement,
              nowIso(),
            ),
      statusPowerMode:
        payload.statusPowerMode === undefined
          ? existing.statusPowerMode
          : normalizeStatusPowerMode(payload.statusPowerMode, existing.statusPowerMode),
      homeEyebrow: payload.homeEyebrow?.trim() ?? existing.homeEyebrow,
      homeTitle: payload.homeTitle?.trim() ?? existing.homeTitle,
      homeTagline: payload.homeTagline?.trim() ?? existing.homeTagline,
      homeIntro: payload.homeIntro?.trim() ?? existing.homeIntro,
      gateSettings:
        payload.gateSettings === undefined
          ? existing.gateSettings
          : normalizeGateSettings(payload.gateSettings, existing.gateSettings),
      aboutBlocks:
        payload.aboutBlocks === undefined
          ? existing.aboutBlocks
          : normalizeAboutBlocks(payload.aboutBlocks),
      skillsGroups:
        payload.skillsGroups === undefined
          ? existing.skillsGroups
          : normalizeSkillGroups(payload.skillsGroups),
    }

    if (!settings.email) {
      return fail('Email is required.', 400)
    }

    await context.env.DB
      .prepare(
        `INSERT INTO site_settings (
           id,
           email,
           phone,
           location,
           socials_json,
           contact_intro,
           maintenance_mode,
           maintenance_message,
           announcement_json,
           status_power_mode,
           home_eyebrow,
           home_title,
           home_tagline,
           home_intro,
           gate_settings_json,
           about_blocks_json,
           skills_groups_json,
           updated_at
         )
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           email = excluded.email,
           phone = excluded.phone,
           location = excluded.location,
           socials_json = excluded.socials_json,
           contact_intro = excluded.contact_intro,
           maintenance_mode = excluded.maintenance_mode,
           maintenance_message = excluded.maintenance_message,
           announcement_json = excluded.announcement_json,
           status_power_mode = excluded.status_power_mode,
           home_eyebrow = excluded.home_eyebrow,
           home_title = excluded.home_title,
           home_tagline = excluded.home_tagline,
           home_intro = excluded.home_intro,
           gate_settings_json = excluded.gate_settings_json,
           about_blocks_json = excluded.about_blocks_json,
           skills_groups_json = excluded.skills_groups_json,
           updated_at = excluded.updated_at`,
      )
      .bind(
        settings.email,
        settings.phone || null,
        settings.location || null,
        JSON.stringify(settings.socials),
        settings.contactIntro,
        settings.maintenanceMode ? 1 : 0,
        settings.maintenanceMessage,
        JSON.stringify(settings.announcement),
        settings.statusPowerMode,
        settings.homeEyebrow,
        settings.homeTitle,
        settings.homeTagline,
        settings.homeIntro,
        JSON.stringify(settings.gateSettings),
        serializeAboutBlocks(settings.aboutBlocks),
        serializeSkillGroups(settings.skillsGroups),
        nowIso(),
      )
      .run()

    await context.env.DB
      .prepare('INSERT INTO admin_audit (action, metadata_json, created_at) VALUES (?, ?, ?)')
      .bind(
        'site_settings.updated',
        JSON.stringify({
          email: settings.email,
          maintenanceMode: settings.maintenanceMode,
          announcement: settings.announcement.enabled ? settings.announcement.style : 'off',
          statusPowerMode: settings.statusPowerMode,
        }),
        nowIso(),
      )
      .run()

    return ok(settings)
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to update site settings.', 500)
  }
}
