import { readStoredConsent, writeStoredConsent, type AnalyticsConsent } from './consent'

export const GA_MEASUREMENT_ID = 'G-4ZTXFTX8KD'

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag: (...args: unknown[]) => void
  }
}

function hasWindow() {
  return typeof window !== 'undefined'
}

let initialized = false
let lastTrackedPage: string | null = null

export function resetAnalyticsForTests() {
  initialized = false
  lastTrackedPage = null
}

export function initAnalytics() {
  if (!hasWindow() || initialized) {
    return
  }

  initialized = true

  window.dataLayer = window.dataLayer || []
  // gtag.js only drains entries pushed as an Arguments object, so this must be
  // a plain function forwarding `arguments` rather than an arrow with rest args.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments)
  }

  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
  })

  if (readStoredConsent() === 'granted') {
    window.gtag('consent', 'update', { analytics_storage: 'granted' })
  }

  window.gtag('js', new Date())
  window.gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: false,
    ...(import.meta.env.DEV ? { debug_mode: true } : {}),
  })

  try {
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
    document.head.appendChild(script)
  } catch {
    // Blocked or unavailable; gtag calls keep queueing harmlessly.
  }
}

export function updateAnalyticsConsent(consent: AnalyticsConsent) {
  writeStoredConsent(consent)

  if (hasWindow() && typeof window.gtag === 'function') {
    window.gtag('consent', 'update', { analytics_storage: consent })
  }
}

export function trackPageView(page: string) {
  if (!hasWindow() || typeof window.gtag !== 'function') {
    return
  }

  // StrictMode re-runs effects with the same location; real navigation never
  // repeats the same page consecutively.
  if (page === lastTrackedPage) {
    return
  }

  lastTrackedPage = page
  window.gtag('event', 'page_view', {
    page_path: page,
    page_location: window.location.href,
    page_title: document.title,
  })
}
