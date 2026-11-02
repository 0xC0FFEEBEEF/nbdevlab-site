export type WeatherStationSource = 'live' | 'placeholder'

export interface WeatherStationDisplayMetric {
  label: string
  primary: string
  secondary: string
}

export interface WeatherStationIdentity {
  id: string | null
  name: string
  location: string
  coordinates: string
  elevation: WeatherStationDisplayMetric
}

export interface WeatherStationPanels {
  current: WeatherStationDisplayMetric[]
  wind: WeatherStationDisplayMetric[]
  rain: WeatherStationDisplayMetric[]
  solar: WeatherStationDisplayMetric[]
  hardware: WeatherStationDisplayMetric[]
}

export type WeatherStationTrendValues = Record<string, number>

export interface WeatherStationTrendSample {
  observedAt: string
  fetchedAt: string
  values: WeatherStationTrendValues
}

export interface WeatherStationSnapshot {
  configured: boolean
  source: WeatherStationSource
  fetchedAt: string
  observedAt: string | null
  station: WeatherStationIdentity
  metrics: WeatherStationDisplayMetric[]
  panels: WeatherStationPanels
  history: WeatherStationTrendSample[]
  raw?: unknown
}

export interface WeatherStationEnv {
  TEMPEST_ACCESS_TOKEN?: string
  TEMPEST_STATION_ID?: string
  TEMPEST_API_BASE_URL?: string
}

interface WeatherStationRawInput {
  station?: unknown
  observation: unknown
  deviceObservation?: unknown
}

interface ParsedStation {
  id: string | null
  deviceId: string | null
  name: string | null
  location: string | null
  latitude: number | null
  longitude: number | null
  elevationMeters: number | null
}

interface ParsedObservation {
  observedAt: string | null
  temperatureC: number | null
  feelsLikeC: number | null
  heatIndexC: number | null
  windChillC: number | null
  dewPointC: number | null
  humidityPercent: number | null
  pressureMb: number | null
  pressureTrend: string | null
  windLullMps: number | null
  windAvgMps: number | null
  windGustMps: number | null
  windDirectionDegrees: number | null
  windSampleIntervalSeconds: number | null
  rainAccumulatedMm: number | null
  rainAccumulatedFinalMm: number | null
  localDailyRainMm: number | null
  localDailyRainFinalMm: number | null
  precipitationType: number | null
  precipitationAnalysisType: number | null
  lightningStrikeAvgDistanceKm: number | null
  lightningStrikeLastDistanceKm: number | null
  lightningStrikeCount: number | null
  lightningStrikeCount1h: number | null
  lightningStrikeCount3h: number | null
  lightningStrikeLastEpoch: number | null
  illuminanceLux: number | null
  uvIndex: number | null
  solarRadiationWm2: number | null
  batteryVolts: number | null
  reportIntervalMinutes: number | null
}

const placeholderValue = 'N/A'
const missingDetailValue = '-'
const defaultTempestApiBaseUrl = 'https://swd.weatherflow.com/swd/rest'
export const weatherStationTrendMaxPoints = 12

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

function firstNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = asNumber(record[key])
    if (value !== null) {
      return value
    }
  }

  return null
}

function firstRecord(record: Record<string, unknown>, keys: string[]): Record<string, unknown> | null {
  for (const key of keys) {
    const value = record[key]
    if (isRecord(value)) {
      return value
    }
  }

  return null
}

function firstArrayItem(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : null
}

function formatDateFromEpoch(value: number | null): string | null {
  if (value === null) {
    return null
  }

  const date = new Date(value * 1000)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function formatFixed(value: number | null, digits: number): string | null {
  return value === null ? null : value.toFixed(digits)
}

function asPrimary(value: string | null): string {
  return value ?? placeholderValue
}

function asSecondary(value: string | null): string {
  return value ?? missingDetailValue
}

function createMetric(label: string, primary: string | null, secondary: string | null = null): WeatherStationDisplayMetric {
  return {
    label,
    primary: asPrimary(primary),
    secondary: asSecondary(secondary),
  }
}

function cToF(value: number): number {
  return value * (9 / 5) + 32
}

function mpsToMph(value: number): number {
  return value * 2.2369362921
}

function kmToMi(value: number): number {
  return value * 0.6213711922
}

function mmToIn(value: number): number {
  return value / 25.4
}

function mbToInHg(value: number): number {
  return value * 0.0295299830714
}

function metersToFeet(value: number): number {
  return value * 3.280839895
}

function formatTemperature(valueC: number | null): WeatherStationDisplayMetric {
  return createMetric(
    'Temperature',
    valueC === null ? null : `${formatFixed(cToF(valueC), 1)} F`,
    valueC === null ? null : `${formatFixed(valueC, 1)} C`,
  )
}

function formatFeelsLike(valueC: number | null): WeatherStationDisplayMetric {
  return createMetric(
    'Feels Like',
    valueC === null ? null : `${formatFixed(cToF(valueC), 1)} F`,
    valueC === null ? null : `${formatFixed(valueC, 1)} C`,
  )
}

function formatWind(label: string, valueMps: number | null): WeatherStationDisplayMetric {
  return createMetric(
    label,
    valueMps === null ? null : `${formatFixed(mpsToMph(valueMps), 1)} mph`,
    valueMps === null ? null : `${formatFixed(valueMps, 1)} m/s`,
  )
}

function formatDistance(label: string, valueKm: number | null): WeatherStationDisplayMetric {
  return createMetric(
    label,
    valueKm === null ? null : `${formatFixed(kmToMi(valueKm), 1)} mi`,
    valueKm === null ? null : `${formatFixed(valueKm, 1)} km`,
  )
}

function formatRain(label: string, valueMm: number | null): WeatherStationDisplayMetric {
  return createMetric(
    label,
    valueMm === null ? null : `${formatFixed(mmToIn(valueMm), 2)} in`,
    valueMm === null ? null : `${formatFixed(valueMm, 1)} mm`,
  )
}

function formatPressure(valueMb: number | null): WeatherStationDisplayMetric {
  return createMetric(
    'Pressure',
    valueMb === null ? null : `${formatFixed(mbToInHg(valueMb), 2)} inHg`,
    valueMb === null ? null : `${formatFixed(valueMb, 1)} mb`,
  )
}

function formatPercent(label: string, value: number | null): WeatherStationDisplayMetric {
  return createMetric(label, value === null ? null : `${formatFixed(value, 0)}%`)
}

function formatNumberMetric(label: string, value: number | null, unit = '', digits = 0): WeatherStationDisplayMetric {
  const suffix = unit ? ` ${unit}` : ''
  return createMetric(label, value === null ? null : `${formatFixed(value, digits)}${suffix}`)
}

function formatElevation(valueMeters: number | null): WeatherStationDisplayMetric {
  return createMetric(
    'Elevation',
    valueMeters === null ? null : `${formatFixed(metersToFeet(valueMeters), 0)} ft`,
    valueMeters === null ? null : `${formatFixed(valueMeters, 0)} m`,
  )
}

function formatDirection(value: number | null): WeatherStationDisplayMetric {
  return createMetric(
    'Direction',
    value === null ? null : compassLabel(value),
    value === null ? null : `${formatFixed(value, 0)} deg`,
  )
}

function compassLabel(value: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const normalized = ((value % 360) + 360) % 360
  const index = Math.round(normalized / 45) % directions.length
  return directions[index] ?? missingDetailValue
}

function precipitationTypeLabel(value: number | null): string | null {
  if (value === null) {
    return null
  }

  if (value === 0) {
    return 'None'
  }
  if (value === 1) {
    return 'Rain'
  }
  if (value === 2) {
    return 'Hail'
  }
  if (value === 3) {
    return 'Rain + Hail'
  }

  return String(value)
}

function precipitationAnalysisTypeLabel(value: number | null): string | null {
  if (value === null) {
    return null
  }

  if (value === 0) {
    return 'None'
  }
  if (value === 1) {
    return 'Correction Shown'
  }
  if (value === 2) {
    return 'Correction Hidden'
  }

  return String(value)
}

function extractDeviceId(value: unknown): string | null {
  if (!isRecord(value)) {
    return null
  }

  const directDeviceId = firstString(value, ['device_id', 'deviceId'])
  if (directDeviceId) {
    return directDeviceId
  }

  const devices = Array.isArray(value.devices) ? value.devices : []
  const preferredDevice = devices.find((device) => {
    if (!isRecord(device)) {
      return false
    }

    const deviceType = firstString(device, ['device_type', 'deviceType', 'type'])?.toLowerCase() ?? ''
    return deviceType === 'st' || deviceType.includes('tempest') || deviceType.includes('obs_st')
  })
  const fallbackDevice = devices.find((device) => isRecord(device) && firstString(device, ['device_id', 'deviceId']))

  return firstString(isRecord(preferredDevice) ? preferredDevice : isRecord(fallbackDevice) ? fallbackDevice : {}, [
    'device_id',
    'deviceId',
  ])
}

function normalizeStation(value: unknown): ParsedStation {
  const record = isRecord(value) ? value : {}
  const id = firstString(record, ['station_id', 'stationId', 'id'])

  return {
    id,
    deviceId: extractDeviceId(record),
    name: firstString(record, ['name', 'public_name', 'publicName', 'station_name', 'stationName']),
    location: firstString(record, ['location', 'timezone', 'time_zone', 'city']),
    latitude: firstNumber(record, ['latitude', 'lat']),
    longitude: firstNumber(record, ['longitude', 'lon', 'lng']),
    elevationMeters: firstNumber(record, ['elevation', 'elevation_m', 'elevationMeters']),
  }
}

function mapTempestObsArray(values: unknown[]): Record<string, unknown> {
  return {
    timestamp: values[0],
    wind_lull: values[1],
    wind_avg: values[2],
    wind_gust: values[3],
    wind_direction: values[4],
    wind_sample_interval: values[5],
    station_pressure: values[6],
    air_temperature: values[7],
    relative_humidity: values[8],
    illuminance: values[9],
    uv: values[10],
    solar_radiation: values[11],
    rain_accumulated: values[12],
    precipitation_type: values[13],
    lightning_strike_avg_distance: values[14],
    lightning_strike_count: values[15],
    battery: values[16],
    report_interval: values[17],
    precip_accum_local_day: values[18],
    rain_accumulated_final: values[19],
    precip_accum_local_day_final: values[20],
    precipitation_analysis_type: values[21],
  }
}

function extractObservationRecord(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) {
    return {}
  }

  const obsItem = firstArrayItem(payload.obs)
  if (Array.isArray(obsItem)) {
    return mapTempestObsArray(obsItem)
  }

  if (isRecord(obsItem)) {
    return obsItem
  }

  const observationItem = firstArrayItem(payload.observations)
  if (isRecord(observationItem)) {
    return observationItem
  }

  if (Array.isArray(observationItem)) {
    return mapTempestObsArray(observationItem)
  }

  return payload
}

function normalizeObservation(payload: unknown): ParsedObservation {
  const record = extractObservationRecord(payload)
  const summary = isRecord(payload) ? firstRecord(payload, ['summary']) ?? {} : {}
  const observedEpoch =
    firstNumber(record, ['timestamp', 'time_epoch', 'timeStart', 'time_start', 'epoch']) ??
    firstNumber(summary, ['timestamp', 'time_epoch', 'timeStart', 'time_start', 'epoch'])
  const observedAt =
    firstString(record, ['observed_at', 'observedAt', 'timestamp_iso', 'time']) ??
    firstString(summary, ['observed_at', 'observedAt', 'timestamp_iso', 'time']) ??
    formatDateFromEpoch(observedEpoch)

  return {
    observedAt,
    temperatureC: firstNumber(record, ['air_temperature', 'airTemperature', 'temperature', 'temp', 'temp_c']),
    feelsLikeC:
      firstNumber(record, ['feels_like', 'feelsLike']) ??
      firstNumber(summary, ['feels_like', 'feelsLike']),
    heatIndexC:
      firstNumber(record, ['heat_index', 'heatIndex']) ??
      firstNumber(summary, ['heat_index', 'heatIndex']),
    windChillC:
      firstNumber(record, ['wind_chill', 'windChill']) ??
      firstNumber(summary, ['wind_chill', 'windChill']),
    dewPointC:
      firstNumber(record, ['dew_point', 'dewPoint']) ??
      firstNumber(summary, ['dew_point', 'dewPoint']),
    humidityPercent: firstNumber(record, ['relative_humidity', 'relativeHumidity', 'humidity']),
    pressureMb:
      firstNumber(record, [
        'sea_level_pressure',
        'seaLevelPressure',
        'relative_pressure',
        'relativePressure',
        'pressure',
      ]) ??
      firstNumber(summary, [
        'sea_level_pressure',
        'seaLevelPressure',
        'relative_pressure',
        'relativePressure',
        'pressure',
      ]) ??
      firstNumber(record, [
        'barometric_pressure',
        'barometricPressure',
        'station_pressure',
        'stationPressure',
      ]),
    pressureTrend:
      firstString(record, ['pressure_trend', 'pressureTrend']) ??
      firstString(summary, ['pressure_trend', 'pressureTrend']),
    windLullMps: firstNumber(record, ['wind_lull', 'windLull']),
    windAvgMps: firstNumber(record, ['wind_avg', 'windAvg', 'wind_average', 'windAverage']),
    windGustMps: firstNumber(record, ['wind_gust', 'windGust']),
    windDirectionDegrees: firstNumber(record, ['wind_direction', 'windDirection']),
    windSampleIntervalSeconds: firstNumber(record, ['wind_sample_interval', 'windSampleInterval']),
    rainAccumulatedMm:
      firstNumber(record, ['rain_accumulated', 'rainAccumulated', 'precip', 'precipitation']) ??
      firstNumber(summary, ['precip_total_1h', 'precipTotal1h']),
    rainAccumulatedFinalMm: firstNumber(record, ['rain_accumulated_final', 'rainAccumulatedFinal']),
    localDailyRainMm:
      firstNumber(record, ['precip_accum_local_day', 'precipAccumLocalDay', 'local_daily_rain', 'localDailyRain']) ??
      firstNumber(summary, ['precip_accum_local_day', 'precipAccumLocalDay']),
    localDailyRainFinalMm:
      firstNumber(record, ['precip_accum_local_day_final', 'precipAccumLocalDayFinal']) ??
      firstNumber(summary, ['precip_accum_local_yesterday_final', 'precipAccumLocalYesterdayFinal']),
    precipitationType: firstNumber(record, ['precipitation_type', 'precipitationType']),
    precipitationAnalysisType: firstNumber(record, [
      'precipitation_analysis_type',
      'precipitationAnalysisType',
      'precip_analysis_type',
      'precipAnalysisType',
    ]),
    lightningStrikeAvgDistanceKm:
      firstNumber(record, ['lightning_strike_avg_distance', 'lightningStrikeAvgDistance']) ??
      firstNumber(summary, ['strike_last_dist', 'strikeLastDist']),
    lightningStrikeLastDistanceKm:
      firstNumber(record, ['lightning_strike_last_distance', 'lightningStrikeLastDistance']) ??
      firstNumber(summary, ['strike_last_dist', 'strikeLastDist']),
    lightningStrikeCount:
      firstNumber(record, ['lightning_strike_count', 'lightningStrikeCount', 'strike_count']) ??
      firstNumber(summary, ['strike_count', 'strikeCount']),
    lightningStrikeCount1h: firstNumber(summary, ['strike_count_1h', 'strikeCount1h']),
    lightningStrikeCount3h: firstNumber(summary, ['strike_count_3h', 'strikeCount3h']),
    lightningStrikeLastEpoch: firstNumber(summary, ['strike_last_epoch', 'strikeLastEpoch']),
    illuminanceLux: firstNumber(record, ['illuminance', 'brightness', 'lux']),
    uvIndex: firstNumber(record, ['uv', 'uv_index', 'uvIndex']),
    solarRadiationWm2: firstNumber(record, ['solar_radiation', 'solarRadiation']),
    batteryVolts: firstNumber(record, ['battery', 'battery_voltage', 'batteryVoltage']),
    reportIntervalMinutes: firstNumber(record, ['report_interval', 'reportInterval']),
  }
}

function mergeObservations(primary: ParsedObservation, fallback: ParsedObservation): ParsedObservation {
  return Object.fromEntries(
    (Object.keys(primary) as Array<keyof ParsedObservation>).map((key) => [
      key,
      primary[key] ?? fallback[key],
    ]),
  ) as unknown as ParsedObservation
}

function findFirstStation(payload: unknown): unknown {
  if (!isRecord(payload)) {
    return null
  }

  const stations = Array.isArray(payload.stations) ? payload.stations : []
  if (stations.length > 0) {
    return stations[0]
  }

  const data = payload.data
  if (isRecord(data) && Array.isArray(data.stations) && data.stations.length > 0) {
    return data.stations[0]
  }

  return null
}

function findStationById(payload: unknown, stationId: string): unknown {
  const normalizedStationId = stationId.trim()
  if (!normalizedStationId) {
    return null
  }

  const stations = isRecord(payload) && Array.isArray(payload.stations)
    ? payload.stations
    : isRecord(payload) && isRecord(payload.data) && Array.isArray(payload.data.stations)
      ? payload.data.stations
      : []

  return stations.find((station) => isRecord(station) && normalizeStation(station).id === normalizedStationId) ?? null
}

function formatCoordinates(latitude: number | null, longitude: number | null): string {
  if (latitude === null || longitude === null) {
    return missingDetailValue
  }

  return `${formatFixed(latitude, 4)}, ${formatFixed(longitude, 4)}`
}

function buildPanels(observation: ParsedObservation): WeatherStationPanels {
  return {
    current: [
      formatTemperature(observation.temperatureC),
      formatFeelsLike(observation.feelsLikeC),
      formatPercent('Humidity', observation.humidityPercent),
      formatPressure(observation.pressureMb),
      createMetric(
        'Dew Point',
        observation.dewPointC === null ? null : `${formatFixed(cToF(observation.dewPointC), 1)} F`,
        observation.dewPointC === null ? null : `${formatFixed(observation.dewPointC, 1)} C`,
      ),
      createMetric(
        'Pressure Trend',
        observation.pressureTrend,
      ),
    ],
    wind: [
      formatWind('Average Wind', observation.windAvgMps),
      formatWind('Gust', observation.windGustMps),
      formatWind('Lull', observation.windLullMps),
      formatDirection(observation.windDirectionDegrees),
      formatNumberMetric('Sample Interval', observation.windSampleIntervalSeconds, 'sec'),
    ],
    rain: [
      formatRain('Rain Now', observation.rainAccumulatedMm),
      formatRain('Rain Today', observation.localDailyRainMm),
      formatRain('Corrected Rain', observation.localDailyRainFinalMm ?? observation.rainAccumulatedFinalMm),
      createMetric('Precip Type', precipitationTypeLabel(observation.precipitationType)),
      formatNumberMetric('Lightning Count', observation.lightningStrikeCount),
      formatNumberMetric('Strikes 1h', observation.lightningStrikeCount1h),
      formatDistance('Lightning Avg Distance', observation.lightningStrikeAvgDistanceKm),
      formatDistance('Lightning Last Distance', observation.lightningStrikeLastDistanceKm),
      createMetric('Last Strike', formatDateFromEpoch(observation.lightningStrikeLastEpoch)),
    ],
    solar: [
      formatNumberMetric('UV Index', observation.uvIndex, '', 1),
      formatNumberMetric('Solar Radiation', observation.solarRadiationWm2, 'W/m2'),
      formatNumberMetric('Illuminance', observation.illuminanceLux, 'lux'),
    ],
    hardware: [
      formatNumberMetric('Battery', observation.batteryVolts, 'V', 2),
      formatNumberMetric('Report Interval', observation.reportIntervalMinutes, 'min'),
      createMetric(
        'Rain Correction',
        precipitationAnalysisTypeLabel(observation.precipitationAnalysisType),
      ),
      createMetric(
        'Heat Index',
        observation.heatIndexC === null ? null : `${formatFixed(cToF(observation.heatIndexC), 1)} F`,
        observation.heatIndexC === null ? null : `${formatFixed(observation.heatIndexC, 1)} C`,
      ),
      createMetric(
        'Wind Chill',
        observation.windChillC === null ? null : `${formatFixed(cToF(observation.windChillC), 1)} F`,
        observation.windChillC === null ? null : `${formatFixed(observation.windChillC, 1)} C`,
      ),
    ],
  }
}

function parseMetricNumber(value: string): number | null {
  const match = value.match(/-?\d+(?:\.\d+)?/)
  if (!match) {
    return null
  }

  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

export function weatherStationTrendKey(metric: WeatherStationDisplayMetric): string {
  return metric.label
}

export function getWeatherStationTrendValue(metric: WeatherStationDisplayMetric): number | null {
  if (metric.primary === placeholderValue) {
    return null
  }

  if (metric.label === 'Direction') {
    return parseMetricNumber(metric.secondary)
  }

  return parseMetricNumber(metric.primary)
}

export function collectWeatherStationTrendMetrics(
  snapshot: WeatherStationSnapshot,
): WeatherStationDisplayMetric[] {
  return [
    ...snapshot.metrics,
    ...snapshot.panels.current,
    ...snapshot.panels.wind,
    ...snapshot.panels.rain,
    ...snapshot.panels.solar,
    ...snapshot.panels.hardware,
    snapshot.station.elevation,
  ]
}

export function collectWeatherStationTrendValues(
  snapshot: WeatherStationSnapshot,
): WeatherStationTrendValues {
  const values: WeatherStationTrendValues = {}

  for (const metric of collectWeatherStationTrendMetrics(snapshot)) {
    const value = getWeatherStationTrendValue(metric)
    if (value === null) {
      continue
    }

    values[weatherStationTrendKey(metric)] = value
  }

  return values
}

export function createPlaceholderWeatherStationSnapshot(fetchedAt = new Date().toISOString()): WeatherStationSnapshot {
  const station: ParsedStation = {
    id: null,
    deviceId: null,
    name: 'Tempest Weather Station',
    location: missingDetailValue,
    latitude: null,
    longitude: null,
    elevationMeters: null,
  }
  const observation: ParsedObservation = {
    observedAt: null,
    temperatureC: null,
    feelsLikeC: null,
    heatIndexC: null,
    windChillC: null,
    dewPointC: null,
    humidityPercent: null,
    pressureMb: null,
    pressureTrend: null,
    windLullMps: null,
    windAvgMps: null,
    windGustMps: null,
    windDirectionDegrees: null,
    windSampleIntervalSeconds: null,
    rainAccumulatedMm: null,
    rainAccumulatedFinalMm: null,
    localDailyRainMm: null,
    localDailyRainFinalMm: null,
    precipitationType: null,
    precipitationAnalysisType: null,
    lightningStrikeAvgDistanceKm: null,
    lightningStrikeLastDistanceKm: null,
    lightningStrikeCount: null,
    lightningStrikeCount1h: null,
    lightningStrikeCount3h: null,
    lightningStrikeLastEpoch: null,
    illuminanceLux: null,
    uvIndex: null,
    solarRadiationWm2: null,
    batteryVolts: null,
    reportIntervalMinutes: null,
  }

  return normalizeParsedWeather(station, observation, {
    configured: false,
    source: 'placeholder',
    fetchedAt,
  })
}

function normalizeParsedWeather(
  station: ParsedStation,
  observation: ParsedObservation,
  options: {
    configured: boolean
    source: WeatherStationSource
    fetchedAt: string
    raw?: unknown
  },
): WeatherStationSnapshot {
  const panels = buildPanels(observation)

  return {
    configured: options.configured,
    source: options.source,
    fetchedAt: options.fetchedAt,
    observedAt: observation.observedAt,
    station: {
      id: station.id,
      name: station.name ?? 'Tempest Weather Station',
      location: station.location ?? missingDetailValue,
      coordinates: formatCoordinates(station.latitude, station.longitude),
      elevation: formatElevation(station.elevationMeters),
    },
    metrics: [
      panels.current[0] ?? formatTemperature(null),
      panels.current[1] ?? formatFeelsLike(null),
      panels.wind[0] ?? formatWind('Average Wind', null),
      panels.current[2] ?? formatPercent('Humidity', null),
      panels.rain[1] ?? formatRain('Rain Today', null),
      panels.current[3] ?? formatPressure(null),
    ],
    panels,
    history: [],
    raw: options.raw,
  }
}

export function normalizeTempestWeatherPayload(
  input: WeatherStationRawInput,
  fetchedAt = new Date().toISOString(),
): WeatherStationSnapshot {
  const observationPayload = isRecord(input.observation) && isRecord(input.observation.data)
    ? input.observation.data
    : input.observation
  const deviceObservationPayload = input.deviceObservation && isRecord(input.deviceObservation) && isRecord(input.deviceObservation.data)
    ? input.deviceObservation.data
    : input.deviceObservation
  const stationPayload =
    input.station ??
    (isRecord(observationPayload) ? firstRecord(observationPayload, ['station']) : null)
  const stationObservation = normalizeObservation(observationPayload)
  const deviceObservation = deviceObservationPayload ? normalizeObservation(deviceObservationPayload) : null

  return normalizeParsedWeather(
    normalizeStation(stationPayload),
    deviceObservation ? mergeObservations(stationObservation, deviceObservation) : stationObservation,
    {
      configured: true,
      source: 'live',
      fetchedAt,
      raw: input,
    },
  )
}

async function fetchTempestJson(
  baseUrl: string,
  path: string,
  token: string,
  fetcher: typeof fetch,
  query: Record<string, string> = {},
): Promise<unknown> {
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`)
  url.searchParams.set('token', token)

  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value)
  }

  const response = await fetcher(url.toString(), {
    headers: {
      Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
    },
  })
  const bodyText = await response.text()

  if (!response.ok) {
    throw new Error(`Tempest API returned ${response.status}.`)
  }

  let payload: unknown
  try {
    payload = JSON.parse(bodyText) as unknown
  } catch {
    throw new Error('Tempest API did not return JSON.')
  }

  if (isRecord(payload) && isRecord(payload.status)) {
    const statusCode = asNumber(payload.status.status_code)
    if (statusCode !== null && statusCode !== 0) {
      throw new Error(asString(payload.status.status_message) ?? `Tempest API returned status ${statusCode}.`)
    }
  }

  return payload
}

async function resolveStation(
  env: WeatherStationEnv,
  baseUrl: string,
  token: string,
  fetcher: typeof fetch,
): Promise<{ station: unknown; stationId: string; deviceId: string | null }> {
  const configuredStationId = env.TEMPEST_STATION_ID?.trim()
  let stationsPayload: unknown = null

  try {
    stationsPayload = await fetchTempestJson(baseUrl, 'stations', token, fetcher)
  } catch {
    if (!configuredStationId) {
      throw new Error('No Tempest station was found for this access token.')
    }
  }

  if (configuredStationId) {
    const station = findStationById(stationsPayload, configuredStationId)
    const normalized = normalizeStation(station)

    return {
      station: station ?? { station_id: configuredStationId },
      stationId: configuredStationId,
      deviceId: normalized.deviceId,
    }
  }

  const station = findFirstStation(stationsPayload)
  const normalized = normalizeStation(station)

  if (!normalized.id) {
    throw new Error('No Tempest station was found for this access token.')
  }

  return {
    station,
    stationId: normalized.id,
    deviceId: normalized.deviceId,
  }
}

export async function resolveWeatherStationSnapshot(
  env: WeatherStationEnv,
  fetcher: typeof fetch = fetch,
  fetchedAt = new Date().toISOString(),
): Promise<WeatherStationSnapshot> {
  const token = env.TEMPEST_ACCESS_TOKEN?.trim()
  if (!token) {
    return createPlaceholderWeatherStationSnapshot(fetchedAt)
  }

  const baseUrl = env.TEMPEST_API_BASE_URL?.trim() || defaultTempestApiBaseUrl
  const { station, stationId, deviceId } = await resolveStation(env, baseUrl, token, fetcher)
  const query = {
    units_temp: 'c',
    units_wind: 'mps',
    units_pressure: 'mb',
    units_precip: 'mm',
    units_distance: 'km',
  }

  let observation: unknown
  try {
    observation = await fetchTempestJson(baseUrl, `observations/station/${encodeURIComponent(stationId)}`, token, fetcher, query)
  } catch {
    observation = await fetchTempestJson(baseUrl, `observations/stn/${encodeURIComponent(stationId)}`, token, fetcher, query)
  }

  let deviceObservation: unknown = null
  if (deviceId) {
    try {
      deviceObservation = await fetchTempestJson(
        baseUrl,
        `observations/device/${encodeURIComponent(deviceId)}`,
        token,
        fetcher,
        query,
      )
    } catch {
      deviceObservation = null
    }
  }

  return normalizeTempestWeatherPayload({ station, observation, deviceObservation }, fetchedAt)
}
