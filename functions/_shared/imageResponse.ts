// Serves images stored in R2. Browsers that accept WebP get PNG and JPEG images converted to WebP
// by the Cloudflare Images binding; the converted copy is kept in the edge cache. If conversion
// fails or does not save enough bytes, the original image is served instead.

/** The part of the Cloudflare Images binding this module uses. */
export interface ImageTransformer {
  input(stream: ReadableStream<Uint8Array>): {
    output(options: { format: 'image/webp'; quality?: number }): Promise<{ response(): Response }>
  }
}

export interface ImageRequestContext {
  request: Request
  /** IMAGE_WEBP = "off" turns conversion off without a code change (set it in the Worker's settings). */
  env: { IMAGE_TRANSFORMS?: ImageTransformer; IMAGE_WEBP?: string }
  waitUntil(promise: Promise<unknown>): void
}

export interface StoredImage {
  /** The R2 object body. Read once here, so callers must not touch it afterwards. */
  body: ReadableStream<Uint8Array>
  /** R2 `httpEtag`, already quoted. */
  etag?: string
  /** R2 object size in bytes. Larger images than MAX_CONVERT_BYTES are never converted. */
  size?: number
}

export interface ImageResponseOptions {
  contentType: string
  cacheControl: string
  /** Extra headers for both the original and the WebP response, such as Content-Disposition. */
  headers?: Record<string, string>
}

const CONVERTIBLE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/pjpeg'])

// PNGs here are mostly screenshots and diagrams: lossless WebP keeps them pixel-exact and is far smaller
// (Cloudflare Images returns lossless WebP for quality 100). Lossy WebP at 90 saved only ~6% on them.
const QUALITY_PNG = 100
const QUALITY_JPEG = 85

function qualityFor(contentType: string): number {
  return contentType.includes('png') ? QUALITY_PNG : QUALITY_JPEG
}

// Keep the original unless WebP is at least 10% smaller.
const MIN_SAVING = 0.1

// Cost and memory guard: big originals are streamed untouched instead of buffered and converted.
export const MAX_CONVERT_BYTES = 10 * 1024 * 1024

export function conversionEnabled(env: ImageRequestContext['env']): boolean {
  const flag = (env.IMAGE_WEBP ?? '').trim().toLowerCase()
  return Boolean(env.IMAGE_TRANSFORMS) && !['off', 'false', '0', 'no'].includes(flag)
}

export function acceptsWebp(request: Request): boolean {
  return /\bimage\/webp\b/i.test(request.headers.get('accept') ?? '')
}

export function isConvertible(contentType: string): boolean {
  return CONVERTIBLE_TYPES.has(contentType.split(';')[0].trim().toLowerCase())
}

function webpCacheKey(request: Request, etag: string | undefined, quality: number): Request {
  const url = new URL(request.url)
  url.search = ''
  url.searchParams.set('format', 'webp')
  url.searchParams.set('q', String(quality))
  if (etag) {
    url.searchParams.set('v', etag.replace(/"/g, ''))
  }
  return new Request(url.toString(), { method: 'GET' })
}

function edgeCache(): Cache | undefined {
  return typeof caches === 'undefined' ? undefined : (caches as unknown as { default?: Cache }).default
}

function webpFileName(disposition: string): string {
  return disposition.replace(/\.(png|jpe?g)(")?$/i, '.webp$2')
}

export async function serveStoredImage(
  context: ImageRequestContext,
  image: StoredImage,
  options: ImageResponseOptions,
): Promise<Response> {
  const convertible = isConvertible(options.contentType)

  const baseHeaders = (): Headers => {
    const headers = new Headers(options.headers)
    headers.set('cache-control', options.cacheControl)
    if (convertible) {
      headers.append('vary', 'Accept')
    }
    return headers
  }

  const originalResponse = (body: BodyInit | null): Response => {
    const headers = baseHeaders()
    headers.set('content-type', options.contentType)
    if (image.etag) {
      headers.set('etag', image.etag)
    }
    return new Response(body, { headers })
  }

  const transformer = context.env.IMAGE_TRANSFORMS
  const tooBig = image.size !== undefined && image.size > MAX_CONVERT_BYTES
  if (!convertible || !transformer || tooBig || !conversionEnabled(context.env) || !acceptsWebp(context.request)) {
    return originalResponse(image.body)
  }

  const quality = qualityFor(options.contentType)
  const cache = edgeCache()
  const cacheKey = webpCacheKey(context.request, image.etag, quality)
  if (cache) {
    const cached = await cache.match(cacheKey).catch(() => undefined)
    if (cached) {
      await image.body.cancel().catch(() => {})
      return cached
    }
  }

  const original = await new Response(image.body).arrayBuffer()

  let response: Response
  try {
    const result = await transformer
      .input(new Response(original).body as ReadableStream<Uint8Array>)
      .output({ format: 'image/webp', quality })
    const webp = await result.response().arrayBuffer()

    if (webp.byteLength > 0 && webp.byteLength <= original.byteLength * (1 - MIN_SAVING)) {
      const headers = baseHeaders()
      headers.set('content-type', 'image/webp')
      if (image.etag) {
        headers.set('etag', `"${image.etag.replace(/"/g, '')}-webp"`)
      }
      const disposition = headers.get('content-disposition')
      if (disposition) {
        headers.set('content-disposition', webpFileName(disposition))
      }
      response = new Response(webp, { headers })
    } else {
      response = originalResponse(original)
    }
  } catch (error) {
    console.warn('WebP conversion failed, serving the original image.', error)
    return originalResponse(original)
  }

  if (cache) {
    context.waitUntil(cache.put(cacheKey, response.clone()).catch(() => {}))
  }
  return response
}
