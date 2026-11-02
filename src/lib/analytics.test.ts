import { beforeEach, describe, expect, it } from 'vitest'
import {
  GA_MEASUREMENT_ID,
  initAnalytics,
  resetAnalyticsForTests,
  trackPageView,
  updateAnalyticsConsent,
} from './analytics'
import { readStoredConsent, writeStoredConsent } from './consent'

function dataLayerCommands() {
  return window.dataLayer.map((entry) => {
    const args = Array.from(entry as ArrayLike<unknown>)
    return args
  })
}

describe('analytics bootstrap', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.dataLayer = []
    // @ts-expect-error reset between tests
    delete window.gtag
    document
      .querySelectorAll('script[src*="googletagmanager"]')
      .forEach((node) => node.remove())
    resetAnalyticsForTests()
  })

  it('queues consent default before config and injects the gtag script', () => {
    initAnalytics()

    const commands = dataLayerCommands()
    const defaultIndex = commands.findIndex((args) => args[0] === 'consent' && args[1] === 'default')
    const configIndex = commands.findIndex((args) => args[0] === 'config')

    expect(defaultIndex).toBeGreaterThanOrEqual(0)
    expect(configIndex).toBeGreaterThan(defaultIndex)
    expect(commands[defaultIndex][2]).toMatchObject({
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    })
    expect(commands[configIndex][1]).toBe(GA_MEASUREMENT_ID)
    expect(commands[configIndex][2]).toMatchObject({ send_page_view: false })

    const script = document.querySelector<HTMLScriptElement>('script[src*="googletagmanager"]')
    expect(script).not.toBeNull()
    expect(script?.src).toContain(GA_MEASUREMENT_ID)
    expect(script?.async).toBe(true)
  })

  it('is idempotent across repeat calls', () => {
    initAnalytics()
    const count = window.dataLayer.length
    initAnalytics()
    expect(window.dataLayer.length).toBe(count)
    expect(document.querySelectorAll('script[src*="googletagmanager"]').length).toBe(1)
  })

  it('re-applies stored granted consent on boot', () => {
    writeStoredConsent('granted')
    initAnalytics()

    const update = dataLayerCommands().find((args) => args[0] === 'consent' && args[1] === 'update')
    expect(update?.[2]).toMatchObject({ analytics_storage: 'granted' })
  })

  it('does not send a consent update when no choice is stored', () => {
    initAnalytics()
    const update = dataLayerCommands().find((args) => args[0] === 'consent' && args[1] === 'update')
    expect(update).toBeUndefined()
  })

  it('updateAnalyticsConsent persists the choice and pushes a consent update', () => {
    initAnalytics()
    updateAnalyticsConsent('granted')

    expect(readStoredConsent()).toBe('granted')
    const update = dataLayerCommands().find((args) => args[0] === 'consent' && args[1] === 'update')
    expect(update?.[2]).toMatchObject({ analytics_storage: 'granted' })
  })

  it('suppresses consecutive duplicate page views but tracks navigation', () => {
    initAnalytics()

    trackPageView('/')
    trackPageView('/')
    trackPageView('/projects')
    trackPageView('/')

    const pageViews = dataLayerCommands().filter(
      (args) => args[0] === 'event' && args[1] === 'page_view',
    )
    expect(pageViews.map((args) => (args[2] as { page_path: string }).page_path)).toEqual([
      '/',
      '/projects',
      '/',
    ])
  })
})
