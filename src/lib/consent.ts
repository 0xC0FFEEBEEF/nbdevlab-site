export type AnalyticsConsent = 'granted' | 'denied'

export const consentStorageKey = 'nbdevlab:consent:v1'

interface StoredConsent {
  analytics: AnalyticsConsent
  updatedAt: string
}

function hasWindow() {
  return typeof window !== 'undefined'
}

function normalizeConsent(value: unknown): AnalyticsConsent | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const analytics = (value as Partial<StoredConsent>).analytics
  return analytics === 'granted' || analytics === 'denied' ? analytics : null
}

export function readStoredConsent(): AnalyticsConsent | null {
  if (!hasWindow()) {
    return null
  }

  try {
    const raw = window.localStorage.getItem(consentStorageKey)
    if (!raw) {
      return null
    }

    return normalizeConsent(JSON.parse(raw))
  } catch {
    return null
  }
}

export function writeStoredConsent(consent: AnalyticsConsent) {
  if (!hasWindow()) {
    return
  }

  try {
    const stored: StoredConsent = { analytics: consent, updatedAt: new Date().toISOString() }
    window.localStorage.setItem(consentStorageKey, JSON.stringify(stored))
  } catch {
    // Ignore storage failures; consent still applies for this session.
  }
}
