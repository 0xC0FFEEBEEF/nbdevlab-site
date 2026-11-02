import { useEffect, useRef } from 'react'
import { TURNSTILE_FIELD, TURNSTILE_SITE_KEY } from '../lib/turnstile'

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string
  reset(widgetId?: string): void
  remove(widgetId: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let scriptPromise: Promise<void> | null = null

function loadTurnstile(): Promise<void> {
  if (window.turnstile) {
    return Promise.resolve()
  }
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('Turnstile failed to load.'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

/**
 * Renders a Cloudflare Turnstile check inside a form. The token lands in a hidden input named
 * `cf-turnstile-response`, so it is part of the form's FormData. Change `resetKey` after each
 * submit to get a fresh token (tokens are single use).
 */
export function TurnstileWidget({ action, resetKey = 0 }: { action: string; resetKey?: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    loadTurnstile()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) {
          return
        }
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action,
          theme: 'dark',
          appearance: 'interaction-only',
          'response-field-name': TURNSTILE_FIELD,
        })
      })
      .catch(() => {
        // The form shows a message if no token is present at submit time.
      })
    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
      }
      widgetIdRef.current = undefined
    }
  }, [action])

  useEffect(() => {
    if (resetKey > 0 && widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current)
    }
  }, [resetKey])

  return <div ref={containerRef} className="contact-form__turnstile" />
}
