import type { AppEnv } from '../../../_shared/types'
import { fail, ok } from '../../../_shared/response'
import { listStoredBuilderDocuments } from '../../../_shared/builder'

export const onRequestGet: PagesFunction<AppEnv> = async (context) => {
  try {
    const documents = await listStoredBuilderDocuments(context.env.DB)

    return ok({
      bootstrapped: documents.length > 0,
      documents: documents.map(({ createdAt: _createdAt, ...document }) => document),
    })
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to load builder bootstrap data.', 500)
  }
}
