export const defaultMaintenanceMessage =
  'The lab is under maintenance right now. Live server status is temporarily unavailable, and the status page will show maintenance placeholders until everything is back up.'

export const maintenanceStatusLabel = 'Under maintenance'

export function normalizeMaintenanceMessage(value: unknown): string {
  if (typeof value !== 'string') {
    return defaultMaintenanceMessage
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : defaultMaintenanceMessage
}
