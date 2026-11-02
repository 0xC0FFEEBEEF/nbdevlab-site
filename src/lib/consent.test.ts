import { beforeEach, describe, expect, it } from 'vitest'
import { consentStorageKey, readStoredConsent, writeStoredConsent } from './consent'

describe('consent storage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('returns null when nothing is stored', () => {
    expect(readStoredConsent()).toBeNull()
  })

  it('returns null for malformed values', () => {
    window.localStorage.setItem(consentStorageKey, 'not json {{')
    expect(readStoredConsent()).toBeNull()

    window.localStorage.setItem(consentStorageKey, JSON.stringify({ analytics: 'maybe' }))
    expect(readStoredConsent()).toBeNull()

    window.localStorage.setItem(consentStorageKey, JSON.stringify('granted'))
    expect(readStoredConsent()).toBeNull()
  })

  it('round-trips granted and denied choices', () => {
    writeStoredConsent('granted')
    expect(readStoredConsent()).toBe('granted')

    writeStoredConsent('denied')
    expect(readStoredConsent()).toBe('denied')
  })

  it('stores an updatedAt timestamp', () => {
    writeStoredConsent('granted')
    const raw = JSON.parse(window.localStorage.getItem(consentStorageKey) ?? '{}')
    expect(typeof raw.updatedAt).toBe('string')
    expect(Number.isNaN(Date.parse(raw.updatedAt))).toBe(false)
  })
})
