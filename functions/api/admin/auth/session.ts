import type { AppEnv } from '../../../_shared/types'
import { isAdminAuthenticated } from '../../../_shared/auth'
import { ok } from '../../../_shared/response'

export const onRequestGet: PagesFunction<AppEnv> = async (context) => {
  const authenticated = await isAdminAuthenticated(context.request, context.env)
  return ok({ authenticated })
}
