import type { AppEnv } from '../../../../_shared/types'
import { isAdminAuthenticated } from '../../../../_shared/auth'
import { fail, ok } from '../../../../_shared/response'
import { ensureBuilderBootstrap, loadBuilderDocument, saveBuilderDocument } from '../../../../_shared/builder'
import { parseBody } from '../../../../_shared/utils'
import { isBuilderDocumentKey } from '../../../../../shared/builder'

export const onRequestGet: PagesFunction<AppEnv> = async (context) => {
  try {
    const authenticated = await isAdminAuthenticated(context.request, context.env)
    if (!authenticated) {
      return fail('Unauthorized.', 401)
    }

    const docKey = context.params.docKey ?? ''
    if (!isBuilderDocumentKey(docKey)) {
      return fail('Unknown builder document.', 404)
    }

    await ensureBuilderBootstrap(context.env.DB)
    const document = await loadBuilderDocument(context.env.DB, docKey)
    if (!document) {
      return fail('Builder document not found.', 404)
    }

    const { createdAt: _createdAt, ...responseDocument } = document
    return ok(responseDocument)
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to load builder document.', 500)
  }
}

export const onRequestPut: PagesFunction<AppEnv> = async (context) => {
  try {
    const authenticated = await isAdminAuthenticated(context.request, context.env)
    if (!authenticated) {
      return fail('Unauthorized.', 401)
    }

    const docKey = context.params.docKey ?? ''
    if (!isBuilderDocumentKey(docKey)) {
      return fail('Unknown builder document.', 404)
    }

    const payload = await parseBody<unknown>(context.request)
    await ensureBuilderBootstrap(context.env.DB)
    const saved = await saveBuilderDocument(context.env.DB, docKey, payload)

    const { createdAt: _createdAt, ...responseDocument } = saved
    return ok(responseDocument)
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to save builder document.', 500)
  }
}
