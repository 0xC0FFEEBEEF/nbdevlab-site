import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { publicApi } from '../lib/api'
import {
  collectWeatherStationTrendMetrics,
  createPlaceholderWeatherStationSnapshot,
  getWeatherStationTrendValue,
  type WeatherStationDisplayMetric,
  type WeatherStationSnapshot,
  weatherStationTrendKey,
  weatherStationTrendMaxPoints,
} from '../lib/weatherStation'

const refreshIntervalMs = 60_000
type WeatherTrendMap = Record<string, number[]>

function formatDateTime(value: string | null): string {
  if (!value) {
    return 'N/A'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function hasSecondaryValue(metric: WeatherStationDisplayMetric): boolean {
  const normalized = metric.secondary.trim()
  return normalized.length > 0 && normalized !== '-' && normalized !== 'N/A'
}

function appendTrendPoint(values: number[] | undefined, nextValue: number): number[] {
  const baseline = values && values.length > 0
    ? values
    : Array.from({ length: Math.min(4, weatherStationTrendMaxPoints) }, () => nextValue)

  return [...baseline.slice(-(weatherStationTrendMaxPoints - 1)), nextValue]
}

function buildTrendMapFromHistory(snapshot: WeatherStationSnapshot): WeatherTrendMap {
  const trends: WeatherTrendMap = {}

  for (const sample of (snapshot.history ?? []).slice(-weatherStationTrendMaxPoints)) {
    for (const [key, value] of Object.entries(sample.values)) {
      if (!Number.isFinite(value)) {
        continue
      }

      trends[key] = [...(trends[key] ?? []), value].slice(-weatherStationTrendMaxPoints)
    }
  }

  return trends
}

interface WeatherSparklineProps {
  values: number[]
}

function WeatherSparkline({ values }: WeatherSparklineProps) {
  const { areaPath, linePath, lastPoint } = useMemo(() => {
    const safeValues =
      values.length > 1
        ? values
        : values.length === 1
          ? Array.from({ length: 6 }, () => values[0] ?? 0)
          : Array.from({ length: 6 }, () => 0)

    const width = 100
    const height = 28
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
    <div className="weather-card-graph" aria-hidden="true">
      <svg viewBox="0 0 100 28" preserveAspectRatio="none" focusable="false">
        <path className="weather-card-graph__area" d={areaPath} />
        <path className="weather-card-graph__line" d={linePath} />
        <circle className="weather-card-graph__dot" cx={lastPoint.x} cy={lastPoint.y} r="1.8" />
      </svg>
    </div>
  )
}

function WeatherMetricCard({
  metric,
  trendValues,
}: {
  metric: WeatherStationDisplayMetric
  trendValues?: number[]
}) {
  return (
    <article className="status-metric-card weather-metric-card">
      <span>{metric.label}</span>
      <strong>{metric.primary}</strong>
      {hasSecondaryValue(metric) ? <small>{metric.secondary}</small> : null}
      {trendValues && trendValues.length > 0 ? <WeatherSparkline values={trendValues} /> : null}
    </article>
  )
}

function WeatherMetricGrid({
  metrics,
  trends,
}: {
  metrics: WeatherStationDisplayMetric[]
  trends: WeatherTrendMap
}) {
  return (
    <div className="weather-detail-grid">
      {metrics.map((metric) => {
        const trendValues = trends[weatherStationTrendKey(metric)]

        return (
          <article key={metric.label} className="status-power-card weather-detail-card">
            <span>{metric.label}</span>
            <strong>{metric.primary}</strong>
            {hasSecondaryValue(metric) ? <small>{metric.secondary}</small> : null}
            {trendValues && trendValues.length > 0 ? <WeatherSparkline values={trendValues} /> : null}
          </article>
        )
      })}
    </div>
  )
}

function WeatherPanel({
  title,
  summary,
  metrics,
  trends,
}: {
  title: string
  summary: string
  metrics: WeatherStationDisplayMetric[]
  trends: WeatherTrendMap
}) {
  return (
    <article className="status-panel weather-panel">
      <div className="status-panel__head">
        <div>
          <h2>{title}</h2>
          <p>{summary}</p>
        </div>
      </div>
      <WeatherMetricGrid metrics={metrics} trends={trends} />
    </article>
  )
}

function shouldUseLocalPlaceholder(error: unknown): boolean {
  return Boolean(
    import.meta.env.DEV &&
      error instanceof Error &&
      /Invalid API response|Route not found|Request failed: 404/i.test(error.message),
  )
}

export function WeatherPage() {
  const [snapshot, setSnapshot] = useState<WeatherStationSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null)
  const [refreshNow, setRefreshNow] = useState(() => Date.now())
  const [trends, setTrends] = useState<WeatherTrendMap>({})
  const cancelledRef = useRef(false)

  const load = async (silent = false) => {
    if (!silent) {
      setIsLoading(true)
    }

    try {
      const nextSnapshot = await publicApi.getWeatherStation()
      if (cancelledRef.current) {
        return
      }

      setSnapshot(nextSnapshot)
      setError(null)
    } catch (loadError) {
      if (cancelledRef.current) {
        return
      }

      setError(shouldUseLocalPlaceholder(loadError) ? null : "Couldn't load the Tempest weather station feed.")
      setSnapshot((current) => current ?? createPlaceholderWeatherStationSnapshot())
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
    cancelledRef.current = false
    void load()

    const refreshTimer = window.setInterval(() => {
      setRefreshNow(Date.now())
    }, 1_000)
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
      window.clearInterval(refreshTimer)
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  useEffect(() => {
    if (!snapshot || snapshot.source === 'placeholder') {
      return
    }

    setTrends((current) => {
      if ((snapshot.history ?? []).length > 0) {
        return buildTrendMapFromHistory(snapshot)
      }

      const next = { ...current }
      for (const metric of collectWeatherStationTrendMetrics(snapshot)) {
        const value = getWeatherStationTrendValue(metric)
        if (value === null) {
          continue
        }

        const key = weatherStationTrendKey(metric)
        next[key] = appendTrendPoint(current[key], value)
      }

      return next
    })
  }, [snapshot])

  const currentSnapshot = snapshot ?? createPlaceholderWeatherStationSnapshot()
  const refreshCountdown =
    nextRefreshAt === null ? null : Math.max(0, Math.ceil((nextRefreshAt - refreshNow) / 1_000))
  const isPlaceholder = currentSnapshot.source === 'placeholder'
  const statusLabel = isPlaceholder ? 'Placeholder Data' : 'Live Refresh · 60s'

  return (
    <section className="public-page reveal-card status-page weather-page" style={{ '--delay': '120ms' } as CSSProperties}>
      <div className="status-hero weather-hero">
        <div className="status-hero__copy">
          <p className="eyebrow">Weather</p>
          <h1>Tempest Weather Station</h1>
          <p>
            Live conditions from my Tempest station with current wind, rain, lightning, solar, and hardware readings.
          </p>

          <div className="status-hero__meta">
            <span className={`status-live-pill${isPlaceholder ? ' status-live-pill--maintenance' : ''}`}>
              <span className="status-live-pill__dot" aria-hidden="true" />
              {statusLabel}
            </span>
            {!isPlaceholder && refreshCountdown !== null && (
              <span className="status-updated">Refreshing again in {refreshCountdown}s</span>
            )}
            <span className="status-updated">Observed {formatDateTime(currentSnapshot.observedAt)}</span>
          </div>
        </div>

        <div className="status-actions weather-actions">
          <button className="button" type="button" onClick={() => void load()}>
            Refresh
          </button>
        </div>
      </div>

      {isLoading && !snapshot && <p className="notice">Loading weather station...</p>}
      {isPlaceholder && !error && (
        <p className="notice">Tempest token is not configured. Showing placeholders for local layout testing.</p>
      )}
      {error && (
        <p className="notice notice--error">
          {error}{' '}
          <button className="button button--solid" type="button" onClick={() => void load()}>
            Try again
          </button>
        </p>
      )}

      <div className="status-metric-strip weather-metric-strip">
        {currentSnapshot.metrics.map((metric) => (
          <WeatherMetricCard key={metric.label} metric={metric} trendValues={trends[weatherStationTrendKey(metric)]} />
        ))}
      </div>

      <div className="status-dashboard weather-dashboard">
        <div className="status-dashboard__main">
          <WeatherPanel
            title="Current Conditions"
            summary="Temperature, humidity, pressure, and derived comfort readings."
            metrics={currentSnapshot.panels.current}
            trends={trends}
          />
          <WeatherPanel
            title="Wind"
            summary="Average, gust, lull, direction, and sample interval."
            metrics={currentSnapshot.panels.wind}
            trends={trends}
          />
          <WeatherPanel
            title="Rain and Lightning"
            summary="Local rain totals, precipitation type, and lightning distance/count values."
            metrics={currentSnapshot.panels.rain}
            trends={trends}
          />
        </div>

        <aside className="status-dashboard__side">
          <article className="status-panel weather-panel">
            <div className="status-panel__head">
              <div>
                <h2>Station</h2>
                <p>{currentSnapshot.station.name}</p>
              </div>
              <span className={`status-badge status-badge--${currentSnapshot.configured ? 'operational' : 'maintenance'}`}>
                {currentSnapshot.configured ? 'live' : 'local'}
              </span>
            </div>
            <div className="weather-detail-grid">
              <article className="status-power-card weather-detail-card">
                <span>Station ID</span>
                <strong>{currentSnapshot.station.id ?? 'N/A'}</strong>
              </article>
              <article className="status-power-card weather-detail-card">
                <span>Location</span>
                <strong>{currentSnapshot.station.location}</strong>
              </article>
              <article className="status-power-card weather-detail-card">
                <span>Fetched</span>
                <strong>{formatDateTime(currentSnapshot.fetchedAt)}</strong>
                <small>{currentSnapshot.source}</small>
              </article>
            </div>
          </article>

          <WeatherPanel
            title="Solar and UV"
            summary="Light, UV index, and solar radiation."
            metrics={currentSnapshot.panels.solar}
            trends={trends}
          />
          <WeatherPanel
            title="Hardware"
            summary="Battery, report cadence, and derived fields."
            metrics={currentSnapshot.panels.hardware}
            trends={trends}
          />
        </aside>
      </div>

    </section>
  )
}
