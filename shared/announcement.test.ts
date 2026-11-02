import { describe, expect, it } from 'vitest'
import {
  announcementHasText,
  announcementLimits,
  defaultAnnouncement,
  isAnnouncementLive,
  normalizeAnnouncement,
  normalizeAnnouncementLink,
  splitAnnouncementParagraphs,
  stampAnnouncement,
  toDateKey,
  type Announcement,
} from './announcement'

const live: Announcement = {
  ...defaultAnnouncement,
  enabled: true,
  message: 'The lab is running in a minimal state.',
  updatedAt: '2026-10-12T15:00:00.000Z',
}

describe('normalizeAnnouncement', () => {
  it('returns the defaults for anything that is not an object', () => {
    expect(normalizeAnnouncement(undefined)).toEqual(defaultAnnouncement)
    expect(normalizeAnnouncement('strip')).toEqual(defaultAnnouncement)
    expect(normalizeAnnouncement(null)).toEqual(defaultAnnouncement)
  })

  it('drops unknown choices and cuts text to its limit', () => {
    const cleaned = normalizeAnnouncement({
      enabled: 'yes',
      style: 'popup',
      tone: 'red',
      label: '  Heads   up  ',
      title: 'T'.repeat(500),
      message: 'M'.repeat(5000),
      expiresOn: 'tomorrow',
      updatedAt: 'not a date',
    })

    expect(cleaned.enabled).toBe(false)
    expect(cleaned.style).toBe('strip')
    expect(cleaned.tone).toBe('plain')
    expect(cleaned.label).toBe('Heads up')
    expect(cleaned.title).toHaveLength(announcementLimits.title)
    expect(cleaned.message).toHaveLength(announcementLimits.message)
    expect(cleaned.expiresOn).toBe('')
    expect(cleaned.updatedAt).toBe('')
  })

  it('keeps paragraph breaks in the message and tidies the rest', () => {
    const cleaned = normalizeAnnouncement({ message: '  First  line \r\n\r\n\r\n\r\nSecond\tline  ' })
    expect(cleaned.message).toBe('First line\n\nSecond line')
    expect(splitAnnouncementParagraphs(cleaned.message)).toEqual(['First line', 'Second line'])
  })

  it('fills fields that were left out from the given fallback', () => {
    expect(normalizeAnnouncement({ tone: 'alert' }, live)).toEqual({ ...live, tone: 'alert' })
  })
})

describe('normalizeAnnouncementLink', () => {
  it('accepts pages on this site and full addresses', () => {
    expect(normalizeAnnouncementLink(' /status ')).toBe('/status')
    expect(normalizeAnnouncementLink('https://example.com/a?b=1')).toBe('https://example.com/a?b=1')
    expect(normalizeAnnouncementLink('mailto:me@example.com')).toBe('mailto:me@example.com')
  })

  it('drops script links, other sites written as paths, and bare words', () => {
    expect(normalizeAnnouncementLink('javascript:alert(1)')).toBe('')
    expect(normalizeAnnouncementLink('//example.com/x')).toBe('')
    expect(normalizeAnnouncementLink('status')).toBe('')
    expect(normalizeAnnouncementLink(42)).toBe('')
  })
})

describe('stampAnnouncement', () => {
  const now = '2026-10-13T09:00:00.000Z'

  it('keeps the timestamp while the same announcement stays up', () => {
    expect(stampAnnouncement({ ...live, tone: 'alert', animate: false }, live, now).updatedAt).toBe(live.updatedAt)
  })

  it('stamps a new time when the wording, the link or the style changes', () => {
    expect(stampAnnouncement({ ...live, message: 'Back to normal.' }, live, now).updatedAt).toBe(now)
    expect(stampAnnouncement({ ...live, linkUrl: '/status' }, live, now).updatedAt).toBe(now)
    expect(stampAnnouncement({ ...live, style: 'takeover' }, live, now).updatedAt).toBe(now)
  })

  it('stamps a new time when it is switched back on', () => {
    const off = { ...live, enabled: false }
    expect(stampAnnouncement(off, live, now).updatedAt).toBe(live.updatedAt)
    expect(stampAnnouncement(live, off, now).updatedAt).toBe(now)
  })
})

describe('isAnnouncementLive', () => {
  it('needs to be switched on and to have text for its style', () => {
    expect(isAnnouncementLive(live, '2026-10-12')).toBe(true)
    expect(isAnnouncementLive({ ...live, enabled: false }, '2026-10-12')).toBe(false)
    expect(isAnnouncementLive({ ...live, message: '' }, '2026-10-12')).toBe(false)
    expect(announcementHasText({ ...live, style: 'takeover', message: '', title: 'Headline only' })).toBe(true)
    expect(announcementHasText({ ...live, style: 'strip', message: '', title: 'Headline only' })).toBe(false)
  })

  it('shows through its last day and not after it', () => {
    const untilThe14th = { ...live, expiresOn: '2026-10-14' }
    expect(isAnnouncementLive(untilThe14th, '2026-10-14')).toBe(true)
    expect(isAnnouncementLive(untilThe14th, '2026-10-15')).toBe(false)
  })

  it('reads the day in local time', () => {
    expect(toDateKey(new Date(2026, 9, 3, 23, 59))).toBe('2026-10-03')
  })
})
