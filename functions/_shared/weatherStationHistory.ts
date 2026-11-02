import {
  collectWeatherStationTrendValues,
  type WeatherStationSnapshot,
  type WeatherStationTrendSample,
  type WeatherStationTrendValues,
  weatherStationTrendMaxPoints,
} from '../../src/lib/weatherStation'

interface WeatherHistoryRow {
  observed_at: string
  fetched_at: string
  values_json: string
}

function stationHistoryKey(snapshot: WeatherStationSnapshot): string {
  return snapshot.station.id ?? snapshot.station.name
}

function parseTrendValues(value: string): WeatherStationTrendValues {
  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, number] => {
        const [, metricValue] = entry
        return typeof metricValue === 'number' && Number.isFinite(metricValue)
      }),
    )
  } catch {
    return {}
  }
}

async function ensureWeatherStationHistoryTable(db: D1Database): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS weather_station_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        station_id TEXT NOT NULL,
        observed_at TEXT NOT NULL,
        fetched_at TEXT NOT NULL,
        values_json TEXT NOT NULL
      )`,
    )
    .run()

  await db
    .prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_weather_station_history_station_observed
      ON weather_station_history(station_id, observed_at)`,
    )
    .run()

  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_weather_station_history_observed
      ON weather_station_history(observed_at DESC, id DESC)`,
    )
    .run()
}

async function loadWeatherStationHistory(
  db: D1Database,
  stationId: string,
): Promise<WeatherStationTrendSample[]> {
  const rows = await db
    .prepare(
      `SELECT observed_at, fetched_at, values_json
      FROM weather_station_history
      WHERE station_id = ?
      ORDER BY observed_at DESC, id DESC
      LIMIT ?`,
    )
    .bind(stationId, weatherStationTrendMaxPoints)
    .all<WeatherHistoryRow>()

  return (rows.results ?? [])
    .slice()
    .reverse()
    .map((row) => ({
      observedAt: row.observed_at,
      fetchedAt: row.fetched_at,
      values: parseTrendValues(row.values_json),
    }))
}

async function pruneWeatherStationHistory(db: D1Database): Promise<void> {
  await db
    .prepare(
      `DELETE FROM weather_station_history
      WHERE id NOT IN (
        SELECT id
        FROM weather_station_history
        ORDER BY observed_at DESC, id DESC
        LIMIT ?
      )`,
    )
    .bind(weatherStationTrendMaxPoints)
    .run()
}

export async function persistWeatherStationSnapshotHistory(
  db: D1Database,
  snapshot: WeatherStationSnapshot,
): Promise<WeatherStationSnapshot> {
  if (snapshot.source !== 'live') {
    return snapshot
  }

  await ensureWeatherStationHistoryTable(db)

  const stationId = stationHistoryKey(snapshot)
  const observedAt = snapshot.observedAt ?? snapshot.fetchedAt
  const values = collectWeatherStationTrendValues(snapshot)

  if (Object.keys(values).length > 0) {
    await db
      .prepare(
        `INSERT INTO weather_station_history (station_id, observed_at, fetched_at, values_json)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(station_id, observed_at) DO UPDATE SET
          fetched_at = excluded.fetched_at,
          values_json = excluded.values_json`,
      )
      .bind(stationId, observedAt, snapshot.fetchedAt, JSON.stringify(values))
      .run()

    await pruneWeatherStationHistory(db)
  }

  return {
    ...snapshot,
    history: await loadWeatherStationHistory(db, stationId),
  }
}
