import { describe, expect, it, vi } from 'vitest'
import { verifyTurnstile } from './turnstile'

const request = new Request('https://www.nbdevlab.com/api/public/contact', {
  method: 'POST',
  headers: { 'cf-connecting-ip': '203.0.113.7' },
})

function fetcherReturning(body: unknown, status = 200) {
  return vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(body), { status }))
}

describe('verifyTurnstile', () => {
  it('skips the check when no secret is configured', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(verifyTurnstile(undefined, undefined, request)).resolves.toEqual({ ok: true, skipped: true })
    warn.mockRestore()
  })

  it('rejects a missing or oversized token without calling Cloudflare', async () => {
    const fetcher = fetcherReturning({ success: true })
    expect((await verifyTurnstile('s', undefined, request, { fetcher })).ok).toBe(false)
    expect((await verifyTurnstile('s', '', request, { fetcher })).ok).toBe(false)
    expect((await verifyTurnstile('s', 'x'.repeat(3000), request, { fetcher })).ok).toBe(false)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('accepts a valid token and sends the secret, token and visitor IP', async () => {
    const fetcher = fetcherReturning({ success: true, action: 'contact', hostname: 'www.nbdevlab.com' })
    const result = await verifyTurnstile('secret-1', 'token-1', request, { action: 'contact', fetcher })
    expect(result).toEqual({ ok: true })
    const body = fetcher.mock.calls[0][1]?.body as FormData
    expect(body.get('secret')).toBe('secret-1')
    expect(body.get('response')).toBe('token-1')
    expect(body.get('remoteip')).toBe('203.0.113.7')
  })

  it('rejects a token Cloudflare says is invalid', async () => {
    const fetcher = fetcherReturning({ success: false, 'error-codes': ['invalid-input-response'] })
    expect(await verifyTurnstile('s', 't', request, { fetcher })).toMatchObject({ ok: false, status: 403 })
  })

  it('rejects a token issued for another action or hostname', async () => {
    const wrongAction = fetcherReturning({ success: true, action: 'login', hostname: 'www.nbdevlab.com' })
    expect((await verifyTurnstile('s', 't', request, { action: 'contact', fetcher: wrongAction })).ok).toBe(false)
    const wrongHost = fetcherReturning({ success: true, action: 'contact', hostname: 'evil.example' })
    expect((await verifyTurnstile('s', 't', request, { action: 'contact', fetcher: wrongHost })).ok).toBe(false)
  })

  it('reports Cloudflare being unreachable as a temporary error', async () => {
    const down = vi.fn(async () => {
      throw new Error('network')
    })
    expect(await verifyTurnstile('s', 't', request, { fetcher: down })).toMatchObject({ ok: false, status: 503 })
    expect(await verifyTurnstile('s', 't', request, { fetcher: fetcherReturning({}, 500) })).toMatchObject({
      ok: false,
      status: 503,
    })
  })
})
