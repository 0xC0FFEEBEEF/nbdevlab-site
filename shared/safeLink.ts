/** A page on this site ("/status") or a full web or mail address. Anything else comes back empty. */
export function normalizeSafeLink(value: unknown, maxLength = 400): string {
  if (typeof value !== 'string') {
    return ''
  }

  const trimmed = value.trim().slice(0, maxLength)
  const isSitePath = trimmed.startsWith('/') && !trimmed.startsWith('//')
  return isSitePath || /^(https?:\/\/|mailto:)\S+$/i.test(trimmed) ? trimmed : ''
}
