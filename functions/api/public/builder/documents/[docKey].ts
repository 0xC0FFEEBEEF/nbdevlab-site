import type { AppEnv } from '../../../../_shared/types'
import { fail, ok } from '../../../../_shared/response'
import { loadStoredBuilderDocument } from '../../../../_shared/builder'
import { isBuilderDocumentKey } from '../../../../../shared/builder'

export const onRequestGet: PagesFunction<AppEnv> = async (context) => {
  try {
    const docKey = context.params.docKey ?? ''
    if (!isBuilderDocumentKey(docKey)) {
      return fail('Unknown builder document.', 404)
    }

    const document = await loadStoredBuilderDocument(context.env.DB, docKey)
    if (!document) {
      return fail('Builder document not found.', 404)
    }

    const { createdAt: _createdAt, ...responseDocument } = document
    return ok(responseDocument)
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to load builder document.', 500)
  }
}
