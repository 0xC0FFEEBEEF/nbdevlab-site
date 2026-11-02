import type { AppEnv } from '../../_shared/types'
import { fail, ok } from '../../_shared/response'
import { nowIso, parseBody } from '../../_shared/utils'
import { CONTACT_TURNSTILE_ACTION, verifyTurnstile } from '../../_shared/turnstile'

interface ContactPayload {
  name?: string
  email?: string
  message?: string
  turnstileToken?: string
}

// Abuse limits: keep spam from filling the database.
const MAX_BODY_BYTES = 32 * 1024
const MAX_NAME = 120
const MAX_EMAIL = 254
const MAX_MESSAGE = 5000
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const onRequestPost: PagesFunction<AppEnv> = async (context) => {
  try {
    const declaredLength = Number(context.request.headers.get('content-length') ?? 0)
    if (declaredLength > MAX_BODY_BYTES) {
      return fail('Message is too long.', 413)
    }

    const payload = await parseBody<ContactPayload>(context.request)
    const name = payload.name?.trim() ?? ''
    const email = payload.email?.trim() ?? ''
    const message = payload.message?.trim() ?? ''

    if (!name || !email || !message) {
      return fail('Name, email, and message are required.', 400)
    }
    if (name.length > MAX_NAME || email.length > MAX_EMAIL || message.length > MAX_MESSAGE) {
      return fail(`Please keep the message under ${MAX_MESSAGE} characters.`, 413)
    }
    if (!EMAIL_SHAPE.test(email)) {
      return fail('Please enter a valid email address.', 400)
    }

    const check = await verifyTurnstile(context.env.TURNSTILE_SECRET, payload.turnstileToken, context.request, {
      action: CONTACT_TURNSTILE_ACTION,
    })
    if (!check.ok) {
      return fail(check.error, check.status)
    }

    const createdAt = nowIso()
    const insert = await context.env.DB
      .prepare(
        `INSERT INTO contact_messages (name, email, message, status, created_at)
         VALUES (?, ?, ?, 'new', ?)`,
      )
      .bind(name, email, message, createdAt)
      .run()

    await context.env.DB
      .prepare('INSERT INTO admin_audit (action, metadata_json, created_at) VALUES (?, ?, ?)')
      .bind('contact.created', JSON.stringify({ id: insert.meta.last_row_id }), createdAt)
      .run()

    return ok({ id: Number(insert.meta.last_row_id) }, 201)
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to create contact message.', 500)
  }
}
