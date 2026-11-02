import { afterEach, describe, expect, it, vi } from 'vitest'
import { acceptsWebp, isConvertible, MAX_CONVERT_BYTES, serveStoredImage, type ImageTransformer } from './imageResponse'

const WEBP_ACCEPT = 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'

function stream(bytes: number): ReadableStream<Uint8Array> {
  return new Response(new Uint8Array(bytes).fill(7)).body as ReadableStream<Uint8Array>
}

function fakeTransformer(outputBytes: number | Error) {
  const output = vi.fn(async (options: { format: string; quality?: number }) => {
    void options
    if (outputBytes instanceof Error) {
      throw outputBytes
    }
    return { response: () => new Response(new Uint8Array(outputBytes)) }
  })
  const input = vi.fn(() => ({ output }))
  return { binding: { input } as unknown as ImageTransformer, input, output }
}

function context(accept: string | null, transformer?: ImageTransformer, flag?: string) {
  const pending: Promise<unknown>[] = []
  const headers = accept ? { accept } : undefined
  return {
    ctx: {
      request: new Request('https://www.nbdevlab.com/api/public/images/1?x=1', { headers }),
      env: { IMAGE_TRANSFORMS: transformer, IMAGE_WEBP: flag },
      waitUntil: (promise: Promise<unknown>) => {
        pending.push(promise)
      },
    },
    pending,
  }
}

const png = { contentType: 'image/png', cacheControl: 'public, max-age=3600' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('imageResponse helpers', () => {
  it('detects WebP support from the Accept header', () => {
    expect(acceptsWebp(new Request('https://x/', { headers: { accept: WEBP_ACCEPT } }))).toBe(true)
    expect(acceptsWebp(new Request('https://x/', { headers: { accept: 'image/png,*/*' } }))).toBe(false)
    expect(acceptsWebp(new Request('https://x/'))).toBe(false)
  })

  it('only converts PNG and JPEG', () => {
    expect(isConvertible('image/png')).toBe(true)
    expect(isConvertible('image/jpeg; charset=binary')).toBe(true)
    expect(isConvertible('image/gif')).toBe(false)
    expect(isConvertible('image/svg+xml')).toBe(false)
    expect(isConvertible('image/webp')).toBe(false)
  })
})

describe('serveStoredImage', () => {
  it('converts a PNG to lossless WebP when the browser accepts it and it is smaller', async () => {
    const t = fakeTransformer(400)
    const { ctx } = context(WEBP_ACCEPT, t.binding)
    const res = await serveStoredImage(ctx, { body: stream(1000), etag: '"abc"' }, png)

    expect(res.headers.get('content-type')).toBe('image/webp')
    expect(res.headers.get('etag')).toBe('"abc-webp"')
    expect(res.headers.get('vary')).toBe('Accept')
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600')
    expect((await res.arrayBuffer()).byteLength).toBe(400)
    expect(t.output).toHaveBeenCalledWith({ format: 'image/webp', quality: 100 })
  })

  it('uses the photo quality for JPEG', async () => {
    const t = fakeTransformer(100)
    const { ctx } = context(WEBP_ACCEPT, t.binding)
    await serveStoredImage(ctx, { body: stream(1000) }, { ...png, contentType: 'image/jpeg' })
    expect(t.output).toHaveBeenCalledWith({ format: 'image/webp', quality: 85 })
  })

  it('serves the original when the browser does not accept WebP', async () => {
    const t = fakeTransformer(100)
    const { ctx } = context('image/png,*/*', t.binding)
    const res = await serveStoredImage(ctx, { body: stream(1000), etag: '"abc"' }, png)

    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('etag')).toBe('"abc"')
    expect(res.headers.get('vary')).toBe('Accept')
    expect((await res.arrayBuffer()).byteLength).toBe(1000)
    expect(t.input).not.toHaveBeenCalled()
  })

  it('leaves GIFs alone and does not add Vary', async () => {
    const t = fakeTransformer(100)
    const { ctx } = context(WEBP_ACCEPT, t.binding)
    const res = await serveStoredImage(ctx, { body: stream(1000) }, { ...png, contentType: 'image/gif' })

    expect(res.headers.get('content-type')).toBe('image/gif')
    expect(res.headers.get('vary')).toBeNull()
    expect(t.input).not.toHaveBeenCalled()
  })

  it('keeps the original when WebP saves less than 10%', async () => {
    const t = fakeTransformer(950)
    const { ctx } = context(WEBP_ACCEPT, t.binding)
    const res = await serveStoredImage(ctx, { body: stream(1000), etag: '"abc"' }, png)

    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('etag')).toBe('"abc"')
    expect((await res.arrayBuffer()).byteLength).toBe(1000)
  })

  it('falls back to the original when conversion fails', async () => {
    const t = fakeTransformer(new Error('9422: transformation limit'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { ctx } = context(WEBP_ACCEPT, t.binding)
    const res = await serveStoredImage(ctx, { body: stream(1000) }, png)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect((await res.arrayBuffer()).byteLength).toBe(1000)
    warn.mockRestore()
  })

  it('serves the original when the Images binding is missing', async () => {
    const { ctx } = context(WEBP_ACCEPT, undefined)
    const res = await serveStoredImage(ctx, { body: stream(1000) }, png)
    expect(res.headers.get('content-type')).toBe('image/png')
  })

  it('renames the download file name to .webp', async () => {
    const t = fakeTransformer(100)
    const { ctx } = context(WEBP_ACCEPT, t.binding)
    const res = await serveStoredImage(ctx, { body: stream(1000) }, {
      ...png,
      headers: { 'content-disposition': 'inline; filename="rack.PNG"' },
    })
    expect(res.headers.get('content-disposition')).toBe('inline; filename="rack.webp"')
  })

  it('stores the WebP copy in the edge cache and reuses it', async () => {
    const store = new Map<string, Response>()
    vi.stubGlobal('caches', {
      default: {
        match: async (req: Request) => store.get(req.url)?.clone(),
        put: async (req: Request, res: Response) => {
          store.set(req.url, res)
        },
      },
    })
    const t = fakeTransformer(400)

    const first = context(WEBP_ACCEPT, t.binding)
    await serveStoredImage(first.ctx, { body: stream(1000), etag: '"abc"' }, png)
    await Promise.all(first.pending)
    expect([...store.keys()]).toEqual(['https://www.nbdevlab.com/api/public/images/1?format=webp&q=100&v=abc'])

    const second = context(WEBP_ACCEPT, t.binding)
    const res = await serveStoredImage(second.ctx, { body: stream(1000), etag: '"abc"' }, png)
    expect(res.headers.get('content-type')).toBe('image/webp')
    expect(t.input).toHaveBeenCalledTimes(1)
  })

  it('does not convert when IMAGE_WEBP is off (kill switch)', async () => {
    const t = fakeTransformer(100)
    const { ctx } = context(WEBP_ACCEPT, t.binding, 'off')
    const res = await serveStoredImage(ctx, { body: stream(1000) }, png)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(t.input).not.toHaveBeenCalled()
  })

  it('never converts images over the size cap', async () => {
    const t = fakeTransformer(100)
    const { ctx } = context(WEBP_ACCEPT, t.binding)
    const res = await serveStoredImage(ctx, { body: stream(10), size: MAX_CONVERT_BYTES + 1 }, png)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(t.input).not.toHaveBeenCalled()
  })

  it('ignores query strings in the cache key so they cannot force new conversions', async () => {
    const store = new Map<string, Response>()
    vi.stubGlobal('caches', {
      default: {
        match: async (req: Request) => store.get(req.url)?.clone(),
        put: async (req: Request, res: Response) => {
          store.set(req.url, res)
        },
      },
    })
    const t = fakeTransformer(400)
    for (const q of ['a=1', 'b=2', 'cachebust=999']) {
      const c = context(WEBP_ACCEPT, t.binding)
      const ctx = { ...c.ctx, request: new Request(`https://www.nbdevlab.com/api/public/images/1?${q}`, { headers: { accept: WEBP_ACCEPT } }) }
      await serveStoredImage(ctx, { body: stream(1000), etag: '"abc"' }, png)
      await Promise.all(c.pending)
    }
    expect(store.size).toBe(1)
    expect(t.input).toHaveBeenCalledTimes(1)
  })
})
