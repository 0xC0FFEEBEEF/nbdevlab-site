export type StackStatusLevel = 'operational' | 'degraded' | 'outage' | 'unknown'

export interface StackStatusMetric {
  label: string
  value: string
}

export interface StackStatusService {
  id: string
  name: string
  status: StackStatusLevel
  summary: string | null
  checkedAt: string | null
  responseTimeMs: number | null
  metrics: StackStatusMetric[]
}

export interface StackStatusCounts {
  total: number
  operational: number
  degraded: number
  outage: number
  unknown: number
}

export interface StackStatusSnapshot {
  sourceUrl: string
  healthUrl: string
  fetchedAt: string
  checkedAt: string | null
  overallStatus: StackStatusLevel
  overallLabel: string
  summary: string
  services: StackStatusService[]
  counts: StackStatusCounts
  metrics: StackStatusMetric[]
  raw: unknown
}

const collectionKeys = ['endpoints', 'services', 'checks', 'components', 'systems', 'dependencies', 'monitors']
const dateKeys = ['checkedAt', 'lastCheckedAt', 'updatedAt', 'generatedAt', 'timestamp']
const summaryKeys = ['summary', 'message', 'description', 'detail']
const topLevelMetaKeys = new Set([
  'status',
  'overallStatus',
  'state',
  'severity',
  'summary',
  'power',
  'endpoints',
  'nodes',
  'guests',
  'message',
  'description',
  'detail',
  'services',
  'checks',
  'components',
  'systems',
  'dependencies',
  'monitors',
  'data',
  'ok',
  'healthy',
  'up',
  'passing',
  'checkedAt',
  'lastCheckedAt',
  'updatedAt',
  'generatedAt',
  'timestamp',
])
const serviceMetaKeys = new Set([
  'id',
  'name',
  'service',
  'title',
  'label',
  'component',
  'status',
  'state',
  'severity',
  'summary',
  'message',
  'description',
  'detail',
  'details',
  'ok',
  'healthy',
  'up',
  'passing',
  'available',
  'latency',
  'latencyMs',
  'responseTime',
  'responseTimeMs',
  'response_ms',
  'duration',
  'durationMs',
  'ping',
  'pingMs',
  'checkedAt',
  'lastCheckedAt',
  'updatedAt',
  'generatedAt',
  'timestamp',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function firstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = asString(record[key])
    if (value) {
      return value
    }
  }
  return null
}

function toIdentifier(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return normalized || 'service'
}

export function formatStatusLabel(level: StackStatusLevel): string {
  if (level === 'operational') {
    return 'Operational'
  }
  if (level === 'degraded') {
    return 'Degraded'
  }
  if (level === 'outage') {
    return 'Outage'
  }
  return 'Unknown'
}

function normalizeLevel(value: unknown): StackStatusLevel | null {
  if (typeof value === 'boolean') {
    return value ? 'operational' : 'outage'
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  if (
    normalized.includes('operational') ||
    normalized === 'ok' ||
    normalized === 'up' ||
    normalized === 'healthy' ||
    normalized === 'passing' ||
    normalized === 'online' ||
    normalized === 'available'
  ) {
    return 'operational'
  }

  if (
    normalized.includes('degraded') ||
    normalized.includes('partial') ||
    normalized.includes('warning') ||
    normalized.includes('warn') ||
    normalized.includes('limited') ||
    normalized.includes('unstable')
  ) {
    return 'degraded'
  }

  if (
    normalized.includes('outage') ||
    normalized.includes('critical') ||
    normalized.includes('down') ||
    normalized.includes('offline') ||
    normalized.includes('failed') ||
    normalized.includes('error') ||
    normalized.includes('unavailable')
  ) {
    return 'outage'
  }

  return 'unknown'
}

function deriveLevel(record: Record<string, unknown>): StackStatusLevel {
  const fromFields =
    normalizeLevel(record.status) ??
    normalizeLevel(record.overallStatus) ??
    normalizeLevel(record.state) ??
    normalizeLevel(record.severity)

  if (fromFields) {
    return fromFields
  }

  const fromBooleans =
    normalizeLevel(record.ok) ??
    normalizeLevel(record.healthy) ??
    normalizeLevel(record.up) ??
    normalizeLevel(record.passing) ??
    normalizeLevel(record.available)

  return fromBooleans ?? 'unknown'
}

function toDisplayLabel(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function toMetricValue(value: unknown): string | null {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  return null
}

function collectMetrics(
  record: Record<string, unknown>,
  skipKeys: Set<string>,
  limit = 4,
  labelPrefix = '',
): StackStatusMetric[] {
  const metrics: StackStatusMetric[] = []

  for (const [key, value] of Object.entries(record)) {
    if (skipKeys.has(key)) {
      continue
    }

    const metricValue = toMetricValue(value)
    if (!metricValue) {
      continue
    }

    metrics.push({
      label: `${labelPrefix}${toDisplayLabel(key)}`,
      value: metricValue,
    })

    if (metrics.length >= limit) {
      break
    }
  }

  return metrics
}

function extractResponseTime(record: Record<string, unknown>): number | null {
  return (
    asNumber(record.responseTimeMs) ??
    asNumber(record.response_ms) ??
    asNumber(record.responseTime) ??
    asNumber(record.latencyMs) ??
    asNumber(record.latency) ??
    asNumber(record.durationMs) ??
    asNumber(record.duration) ??
    asNumber(record.pingMs) ??
    asNumber(record.ping)
  )
}

function extractCheckedAt(record: Record<string, unknown>): string | null {
  return firstString(record, dateKeys)
}

function extractSummary(record: Record<string, unknown>): string | null {
  const summary = firstString(record, summaryKeys)
  if (summary) {
    return summary
  }

  if (Array.isArray(record.details)) {
    const details = record.details.map(asString).filter((value): value is string => Boolean(value))
    if (details.length > 0) {
      return details.join(' • ')
    }
  }

  return null
}

function unwrapPayload(payload: unknown): unknown {
  if (!isRecord(payload)) {
    return payload
  }

  if (isRecord(payload.data) || Array.isArray(payload.data)) {
    return payload.data
  }

  return payload
}

function hasStatusSignals(record: Record<string, unknown>): boolean {
  return (
    'status' in record ||
    'overallStatus' in record ||
    'state' in record ||
    'severity' in record ||
    'ok' in record ||
    'healthy' in record ||
    'up' in record ||
    'passing' in record ||
    'available' in record
  )
}

function extractCollection(root: unknown): Array<{ key: string; value: unknown }> {
  if (Array.isArray(root)) {
    return root.map((value, index) => ({ key: `service-${index + 1}`, value }))
  }

  if (!isRecord(root)) {
    return []
  }

  for (const key of collectionKeys) {
    const candidate = root[key]
    if (Array.isArray(candidate)) {
      return candidate.map((value, index) => ({ key: `${key}-${index + 1}`, value }))
    }
    if (isRecord(candidate)) {
      return Object.entries(candidate).map(([entryKey, value]) => ({ key: entryKey, value }))
    }
  }

  const entries = Object.entries(root).filter(
    ([key, value]) => !topLevelMetaKeys.has(key) && isRecord(value) && hasStatusSignals(value),
  )

  if (entries.length > 0) {
    return entries.map(([key, value]) => ({ key, value }))
  }

  return []
}

function normalizeServiceEntry(entry: { key: string; value: unknown }): StackStatusService {
  if (!isRecord(entry.value)) {
    const name = asString(entry.value) ?? toDisplayLabel(entry.key)
    return {
      id: toIdentifier(entry.key),
      name,
      status: 'unknown',
      summary: null,
      checkedAt: null,
      responseTimeMs: null,
      metrics: [],
    }
  }

  const record = entry.value
  const name =
    firstString(record, ['name', 'service', 'title', 'label', 'component']) ??
    toDisplayLabel(entry.key)

  return {
    id: toIdentifier(firstString(record, ['id', 'name']) ?? entry.key),
    name,
    status: deriveLevel(record),
    summary: extractSummary(record),
    checkedAt: extractCheckedAt(record),
    responseTimeMs: extractResponseTime(record),
    metrics: collectMetrics(record, serviceMetaKeys),
  }
}

function compareLevels(left: StackStatusLevel, right: StackStatusLevel): number {
  const order: Record<StackStatusLevel, number> = {
    outage: 3,
    degraded: 2,
    unknown: 1,
    operational: 0,
  }

  return order[left] - order[right]
}

function buildCounts(services: StackStatusService[]): StackStatusCounts {
  const counts: StackStatusCounts = {
    total: services.length,
    operational: 0,
    degraded: 0,
    outage: 0,
    unknown: 0,
  }

  for (const service of services) {
    counts[service.status] += 1
  }

  return counts
}

function buildSummary(
  root: unknown,
  services: StackStatusService[],
  counts: StackStatusCounts,
  overallStatus: StackStatusLevel,
): string {
  if (isRecord(root)) {
    const explicitSummary = extractSummary(root)
    if (explicitSummary) {
      return explicitSummary
    }

    if (isRecord(root.summary)) {
      const endpointCount = asNumber(root.summary.endpointCount)
      const issueCount = asNumber(root.summary.issueCount)
      const runningGuestCount = asNumber(root.summary.runningGuestCount)

      if (endpointCount !== null && issueCount !== null) {
        const endpointLabel = `${endpointCount} endpoint${endpointCount === 1 ? '' : 's'}`
        const issueLabel = `${issueCount} issue${issueCount === 1 ? '' : 's'}`

        if (runningGuestCount !== null) {
          return `${issueLabel} across ${endpointLabel}; ${runningGuestCount} guests currently running.`
        }

        return `${issueLabel} across ${endpointLabel}.`
      }
    }
  }

  if (services.length === 0) {
    return `Current stack state is ${formatStatusLabel(overallStatus).toLowerCase()}.`
  }

  if (counts.outage > 0) {
    return `${counts.outage} service${counts.outage === 1 ? '' : 's'} in outage, ${counts.operational} operational.`
  }

  if (counts.degraded > 0) {
    return `${counts.degraded} service${counts.degraded === 1 ? '' : 's'} degraded, ${counts.operational} operational.`
  }

  if (counts.operational === services.length) {
    return `All ${services.length} services are operational.`
  }

  return `${counts.operational} of ${services.length} services are operational.`
}

function buildTopLevelMetrics(root: unknown): StackStatusMetric[] {
  if (!isRecord(root)) {
    return []
  }

  const metrics: StackStatusMetric[] = []

  metrics.push(...collectMetrics(root, topLevelMetaKeys, 2))

  if (isRecord(root.summary)) {
    metrics.push(...collectMetrics(root.summary, new Set(), 8))
  }

  if (isRecord(root.power)) {
    const available = normalizeLevel(root.power.available)
    if (available) {
      metrics.push({
        label: 'UPS Availability',
        value: formatStatusLabel(available),
      })
    }

    if (isRecord(root.power.summary)) {
      metrics.push(...collectMetrics(root.power.summary, new Set(), 4, 'UPS '))
    }
  }

  const seen = new Set<string>()
  return metrics.filter((metric) => {
    const key = `${metric.label}:${metric.value}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

export function normalizeStackStatusPayload(
  payload: unknown,
  sourceUrl: string,
  healthUrl: string,
  fetchedAt = new Date().toISOString(),
): StackStatusSnapshot {
  const root = unwrapPayload(payload)
  const services = extractCollection(root).map(normalizeServiceEntry)
  const counts = buildCounts(services)

  let overallStatus: StackStatusLevel = 'unknown'
  if (isRecord(root)) {
    overallStatus = deriveLevel(root)
  }
  if (overallStatus === 'unknown' && services.length > 0) {
    overallStatus = services.reduce<StackStatusLevel>((current, service) => {
      return compareLevels(service.status, current) > 0 ? service.status : current
    }, 'operational')
  }

  const checkedAt = isRecord(root) ? extractCheckedAt(root) : null

  return {
    sourceUrl,
    healthUrl,
    fetchedAt,
    checkedAt,
    overallStatus,
    overallLabel: formatStatusLabel(overallStatus),
    summary: buildSummary(root, services, counts, overallStatus),
    services,
    counts,
    metrics: buildTopLevelMetrics(root),
    raw: root,
  }
}

export function isCloudflareChallengeResponse(response: Pick<Response, 'status' | 'headers'>, bodyText: string): boolean {
  const mitigated = response.headers.get('cf-mitigated')
  if (mitigated && mitigated.toLowerCase() === 'challenge') {
    return true
  }

  if (response.status !== 403) {
    return false
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.includes('text/html')) {
    return false
  }

  return /just a moment|challenge-platform|enable javascript and cookies/i.test(bodyText)
}

export interface WallPowerReading {
  watts: number
  upsWatts: number
  surgeWatts: number
  updatedAt: string
}

/**
 * The lab's total draw at the wall from the status feed: the UPS output plus the PSUs on surge-only power.
 * Null when the feed has no complete reading, so a partial one is never shown as the total.
 */
export function readWallPower(snapshot: Pick<StackStatusSnapshot, 'raw'> | null | undefined): WallPowerReading | null {
  const root = snapshot?.raw
  if (!isRecord(root) || !isRecord(root.power) || !isRecord(root.power.wall)) {
    return null
  }

  const wall = root.power.wall
  const watts = [wall.watts, wall.upsWatts, wall.surgeWatts]
  if (wall.available !== true || !watts.every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0)) {
    return null
  }

  return {
    watts: Math.round(wall.watts as number),
    upsWatts: Math.round(wall.upsWatts as number),
    surgeWatts: Math.round(wall.surgeWatts as number),
    updatedAt: typeof wall.updatedAt === 'string' ? wall.updatedAt : '',
  }
}

export interface GuestCounts {
  running: number
  total: number
}

/**
 * Running and defined guests from the status feed. Null unless every Proxmox host answered, because a host that
 * could not be read would otherwise look like guests that stopped.
 */
export function readGuestCounts(snapshot: Pick<StackStatusSnapshot, 'raw'> | null | undefined): GuestCounts | null {
  const root = snapshot?.raw
  if (!isRecord(root) || !isRecord(root.summary)) {
    return null
  }

  const { guestCount, runningGuestCount, endpointCount, healthyEndpointCount } = root.summary
  const counts = [guestCount, runningGuestCount, endpointCount, healthyEndpointCount]
  if (!counts.every((value) => typeof value === 'number' && Number.isInteger(value) && value >= 0)) {
    return null
  }
  if ((endpointCount as number) === 0 || healthyEndpointCount !== endpointCount || (runningGuestCount as number) > (guestCount as number)) {
    return null
  }

  return { running: runningGuestCount as number, total: guestCount as number }
}
