import type { AppEnv } from './types'

interface SessionPayload {
  exp: number
}

const cookieName = 'nbdevlab_admin_session'
const sessionMaxAgeSeconds = 60 * 60 * 12

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '==='.slice((normalized.length + 3) % 4)
  return atob(padded)
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return base64UrlEncode(binary)
}

function parseCookies(header: string | null): Record<string, string> {
  if (!header) {
    return {}
  }

  const cookies: Record<string, string> = {}
  for (const chunk of header.split(';')) {
    const [rawName, ...rawValue] = chunk.trim().split('=')
    if (!rawName || rawValue.length === 0) {
      continue
    }
    cookies[rawName] = rawValue.join('=')
  }
  return cookies
}

function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }

  return result === 0
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return bytesToBase64Url(new Uint8Array(signature))
}

function getSessionSecret(env: AppEnv): string {
  return env.ADMIN_SESSION_SECRET ?? env.ADMIN_PASS ?? env.PASS ?? ''
}

export function getAdminCredentials(env: AppEnv): { username: string; password: string } {
  return {
    username: env.ADMIN_USER ?? env.USER ?? '',
    password: env.ADMIN_PASS ?? env.PASS ?? '',
  }
}

export function buildSessionCookie(token: string): string {
  return `${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${sessionMaxAgeSeconds}`
}

export function buildSessionClearCookie(): string {
  return `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
}

export async function createSessionToken(env: AppEnv): Promise<string> {
  const secret = getSessionSecret(env)
  if (!secret) {
    throw new Error('Missing ADMIN_SESSION_SECRET (or ADMIN_PASS/PASS) for signing admin sessions.')
  }

  const payload: SessionPayload = {
    exp: Date.now() + sessionMaxAgeSeconds * 1000,
  }

  const payloadPart = base64UrlEncode(JSON.stringify(payload))
  const signaturePart = await sign(payloadPart, secret)
  return `${payloadPart}.${signaturePart}`
}

export async function isAdminAuthenticated(request: Request, env: AppEnv): Promise<boolean> {
  const cookies = parseCookies(request.headers.get('cookie'))
  const token = cookies[cookieName]
  if (!token) {
    return false
  }

  const [payloadPart, signaturePart] = token.split('.')
  if (!payloadPart || !signaturePart) {
    return false
  }

  const secret = getSessionSecret(env)
  if (!secret) {
    return false
  }

  try {
    const expectedSignature = await sign(payloadPart, secret)
    if (!secureCompare(signaturePart, expectedSignature)) {
      return false
    }

    const payload = JSON.parse(base64UrlDecode(payloadPart)) as SessionPayload
    if (typeof payload.exp !== 'number') {
      return false
    }

    return payload.exp > Date.now()
  } catch {
    return false
  }
}
