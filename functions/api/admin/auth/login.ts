import type { AppEnv } from '../../../_shared/types'
import { buildSessionCookie, createSessionToken, getAdminCredentials } from '../../../_shared/auth'
import { fail, ok } from '../../../_shared/response'
import { parseBody } from '../../../_shared/utils'

interface LoginPayload {
  username?: string
  password?: string
}

export const onRequestPost: PagesFunction<AppEnv> = async (context) => {
  try {
    const payload = await parseBody<LoginPayload>(context.request)
    const { username, password } = getAdminCredentials(context.env)

    if (!username || !password) {
      return fail(
        'Admin credentials are not configured. Set ADMIN_USER/ADMIN_PASS (or USER/PASS) as Worker secrets.',
        500,
      )
    }

    const submittedUsername = payload.username?.trim() ?? ''
    const submittedPassword = payload.password ?? ''
    if (submittedUsername !== username || submittedPassword !== password) {
      return fail('Invalid username or password.', 401)
    }

    const token = await createSessionToken(context.env)
    const response = ok({ authenticated: true })
    response.headers.set('Set-Cookie', buildSessionCookie(token))
    return response
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Login failed.', 500)
  }
}
