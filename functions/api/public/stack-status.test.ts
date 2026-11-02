import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FRESH_SECONDS, onRequestGet, STALE_SECONDS } from './stack-status'

const PI_PAYLOAD = { generatedAt: '2026-11-02T07:00:00Z', hosts: [] }

function memoryCache() {
  const store = new Map<string, Response>()
  return {
    store,
    match: async (req: Request) => store.get(req.url)?.clone(),
    put: async (req: Request, res: Response) => {
      store.set(req.url, res)
    },
  }
}

function call() {
  const pending: Promise<unknown>[] = []
  const context = {
    request: new Request('https://www.nbdevlab.com/api/public/stack-status'),
    env: {},
    params: {},
    data: {},
    next: async () => new Response(null),
    waitUntil: (p: Promise<unknown>) => {
      pending.push(p)
    },
    passThroughOnException: () => {},
  } as unknown as Parameters<typeof onRequestGet>[0]
  return { run: async () => {
    const res = await onRequestGet(context)
    await Promise.all(pending)
    return res
  } }
}

let now = Date.parse('2026-11-02T07:00:00Z')

beforeEach(() => {
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  vi.stubGlobal('caches', { default: memoryCache() })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('stack-status', () => {
  it('fetches from the Pi, then serves the cached copy while it is fresh', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(PI_PAYLOAD), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const first = await call().run()
    expect(first.status).toBe(200)
    expect(first.headers.get('X-Status-Cache')).toBe('miss')
    expect((await first.json()).success).toBe(true)

    now += (FRESH_SECONDS - 5) * 1000
    const second = await call().run()
    expect(second.headers.get('X-Status-Cache')).toBe('hit')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('passes a timeout signal to the Pi request', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal)
      return new Response(JSON.stringify(PI_PAYLOAD))
    })
    vi.stubGlobal('fetch', fetchMock)
    await call().run()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('serves the last good snapshot when the Pi stops answering', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(PI_PAYLOAD))))
    await call().run()

    now += (FRESH_SECONDS + 30) * 1000
    const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' })
    vi.stubGlobal('fetch', vi.fn(async () => { throw timeout }))
    const res = await call().run()
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Status-Cache')).toBe('stale')
  })

  it('reports a timeout once the last snapshot is too old', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(PI_PAYLOAD))))
    await call().run()

    now += (STALE_SECONDS + 60) * 1000
    const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' })
    vi.stubGlobal('fetch', vi.fn(async () => { throw timeout }))
    const res = await call().run()
    expect(res.status).toBe(504)
    expect((await res.json()).error).toMatch(/did not answer/)
  })

  it('explains a Cloudflare challenge in front of the status API', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<title>Just a moment...</title>', {
      status: 403,
      headers: { 'cf-mitigated': 'challenge', 'content-type': 'text/html' },
    })))
    const res = await call().run()
    expect(res.status).toBe(502)
    expect((await res.json()).error).toMatch(/challenge/)
  })
})
