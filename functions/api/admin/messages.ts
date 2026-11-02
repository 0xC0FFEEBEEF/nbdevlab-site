import type { AppEnv, ContactMessage } from '../../_shared/types'
import { fail, ok } from '../../_shared/response'

export const onRequestGet: PagesFunction<AppEnv> = async (context) => {
  try {
    const rows = await context.env.DB
      .prepare(
        `SELECT id, name, email, message, status, created_at
         FROM contact_messages
         ORDER BY created_at DESC`,
      )
      .all<{
        id: number
        name: string
        email: string
        message: string
        status: 'new' | 'read' | 'archived'
        created_at: string
      }>()

    const messages: ContactMessage[] = (rows.results ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      message: row.message,
      status: row.status,
      createdAt: row.created_at,
    }))

    return ok(messages)
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to load messages.', 500)
  }
}
