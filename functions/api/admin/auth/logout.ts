import type { AppEnv } from '../../../_shared/types'
import { buildSessionClearCookie } from '../../../_shared/auth'
import { ok } from '../../../_shared/response'

export const onRequestPost: PagesFunction<AppEnv> = async () => {
  const response = ok({ authenticated: false })
  response.headers.set('Set-Cookie', buildSessionClearCookie())
  return response
}
