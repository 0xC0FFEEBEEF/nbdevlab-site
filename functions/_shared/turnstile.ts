// Server-side check of a Cloudflare Turnstile token (the contact form sends it as `turnstileToken`).

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export const CONTACT_TURNSTILE_ACTION = 'contact'
export const SITE_HOSTNAMES = ['nbdevlab.com', 'www.nbdevlab.com']

export type TurnstileCheck =
  | { ok: true; skipped?: boolean }
  | { ok: false; status: number; error: string }

interface SiteverifyResult {
  success: boolean
  action?: string
  hostname?: string
  'error-codes'?: string[]
}

const FAILED: TurnstileCheck = { ok: false, status: 403, error: 'Verification failed. Please try again.' }
const UNAVAILABLE: TurnstileCheck = {
  ok: false,
  status: 503,
  error: 'Verification is unavailable right now. Please try again in a minute.',
}

export async function verifyTurnstile(
  secret: string | undefined,
  token: unknown,
  request: Request,
  options: { action?: string; hostnames?: string[]; fetcher?: typeof fetch } = {},
): Promise<TurnstileCheck> {
  if (!secret) {
    // Not configured (for example the local admin sandbox): keep the form working.
    console.warn('TURNSTILE_SECRET is not set; skipping the Turnstile check.')
    return { ok: true, skipped: true }
  }

  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) {
    return FAILED
  }

  const body = new FormData()
  body.append('secret', secret)
  body.append('response', token)
  const ip = request.headers.get('cf-connecting-ip')
  if (ip) {
    body.append('remoteip', ip)
  }

  let result: SiteverifyResult
  try {
    const response = await (options.fetcher ?? fetch)(SITEVERIFY_URL, { method: 'POST', body })
    if (!response.ok) {
      return UNAVAILABLE
    }
    result = (await response.json()) as SiteverifyResult
  } catch {
    return UNAVAILABLE
  }

  if (!result.success) {
    return FAILED
  }
  if (options.action && result.action && result.action !== options.action) {
    return FAILED
  }
  const hostnames = options.hostnames ?? SITE_HOSTNAMES
  if (result.hostname && !hostnames.includes(result.hostname)) {
    return FAILED
  }
  return { ok: true }
}
