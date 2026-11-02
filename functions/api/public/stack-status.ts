import type { AppEnv } from '../../_shared/types'
import {
  isCloudflareChallengeResponse,
  normalizeStackStatusPayload,
} from '../../../src/lib/stackStatus'

// The live status comes from the Pi's API (api.nbdevlab.com, through the tunnel). Every open status page polls
// this endpoint, so a short edge cache keeps that off the Pi, and a timeout keeps a stuck Pi from hanging the page:
// if the Pi does not answer in time, the last good snapshot (up to STALE_SECONDS old) is served instead.
export const FRESH_SECONDS = 15
export const STALE_SECONDS = 600
export const TIMEOUT_MS = 8000

interface CachedSnapshot {
  fetchedAt: number
  data: unknown
}

function jsonResponse(body: unknown, cacheState: string, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data: body }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Status-Cache': cacheState,
    },
  })
}

function errorResponse(error: string, status = 400): Response {
  return new Response(JSON.stringify({ success: false, data: null, error }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function getBaseUrl(env: AppEnv): string {
  return (env.STATUS_API_BASE_URL?.trim() || 'https://api.nbdevlab.com').replace(/\/+$/, '')
}

function edgeCache(): Cache | undefined {
  return typeof caches === 'undefined' ? undefined : (caches as unknown as { default?: Cache }).default
}

async function readCached(cache: Cache | undefined, key: Request): Promise<CachedSnapshot | null> {
  if (!cache) {
    return null
  }
  try {
    const hit = await cache.match(key)
    return hit ? ((await hit.json()) as CachedSnapshot) : null
  } catch {
    return null
  }
}

type FetchResult = { ok: true; data: unknown } | { ok: false; error: string; status: number }

async function fetchSnapshot(sourceUrl: string, healthUrl: string): Promise<FetchResult> {
  let response: Response
  try {
    response = await fetch(sourceUrl, {
      headers: { Accept: 'application/json, text/plain;q=0.9, */*;q=0.8' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    return timedOut
      ? { ok: false, error: `The status API did not answer within ${TIMEOUT_MS / 1000} s.`, status: 504 }
      : { ok: false, error: error instanceof Error ? error.message : 'Failed to reach the public status API.', status: 502 }
  }

  const bodyText = await response.text()
  if (isCloudflareChallengeResponse(response, bodyText)) {
    return {
      ok: false,
      error: 'The status API is behind a Cloudflare challenge. Allowlist /api/status and /healthz so the site can read it.',
      status: 502,
    }
  }
  if (!response.ok) {
    return { ok: false, error: `Status API returned ${response.status}.`, status: 502 }
  }
  try {
    return { ok: true, data: normalizeStackStatusPayload(JSON.parse(bodyText) as unknown, sourceUrl, healthUrl) }
  } catch {
    return { ok: false, error: 'Status API did not return JSON.', status: 502 }
  }
}

export const onRequestGet: PagesFunction<AppEnv> = async (context) => {
  const baseUrl = getBaseUrl(context.env)
  const sourceUrl = `${baseUrl}/api/status`
  const healthUrl = `${baseUrl}/healthz`

  const cache = edgeCache()
  const cacheKey = new Request(new URL(`/api/public/stack-status?snapshot=${encodeURIComponent(baseUrl)}`, context.request.url))
  const cached = await readCached(cache, cacheKey)
  const age = cached ? (Date.now() - cached.fetchedAt) / 1000 : Infinity

  if (cached && age < FRESH_SECONDS) {
    return jsonResponse(cached.data, 'hit')
  }

  const result = await fetchSnapshot(sourceUrl, healthUrl)
  if (result.ok) {
    if (cache) {
      const entry: CachedSnapshot = { fetchedAt: Date.now(), data: result.data }
      const stored = new Response(JSON.stringify(entry), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${STALE_SECONDS}` },
      })
      context.waitUntil(cache.put(cacheKey, stored).catch(() => {}))
    }
    return jsonResponse(result.data, 'miss')
  }

  if (cached && age < STALE_SECONDS) {
    return jsonResponse(cached.data, 'stale')
  }
  return errorResponse(result.error, result.status)
}
