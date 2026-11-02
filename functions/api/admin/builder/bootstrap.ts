import type { AppEnv } from '../../../_shared/types'
import { isAdminAuthenticated } from '../../../_shared/auth'
import { fail, ok } from '../../../_shared/response'
import { ensureBuilderBootstrap, listBuilderDocuments } from '../../../_shared/builder'

export const onRequestGet: PagesFunction<AppEnv> = async (context) => {
  try {
    const authenticated = await isAdminAuthenticated(context.request, context.env)
    if (!authenticated) {
      return fail('Unauthorized.', 401)
    }

    const bootstrapped = await ensureBuilderBootstrap(context.env.DB)
    const documents = await listBuilderDocuments(context.env.DB)

    return ok({
      bootstrapped,
      documents: documents.map(({ createdAt: _createdAt, ...document }) => document),
    })
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to load builder bootstrap data.', 500)
  }
}
