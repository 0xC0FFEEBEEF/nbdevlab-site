import { normalizeSafeLink } from './safeLink'

export type AnnouncementStyle = 'strip' | 'takeover'
export type AnnouncementTone = 'plain' | 'alert'

export interface Announcement {
  enabled: boolean
  style: AnnouncementStyle
  tone: AnnouncementTone
  label: string
  title: string
  message: string
  linkLabel: string
  linkUrl: string
  animate: boolean
  dismissible: boolean
  /** Last day it shows, as YYYY-MM-DD in the visitor's own time zone. Empty means no end date. */
  expiresOn: string
  /** Set by the server whenever a new announcement goes out. Visitors' dismissals are remembered against it. */
  updatedAt: string
}

export const announcementStyles: readonly AnnouncementStyle[] = ['strip', 'takeover']
export const announcementTones: readonly AnnouncementTone[] = ['plain', 'alert']

export const announcementLimits = {
  label: 24,
  title: 80,
  message: 600,
  linkLabel: 40,
  linkUrl: 300,
} as const

/** Past this length a strip message wraps onto several lines on a laptop screen. */
export const stripComfortableLength = 110

export const defaultAnnouncement: Announcement = {
  enabled: false,
  style: 'strip',
  tone: 'plain',
  label: '',
  title: '',
  message: '',
  linkLabel: '',
  linkUrl: '',
  animate: true,
  dismissible: true,
  expiresOn: '',
  updatedAt: '',
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback
}

function asLine(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') {
    return fallback
  }

  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function asParagraphs(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') {
    return fallback
  }

  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength)
}

/** A page on this site ("/status") or a full web or mail address. Anything else is dropped. */
export function normalizeAnnouncementLink(value: unknown): string {
  return normalizeSafeLink(value, announcementLimits.linkUrl)
}

function asDateKey(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback
  }

  const trimmed = value.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) && !Number.isNaN(Date.parse(`${trimmed}T00:00:00Z`)) ? trimmed : ''
}

function asTimestamp(value: unknown, fallback: string): string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : fallback
}

export function normalizeAnnouncement(
  value: unknown,
  defaults: Announcement = defaultAnnouncement,
): Announcement {
  const source = typeof value === 'object' && value !== null ? (value as Partial<Announcement>) : {}

  return {
    enabled: asBoolean(source.enabled, defaults.enabled),
    style: asEnum(source.style, announcementStyles, defaults.style),
    tone: asEnum(source.tone, announcementTones, defaults.tone),
    label: asLine(source.label, defaults.label, announcementLimits.label),
    title: asLine(source.title, defaults.title, announcementLimits.title),
    message: asParagraphs(source.message, defaults.message, announcementLimits.message),
    linkLabel: asLine(source.linkLabel, defaults.linkLabel, announcementLimits.linkLabel),
    linkUrl: source.linkUrl === undefined ? defaults.linkUrl : normalizeAnnouncementLink(source.linkUrl),
    animate: asBoolean(source.animate, defaults.animate),
    dismissible: asBoolean(source.dismissible, defaults.dismissible),
    expiresOn: asDateKey(source.expiresOn, defaults.expiresOn),
    updatedAt: asTimestamp(source.updatedAt, defaults.updatedAt),
  }
}

/** A strip needs its one line. A take-over needs a headline or a message. */
export function announcementHasText(announcement: Announcement): boolean {
  return announcement.style === 'strip'
    ? announcement.message.length > 0
    : announcement.title.length > 0 || announcement.message.length > 0
}

/** The parts a visitor reads. A change to any of them makes it a new announcement. */
function announcementWording(announcement: Announcement): string {
  return JSON.stringify([
    announcement.style,
    announcement.label,
    announcement.title,
    announcement.message,
    announcement.linkLabel,
    announcement.linkUrl,
  ])
}

/**
 * Keeps the old timestamp while the same announcement stays up, so visitors who dismissed it are not shown it
 * again. Turning it back on, or changing what it says, makes it new for everyone.
 */
export function stampAnnouncement(next: Announcement, previous: Announcement, now: string): Announcement {
  if (!next.enabled) {
    return { ...next, updatedAt: previous.updatedAt }
  }

  const isNew =
    !previous.enabled || !previous.updatedAt || announcementWording(next) !== announcementWording(previous)

  return { ...next, updatedAt: isNew ? now : previous.updatedAt }
}

export function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function isAnnouncementExpired(announcement: Announcement, today: string): boolean {
  return announcement.expiresOn !== '' && today > announcement.expiresOn
}

export function isAnnouncementLive(announcement: Announcement, today: string): boolean {
  return announcement.enabled && announcementHasText(announcement) && !isAnnouncementExpired(announcement, today)
}

export function splitAnnouncementParagraphs(message: string): string[] {
  return message
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}
