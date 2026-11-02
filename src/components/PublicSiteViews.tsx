import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import type { CSSProperties, FormEvent, MouseEvent, ReactNode } from 'react'
import type { AboutBlock, HomeCard, Project, SiteSettings, SkillGroup } from '../types/models'
import type { StackStatusSnapshot } from '../lib/stackStatus'
import type { BuilderDocument } from '../../shared/builder'
import { getProjectIdentityKey } from '../../shared/projectIdentity'
import { maintenanceStatusLabel } from '../../shared/maintenance'
import { builderDataAttrs, type BuilderMetadata, type PublicBuilderContext } from '../lib/publicBuilder'
import type { SiteNavItem } from '../lib/siteNavigation'
import {
  getBuilderNodeText,
  getBuilderUnhandledRootChildren,
} from '../lib/builderDocuments'
import {
  getBuilderNodePresentationStyle,
  getBuilderNodeTextStyle,
} from '../lib/builderPresentation'
import { BuilderNodeContent } from './BuilderNodeContent'
import { ProjectBlocksView, ProjectCardStages } from './ProjectBlocks'
import { findProjectStageMap } from '../../shared/projectBlocks'
import { SettingsGearButton } from './SettingsGearButton'
import { TurnstileWidget } from './TurnstileWidget'

type AboutParagraphBlock = Extract<AboutBlock, { type: 'paragraph' }>
type AboutImageBlock = Extract<AboutBlock, { type: 'image' }>
type ImageShape = 'portrait' | 'landscape' | 'square'
type StatusTone = 'operational' | 'degraded' | 'outage' | 'unknown'

function clampUnits(value: number) {
  return Math.max(1, Math.min(4, value))
}

function findMetricValue(snapshot: StackStatusSnapshot | null, label: string): string | null {
  return snapshot?.metrics.find((metric) => metric.label === label)?.value ?? null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function parseMetricNumber(value: string | null): number | null {
  if (!value) {
    return null
  }

  const match = value.match(/-?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : null
}

function resampleSeries(values: number[], targetSize: number): number[] {
  if (values.length === 0) {
    return []
  }

  if (values.length === 1) {
    return Array.from({ length: targetSize }, () => values[0] ?? 0)
  }

  return Array.from({ length: targetSize }, (_, index) => {
    const position = (index / (targetSize - 1)) * (values.length - 1)
    const leftIndex = Math.floor(position)
    const rightIndex = Math.min(values.length - 1, leftIndex + 1)
    const progress = position - leftIndex
    const leftValue = values[leftIndex] ?? values[0] ?? 0
    const rightValue = values[rightIndex] ?? leftValue
    return leftValue + (rightValue - leftValue) * progress
  })
}

function buildMetricTrendSeed(snapshot: StackStatusSnapshot | null, metric: 'runningGuests' | 'averageNodeCpu'): number[] {
  if (!snapshot || !isRecord(snapshot.raw)) {
    return []
  }

  if (metric === 'averageNodeCpu') {
    const nodeSeries = asArray(snapshot.raw.nodes)
      .flatMap((node) => {
        if (!isRecord(node)) {
          return []
        }

        const cpuPercent = asNumber(node.cpuPercent)
        return cpuPercent === null ? [] : [cpuPercent]
      })

    return resampleSeries(nodeSeries, 8)
  }

  const endpointSeries = asArray(snapshot.raw.endpoints)
    .flatMap((endpoint) => {
      if (!isRecord(endpoint)) {
        return []
      }

      const runningGuestCount = asNumber(endpoint.runningGuestCount)
      return runningGuestCount === null ? [] : [runningGuestCount]
    })

  return resampleSeries(endpointSeries, 8)
}

function buildRollingTrendSeries(previous: number[], nextValue: number, seed: number[] = [], maxPoints = 10): number[] {
  const baseline = previous.length > 0 ? previous : seed.length > 0 ? seed : Array.from({ length: maxPoints }, () => nextValue)
  return [...baseline.slice(-(maxPoints - 1)), nextValue]
}

interface MetricSparklineProps {
  values: number[]
}

function MetricSparkline({ values }: MetricSparklineProps) {
  const { areaPath, linePath, lastPoint } = useMemo(() => {
    const safeValues =
      values.length > 1
        ? values
        : values.length === 1
          ? Array.from({ length: 8 }, () => values[0] ?? 0)
          : Array.from({ length: 8 }, () => 0)

    const width = 100
    const height = 32
    const paddingX = 2
    const paddingY = 3
    const minValue = Math.min(...safeValues)
    const maxValue = Math.max(...safeValues)
    const valueRange = maxValue - minValue

    const points = safeValues.map((value, index) => {
      const x = paddingX + (index / Math.max(safeValues.length - 1, 1)) * (width - paddingX * 2)
      const normalized = valueRange === 0 ? 0.5 : (value - minValue) / valueRange
      const y = height - paddingY - normalized * (height - paddingY * 2)
      return { x, y }
    })

    const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
    const lastPoint = points[points.length - 1] ?? { x: width / 2, y: height / 2 }
    const areaPath = `${linePath} L ${lastPoint.x} ${height - paddingY} L ${points[0]?.x ?? paddingX} ${height - paddingY} Z`

    return { areaPath, linePath, lastPoint }
  }, [values])

  return (
    <div className="home-status-teaser__sparkline" aria-hidden="true">
      <svg viewBox="0 0 100 32" preserveAspectRatio="none" focusable="false">
        <path className="home-status-teaser__sparkline-area" d={areaPath} />
        <path className="home-status-teaser__sparkline-line" d={linePath} />
        <circle className="home-status-teaser__sparkline-dot" cx={lastPoint.x} cy={lastPoint.y} r="1.9" />
      </svg>
    </div>
  )
}

function wrapProjectIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0
  }

  const remainder = index % length
  return remainder >= 0 ? remainder : remainder + length
}

type HeroCarouselPosition = 'center' | 'left' | 'right' | 'hidden-left' | 'hidden-right'

function getHeroCarouselPosition(
  projectIndex: number,
  activeIndex: number,
  projectCount: number,
): HeroCarouselPosition {
  if (projectCount <= 1) {
    return 'center'
  }

  const forwardDistance = wrapProjectIndex(projectIndex - activeIndex, projectCount)
  const backwardDistance = forwardDistance - projectCount
  const signedDistance =
    Math.abs(forwardDistance) <= Math.abs(backwardDistance) ? forwardDistance : backwardDistance

  if (signedDistance === 0) {
    return 'center'
  }
  if (signedDistance === -1) {
    return 'left'
  }
  if (signedDistance === 1) {
    return 'right'
  }

  return signedDistance < 0 ? 'hidden-left' : 'hidden-right'
}

type HomeCardRole = 'about' | 'projects' | 'skills' | 'contact' | 'default'

function normalizeHomeCardTarget(ctaUrl: string): string {
  const trimmed = ctaUrl.trim().toLowerCase()
  if (!trimmed) {
    return ''
  }

  return trimmed === '/' ? trimmed : trimmed.replace(/\/+$/, '')
}

function getHomeCardRole(ctaUrl: string): HomeCardRole {
  const target = normalizeHomeCardTarget(ctaUrl)

  if (target === '/about') {
    return 'about'
  }
  if (target === '/projects') {
    return 'projects'
  }
  if (target === '/skills') {
    return 'skills'
  }
  if (target === '/contact') {
    return 'contact'
  }

  return 'default'
}

function getHomeCardPriority(card: HomeCard): number {
  const role = getHomeCardRole(card.ctaUrl)

  if (role === 'about') {
    return 0
  }
  if (role === 'projects') {
    return 1
  }
  if (role === 'skills') {
    return 2
  }
  if (role === 'contact') {
    return 3
  }

  return 100 + Math.max(card.sortOrder, 0)
}

interface StatusSummary {
  endpointCount: number
  healthyEndpointCount: number
  issueCount: number
  nodeCount: number
  onlineNodeCount: number
  guestCount: number
  runningGuestCount: number
  averageNodeCpuPercent: number
}

interface StatusEndpoint {
  name: string
  status: string
  issue: string
  nodeCount: number
  onlineNodeCount: number
  guestCount: number
  runningGuestCount: number
}

interface StatusNode {
  id: string
  name: string
  endpointName: string
  status: string
  cpuPercent: number
  memoryPercent: number
  diskPercent: number
  uptimeSeconds: number
}

interface StatusGuest {
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

interface StatusPowerSummary {
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

interface StatusPower {
  available: boolean
  updatedAt: string | null
  issue: string
  summary: StatusPowerSummary
}

interface StatusWallboard {
  generatedAt: string | null
  summary: StatusSummary
  endpoints: StatusEndpoint[]
  nodes: StatusNode[]
  guests: StatusGuest[]
  power: StatusPower | null
}

export type HeroContent = Pick<SiteSettings, 'homeEyebrow' | 'homeTitle' | 'homeTagline' | 'homeIntro'>

export interface HomePageViewModel {
  hero: HeroContent
  cards: HomeCard[]
  featuredProjects?: Project[]
  maintenanceMode?: boolean
  maintenanceMessage?: string
  statusSnapshot: StackStatusSnapshot | null
  statusError: string | null
  error: string | null
  document?: BuilderDocument | null
  projectsDocument?: BuilderDocument | null
  statusDocument?: BuilderDocument | null
  builder?: PublicBuilderContext
}

export interface AboutPageViewModel {
  aboutBlocks: AboutBlock[]
  notice: string | null
  document?: BuilderDocument | null
  builder?: PublicBuilderContext
}

export interface ProjectsPageViewModel {
  projects: Project[]
  isLoading: boolean
  error: string | null
  document?: BuilderDocument | null
  builder?: PublicBuilderContext
}

export interface SkillsPageViewModel {
  title: string
  intro: string
  groups: SkillGroup[]
  notice: string | null
  document?: BuilderDocument | null
  builder?: PublicBuilderContext
}

export interface ContactPageViewModel {
  settings: SiteSettings
  notice: string | null
  isSending: boolean
  onSubmitContact: (formData: FormData) => Promise<boolean>
  document?: BuilderDocument | null
  builder?: PublicBuilderContext
}

export interface StatusPageViewModel {
  snapshot: StackStatusSnapshot | null
  wallboard: StatusWallboard | null
  maintenanceMode?: boolean
  maintenanceMessage?: string
  isUsingCachedSnapshot?: boolean
  error: string | null
  isLoading: boolean
  hideOfflineGuests: boolean
  isCompactMobile: boolean
  showAllMobileGuests: boolean
  nextRefreshAt: number | null
  refreshNow: number
  refreshCountdown: number | null
  visibleGuests: StatusGuest[]
  displayedGuests: StatusGuest[]
  remainingGuestCount: number
  guestPanelTitle: string
  guestPanelSummary: string
  hasMobileGuestOverflow: boolean
  spotlightNodes: StatusNode[]
  compactNodes: StatusNode[]
  batteryPercent: number | null
  loadPercent: number | null
  onRetry: () => void
  onToggleOfflineGuests: (next: boolean) => void
  onToggleMobileGuests: () => void
  document?: BuilderDocument | null
  builder?: PublicBuilderContext
}

export interface SiteNavigationProps {
  siteVisible: boolean
  isMenuOpen: boolean
  isMobileNavHidden: boolean
  isAdminAuthenticated: boolean | null
  isCompactNav?: boolean
  onMenuToggle: () => void
  onCloseMenu: () => void
  navItems: SiteNavItem[]
  headerActions: SiteNavItem[]
  brandLabel?: string
  brandHref?: string
  onOpenIntroSettings?: () => void
  builder?: PublicBuilderContext
}

function asRouteHref(route: string): string {
  return route || '/'
}

function normalizeSocialName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function toExternalHref(value: string): string | null {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  if (/^[a-z0-9.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`
  }

  return null
}

function normalizeGuestName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function isBackgroundComputeGuest(name: string): boolean {
  const normalized = normalizeGuestName(name)
  return normalized === 'golem' || normalized === 'golem2'
}

function formatClockTime(value: string | null): string {
  if (!value) {
    return 'Unavailable'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    timeStyle: 'medium',
  }).format(parsed)
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return 'Unavailable'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

function formatPercent(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) {
    return 'n/a'
  }

  return `${value.toFixed(digits).replace(/\.0$/, '')}%`
}

function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 'Offline'
  }

  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  return `${minutes}m`
}

function clampPercent(value: number | null): number {
  if (value === null || !Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(100, value))
}

function mapTone(status: string): StatusTone {
  const normalized = status.trim().toLowerCase()

  if (
    normalized === 'ok' ||
    normalized === 'healthy' ||
    normalized === 'online' ||
    normalized === 'running' ||
    normalized === 'normal'
  ) {
    return 'operational'
  }

  if (normalized === 'warning' || normalized === 'degraded' || normalized === 'partial') {
    return 'degraded'
  }

  if (normalized === 'offline' || normalized === 'failed' || normalized === 'outage') {
    return 'outage'
  }

  return 'unknown'
}

function normalizePowerSignal(value: string | null | undefined): string {
  if (!value) {
    return ''
  }

  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

// The battery level at which ups-guardian shuts down what is still running. Same figure as /homelab#power.
const lowBatteryShutdownPercent = 35

// pwrstat reports "117 Watt(13 %)" and "64 min."; show them as "117 W · 13 %" and "64 min".
function formatUpsLoad(value: string): string {
  const match = value.match(/([0-9]+(?:\.[0-9]+)?)\s*Watt\s*\(\s*([0-9]+(?:\.[0-9]+)?)\s*%\s*\)/i)
  return match ? `${match[1]} W · ${match[2]} %` : value
}

function formatUpsRuntime(value: string): string {
  return value.replace(/\.$/, '')
}

function isBatteryPowerAlert(power: StatusPower | null | undefined): boolean {
  if (!power) {
    return false
  }

  const powerSource = normalizePowerSignal(power.summary.powerSource)
  const state = normalizePowerSignal(power.summary.state)

  return (
    powerSource.includes('battery') ||
    powerSource.includes('on bat') ||
    state.includes('battery') ||
    state.includes('on bat') ||
    state.includes('discharging')
  )
}

function DocumentExtras({
  document,
  handledIds,
  builder,
  region,
}: {
  document?: BuilderDocument | null
  handledIds: string[]
  builder?: PublicBuilderContext
  region: string
}) {
  const nodes = getBuilderUnhandledRootChildren(document, handledIds)

  if (nodes.length === 0) {
    return null
  }

  return (
    <div className="builder-extra-stack">
      {nodes.map((node) => (
        <BuilderNodeContent
          key={node.id}
          node={node}
          builder={{
            ...builder,
            meta: {
              docKey: document?.docKey,
              region,
            },
          }}
        />
      ))}
    </div>
  )
}

function SiteLink({
  to,
  href,
  external,
  children,
  className,
  builder,
  meta,
  onClick,
}: {
  to?: string
  href?: string
  external?: boolean
  children: ReactNode
  className?: string
  builder?: PublicBuilderContext
  meta?: BuilderMetadata
  onClick?: (event: MouseEvent<HTMLElement>) => void
}) {
  const attrs = builderDataAttrs(meta ?? builder?.meta)

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    onClick?.(event)
    if (event.defaultPrevented) {
      return
    }

    const target = to ?? href
    if (builder?.onNavigate && target) {
      event.preventDefault()
      builder.onNavigate(target)
    }
  }

  if (to) {
    return (
      <Link className={className} to={to} onClick={handleClick} {...attrs}>
        {children}
      </Link>
    )
  }

  if (href && external) {
    return (
      <a className={className} href={href} target="_blank" rel="noreferrer" onClick={handleClick} {...attrs}>
        {children}
      </a>
    )
  }

  if (href) {
    return (
      <a className={className} href={href} onClick={handleClick} {...attrs}>
        {children}
      </a>
    )
  }

  return (
    <span className={className} {...attrs}>
      {children}
    </span>
  )
}

export function SiteNavigation({
  siteVisible,
  isMenuOpen,
  isMobileNavHidden,
  isAdminAuthenticated,
  isCompactNav = false,
  onMenuToggle,
  onCloseMenu,
  navItems,
  headerActions,
  brandLabel = 'nbdevlab',
  brandHref = '/',
  onOpenIntroSettings,
  builder,
}: SiteNavigationProps) {
  const visibleNavItems = navItems.filter(
    (item) => item.visible !== false && (item.action !== 'admin' || isAdminAuthenticated),
  )
  const visibleHeaderActions = headerActions.filter((item) => item.visible !== false)
  const isPhoneMenuOpen = isCompactNav && isMenuOpen
  const headerRef = useRef<HTMLElement>(null)

  // The phone menu hangs from the bottom of the bar and fills the rest of the screen. The bar is not always at the
  // top (the announcement strip can sit above it), so measure where it ends.
  useLayoutEffect(() => {
    const header = headerRef.current
    if (!header || !isPhoneMenuOpen) {
      return
    }

    const measure = () => {
      header.style.setProperty('--site-nav-bottom', `${Math.max(0, Math.round(header.getBoundingClientRect().bottom))}px`)
    }

    measure()
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
    }
  }, [isPhoneMenuOpen])

  const handleRouteClick = (target: string) => (event: MouseEvent<HTMLElement>) => {
    onCloseMenu()
    if (builder?.onNavigate) {
      event.preventDefault()
      builder.onNavigate(target)
    }
  }

  return (
    <header
      ref={headerRef}
      className={`site-nav ${siteVisible ? 'site-nav--visible' : ''} ${
        isMobileNavHidden ? 'site-nav--mobile-hidden' : ''
      } ${isPhoneMenuOpen ? 'site-nav--menu-open' : ''}`}
      {...builderDataAttrs({ docKey: 'layout.nav', nodeId: 'layout.nav', nodeType: 'header', region: 'site-header' })}
    >
      <SiteLink
        to={brandHref}
        className="site-brand"
        onClick={onCloseMenu}
        builder={builder}
        meta={{ docKey: 'layout.nav', nodeId: 'nav-brand', nodeType: 'link', region: 'site-header' }}
      >
        {brandLabel}
      </SiteLink>
      <div className="site-nav__controls">
        <SettingsGearButton
          className="settings-toggle--nav"
          label="Open intro settings"
          onClick={() => {
            onCloseMenu()
            onOpenIntroSettings?.()
          }}
        />
        {isCompactNav ? (
          <button
            type="button"
            className="button site-nav__menu-toggle"
            aria-expanded={isMenuOpen}
            aria-controls="site-primary-nav"
            onClick={onMenuToggle}
            {...builderDataAttrs({ docKey: 'layout.nav', nodeId: 'layout.nav.menu-toggle', nodeType: 'button', region: 'site-header' })}
          >
            {isMenuOpen ? 'Close' : 'Menu'}
          </button>
        ) : null}
      </div>
      <div className={`site-nav__right ${isPhoneMenuOpen ? 'site-nav__right--open' : ''}`}>
        {visibleHeaderActions.map((item) => {
          if (!item.action) {
            return null
          }

          const action = item.action

          if (builder?.onAction) {
            return (
              <button
                key={item.id}
                type="button"
                className="button site-nav__rain-button"
                onClick={(event) => {
                  onCloseMenu()
                  event.preventDefault()
                  builder.onAction?.(action)
                }}
                {...builderDataAttrs({ docKey: 'layout.nav', nodeId: item.id, nodeType: 'action', region: 'site-header' })}
              >
                {item.label}
              </button>
            )
          }

          if (action === 'admin') {
            return (
              <NavLink
                key={item.id}
                to="/admin"
                reloadDocument
                onClick={onCloseMenu}
                {...builderDataAttrs({ docKey: 'layout.nav', nodeId: item.id, nodeType: 'action', region: 'site-header' })}
              >
                {item.label}
              </NavLink>
            )
          }

          return null
        })}

        <nav id="site-primary-nav" aria-label="Main">
          <ul className="site-nav__list">
            {visibleNavItems.map((item) => {
              if (item.kind === 'external' && item.href) {
                return (
                  <li key={item.id} {...builderDataAttrs({ docKey: 'layout.nav', nodeId: item.id, nodeType: 'navItem', region: 'site-nav' })}>
                    <SiteLink external href={item.href} builder={builder}>
                      {item.label}
                    </SiteLink>
                  </li>
                )
              }

              if (item.kind === 'action' && item.action) {
                const action = item.action
                const href = action === 'admin' ? '/admin' : '#'

                if (builder?.onAction) {
                  return (
                    <li key={item.id} {...builderDataAttrs({ docKey: 'layout.nav', nodeId: item.id, nodeType: 'navItem', region: 'site-nav' })}>
                      <button
                        type="button"
                        onClick={(event) => {
                          onCloseMenu()
                          event.preventDefault()
                          builder.onAction?.(action)
                        }}
                      >
                        {item.label}
                      </button>
                    </li>
                  )
                }

                return (
                  <li key={item.id} {...builderDataAttrs({ docKey: 'layout.nav', nodeId: item.id, nodeType: 'navItem', region: 'site-nav' })}>
                    <SiteLink href={href} builder={builder}>
                      {item.label}
                    </SiteLink>
                  </li>
                )
              }

              const route = asRouteHref(item.route ?? '/')

              return (
                <li key={item.id} {...builderDataAttrs({ docKey: 'layout.nav', nodeId: item.id, nodeType: 'navItem', region: 'site-nav' })}>
                  <NavLink to={route} onClick={handleRouteClick(route)}>
                    {item.label}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </header>
  )
}

export function HomePageView({
  hero,
  cards,
  featuredProjects = [],
  maintenanceMode = false,
  maintenanceMessage,
  statusSnapshot,
  statusError,
  error,
  document,
  projectsDocument,
  statusDocument,
  builder,
}: HomePageViewModel) {
  const preferDocumentContent = builder?.mode === 'builder'
  const [heroCarouselIndex, setHeroCarouselIndex] = useState(0)
  const [isHeroCarouselPaused, setIsHeroCarouselPaused] = useState(false)
  const formatStatusClock = (value: string | null): string => {
    if (!value) {
      return 'Unavailable'
    }

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      return value
    }

    return new Intl.DateTimeFormat(undefined, {
      timeStyle: 'medium',
    }).format(parsed)
  }

  const runningGuests = findMetricValue(statusSnapshot, 'Running Guest Count') ?? '...'
  const averageNodeCpu = findMetricValue(statusSnapshot, 'Average Node Cpu Percent') ?? '...'
  const upsAvailability = findMetricValue(statusSnapshot, 'UPS Availability') ?? statusSnapshot?.overallLabel ?? '...'
  const lastStatusAt = formatStatusClock(statusSnapshot?.checkedAt ?? statusSnapshot?.fetchedAt ?? null)
  const runningGuestValue = parseMetricNumber(runningGuests)
  const averageNodeCpuValue = parseMetricNumber(averageNodeCpu)
  const [runningGuestTrend, setRunningGuestTrend] = useState<number[]>([])
  const [averageNodeCpuTrend, setAverageNodeCpuTrend] = useState<number[]>([])
  const homeStatusSummary = maintenanceMode
    ? maintenanceMessage ?? maintenanceStatusLabel
    : statusSnapshot?.summary ?? 'Quick look at endpoints, guest load, node health, and UPS status.'
  const homeStatusMetaLabel = maintenanceMode ? 'Maintenance mode' : 'Live feed'
  const homeStatusMetaState = maintenanceMode
    ? maintenanceStatusLabel
    : statusSnapshot
      ? `Updated ${lastStatusAt}`
      : statusError
        ? 'Reconnecting'
        : 'Connecting'
  const homeEndpointsValue = maintenanceMode ? maintenanceStatusLabel : statusSnapshot ? String(statusSnapshot.counts.total) : '...'
  const homeRunningGuestsValue = maintenanceMode ? maintenanceStatusLabel : runningGuests
  const homeAverageCpuValue = maintenanceMode ? maintenanceStatusLabel : averageNodeCpu
  const homePowerValue = maintenanceMode ? maintenanceStatusLabel : upsAvailability
  const homeStatusEyebrow = maintenanceMode ? 'Maintenance' : 'Live Status'
  const homeStatusTitle = maintenanceMode ? 'Status is temporarily unavailable.' : "See what I'm running right now."

  useEffect(() => {
    const snapshotKey = statusSnapshot?.checkedAt ?? statusSnapshot?.fetchedAt ?? null
    if (!snapshotKey) {
      return
    }

    if (runningGuestValue !== null) {
      const seed = buildMetricTrendSeed(statusSnapshot, 'runningGuests')
      setRunningGuestTrend((current) => buildRollingTrendSeries(current, runningGuestValue, seed))
    }

    if (averageNodeCpuValue !== null) {
      const seed = buildMetricTrendSeed(statusSnapshot, 'averageNodeCpu')
      setAverageNodeCpuTrend((current) => buildRollingTrendSeries(current, averageNodeCpuValue, seed))
    }
  }, [statusSnapshot, runningGuestValue, averageNodeCpuValue])
  const homeEyebrow = preferDocumentContent
    ? getBuilderNodeText(document, 'home-hero-eyebrow', hero.homeEyebrow)
    : hero.homeEyebrow
  const homeTitle = preferDocumentContent
    ? getBuilderNodeText(document, 'home-hero-title', hero.homeTitle)
    : hero.homeTitle
  const homeTagline = preferDocumentContent
    ? getBuilderNodeText(document, 'home-hero-tagline', hero.homeTagline)
    : hero.homeTagline
  const homeIntro = preferDocumentContent
    ? getBuilderNodeText(document, 'home-hero-intro', hero.homeIntro)
    : hero.homeIntro
  const homeEyebrowStyle = getBuilderNodeTextStyle(document, 'home-hero-eyebrow')
  const homeTitleStyle = getBuilderNodeTextStyle(document, 'home-hero-title')
  const homeTaglineStyle = getBuilderNodeTextStyle(document, 'home-hero-tagline')
  const homeIntroStyle = getBuilderNodeTextStyle(document, 'home-hero-intro')
  const homeLeadSegments = homeTagline
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean)
  const useSegmentedHomeLead = homeLeadSegments.length > 1 && homeLeadSegments.join(' ').length <= 96
  const orderedCards = useMemo(
    () =>
      [...cards].sort((left, right) => {
        const priorityDifference = getHomeCardPriority(left) - getHomeCardPriority(right)
        if (priorityDifference !== 0) {
          return priorityDifference
        }

        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder
        }

        return left.id - right.id
      }),
    [cards],
  )
  const heroFeaturedProjects = useMemo(
    () => featuredProjects.filter((project) => project.isFeatured),
    [featuredProjects],
  )
  const heroCarouselCards = useMemo(() => {
    const projectCount = heroFeaturedProjects.length

    if (projectCount === 0) {
      return []
    }

    return heroFeaturedProjects.map((project, projectIndex) => ({
      project,
      projectIndex,
      position: getHeroCarouselPosition(projectIndex, heroCarouselIndex, projectCount),
    }))
  }, [heroCarouselIndex, heroFeaturedProjects])
  const currentlyBuildingItems =
    Array.isArray(document?.root.children?.find((node) => node.id === 'home-currently-building')?.content?.items)
      ? (
          document?.root.children?.find((node) => node.id === 'home-currently-building')?.content?.items as unknown[]
        )
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter(Boolean)
      : ['AICMS', 'PVE Dashboard', 'Cryo-AI']

  useEffect(() => {
    if (heroFeaturedProjects.length === 0) {
      setHeroCarouselIndex(0)
      return
    }

    setHeroCarouselIndex((currentIndex) => wrapProjectIndex(currentIndex, heroFeaturedProjects.length))
  }, [heroFeaturedProjects.length])

  useEffect(() => {
    if (heroFeaturedProjects.length <= 1 || isHeroCarouselPaused) {
      return
    }

    const intervalId = window.setInterval(() => {
      setHeroCarouselIndex((currentIndex) => wrapProjectIndex(currentIndex + 1, heroFeaturedProjects.length))
    }, 4200)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [heroFeaturedProjects.length, isHeroCarouselPaused])

  return (
    <>
      <section className="home-stage reveal-card" style={{ '--delay': '120ms' } as CSSProperties}>
        <div
          className={`home-stage__hero${heroFeaturedProjects.length === 0 ? ' home-stage__hero--solo' : ''}`}
          {...builderDataAttrs({ docKey: 'page.home', nodeId: 'home-hero', nodeType: 'section', region: 'home' })}
        >
          <div className="home-stage__hero-main">
            {homeEyebrow && (
              <p
                className="eyebrow"
                style={homeEyebrowStyle}
                {...builderDataAttrs({ docKey: 'page.home', nodeId: 'home-hero-eyebrow', nodeType: 'text', region: 'home' })}
              >
                {homeEyebrow}
              </p>
            )}
            <h1
              className="home-hero__title"
              style={homeTitleStyle}
              {...builderDataAttrs({ docKey: 'page.home', nodeId: 'home-hero-title', nodeType: 'text', region: 'home' })}
            >
              {homeTitle}
            </h1>
            <p
              className="home-hero__lead"
              style={homeTaglineStyle}
              {...builderDataAttrs({ docKey: 'page.home', nodeId: 'home-hero-tagline', nodeType: 'text', region: 'home' })}
            >
              {useSegmentedHomeLead
                ? homeLeadSegments.map((segment, index) => (
                    <span className="home-hero__lead-line" key={`${segment}-${index}`}>
                      {segment}
                      {index < homeLeadSegments.length - 1 ? ',' : ''}
                    </span>
                  ))
                : homeTagline}
            </p>
          </div>

          {heroFeaturedProjects.length > 0 && (
            <aside
              className={`home-hero__carousel${heroFeaturedProjects.length <= 1 ? ' home-hero__carousel--static' : ''}`}
              aria-label="Featured projects"
              onMouseEnter={() => setIsHeroCarouselPaused(true)}
              onMouseLeave={() => setIsHeroCarouselPaused(false)}
            >
              <div className="home-hero__carousel-deck">
                {heroCarouselCards.map(({ project, position, projectIndex }) => (
                  <article
                    className={`home-hero-project home-hero-project--${position}`}
                    key={project.id}
                    style={getBuilderNodePresentationStyle(projectsDocument, `project-${project.id}`)}
                    {...builderDataAttrs({
                      docKey: 'page.projects',
                      nodeId: `project-${project.id}`,
                      nodeType: 'card',
                      region: 'projects',
                    })}
                  >
                    <div className="home-hero-project__head">
                      <p className="eyebrow">Featured Build</p>
                      <span className="home-hero-project__index">{String(projectIndex + 1).padStart(2, '0')}</span>
                    </div>
                    <h2>{displayProjectTitle(project)}</h2>
                    <p className="home-hero-project__summary">{truncateText(project.summary, 164)}</p>
                    <div className="home-hero-project__footer">
                      {position === 'center' ? (
                        <SiteLink className="home-hero-project__link" to="/projects" builder={builder}>
                          Read More
                        </SiteLink>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </aside>
          )}

          <div className="home-hero__details">
            <p
              className="home-hero__intro"
              style={homeIntroStyle}
              {...builderDataAttrs({ docKey: 'page.home', nodeId: 'home-hero-intro', nodeType: 'text', region: 'home' })}
            >
              {homeIntro}
            </p>

            <section className="home-hero__focus" aria-labelledby="currently-building-heading">
              <div className="home-currently-building__head">
                <p className="eyebrow" id="currently-building-heading">
                  Currently Building
                </p>
              </div>
              <div
                className="home-currently-building__items"
                role="list"
                {...builderDataAttrs({ docKey: 'page.home', nodeId: 'home-currently-building', nodeType: 'section', region: 'home' })}
              >
                {currentlyBuildingItems.map((item) => (
                  <span key={item} role="listitem">
                    {item}
                  </span>
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>

      {error && (
        <p className="notice notice--error reveal-card" style={{ '--delay': '220ms' } as CSSProperties}>
          {error}
        </p>
      )}

      {cards.length > 0 ? (
        <div
          className="home-card-grid reveal-card"
          style={{ '--delay': '300ms' } as CSSProperties}
          aria-label="Homepage cards"
          {...builderDataAttrs({ docKey: 'page.home', nodeId: 'home-cards', nodeType: 'collection', region: 'home' })}
        >
          <article
            className="home-card home-card--status home-status-teaser"
            style={getBuilderNodePresentationStyle(document, 'home-status-teaser')}
            {...builderDataAttrs({ docKey: 'page.home', nodeId: 'home-status-teaser', nodeType: 'section', region: 'home' })}
          >
            <div className="home-status-teaser__intro">
              <p className="eyebrow">{homeStatusEyebrow}</p>
              <h2>{homeStatusTitle}</h2>
            </div>

            <div className="home-status-teaser__summary">
              <p>{homeStatusSummary}</p>
              <div className="home-status-teaser__meta">
                <span className={`home-status-live${maintenanceMode ? ' home-status-live--maintenance' : ''}`}>
                  <span className="home-status-live__dot" aria-hidden="true" />
                  {homeStatusMetaLabel}
                </span>
                <span>{homeStatusMetaState}</span>
              </div>

              {!maintenanceMode && statusError && !statusSnapshot && <p className="notice">{statusError}</p>}
            </div>

            <div className="home-status-teaser__aside">
              <SiteLink className="button home-status-teaser__action" to="/status" builder={builder}>
                Open Status
              </SiteLink>

              <div className="home-status-teaser__metrics">
                <article
                  className="home-status-teaser__metric"
                  style={getBuilderNodePresentationStyle(statusDocument, 'status-metric-endpoints')}
                  {...builderDataAttrs({
                    docKey: 'page.status',
                    nodeId: 'status-metric-endpoints',
                    nodeType: 'dynamicWidget',
                    region: 'status',
                  })}
                >
                  <span>Endpoints</span>
                  <strong className={maintenanceMode ? 'maintenance-copy' : undefined}>{homeEndpointsValue}</strong>
                </article>
                <article
                  className="home-status-teaser__metric"
                  style={getBuilderNodePresentationStyle(statusDocument, 'status-metric-running-guests')}
                  {...builderDataAttrs({
                    docKey: 'page.status',
                    nodeId: 'status-metric-running-guests',
                    nodeType: 'dynamicWidget',
                    region: 'status',
                  })}
                >
                  <span>Running Guests</span>
                  <strong className={maintenanceMode ? 'maintenance-copy' : undefined}>{homeRunningGuestsValue}</strong>
                  {!maintenanceMode && runningGuestTrend.length > 0 ? <MetricSparkline values={runningGuestTrend} /> : null}
                </article>
                <article
                  className="home-status-teaser__metric"
                  style={getBuilderNodePresentationStyle(statusDocument, 'status-metric-average-cpu')}
                  {...builderDataAttrs({
                    docKey: 'page.status',
                    nodeId: 'status-metric-average-cpu',
                    nodeType: 'dynamicWidget',
                    region: 'status',
                  })}
                >
                  <span>Avg Node CPU</span>
                  <strong className={maintenanceMode ? 'maintenance-copy' : undefined}>{homeAverageCpuValue}</strong>
                  {!maintenanceMode && averageNodeCpuTrend.length > 0 ? <MetricSparkline values={averageNodeCpuTrend} /> : null}
                </article>
                <article
                  className="home-status-teaser__metric"
                  style={getBuilderNodePresentationStyle(statusDocument, 'status-power')}
                  {...builderDataAttrs({
                    docKey: 'page.status',
                    nodeId: 'status-power',
                    nodeType: 'dynamicWidget',
                    region: 'status',
                  })}
                >
                  <span>Power</span>
                  <strong className={maintenanceMode ? 'maintenance-copy' : undefined}>{homePowerValue}</strong>
                </article>
              </div>
            </div>
          </article>

          {orderedCards.map((card) => {
            const isExternal = /^https?:\/\//i.test(card.ctaUrl)
            const widthUnits = clampUnits(card.widthUnits)
            const heightUnits = clampUnits(card.heightUnits)
            const role = getHomeCardRole(card.ctaUrl)

            return (
              <article
                key={card.id}
                className={[
                  'home-card',
                  role !== 'default' ? `home-card--${role}` : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{
                  ...getBuilderNodePresentationStyle(document, `home-card-${card.id}`),
                  '--home-card-col-span': `${widthUnits * 3}`,
                  '--home-card-col-span-tablet': `${Math.min(widthUnits * 2, 6)}`,
                  '--home-card-row-span': `${Math.max(heightUnits * 2, 2)}`,
                  '--home-card-row-span-tablet': `${Math.max(heightUnits, 1)}`,
                } as CSSProperties}
                {...builderDataAttrs({ docKey: 'page.home', nodeId: `home-card-${card.id}`, nodeType: 'card', region: 'home' })}
              >
                {card.subtitle && <p className="eyebrow">{card.subtitle}</p>}
                <h2>{card.title}</h2>
                {card.body && <p>{card.body}</p>}
                {card.ctaLabel && card.ctaUrl && isExternal && (
                  <SiteLink href={card.ctaUrl} external builder={builder}>
                    {card.ctaLabel}
                  </SiteLink>
                )}
                {card.ctaLabel && card.ctaUrl && !isExternal && (
                  <SiteLink className="button" to={card.ctaUrl} builder={builder}>
                    {card.ctaLabel}
                  </SiteLink>
                )}
              </article>
            )
          })}
        </div>
      ) : (
        <div
          className="home-card-grid reveal-card"
          style={{ '--delay': '300ms' } as CSSProperties}
          aria-label="Homepage skeleton layout"
        >
          <article className="home-card home-card--status home-status-teaser" aria-hidden="true">
            <div className="home-status-teaser__intro">
              <p className="eyebrow">Live Status</p>
              <h2>See what I&apos;m running right now.</h2>
            </div>
            <div className="home-status-teaser__summary">
              <div className="skeleton-line" />
              <div className="skeleton-line skeleton-line--short" />
              <div className="skeleton-line skeleton-line--short" />
            </div>
            <div className="home-status-teaser__aside">
              <div className="skeleton-line skeleton-line--short" />
              <div className="home-status-teaser__metrics">
                <article className="home-status-teaser__metric">
                  <div className="skeleton-line skeleton-line--short" />
                  <div className="skeleton-line skeleton-line--short" />
                </article>
                <article className="home-status-teaser__metric">
                  <div className="skeleton-line skeleton-line--short" />
                  <div className="skeleton-line skeleton-line--short" />
                </article>
                <article className="home-status-teaser__metric">
                  <div className="skeleton-line skeleton-line--short" />
                  <div className="skeleton-line skeleton-line--short" />
                </article>
                <article className="home-status-teaser__metric">
                  <div className="skeleton-line skeleton-line--short" />
                  <div className="skeleton-line skeleton-line--short" />
                </article>
              </div>
            </div>
          </article>

          <article className="home-card skeleton-card home-card--about">
            <div className="skeleton-line skeleton-line--title" />
            <div className="skeleton-line" />
            <div className="skeleton-line skeleton-line--short" />
            <SiteLink className="button" to="/about" builder={builder}>
              Open About
            </SiteLink>
          </article>
          <article className="home-card skeleton-card home-card--projects">
            <div className="skeleton-line skeleton-line--title" />
            <div className="skeleton-line" />
            <div className="skeleton-line skeleton-line--short" />
            <SiteLink className="button" to="/projects" builder={builder}>
              Open Projects
            </SiteLink>
          </article>
          <article className="home-card skeleton-card home-card--skills">
            <div className="skeleton-line skeleton-line--title" />
            <div className="skeleton-line" />
            <div className="skeleton-line skeleton-line--short" />
            <SiteLink className="button" to="/skills" builder={builder}>
              Open Skills
            </SiteLink>
          </article>
          <article className="home-card skeleton-card home-card--contact">
            <div className="skeleton-line skeleton-line--title" />
            <div className="skeleton-line" />
            <div className="skeleton-line skeleton-line--short" />
            <SiteLink className="button" to="/contact" builder={builder}>
              Open Contact
            </SiteLink>
          </article>
        </div>
      )}

      <DocumentExtras
        document={document}
        handledIds={['home-hero', 'home-status-teaser', 'home-cards', 'home-currently-building']}
        builder={builder}
        region="home"
      />
    </>
  )
}

function AboutImageFigure({
  block,
  imageIndex,
  inlineOnDesktop,
}: {
  block: AboutImageBlock
  imageIndex: number
  inlineOnDesktop: boolean
}) {
  const [shape, setShape] = useState<ImageShape>('landscape')
  const alignmentClass = imageIndex % 2 === 0 ? 'about-page__figure--align-right' : 'about-page__figure--align-left'
  const layoutClass =
    shape === 'portrait' && inlineOnDesktop ? 'about-page__figure--flow' : 'about-page__figure--stacked'
  const topRuleClass = block.showTopRule ? 'about-page__figure--top-rule' : ''

  return (
    <figure
      className={[
        'about-page__figure',
        `about-page__figure--${shape}`,
        layoutClass,
        alignmentClass,
        topRuleClass,
      ].join(' ')}
      {...builderDataAttrs({ docKey: 'page.about', nodeId: `about-${block.id}`, nodeType: 'image', region: 'about' })}
    >
      <img
        className="about-page__image"
        src={block.src}
        alt={block.alt.trim() || block.caption.trim() || ''}
        loading="lazy"
        decoding="async"
        onLoad={(event) =>
          setShape(classifyImageShape(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight))
        }
      />
      {block.caption.trim() && <figcaption>{block.caption}</figcaption>}
    </figure>
  )
}

function AboutParagraphImagePair({
  paragraph,
  block,
}: {
  paragraph: AboutParagraphBlock
  block: AboutImageBlock
}) {
  const [shape, setShape] = useState<ImageShape>('landscape')
  const topRuleClass = paragraph.showTopRule || block.showTopRule ? 'about-page__pair--top-rule' : ''

  return (
    <div className={['about-page__pair', `about-page__pair--${shape}`, topRuleClass].join(' ')}>
      <p
        className="about-page__paragraph"
        {...builderDataAttrs({ docKey: 'page.about', nodeId: `about-${paragraph.id}`, nodeType: 'text', region: 'about' })}
      >
        {paragraph.content}
      </p>
      <figure
        className={['about-page__figure', 'about-page__figure--paired', `about-page__figure--${shape}`].join(' ')}
        {...builderDataAttrs({ docKey: 'page.about', nodeId: `about-${block.id}`, nodeType: 'image', region: 'about' })}
      >
        <img
          className="about-page__image"
          src={block.src}
          alt={block.alt.trim() || block.caption.trim() || ''}
          loading="lazy"
          decoding="async"
          onLoad={(event) =>
            setShape(classifyImageShape(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight))
          }
        />
        {block.caption.trim() && <figcaption>{block.caption}</figcaption>}
      </figure>
    </div>
  )
}

function classifyImageShape(width: number, height: number): ImageShape {
  if (!width || !height) {
    return 'landscape'
  }

  const ratio = width / height
  if (ratio < 0.85) {
    return 'portrait'
  }
  if (ratio > 1.15) {
    return 'landscape'
  }

  return 'square'
}

export function AboutPageView({ aboutBlocks, notice, document, builder }: AboutPageViewModel) {
  const preferDocumentContent = builder?.mode === 'builder'
  const aboutBuiltWithStyle = getBuilderNodeTextStyle(document, 'about-built-with')
  let imageIndex = 0
  const renderedBlocks = []

  for (let index = 0; index < aboutBlocks.length; index += 1) {
    const block = aboutBlocks[index]
    const nextBlock = aboutBlocks[index + 1]

    if (
      block.type === 'paragraph' &&
      block.content.trim() &&
      nextBlock?.type === 'image' &&
      nextBlock.src.trim() &&
      !aboutBlocks
        .slice(index + 2)
        .some((nextBlock) => nextBlock.type === 'paragraph' && nextBlock.content.trim())
    ) {
      const nextImageBlock = nextBlock
      imageIndex += 1
      renderedBlocks.push(
        <AboutParagraphImagePair key={`${block.id}-${nextImageBlock.id}`} paragraph={block} block={nextImageBlock} />,
      )
      index += 1
      continue
    }

    if (block.type === 'image') {
      if (!block.src.trim()) {
        continue
      }

      const currentImageIndex = imageIndex
      imageIndex += 1
      const inlineOnDesktop = aboutBlocks
        .slice(index + 1)
        .some((nextBlock) => nextBlock.type === 'paragraph' && nextBlock.content.trim())

      renderedBlocks.push(
        <AboutImageFigure
          key={block.id}
          block={block}
          imageIndex={currentImageIndex}
          inlineOnDesktop={inlineOnDesktop}
        />,
      )
      continue
    }

    if (!block.content.trim()) {
      continue
    }

    renderedBlocks.push(
      <p
        key={block.id}
        className={['about-page__paragraph', block.showTopRule ? 'about-page__paragraph--top-rule' : ''].join(' ')}
        {...builderDataAttrs({ docKey: 'page.about', nodeId: `about-${block.id}`, nodeType: 'text', region: 'about' })}
      >
        {block.content}
      </p>,
    )
  }

  return (
    <section className="public-page about-page reveal-card" style={{ '--delay': '120ms' } as CSSProperties}>
      <p className="eyebrow">About</p>
      <h1>About</h1>
      <div className="about-page__body" {...builderDataAttrs({ docKey: 'page.about', nodeId: 'about-blocks', nodeType: 'collection', region: 'about' })}>
        {renderedBlocks}
      </div>
      {notice && <p className="notice">{notice}</p>}
      <DocumentExtras document={document} handledIds={['about-blocks', 'about-built-with']} builder={builder} region="about" />
      <footer className="about-page__built-with">
        <p className="eyebrow">Built With</p>
        <p
          style={aboutBuiltWithStyle}
          {...builderDataAttrs({ docKey: 'page.about', nodeId: 'about-built-with', nodeType: 'text', region: 'about' })}
        >
          {preferDocumentContent
            ? getBuilderNodeText(
                document,
                'about-built-with',
                'Built with Cloudflare Pages Functions, D1, R2, and custom status/project data pipelines.',
              )
            : 'Built with Cloudflare Pages Functions, D1, R2, and custom status/project data pipelines.'}
        </p>
      </footer>
    </section>
  )
}

const projectsIntro =
  'My homelab is built around Proxmox, self-hosted services, security tooling, and hands-on infrastructure experiments. A lot of these systems are tied together with Cloudflare Zero Trust, which I use to securely publish and reach selected internal services like Nextcloud, Technitium DNS, core Proxmox systems, and remote Windows lab machines without directly exposing the rest of the network.'

function truncateText(value: string, maxLength: number): string {
  const trimmed = value.trim()
  if (trimmed.length <= maxLength) {
    return trimmed
  }

  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

function splitProjectDetails(value: string): string[] {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

function getProjectLinks(project: Project) {
  if (project.links.length > 0) {
    return project.links
  }

  const fallbackLinks = []
  if (project.demoUrl) {
    fallbackLinks.push({
      id: `${project.id}-demo`,
      label: 'Demo',
      url: project.demoUrl,
      kind: 'demo' as const,
    })
  }
  if (project.repoUrl) {
    fallbackLinks.push({
      id: `${project.id}-repo`,
      label: 'Repo',
      url: project.repoUrl,
      kind: 'repo' as const,
    })
  }

  return fallbackLinks
}

function getProjectDetailBoardHeight(project: Project): number {
  const maxBottom = project.detailCards.reduce((max, card) => Math.max(max, card.y + card.height), 76)
  return Math.min(560, Math.max(340, maxBottom * 4.6))
}

function ProjectCard({
  project,
  featuredLabel,
  onOpen,
  document,
  builder,
}: {
  project: Project
  featuredLabel?: string
  onOpen?: () => void
  document?: BuilderDocument | null
  builder?: PublicBuilderContext
}) {
  const summary = truncateText(project.summary, featuredLabel ? 188 : 156)
  const isInteractive = typeof onOpen === 'function'
  const projectLinks = getProjectLinks(project)
  const stageMap = findProjectStageMap(project.contentBlocks)

  return (
    <article
      className={[
        'project-card',
        featuredLabel ? 'project-card--featured' : '',
        isInteractive ? 'project-card--interactive' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={
        isInteractive
          ? () => {
              onOpen?.()
            }
          : undefined
      }
      onKeyDown={
        isInteractive
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onOpen?.()
              }
            }
          : undefined
      }
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-haspopup={isInteractive ? 'dialog' : undefined}
      aria-label={isInteractive ? `Open ${displayProjectTitle(project)}` : undefined}
      style={getBuilderNodePresentationStyle(document, `project-${project.id}`)}
      {...builderDataAttrs({
        docKey: 'page.projects',
        nodeId: `project-${project.id}`,
        nodeType: 'card',
        region: 'projects',
      })}
    >
      {featuredLabel && <p className="eyebrow">{featuredLabel}</p>}
      {project.images[0] && (
        <img src={project.images[0].url} alt={project.images[0].altText || displayProjectTitle(project)} />
      )}
      <h3>{displayProjectTitle(project)}</h3>
      <p className="project-card__summary">{summary}</p>
      {stageMap && <ProjectCardStages block={stageMap} />}
      <div className="project-tags">
        {project.tech.map((tech) => (
          <span key={`${project.id}-${tech}`}>{tech}</span>
        ))}
      </div>
      {isInteractive ? (
        <div className="project-card__footer">
          <span className="project-card__open">Open Project</span>
        </div>
      ) : (
        <div className="project-links">
          {projectLinks.map((link) => (
            <SiteLink
              key={link.id}
              href={link.url}
              external
              builder={builder}
              meta={{ nodeId: `project-${project.id}-${link.id}`, nodeType: 'link', region: 'projects' }}
            >
              {link.label}
            </SiteLink>
          ))}
        </div>
      )}
    </article>
  )
}

function displayProjectTitle(project: Project): string {
  const identity = getProjectIdentityKey(project)
  if (identity === 'pve-dashboard') {
    return 'PVE Dashboard'
  }
  if (identity === 'cryo-ai') {
    return 'Cryo-AI'
  }

  return project.title
}

function ProjectDetailModal({
  project,
  previousProject,
  nextProject,
  onClose,
  onShowPrevious,
  onShowNext,
  document,
  builder,
}: {
  project: Project
  previousProject: Project | null
  nextProject: Project | null
  onClose: () => void
  onShowPrevious: () => void
  onShowNext: () => void
  document?: BuilderDocument | null
  builder?: PublicBuilderContext
}) {
  const detailParagraphs = splitProjectDetails(project.details.trim())
  const projectLinks = getProjectLinks(project)
  const detailBoardHeight = getProjectDetailBoardHeight(project)
  // A page arranged in the editor shows its blocks. Until then the project keeps the old fixed layout.
  const contentBlocks = project.contentBlocks ?? []

  return (
    <div className="project-detail-modal" role="dialog" aria-modal="true" aria-labelledby={`project-detail-title-${project.id}`} onClick={onClose}>
      <div className="project-detail-modal__backdrop" />
      <article
        className="project-detail-modal__panel"
        style={getBuilderNodePresentationStyle(document, `project-${project.id}`)}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="project-detail-modal__header">
          <div className="project-detail-modal__heading">
            <p className="eyebrow">{project.isFeatured ? 'Featured Build' : 'Project Detail'}</p>
            <h2 id={`project-detail-title-${project.id}`}>{displayProjectTitle(project)}</h2>
          </div>
          <button type="button" className="button project-detail-modal__close" onClick={onClose}>
            Close
          </button>
        </header>

        {contentBlocks.length > 0 ? (
          <ProjectBlocksView
            blocks={contentBlocks}
            title={displayProjectTitle(project)}
            summary={project.summary}
            tech={project.tech}
            links={projectLinks}
            images={project.images}
          />
        ) : (
          <div className={`project-detail-modal__body${project.images[0] ? ' project-detail-modal__body--with-media' : ''}`}>
            {project.images.length > 0 && (
              <figure className="project-detail-modal__media">
                {/* Every image, in its saved order. The card on the grid still shows only the first one. */}
                {project.images.map((image, index) => (
                  <img
                    key={image.id}
                    src={image.url}
                    alt={image.altText || displayProjectTitle(project)}
                    loading={index === 0 ? undefined : 'lazy'}
                  />
                ))}
              </figure>
            )}

            <div className="project-detail-modal__content">
              <p className="project-detail-modal__summary">{project.summary}</p>

              {detailParagraphs.length > 0 && (
                <div className="project-detail-modal__copy">
                  {detailParagraphs.map((paragraph, index) => (
                    <p key={`${project.id}-detail-${index}`}>{paragraph}</p>
                  ))}
                </div>
              )}

              {project.tech.length > 0 && (
                <div className="project-tags project-detail-modal__tags">
                  {project.tech.map((tech) => (
                    <span key={`${project.id}-detail-tech-${tech}`}>{tech}</span>
                  ))}
                </div>
              )}

              {projectLinks.length > 0 && (
                <div className="project-links project-detail-modal__links">
                  {projectLinks.map((link) => (
                    <SiteLink
                      key={link.id}
                      href={link.url}
                      external
                      builder={builder}
                      meta={{ nodeId: `project-${project.id}-${link.id}`, nodeType: 'link', region: 'projects' }}
                    >
                      {link.label}
                    </SiteLink>
                  ))}
                </div>
              )}

              {project.detailCards.length > 0 && (
                <section className="project-detail-modal__embedded">
                  <div className="project-detail-modal__embedded-head">
                    <p className="eyebrow">Inside This Build</p>
                    <strong>Embedded detail cards</strong>
                  </div>
                  <div
                    className="project-detail-modal__embedded-board"
                    style={{ height: `${detailBoardHeight}px` }}
                  >
                    {project.detailCards.map((card) => (
                      <article
                        key={card.id}
                        className="project-detail-modal__embedded-card"
                        style={{
                          left: `${card.x}%`,
                          top: `${card.y}%`,
                          width: `${card.width}%`,
                          height: `${card.height}%`,
                        }}
                      >
                        <div className="project-detail-modal__embedded-card-copy">
                          <span className="eyebrow">Detail Card</span>
                          <h3>{card.title}</h3>
                          {card.body && <p>{card.body}</p>}
                        </div>
                        {card.linkLabel && card.linkUrl && (
                          <div className="project-detail-modal__embedded-card-actions">
                            <SiteLink
                              href={card.linkUrl}
                              external
                              builder={builder}
                              meta={{ nodeId: `project-${project.id}-${card.id}-link`, nodeType: 'link', region: 'projects' }}
                            >
                              {card.linkLabel}
                            </SiteLink>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}

        {(previousProject || nextProject) && (
          <footer className="project-detail-modal__nav">
            <button
              type="button"
              className="project-detail-modal__nav-button"
              style={getBuilderNodePresentationStyle(document, `project-${previousProject?.id ?? project.id}`)}
              onClick={onShowPrevious}
            >
              <span className="eyebrow">Previous</span>
              <strong>{previousProject ? `< ${displayProjectTitle(previousProject)}` : 'Start'}</strong>
            </button>
            <button
              type="button"
              className="project-detail-modal__nav-button"
              style={getBuilderNodePresentationStyle(document, `project-${nextProject?.id ?? project.id}`)}
              onClick={onShowNext}
            >
              <span className="eyebrow">Next</span>
              <strong>{nextProject ? `${displayProjectTitle(nextProject)} >` : 'End'}</strong>
            </button>
          </footer>
        )}
      </article>
    </div>
  )
}

export function ProjectsPageView({ projects, isLoading, error, document, builder }: ProjectsPageViewModel) {
  const preferDocumentContent = builder?.mode === 'builder'
  const isBuilderMode = builder?.mode === 'builder'
  const projectsIntroStyle = getBuilderNodeTextStyle(document, 'projects-intro')
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null)
  const { featuredProjects, remainingProjects } = useMemo(
    () => ({
      featuredProjects: projects.filter((project) => project.isFeatured),
      remainingProjects: projects.filter((project) => !project.isFeatured),
    }),
    [projects],
  )
  const orderedProjects = useMemo(() => [...featuredProjects, ...remainingProjects], [featuredProjects, remainingProjects])
  const activeProjectIndex = useMemo(
    () => orderedProjects.findIndex((project) => project.id === activeProjectId),
    [activeProjectId, orderedProjects],
  )
  const activeProject = activeProjectIndex >= 0 ? orderedProjects[activeProjectIndex] ?? null : null
  const previousProject =
    activeProject && orderedProjects.length > 1
      ? orderedProjects[wrapProjectIndex(activeProjectIndex - 1, orderedProjects.length)] ?? null
      : null
  const nextProject =
    activeProject && orderedProjects.length > 1
      ? orderedProjects[wrapProjectIndex(activeProjectIndex + 1, orderedProjects.length)] ?? null
      : null

  useEffect(() => {
    if (activeProjectId !== null && activeProjectIndex < 0) {
      setActiveProjectId(null)
    }
  }, [activeProjectId, activeProjectIndex])

  useEffect(() => {
    if (!activeProject) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setActiveProjectId(null)
        return
      }

      if (orderedProjects.length <= 1) {
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setActiveProjectId(orderedProjects[wrapProjectIndex(activeProjectIndex - 1, orderedProjects.length)]?.id ?? null)
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        setActiveProjectId(orderedProjects[wrapProjectIndex(activeProjectIndex + 1, orderedProjects.length)]?.id ?? null)
      }
    }

    const previousOverflow = window.document.body.style.overflow
    window.document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeProject, activeProjectIndex, orderedProjects])

  return (
    <section className="public-page projects-page reveal-card" style={{ '--delay': '120ms' } as CSSProperties}>
      <p className="eyebrow">Projects</p>
      <h1>Projects</h1>
      <div
        className="projects-page__intro"
        {...builderDataAttrs({ docKey: 'page.projects', nodeId: 'projects-intro', nodeType: 'text', region: 'projects' })}
      >
        <p style={projectsIntroStyle}>
          {preferDocumentContent ? getBuilderNodeText(document, 'projects-intro', projectsIntro) : projectsIntro}
        </p>
      </div>

      {isLoading && <p className="notice">Loading projects...</p>}
      {error && <p className="notice notice--error">{error}</p>}

      {featuredProjects.length > 0 && (
        <section
          className="projects-page__section projects-page__section--featured"
          aria-labelledby="featured-projects-heading"
          {...builderDataAttrs({ docKey: 'page.projects', nodeId: 'projects-featured', nodeType: 'section', region: 'projects' })}
        >
          <div className="section-head">
            <div>
              <p className="eyebrow">Featured</p>
              <h2 id="featured-projects-heading">Priority builds and core lab systems</h2>
            </div>
          </div>
          <div className="project-grid project-grid--featured">
            {featuredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                featuredLabel="Featured"
                document={document}
                builder={builder}
                onOpen={!isBuilderMode ? () => setActiveProjectId(project.id) : undefined}
              />
            ))}
          </div>
        </section>
      )}

      <section className="projects-page__section" aria-labelledby="projects-list-heading">
        <div className="section-head">
          <div>
            <p className="eyebrow">Build Log</p>
            <h2 id="projects-list-heading">Infrastructure, services, and experiments</h2>
          </div>
        </div>

        {remainingProjects.length > 0 && (
          <div
            className="project-grid project-grid--full"
            {...builderDataAttrs({ docKey: 'page.projects', nodeId: 'projects-remaining-list', nodeType: 'collection', region: 'projects' })}
          >
            {remainingProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                document={document}
                builder={builder}
                onOpen={!isBuilderMode ? () => setActiveProjectId(project.id) : undefined}
              />
            ))}
          </div>
        )}

        {!isLoading && !error && projects.length === 0 && <p className="notice">No published projects yet.</p>}

        {!isLoading && !error && projects.length > 0 && remainingProjects.length === 0 && (
          <p className="notice">Everything currently published is featured above.</p>
        )}
      </section>

      <DocumentExtras
        document={document}
        handledIds={['projects-intro', 'projects-featured', 'projects-grid']}
        builder={builder}
        region="projects"
      />

      {activeProject && !isBuilderMode && (
        <ProjectDetailModal
          project={activeProject}
          previousProject={previousProject}
          nextProject={nextProject}
          onClose={() => setActiveProjectId(null)}
          onShowPrevious={() =>
            setActiveProjectId(orderedProjects[wrapProjectIndex(activeProjectIndex - 1, orderedProjects.length)]?.id ?? null)
          }
          onShowNext={() =>
            setActiveProjectId(orderedProjects[wrapProjectIndex(activeProjectIndex + 1, orderedProjects.length)]?.id ?? null)
          }
          document={document}
          builder={builder}
        />
      )}
    </section>
  )
}

export function SkillsPageView({ title, intro, groups, notice, document, builder }: SkillsPageViewModel) {
  const preferDocumentContent = builder?.mode === 'builder'
  const renderedTitle = preferDocumentContent ? getBuilderNodeText(document, 'skills-title', title) : title
  const renderedIntro = preferDocumentContent ? getBuilderNodeText(document, 'skills-intro', intro) : intro
  const skillsTitleStyle = getBuilderNodeTextStyle(document, 'skills-title')
  const skillsIntroStyle = getBuilderNodeTextStyle(document, 'skills-intro')
  return (
    <section className="public-page skills-page reveal-card" style={{ '--delay': '120ms' } as CSSProperties}>
      <p className="eyebrow">Skills</p>
      <h1
        style={skillsTitleStyle}
        {...builderDataAttrs({ docKey: 'page.skills', nodeId: 'skills-title', nodeType: 'text', region: 'skills' })}
      >
        {renderedTitle}
      </h1>
      <p
        className="skills-page__intro"
        style={skillsIntroStyle}
        {...builderDataAttrs({ docKey: 'page.skills', nodeId: 'skills-intro', nodeType: 'text', region: 'skills' })}
      >
        {renderedIntro}
      </p>
      {notice && <p className="notice">{notice}</p>}
      <div
        className="skills-grid"
        {...builderDataAttrs({ docKey: 'page.skills', nodeId: 'skills-groups', nodeType: 'collection', region: 'skills' })}
      >
        {groups.map((group) => (
          <article
            key={group.id}
            className="skill-card"
            style={getBuilderNodePresentationStyle(document, `skill-group-${group.id}`)}
            {...builderDataAttrs({ docKey: 'page.skills', nodeId: `skill-group-${group.id}`, nodeType: 'card', region: 'skills' })}
          >
            <h2>{group.title}</h2>
            <div className="chip-grid">
              {group.items
                .filter((item) => item.trim().length > 0)
                .map((item) => (
                  <span key={`${group.id}-${item}`}>{item}</span>
                ))}
            </div>
          </article>
        ))}
      </div>
      <DocumentExtras document={document} handledIds={['skills-title', 'skills-intro', 'skills-groups']} builder={builder} region="skills" />
    </section>
  )
}

export function ContactPageView({
  settings,
  notice,
  isSending,
  onSubmitContact,
  document,
  builder,
}: ContactPageViewModel) {
  const preferDocumentContent = builder?.mode === 'builder'
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)
  const contactIntroStyle = getBuilderNodeTextStyle(document, 'contact-intro')
  const contactEmailStyle = getBuilderNodeTextStyle(document, 'contact-email')
  const contactPhoneStyle = getBuilderNodeTextStyle(document, 'contact-phone')
  const contactLocationStyle = getBuilderNodeTextStyle(document, 'contact-location')
  const contactNoteStyle = getBuilderNodeTextStyle(document, 'contact-note')
  const socialEntries = Object.entries(settings.socials).filter(([, value]) => value.trim().length > 0)
  const prioritizedSocialEntries = ['github', 'linkedin']
    .map((target) => socialEntries.find(([name]) => normalizeSocialName(name) === target))
    .filter((entry): entry is [string, string] => Boolean(entry))
  const prioritizedSocialNames = new Set(prioritizedSocialEntries.map(([name]) => normalizeSocialName(name)))
  const orderedSocialEntries = [
    ...prioritizedSocialEntries,
    ...socialEntries.filter(([name]) => !prioritizedSocialNames.has(normalizeSocialName(name))),
  ]
  const phoneHref = settings.phone ? `tel:${settings.phone.replace(/[^\d+]/g, '')}` : null

  return (
    <section className="public-page contact-page reveal-card" style={{ '--delay': '120ms' } as CSSProperties}>
      <p className="eyebrow">Contact</p>
      <h1>Get in touch</h1>
      <p
        style={contactIntroStyle}
        {...builderDataAttrs({ docKey: 'page.contact', nodeId: 'contact-intro', nodeType: 'text', region: 'contact' })}
      >
        {preferDocumentContent ? getBuilderNodeText(document, 'contact-intro', settings.contactIntro) : settings.contactIntro}
      </p>

      <div
        className="contact-block"
        style={getBuilderNodePresentationStyle(document, 'contact-details')}
        {...builderDataAttrs({ docKey: 'page.contact', nodeId: 'contact-details', nodeType: 'section', region: 'contact' })}
      >
        <p>
          <strong>Email:</strong>{' '}
          <a
            href={`mailto:${settings.email}`}
            style={contactEmailStyle}
            {...builderDataAttrs({ docKey: 'page.contact', nodeId: 'contact-email', nodeType: 'text', region: 'contact' })}
          >
            {settings.email}
          </a>
        </p>
        {orderedSocialEntries.length > 0 && (
          <ul className="social-list" {...builderDataAttrs({ docKey: 'page.contact', nodeId: 'contact-socials', nodeType: 'collection', region: 'contact' })}>
            {orderedSocialEntries.map(([name, value]) => {
              const href = toExternalHref(value)

              return (
                <li key={name}>
                  <strong>{name}:</strong>{' '}
                  {href ? (
                    <SiteLink href={href} external builder={builder}>
                      {value}
                    </SiteLink>
                  ) : (
                    value
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {settings.phone && (
          <p>
            <strong>Phone:</strong>{' '}
            {phoneHref ? (
              <a
                href={phoneHref}
                style={contactPhoneStyle}
                {...builderDataAttrs({ docKey: 'page.contact', nodeId: 'contact-phone', nodeType: 'text', region: 'contact' })}
              >
                {settings.phone}
              </a>
            ) : (
              settings.phone
            )}
          </p>
        )}
        {settings.location && (
          <p>
            <strong>Location:</strong>{' '}
            <span
              style={contactLocationStyle}
              {...builderDataAttrs({ docKey: 'page.contact', nodeId: 'contact-location', nodeType: 'text', region: 'contact' })}
            >
              {settings.location}
            </span>
          </p>
        )}
      </div>

      <form
        className="contact-form"
        style={getBuilderNodePresentationStyle(document, 'contact-form')}
        {...builderDataAttrs({ docKey: 'page.contact', nodeId: 'contact-form', nodeType: 'section', region: 'contact' })}
        onSubmit={async (event: FormEvent<HTMLFormElement>) => {
          event.preventDefault()
          const form = event.currentTarget
          const formData = new FormData(form)
          const wasSent = await onSubmitContact(formData)

          if (wasSent) {
            form.reset()
          }
          setTurnstileResetKey((key) => key + 1)
        }}
      >
        <label>
          Name
          <input name="name" type="text" maxLength={120} required />
        </label>
        <label>
          Email
          <input name="email" type="email" maxLength={254} required />
        </label>
        <label>
          Message
          <textarea name="message" rows={5} maxLength={5000} required />
        </label>
        {!preferDocumentContent && <TurnstileWidget action="contact" resetKey={turnstileResetKey} />}
        <button type="submit" className="button button--solid" disabled={isSending}>
          {isSending ? 'Sending...' : 'Send Message'}
        </button>
      </form>

      <p
        className="contact-page__note"
        style={contactNoteStyle}
        {...builderDataAttrs({ docKey: 'page.contact', nodeId: 'contact-note', nodeType: 'text', region: 'contact' })}
      >
        {preferDocumentContent ? getBuilderNodeText(document, 'contact-note', 'I usually respond by email when I can.') : 'I usually respond by email when I can.'}
      </p>

      {notice && <p className="notice">{notice}</p>}
      <DocumentExtras
        document={document}
        handledIds={['contact-intro', 'contact-details', 'contact-socials', 'contact-form', 'contact-note']}
        builder={builder}
        region="contact"
      />
    </section>
  )
}

function renderFallback(snapshot: StackStatusSnapshot) {
  return (
    <>
      <div className="ledger-strip">
        <div>
          <strong>{snapshot.overallLabel}</strong>
          <span>overall</span>
        </div>
        <div>
          <strong>{snapshot.counts.total}</strong>
          <span>services</span>
        </div>
        <div>
          <strong>{snapshot.counts.operational}</strong>
          <span>healthy</span>
        </div>
      </div>

      <section className="ledger-section" aria-label="Services">
        <div className="ledger-section__head">
          <h2>Current snapshot</h2>
          <p className="ledger-section__meta">{snapshot.summary}</p>
        </div>
        <table className="ledger-table ledger-services">
          <thead>
            <tr>
              <th scope="col">Service</th>
              <th scope="col">Details</th>
              <th scope="col">State</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.services.map((service) => (
              <tr key={service.id}>
                <th scope="row">{service.name}</th>
                <td>{service.summary ?? 'No extra details right now.'}</td>
                <td>
                  <span className={`ledger-state ledger-state--${service.status}`}>{sentenceCase(service.status)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}

type LedgerState = 'normal' | 'attention' | 'battery' | 'maintenance' | 'loading' | 'unavailable'

// The page's headline is its state, so the first thing a visitor reads answers "is it OK?".
const ledgerHeadlines: Record<LedgerState, string> = {
  normal: 'All systems normal',
  attention: 'Needs attention',
  battery: 'Running on battery',
  maintenance: 'Under maintenance',
  loading: 'Checking the lab',
  unavailable: 'Status feed unavailable',
}

function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

// Feed states arrive lower-case ("online", "running"); show them as "Online", "Running".
function sentenceCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatGuestType(type: string): string {
  const normalized = type.trim().toLowerCase()

  if (normalized === 'vm' || normalized === 'qemu') {
    return 'VM'
  }

  if (normalized === 'container' || normalized === 'lxc') {
    return 'CT'
  }

  return type
}

function LedgerMeter({ value, soft = false }: { value: number | null; soft?: boolean }) {
  return (
    <div className="ledger-meter">
      <span className="ledger-meter__track">
        <span
          className={`ledger-meter__fill${soft ? ' ledger-meter__fill--soft' : ''}`}
          style={{ width: `${clampPercent(value)}%` }}
        />
      </span>
      <span className="ledger-meter__value">{formatPercent(value)}</span>
    </div>
  )
}

export function StatusPageView({
  snapshot,
  wallboard,
  maintenanceMode = false,
  maintenanceMessage,
  isUsingCachedSnapshot = false,
  error,
  isLoading,
  hideOfflineGuests,
  showAllMobileGuests,
  visibleGuests,
  displayedGuests,
  remainingGuestCount,
  hasMobileGuestOverflow,
  batteryPercent,
  loadPercent,
  onRetry,
  onToggleOfflineGuests,
  onToggleMobileGuests,
  document,
  builder,
}: StatusPageViewModel) {
  const preferDocumentContent = builder?.mode === 'builder'
  const statusTitleStyle = getBuilderNodeTextStyle(document, 'status-hero-title')
  const statusSummaryStyle = getBuilderNodeTextStyle(document, 'status-hero-summary')
  const statusNoteStyle = getBuilderNodeTextStyle(document, 'status-hero-note')
  const lastStatusAt = formatClockTime(wallboard?.generatedAt ?? snapshot?.checkedAt ?? snapshot?.fetchedAt ?? null)
  const statusTitle = preferDocumentContent
    ? getBuilderNodeText(document, 'status-hero-title', 'Lab Status')
    : 'Lab Status'
  const statusSummary = preferDocumentContent
    ? getBuilderNodeText(
        document,
        'status-hero-summary',
        'This is a live look at what I have running right now. It pulls from the public status feed and shows guests, nodes, endpoints, and power in one place.',
      )
    : 'This is a live look at what I have running right now. It pulls from the public status feed and shows guests, nodes, endpoints, and power in one place.'
  const statusNote = preferDocumentContent
    ? getBuilderNodeText(
        document,
        'status-hero-note',
        'When the lab is quiet, spare compute may run background Golem workloads to earn a little GLM. That is intentional and not necessarily a problem.',
      )
    : 'When the lab is quiet, spare compute may run background Golem workloads to earn a little GLM. That is intentional and not necessarily a problem.'
  const power = wallboard?.power ?? null
  const powerAlert = !maintenanceMode && isBatteryPowerAlert(power)
  const powerAlertCopy = power?.issue ? power.issue : 'Mains power is out. The UPS is carrying the lab.'
  const powerSimulated = /simulated/i.test(power?.summary.state ?? '')
  const summary = wallboard?.summary ?? null
  const hosts = wallboard ? [...wallboard.nodes].sort((left, right) => left.name.localeCompare(right.name)) : []
  const troubledEndpoints = wallboard
    ? wallboard.endpoints.filter((endpoint) => mapTone(endpoint.status) !== 'operational')
    : []
  const stoppedGuestCount = summary ? Math.max(0, summary.guestCount - summary.runningGuestCount) : 0
  const powerReadable = power?.available === true
  const upsRuntime = power ? formatUpsRuntime(power.summary.remainingRuntime) : ''

  let ledgerState: LedgerState = 'normal'
  if (maintenanceMode) {
    ledgerState = 'maintenance'
  } else if (powerAlert) {
    ledgerState = 'battery'
  } else if (!snapshot) {
    ledgerState = isLoading ? 'loading' : 'unavailable'
  } else if (summary ? summary.issueCount > 0 : snapshot.overallStatus !== 'operational') {
    ledgerState = 'attention'
  }

  // One or more short paragraphs under the headline.
  let headCopy: string[]
  if (ledgerState === 'maintenance') {
    headCopy = (maintenanceMessage ?? maintenanceStatusLabel).split(/\n+/).filter((line) => line.trim())
  } else if (ledgerState === 'battery') {
    headCopy = [powerAlertCopy]
  } else if (ledgerState === 'loading') {
    headCopy = ['Fetching the live feed.']
  } else if (ledgerState === 'unavailable') {
    headCopy = [error ?? "Couldn't load the live status feed."]
  } else if (ledgerState === 'attention') {
    const reasons = [
      ...troubledEndpoints.map((endpoint) => `${endpoint.name}: ${endpoint.issue || endpoint.status}`),
      ...(wallboard && !powerReadable ? [power?.issue || 'UPS reading unavailable.'] : []),
    ]
    headCopy = [reasons.length > 0 ? reasons.join(' ') : snapshot?.summary ?? 'Something is not reporting as healthy.']
  } else if (summary) {
    const upsSentence = !powerReadable
      ? 'The UPS reading is unavailable right now.'
      : /^\d/.test(upsRuntime)
        ? `The UPS is on mains with ${upsRuntime} of battery in reserve.`
        : 'The UPS is on mains.'
    headCopy = [
      `${countLabel(summary.runningGuestCount, 'guest')} running on ${countLabel(summary.onlineNodeCount, 'host')}. ${upsSentence}`,
    ]
  } else {
    headCopy = [snapshot?.summary ?? '']
  }

  return (
    <section
      className="public-page reveal-card status-page status-ledger"
      style={{ '--delay': '120ms' } as CSSProperties}
      {...builderDataAttrs({ docKey: 'page.status', nodeId: 'status-root', nodeType: 'section', region: 'status' })}
    >
      <header
        className="ledger-head"
        {...builderDataAttrs({ docKey: 'page.status', nodeId: 'status-hero', nodeType: 'section', region: 'status' })}
      >
        <div className="ledger-head__main">
          <p className={`ledger-eyebrow${ledgerState === 'battery' ? ' ledger-eyebrow--alert' : ''}`}>
            <span
              style={statusTitleStyle}
              {...builderDataAttrs({ docKey: 'page.status', nodeId: 'status-hero-title', nodeType: 'text', region: 'status' })}
            >
              {statusTitle}
            </span>
            {ledgerState === 'battery' && <span> · power event{powerSimulated ? ' · simulated' : ''}</span>}
          </p>
          <h1>
            <span className={`ledger-dot ledger-dot--${ledgerState}`} aria-hidden="true" />
            {ledgerHeadlines[ledgerState]}
          </h1>
          <div className="ledger-head__copy">
            {headCopy.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>

        <div className="ledger-meta">
          <span>
            {maintenanceMode
              ? 'Live updates are paused'
              : `Updated ${lastStatusAt} · ${isUsingCachedSnapshot ? 'last known snapshot' : 'refreshes every 5 s'}`}
          </span>
          {maintenanceMode ? (
            <span>JSON and health check are unavailable</span>
          ) : (
            <div className="ledger-meta__links">
              {ledgerState === 'battery' && (
                <SiteLink to="/homelab#power" builder={builder}>
                  How the lab rides out an outage
                </SiteLink>
              )}
              <SiteLink href="https://api.nbdevlab.com/api/status" external builder={builder}>
                View JSON
              </SiteLink>
              <SiteLink href="https://api.nbdevlab.com/healthz" external builder={builder}>
                Health check
              </SiteLink>
              {error && (
                <button type="button" className="ledger-link" onClick={onRetry}>
                  Try again
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {powerAlert && power && (
        <section className="power-event" role="status" aria-live="polite" aria-label="Power event">
          <span className="power-event__rule" aria-hidden="true" />

          <dl className="power-event__stats">
            <div>
              <dt>Battery</dt>
              <dd>{power.summary.batteryCapacity}</dd>
            </div>
            <div>
              <dt>Runtime left</dt>
              <dd>{upsRuntime}</dd>
            </div>
            <div>
              <dt>Load</dt>
              <dd>{formatUpsLoad(power.summary.load)}</dd>
            </div>
            <div>
              <dt>Utility</dt>
              <dd>{power.summary.utilityVoltage}</dd>
            </div>
          </dl>

          {batteryPercent !== null && (
            <div className="power-event__battery" aria-hidden="true">
              <span className="power-event__battery-fill" style={{ width: `${clampPercent(batteryPercent)}%` }} />
              <span className="power-event__battery-mark" style={{ left: `${lowBatteryShutdownPercent}%` }}>
                <span>{lowBatteryShutdownPercent} %</span>
              </span>
            </div>
          )}

          <ol className="power-event__steps">
            <li>
              <strong>Now</strong>
              Guests shut down and the big servers power off, all within four minutes.
            </li>
            <li>
              <strong>Kept running</strong>
              DNS and remote access, so the lab stays reachable.
            </li>
            <li>
              <strong>Low battery</strong>
              At {lowBatteryShutdownPercent} % charge or five minutes left, the rest shuts down too.
            </li>
            <li>
              <strong>Power back</strong>
              Everything that was running starts again on its own.
            </li>
          </ol>
        </section>
      )}

      {maintenanceMode && (
        <section className="ledger-section" aria-label="Paused">
          <div className="ledger-section__head">
            <h2>Paused for now</h2>
            <p className="ledger-section__meta">Live numbers come back when maintenance ends</p>
          </div>
          <div className="ledger-strip ledger-strip--quiet">
            <div>
              <strong>Hosts</strong>
              <span>CPU, memory and disk</span>
            </div>
            <div>
              <strong>Guests</strong>
              <span>virtual machines and containers</span>
            </div>
            <div>
              <strong>Power</strong>
              <span>UPS battery and load</span>
            </div>
            <div>
              <strong>JSON and health</strong>
              <span>the public status API</span>
            </div>
          </div>
        </section>
      )}

      {!maintenanceMode && wallboard && summary && (
        <>
          <div
            className="ledger-strip"
            {...builderDataAttrs({ docKey: 'page.status', nodeId: 'status-metrics', nodeType: 'collection', region: 'status' })}
          >
            <div
              style={getBuilderNodePresentationStyle(document, 'status-metric-online-nodes')}
              {...builderDataAttrs({ docKey: 'page.status', nodeId: 'status-metric-online-nodes', nodeType: 'dynamicWidget', region: 'status' })}
            >
              <strong>
                {summary.onlineNodeCount} of {summary.nodeCount}
              </strong>
              <span>hosts online</span>
            </div>
            <div
              style={getBuilderNodePresentationStyle(document, 'status-metric-running-guests')}
              {...builderDataAttrs({ docKey: 'page.status', nodeId: 'status-metric-running-guests', nodeType: 'dynamicWidget', region: 'status' })}
            >
              <strong>{summary.runningGuestCount}</strong>
              <span>guests running of {summary.guestCount}</span>
            </div>
            <div
              style={getBuilderNodePresentationStyle(document, 'status-metric-average-cpu')}
              {...builderDataAttrs({ docKey: 'page.status', nodeId: 'status-metric-average-cpu', nodeType: 'dynamicWidget', region: 'status' })}
            >
              <strong>{formatPercent(summary.averageNodeCpuPercent)}</strong>
              <span>average host CPU</span>
            </div>
            {!powerAlert && power && powerReadable && (
              <>
                <div>
                  <strong>{power.summary.batteryCapacity}</strong>
                  <span>UPS battery, on mains</span>
                </div>
                <div>
                  <strong>{upsRuntime}</strong>
                  <span>runtime if the power fails</span>
                </div>
              </>
            )}
          </div>

          <section
            className="ledger-section"
            id="status-endpoints"
            aria-label="Hosts"
            style={getBuilderNodePresentationStyle(document, 'status-nodes')}
            {...builderDataAttrs({ docKey: 'page.status', nodeId: 'status-nodes', nodeType: 'dynamicWidget', region: 'status' })}
          >
            <div className="ledger-section__head">
              <h2>Hosts</h2>
              <p className="ledger-section__meta">
                {summary.onlineNodeCount} of {summary.nodeCount} online
              </p>
            </div>
            <table className="ledger-table ledger-hosts">
              <thead>
                <tr>
                  <th scope="col">Host</th>
                  <th scope="col" className="ledger-col--wide">
                    State
                  </th>
                  <th scope="col">CPU</th>
                  <th scope="col">Memory</th>
                  <th scope="col" className="ledger-col--wide">
                    Disk
                  </th>
                  <th scope="col" className="ledger-col--wide ledger-num">
                    Uptime
                  </th>
                </tr>
              </thead>
              <tbody>
                {hosts.map((node) => {
                  const tone = mapTone(node.status)

                  return (
                    <tr key={node.id} className={tone === 'operational' ? undefined : 'ledger-row--off'}>
                      <th scope="row">
                        {node.name}
                        <span className="ledger-sub">
                          {node.status} · disk {formatPercent(node.diskPercent)} · up {formatUptime(node.uptimeSeconds)}
                        </span>
                      </th>
                      <td className="ledger-col--wide">
                        <span className={`ledger-state ledger-state--${tone}`}>{sentenceCase(node.status)}</span>
                      </td>
                      <td>
                        <LedgerMeter value={node.cpuPercent} />
                      </td>
                      <td>
                        <LedgerMeter value={node.memoryPercent} />
                      </td>
                      <td className="ledger-col--wide">
                        <LedgerMeter value={node.diskPercent} />
                      </td>
                      <td className="ledger-col--wide ledger-num">{formatUptime(node.uptimeSeconds)}</td>
                    </tr>
                  )
                })}
                {troubledEndpoints.map((endpoint) => (
                  <tr key={`endpoint-${endpoint.name}`} className="ledger-row--off">
                    <th scope="row">{endpoint.name}</th>
                    <td colSpan={5}>
                      <span className={`ledger-state ledger-state--${mapTone(endpoint.status)}`}>
                        {sentenceCase(endpoint.status)}
                      </span>
                      <span className="ledger-row__note">{endpoint.issue || 'Endpoint data unavailable.'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section
            className="ledger-section"
            aria-label="Guests"
            style={getBuilderNodePresentationStyle(document, 'status-guests')}
            {...builderDataAttrs({ docKey: 'page.status', nodeId: 'status-guests', nodeType: 'section', region: 'status' })}
          >
            <div className="ledger-section__head">
              <h2>Guests</h2>
              <div className="ledger-section__meta">
                <span>
                  {hideOfflineGuests
                    ? `${visibleGuests.length} running, busiest first`
                    : `${countLabel(visibleGuests.length, 'guest')}, busiest first`}
                </span>
                {(stoppedGuestCount > 0 || !hideOfflineGuests) && (
                  <button
                    type="button"
                    className="ledger-link"
                    onClick={() => onToggleOfflineGuests(!hideOfflineGuests)}
                  >
                    {hideOfflineGuests ? `Show the ${stoppedGuestCount} stopped` : 'Hide stopped guests'}
                  </button>
                )}
                {hasMobileGuestOverflow && (
                  <button type="button" className="ledger-link" onClick={onToggleMobileGuests}>
                    {showAllMobileGuests ? 'Show top 4' : `Show all ${visibleGuests.length}`}
                  </button>
                )}
              </div>
            </div>

            {displayedGuests.length > 0 ? (
              <table className="ledger-table ledger-guests">
                <thead>
                  <tr>
                    <th scope="col">Guest</th>
                    <th scope="col" className="ledger-col--wide">
                      Host
                    </th>
                    <th scope="col" className="ledger-col--wide">
                      Type
                    </th>
                    <th scope="col">CPU</th>
                    <th scope="col">Memory</th>
                    <th scope="col" className="ledger-col--wide ledger-num">
                      Uptime
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayedGuests.map((guest) => (
                    <tr key={guest.id} className={guest.isRunning ? undefined : 'ledger-row--off'}>
                      <th scope="row">
                        {guest.name}
                        {isBackgroundComputeGuest(guest.name) && <span className="ledger-tag">Background compute</span>}
                        <span className="ledger-sub">
                          {guest.nodeName} · {formatGuestType(guest.type)} ·{' '}
                          {guest.isRunning ? `up ${formatUptime(guest.uptimeSeconds)}` : guest.status}
                        </span>
                      </th>
                      <td className="ledger-col--wide">{guest.nodeName}</td>
                      <td className="ledger-col--wide ledger-mono">{formatGuestType(guest.type)}</td>
                      <td>
                        <LedgerMeter value={guest.cpuPercent} />
                      </td>
                      <td>
                        <LedgerMeter value={guest.memoryPercent} soft />
                      </td>
                      <td className="ledger-col--wide ledger-num">
                        {guest.isRunning ? formatUptime(guest.uptimeSeconds) : sentenceCase(guest.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="ledger-footnote">Nothing matches this filter right now.</p>
            )}

            {remainingGuestCount > 0 && !showAllMobileGuests && (
              <p className="ledger-footnote">{countLabel(remainingGuestCount, 'more guest')} in the full list.</p>
            )}
          </section>

          {!powerAlert && (
            <section
              className="ledger-section"
              aria-label="Power"
              style={getBuilderNodePresentationStyle(document, 'status-power')}
              {...builderDataAttrs({ docKey: 'page.status', nodeId: 'status-power', nodeType: 'dynamicWidget', region: 'status' })}
            >
              <div className="ledger-section__head">
                <h2>Power</h2>
                {power && <p className="ledger-section__meta">Updated {formatClockTime(power.updatedAt)}</p>}
              </div>
              {power && powerReadable ? (
                <div className="ledger-power">
                  <div className="ledger-power__id">
                    <strong>{power.summary.modelName || 'UPS'}</strong>
                    <span className={`ledger-state ledger-state--${mapTone(power.summary.state)}`}>
                      {/utility/i.test(power.summary.powerSource) ? 'On mains' : power.summary.powerSource}
                    </span>
                  </div>
                  <div className="ledger-power__bar">
                    <div>
                      <span>Battery</span>
                      <strong>{power.summary.batteryCapacity}</strong>
                    </div>
                    <span className="ledger-meter__track">
                      <span className="ledger-meter__fill" style={{ width: `${clampPercent(batteryPercent)}%` }} />
                    </span>
                  </div>
                  <div className="ledger-power__bar">
                    <div>
                      <span>Load</span>
                      <strong>{formatUpsLoad(power.summary.load)}</strong>
                    </div>
                    <span className="ledger-meter__track">
                      <span className="ledger-meter__fill" style={{ width: `${clampPercent(loadPercent)}%` }} />
                    </span>
                  </div>
                  <dl className="ledger-power__facts">
                    <div>
                      <dt>Mains in</dt>
                      <dd>{power.summary.utilityVoltage}</dd>
                    </div>
                    <div>
                      <dt>Output</dt>
                      <dd>{power.summary.outputVoltage}</dd>
                    </div>
                    <div>
                      <dt>Runtime</dt>
                      <dd>{upsRuntime}</dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <p className="ledger-footnote">
                  {power?.issue || 'UPS data is not in the public snapshot right now.'}
                </p>
              )}
            </section>
          )}
        </>
      )}

      {!maintenanceMode && !wallboard && snapshot && renderFallback(snapshot)}

      {!maintenanceMode && (
        <div className="ledger-about">
          <p
            style={statusSummaryStyle}
            {...builderDataAttrs({ docKey: 'page.status', nodeId: 'status-hero-summary', nodeType: 'text', region: 'status' })}
          >
            {statusSummary}
          </p>
          <p
            style={statusNoteStyle}
            {...builderDataAttrs({ docKey: 'page.status', nodeId: 'status-hero-note', nodeType: 'text', region: 'status' })}
          >
            {statusNote}
          </p>
        </div>
      )}

      {!maintenanceMode && snapshot && (
        <details className="status-raw ledger-raw">
          <summary>Raw JSON</summary>
          <pre>{JSON.stringify(snapshot.raw, null, 2)}</pre>
        </details>
      )}

      {!maintenanceMode && snapshot && (
        <p className="ledger-footnote">
          This page fetched data at {formatDateTime(snapshot.fetchedAt)} from {snapshot.sourceUrl}.
        </p>
      )}

      <DocumentExtras
        document={document}
        handledIds={['status-hero', 'status-metrics', 'status-overview', 'status-guests']}
        builder={builder}
        region="status"
      />
    </section>
  )
}
