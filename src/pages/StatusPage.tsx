import { useEffect, useRef, useState } from 'react'
import { publicApi } from '../lib/api'
import type { StackStatusSnapshot } from '../lib/stackStatus'
import { StatusPageView } from '../components/PublicSiteViews'
import type { BuilderDocument } from '../../shared/builder'
import { defaultMaintenanceMessage } from '../../shared/maintenance'
import type { StatusPowerMode } from '../../shared/statusPowerMode'
import { applyStatusPowerModeToWallboard } from '../lib/statusPowerSimulation'
import { readCachedStackStatus, writeCachedStackStatus } from '../lib/stackStatusCache'

const refreshIntervalMs = 5_000

export interface ProxmoxStatusSummary {
  endpointCount: number
  healthyEndpointCount: number
  issueCount: number
  nodeCount: number
  onlineNodeCount: number
  guestCount: number
  runningGuestCount: number
  averageNodeCpuPercent: number
}

export interface ProxmoxEndpoint {
  name: string
  status: string
  issue: string
  nodeCount: number
  onlineNodeCount: number
  guestCount: number
  runningGuestCount: number
}

export interface ProxmoxNode {
  id: string
  name: string
  endpointName: string
  status: string
  cpuPercent: number
  memoryPercent: number
  diskPercent: number
  uptimeSeconds: number
}

export interface ProxmoxGuest {
  id: string
  name: string
  endpointName: string
  nodeName: string
  type: string
  status: string
  isRunning: boolean
  cpuPercent: number
  memoryPercent: number
  diskPercent: number
  uptimeSeconds: number
}

export interface ProxmoxPowerSummary {
  modelName: string
  state: string
  powerSource: string
  batteryCapacity: string
  remainingRuntime: string
  load: string
  utilityVoltage: string
  outputVoltage: string
  lineInteraction: string
}

export interface ProxmoxPower {
  available: boolean
  updatedAt: string | null
  issue: string
  summary: ProxmoxPowerSummary
}

export interface ProxmoxWallboard {
  generatedAt: string | null
  summary: ProxmoxStatusSummary
  endpoints: ProxmoxEndpoint[]
  nodes: ProxmoxNode[]
  guests: ProxmoxGuest[]
  power: ProxmoxPower | null
}

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

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value
  }

  return null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function extractPercentFromText(value: string | null): number | null {
  if (!value) {
    return null
  }

  const match = value.match(/([0-9]+(?:\.[0-9]+)?)\s*%/)
  return match ? Number(match[1]) : null
}

function readSummary(value: unknown): ProxmoxStatusSummary | null {
  if (!isRecord(value)) {
    return null
  }

  const endpointCount = asNumber(value.endpointCount)
  const healthyEndpointCount = asNumber(value.healthyEndpointCount)
  const issueCount = asNumber(value.issueCount)
  const nodeCount = asNumber(value.nodeCount)
  const onlineNodeCount = asNumber(value.onlineNodeCount)
  const guestCount = asNumber(value.guestCount)
  const runningGuestCount = asNumber(value.runningGuestCount)
  const averageNodeCpuPercent = asNumber(value.averageNodeCpuPercent)

  if (
    endpointCount === null ||
    healthyEndpointCount === null ||
    issueCount === null ||
    nodeCount === null ||
    onlineNodeCount === null ||
    guestCount === null ||
    runningGuestCount === null ||
    averageNodeCpuPercent === null
  ) {
    return null
  }

  return {
    endpointCount,
    healthyEndpointCount,
    issueCount,
    nodeCount,
    onlineNodeCount,
    guestCount,
    runningGuestCount,
    averageNodeCpuPercent,
  }
}

function readEndpoint(value: unknown): ProxmoxEndpoint | null {
  if (!isRecord(value)) {
    return null
  }

  const name = asString(value.name)
  const status = asString(value.status)
  const nodeCount = asNumber(value.nodeCount)
  const onlineNodeCount = asNumber(value.onlineNodeCount)
  const guestCount = asNumber(value.guestCount)
  const runningGuestCount = asNumber(value.runningGuestCount)

  if (
    !name ||
    !status ||
    nodeCount === null ||
    onlineNodeCount === null ||
    guestCount === null ||
    runningGuestCount === null
  ) {
    return null
  }

  return {
    name,
    status,
    issue: asString(value.issue) ?? '',
    nodeCount,
    onlineNodeCount,
    guestCount,
    runningGuestCount,
  }
}

function readNode(value: unknown): ProxmoxNode | null {
  if (!isRecord(value)) {
    return null
  }

  const id = asString(value.id)
  const name = asString(value.name)
  const endpointName = asString(value.endpointName)
  const status = asString(value.status)
  const cpuPercent = asNumber(value.cpuPercent)
  const memoryPercent = asNumber(value.memoryPercent)
  const diskPercent = asNumber(value.diskPercent)
  const uptimeSeconds = asNumber(value.uptimeSeconds)

  if (
    !id ||
    !name ||
    !endpointName ||
    !status ||
    cpuPercent === null ||
    memoryPercent === null ||
    diskPercent === null ||
    uptimeSeconds === null
  ) {
    return null
  }

  return {
    id,
    name,
    endpointName,
    status,
    cpuPercent,
    memoryPercent,
    diskPercent,
    uptimeSeconds,
  }
}

function readGuest(value: unknown): ProxmoxGuest | null {
  if (!isRecord(value)) {
    return null
  }

  const id = asString(value.id)
  const name = asString(value.name)
  const endpointName = asString(value.endpointName)
  const nodeName = asString(value.nodeName)
  const type = asString(value.type)
  const status = asString(value.status)
  const isRunning = asBoolean(value.isRunning)
  const cpuPercent = asNumber(value.cpuPercent)
  const memoryPercent = asNumber(value.memoryPercent)
  const diskPercent = asNumber(value.diskPercent)
  const uptimeSeconds = asNumber(value.uptimeSeconds)

  if (
    !id ||
    !name ||
    !endpointName ||
    !nodeName ||
    !type ||
    !status ||
    isRunning === null ||
    cpuPercent === null ||
    memoryPercent === null ||
    diskPercent === null ||
    uptimeSeconds === null
  ) {
    return null
  }

  return {
    id,
    name,
    endpointName,
    nodeName,
    type,
    status,
    isRunning,
    cpuPercent,
    memoryPercent,
    diskPercent,
    uptimeSeconds,
  }
}

function readPower(value: unknown): ProxmoxPower | null {
  if (!isRecord(value) || !isRecord(value.summary)) {
    return null
  }

  const available = asBoolean(value.available)
  const summary = value.summary
  const modelName = asString(summary.modelName)
  const state = asString(summary.state)
  const powerSource = asString(summary.powerSource)
  const batteryCapacity = asString(summary.batteryCapacity)
  const remainingRuntime = asString(summary.remainingRuntime)
  const load = asString(summary.load)
  const utilityVoltage = asString(summary.utilityVoltage)
  const outputVoltage = asString(summary.outputVoltage)
  const lineInteraction = asString(summary.lineInteraction)

  if (
    available === null ||
    !modelName ||
    !state ||
    !powerSource ||
    !batteryCapacity ||
    !remainingRuntime ||
    !load ||
    !utilityVoltage ||
    !outputVoltage ||
    !lineInteraction
  ) {
    return null
  }

  return {
    available,
    updatedAt: asString(value.updatedAt),
    issue: asString(value.issue) ?? '',
    summary: {
      modelName,
      state,
      powerSource,
      batteryCapacity,
      remainingRuntime,
      load,
      utilityVoltage,
      outputVoltage,
      lineInteraction,
    },
  }
}

export function extractWallboard(raw: unknown): ProxmoxWallboard | null {
  if (!isRecord(raw)) {
    return null
  }

  const summary = readSummary(raw.summary)
  if (!summary) {
    return null
  }

  const endpoints = asArray(raw.endpoints).map(readEndpoint).filter((value): value is ProxmoxEndpoint => Boolean(value))
  const nodes = asArray(raw.nodes).map(readNode).filter((value): value is ProxmoxNode => Boolean(value))
  const guests = asArray(raw.guests).map(readGuest).filter((value): value is ProxmoxGuest => Boolean(value))

  return {
    generatedAt: asString(raw.generatedAt),
    summary,
    endpoints,
    nodes,
    guests,
    power: readPower(raw.power),
  }
}

export function sortGuests(guests: ProxmoxGuest[]): ProxmoxGuest[] {
  return [...guests].sort((left, right) => {
    if (left.isRunning !== right.isRunning) {
      return Number(right.isRunning) - Number(left.isRunning)
    }

    if (left.cpuPercent !== right.cpuPercent) {
      return right.cpuPercent - left.cpuPercent
    }

    return left.name.localeCompare(right.name)
  })
}

export function sortNodes(nodes: ProxmoxNode[]): ProxmoxNode[] {
  return [...nodes].sort((left, right) => right.cpuPercent - left.cpuPercent)
}

export function StatusPage() {
  const [snapshot, setSnapshot] = useState<StackStatusSnapshot | null>(() => readCachedStackStatus())
  const [builderDocument, setBuilderDocument] = useState<BuilderDocument | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [maintenanceMessage, setMaintenanceMessage] = useState(defaultMaintenanceMessage)
  const [statusPowerMode, setStatusPowerMode] = useState<StatusPowerMode>('live')
  const [isUsingCachedSnapshot, setIsUsingCachedSnapshot] = useState(() => readCachedStackStatus() !== null)
  const [hasLoadedSiteSettings, setHasLoadedSiteSettings] = useState(false)
  const [hideOfflineGuests, setHideOfflineGuests] = useState(true)
  const [isCompactMobile, setIsCompactMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches,
  )
  const [showAllMobileGuests, setShowAllMobileGuests] = useState(false)
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null)
  const [refreshNow, setRefreshNow] = useState(() => Date.now())
  const cancelledRef = useRef(false)

  const load = async (silent = false) => {
    if (!silent) {
      setIsLoading(true)
    }

    try {
      const nextSnapshot = await publicApi.getStackStatus()
      if (cancelledRef.current) {
        return
      }

      setSnapshot(nextSnapshot)
      writeCachedStackStatus(nextSnapshot)
      setError(null)
      setIsUsingCachedSnapshot(false)
    } catch {
      if (cancelledRef.current) {
        return
      }

      const cachedSnapshot = readCachedStackStatus()
      if (cachedSnapshot) {
        setSnapshot(cachedSnapshot)
        setIsUsingCachedSnapshot(true)
        setError('Live feed unavailable. Showing last known snapshot.')
      } else {
        setError("Couldn't load the live status feed.")
      }
    } finally {
      if (!cancelledRef.current) {
        if (!silent) {
          setIsLoading(false)
        }

        setNextRefreshAt(Date.now() + refreshIntervalMs)
      }
    }
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 640px)')
    const onViewportChange = (event: MediaQueryListEvent) => {
      setIsCompactMobile(event.matches)
    }
    mediaQuery.addEventListener('change', onViewportChange)

    return () => {
      mediaQuery.removeEventListener('change', onViewportChange)
    }
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRefreshNow(Date.now())
    }, 1_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const [settingsResult, documentResult] = await Promise.allSettled([
        publicApi.getSiteSettings(),
        publicApi.getBuilderDocument('page.status'),
      ])

      if (cancelled) {
        return
      }

      if (settingsResult.status === 'fulfilled') {
        setMaintenanceMode(settingsResult.value.maintenanceMode)
        setMaintenanceMessage(settingsResult.value.maintenanceMessage)
        setStatusPowerMode(settingsResult.value.statusPowerMode)
      }

      if (documentResult.status === 'fulfilled') {
        setBuilderDocument(documentResult.value)
      }

      setHasLoadedSiteSettings(true)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    cancelledRef.current = false

    if (!hasLoadedSiteSettings) {
      return () => {
        cancelledRef.current = true
      }
    }

    if (maintenanceMode) {
      setSnapshot(null)
      setError(null)
      setIsLoading(false)
      setNextRefreshAt(null)
      return () => {
        cancelledRef.current = true
      }
    }

    void load()

    const intervalId = window.setInterval(() => {
      void load(true)
    }, refreshIntervalMs)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void load(true)
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelledRef.current = true
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [hasLoadedSiteSettings, maintenanceMode])

  const wallboard = applyStatusPowerModeToWallboard(snapshot ? extractWallboard(snapshot.raw) : null, statusPowerMode)
  const orderedGuests = wallboard ? sortGuests(wallboard.guests) : []
  const orderedNodes = wallboard ? sortNodes(wallboard.nodes) : []
  const visibleGuests = hideOfflineGuests
    ? orderedGuests.filter((guest) => guest.isRunning)
    : orderedGuests
  const spotlightNodes = orderedNodes.slice(0, 3)
  const compactNodes = orderedNodes.slice(0, 2)
  const batteryPercent = wallboard?.power
    ? extractPercentFromText(wallboard.power.summary.batteryCapacity)
    : null
  const loadPercent = wallboard?.power ? extractPercentFromText(wallboard.power.summary.load) : null
  const refreshCountdown =
    nextRefreshAt === null ? null : Math.max(0, Math.ceil((nextRefreshAt - refreshNow) / 1_000))
  const compactGuestLimit = 4
  const displayedGuests =
    isCompactMobile && !showAllMobileGuests
      ? visibleGuests.slice(0, compactGuestLimit)
      : visibleGuests
  const remainingGuestCount = Math.max(0, visibleGuests.length - displayedGuests.length)
  const guestPanelTitle = isCompactMobile ? 'Busiest guests' : 'Guests'
  const guestPanelSummary = isCompactMobile
    ? 'Quick look at the busiest guests. Expand it if you want the full list.'
    : 'I sort these by CPU so the busiest guests stay near the top.'
  const hasMobileGuestOverflow = isCompactMobile && visibleGuests.length > compactGuestLimit

  return (
    <StatusPageView
      snapshot={snapshot}
      wallboard={wallboard}
      maintenanceMode={maintenanceMode}
      maintenanceMessage={maintenanceMessage}
      isUsingCachedSnapshot={isUsingCachedSnapshot}
      error={error}
      isLoading={isLoading}
      hideOfflineGuests={hideOfflineGuests}
      isCompactMobile={isCompactMobile}
      showAllMobileGuests={showAllMobileGuests}
      nextRefreshAt={nextRefreshAt}
      refreshNow={refreshNow}
      refreshCountdown={refreshCountdown}
      visibleGuests={visibleGuests}
      displayedGuests={displayedGuests}
      remainingGuestCount={remainingGuestCount}
      guestPanelTitle={guestPanelTitle}
      guestPanelSummary={guestPanelSummary}
      hasMobileGuestOverflow={hasMobileGuestOverflow}
      spotlightNodes={spotlightNodes}
      compactNodes={compactNodes}
      batteryPercent={batteryPercent}
      loadPercent={loadPercent}
      onRetry={() => void load()}
      onToggleOfflineGuests={(next) => setHideOfflineGuests(next)}
      onToggleMobileGuests={() => setShowAllMobileGuests((current) => !current)}
      document={builderDocument}
    />
  )
}
