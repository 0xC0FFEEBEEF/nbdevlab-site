export const statusPowerModeValues = ['live', 'battery', 'utility'] as const

export type StatusPowerMode = (typeof statusPowerModeValues)[number]

export function normalizeStatusPowerMode(value: unknown, fallback: StatusPowerMode = 'live'): StatusPowerMode {
  if (typeof value !== 'string') {
    return fallback
  }

  const normalized = value.trim().toLowerCase()
  return statusPowerModeValues.includes(normalized as StatusPowerMode) ? (normalized as StatusPowerMode) : fallback
}
