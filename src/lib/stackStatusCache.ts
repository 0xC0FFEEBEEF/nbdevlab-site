import type { StackStatusSnapshot } from './stackStatus'

const stackStatusCacheKey = 'nbdevlab.stackStatus.lastKnown'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function readCachedStackStatus(): StackStatusSnapshot | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const rawValue = window.localStorage.getItem(stackStatusCacheKey)
    if (!rawValue) {
      return null
    }

    const parsed = JSON.parse(rawValue) as unknown
    if (!isRecord(parsed) || typeof parsed.fetchedAt !== 'string' || !('raw' in parsed)) {
      return null
    }

    return parsed as unknown as StackStatusSnapshot
  } catch {
    return null
  }
}

export function writeCachedStackStatus(snapshot: StackStatusSnapshot): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(stackStatusCacheKey, JSON.stringify(snapshot))
  } catch {
    // Ignore storage failures and keep the live page functional.
  }
}
