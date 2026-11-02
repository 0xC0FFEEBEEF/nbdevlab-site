import type { AppEnv, ContactMessage, MessageStatus } from '../../../_shared/types'
import { fail, ok } from '../../../_shared/response'
import { isMessageStatus } from '../../../_shared/validation'
import { nowIso, parseBody } from '../../../_shared/utils'

interface MessagePayload {
  status?: MessageStatus
}

function parseMessageId(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw
  return Number(value)
}

export const onRequestPut: PagesFunction<AppEnv> = async (context) => {
  const messageId = parseMessageId(context.params.id)
  if (!Number.isInteger(messageId) || messageId <= 0) {
    return fail('Invalid message id.', 400)
  }

  try {
    const payload = await parseBody<MessagePayload>(context.request)

    if (!isMessageStatus(payload.status)) {
      return fail('Invalid message status.', 400)
    }

    const existing = await context.env.DB
      .prepare('SELECT id FROM contact_messages WHERE id = ? LIMIT 1')
      .bind(messageId)
      .first<{ id: number }>()

    if (!existing) {
      return fail('Message not found.', 404)
    }

    await context.env.DB
      .prepare('UPDATE contact_messages SET status = ? WHERE id = ?')
      .bind(payload.status, messageId)
      .run()

    await context.env.DB
      .prepare('INSERT INTO admin_audit (action, metadata_json, created_at) VALUES (?, ?, ?)')
      .bind('message.status.updated', JSON.stringify({ messageId, status: payload.status }), nowIso())
      .run()

    const row = await context.env.DB
      .prepare('SELECT id, name, email, message, status, created_at FROM contact_messages WHERE id = ?')
      .bind(messageId)
      .first<{
        id: number
        name: string
        email: string
        message: string
        status: MessageStatus
        created_at: string
      }>()

    if (!row) {
      return fail('Message reload failed.', 500)
    }

    const updated: ContactMessage = {
      id: row.id,
      name: row.name,
      email: row.email,
      message: row.message,
      status: row.status,
      createdAt: row.created_at,
    }

    return ok(updated)
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to update message.', 500)
  }
}
