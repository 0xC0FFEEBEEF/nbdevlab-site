import type { ApiEnvelope } from './types'

export function ok<T>(data: T, status = 200): Response {
  const body: ApiEnvelope<T> = {
    success: true,
    data,
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

export function fail(error: string, status = 400): Response {
  const body: ApiEnvelope<null> = {
    success: false,
    data: null,
    error,
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}
