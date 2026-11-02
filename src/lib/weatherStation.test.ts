import { describe, expect, it, vi } from 'vitest'
import {
  collectWeatherStationTrendValues,
  normalizeTempestWeatherPayload,
  resolveWeatherStationSnapshot,
  type WeatherStationDisplayMetric,
} from './weatherStation'

function findMetric(metrics: WeatherStationDisplayMetric[], label: string): WeatherStationDisplayMetric {
  const metric = metrics.find((item) => item.label === label)
  if (!metric) {
    throw new Error(`Missing metric: ${label}`)
  }
  return metric
}

describe('weatherStation', () => {
  it('normalizes a named station observation payload', () => {
    const snapshot = normalizeTempestWeatherPayload(
      {
        station: {
          station_id: 12345,
          name: 'Backyard Tempest',
          timezone: 'America/Chicago',
          latitude: 41.12345,
          longitude: -88.54321,
          elevation: 212,
        },
        observation: {
          obs: [
            {
              timestamp: 1_713_456_789,
              air_temperature: 20,
              feels_like: 21.2,
              relative_humidity: 57,
              station_pressure: 1012.5,
              sea_level_pressure: 1020.3,
              pressure_trend: 'rising',
              wind_avg: 2.2,
              wind_gust: 5,
              wind_lull: 0.5,
              wind_direction: 182,
              precip_accum_local_day: 4.2,
              lightning_strike_count: 1,
              lightning_strike_avg_distance: 12,
              uv: 5,
              solar_radiation: 230,
              battery: 2.72,
              report_interval: 1,
            },
          ],
        },
      },
      '2026-05-12T12:00:00.000Z',
    )

    expect(snapshot.source).toBe('live')
    expect(snapshot.station.name).toBe('Backyard Tempest')
    expect(snapshot.station.coordinates).toBe('41.1234, -88.5432')
    expect(findMetric(snapshot.metrics, 'Temperature')).toEqual({
      label: 'Temperature',
      primary: '68.0 F',
      secondary: '20.0 C',
    })
    expect(findMetric(snapshot.metrics, 'Average Wind').primary).toBe('4.9 mph')
    expect(findMetric(snapshot.metrics, 'Rain Today')).toEqual({
      label: 'Rain Today',
      primary: '0.17 in',
      secondary: '4.2 mm',
    })
    expect(findMetric(snapshot.panels.current, 'Pressure')).toEqual({
      label: 'Pressure',
      primary: '30.13 inHg',
      secondary: '1020.3 mb',
    })
    expect(snapshot.history).toEqual([])
  })

  it('collects graph trend values from display metrics', () => {
    const snapshot = normalizeTempestWeatherPayload(
      {
        station: {
          station_id: 12345,
          name: 'Backyard Tempest',
        },
        observation: {
          obs: [
            {
              timestamp: 1_713_456_789,
              air_temperature: 20,
              wind_direction: 182,
              relative_humidity: 57,
              sea_level_pressure: 1020.3,
              precip_accum_local_day: 4.2,
            },
          ],
        },
      },
      '2026-05-12T12:00:00.000Z',
    )

    expect(collectWeatherStationTrendValues(snapshot)).toMatchObject({
      Temperature: 68,
      Direction: 182,
      Humidity: 57,
      Pressure: 30.13,
      'Rain Today': 0.17,
    })
  })

  it('prefers sea-level pressure over station pressure', () => {
    const snapshot = normalizeTempestWeatherPayload(
      {
        observation: {
          obs: [
            {
              timestamp: 1_713_456_789,
              station_pressure: 1004.4,
              sea_level_pressure: 1020.2,
            },
          ],
        },
      },
      '2026-05-12T12:00:00.000Z',
    )

    expect(findMetric(snapshot.metrics, 'Pressure')).toEqual({
      label: 'Pressure',
      primary: '30.13 inHg',
      secondary: '1020.2 mb',
    })
  })

  it('maps Tempest obs_st array indexes', () => {
    const snapshot = normalizeTempestWeatherPayload(
      {
        observation: {
          type: 'obs_st',
          device_id: 62009,
          obs: [[1603481377, 0, 0.09, 0.54, 33, 6, 1014.8, 28.8, 71, 16639, 1.83, 139, 0, 0, 0, 0, 2.42, 1, 0.07615, null, null, 0]],
        },
      },
      '2026-05-12T12:00:00.000Z',
    )

    expect(snapshot.observedAt).toBe('2020-10-23T19:29:37.000Z')
    expect(findMetric(snapshot.metrics, 'Temperature').primary).toBe('83.8 F')
    expect(findMetric(snapshot.metrics, 'Average Wind').primary).toBe('0.2 mph')
    expect(findMetric(snapshot.metrics, 'Pressure').primary).toBe('29.97 inHg')
    expect(findMetric(snapshot.metrics, 'Rain Today')).toEqual({
      label: 'Rain Today',
      primary: '0.00 in',
      secondary: '0.1 mm',
    })
    expect(findMetric(snapshot.panels.hardware, 'Battery').primary).toBe('2.42 V')
    expect(findMetric(snapshot.panels.hardware, 'Report Interval').primary).toBe('1 min')
    expect(findMetric(snapshot.panels.wind, 'Sample Interval').primary).toBe('6 sec')
    expect(findMetric(snapshot.panels.wind, 'Direction')).toEqual({
      label: 'Direction',
      primary: 'NE',
      secondary: '33 deg',
    })
    expect(findMetric(snapshot.panels.hardware, 'Rain Correction').primary).toBe('None')
  })

  it('uses device observations to fill hardware and sample interval fields', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input)

      if (url.includes('/stations')) {
        return new Response(
          JSON.stringify({
            stations: [
              {
                station_id: 12345,
                name: 'Backyard Tempest',
                devices: [
                  {
                    device_id: 62009,
                    device_type: 'ST',
                  },
                ],
              },
            ],
          }),
        )
      }

      if (url.includes('/observations/station/12345')) {
        return new Response(
          JSON.stringify({
            obs: [
              {
                timestamp: 1_713_456_789,
                air_temperature: 20,
                relative_humidity: 57,
                station_pressure: 1012.5,
                wind_avg: 2.2,
                precip_accum_local_day: 4.2,
              },
            ],
          }),
        )
      }

      if (url.includes('/observations/device/62009')) {
        return new Response(
          JSON.stringify({
            type: 'obs_st',
            device_id: 62009,
            obs: [[1_713_456_789, 0.5, 2.2, 5, 182, 6, 1012.5, 20, 57, 1000, 1, 200, 0, 0, 0, 0, 2.72, 1, 4.2, null, null, 0]],
          }),
        )
      }

      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 })
    })

    const snapshot = await resolveWeatherStationSnapshot(
      { TEMPEST_ACCESS_TOKEN: 'token' },
      fetcher,
      '2026-05-12T12:00:00.000Z',
    )

    expect(findMetric(snapshot.panels.hardware, 'Battery').primary).toBe('2.72 V')
    expect(findMetric(snapshot.panels.hardware, 'Report Interval').primary).toBe('1 min')
    expect(findMetric(snapshot.panels.wind, 'Sample Interval').primary).toBe('6 sec')
    expect(findMetric(snapshot.panels.hardware, 'Rain Correction').primary).toBe('None')
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('/observations/device/62009'),
      expect.any(Object),
    )
  })

  it('uses N/A and - for missing values', () => {
    const snapshot = normalizeTempestWeatherPayload(
      {
        observation: {
          obs: [
            {
              timestamp: 1_713_456_789,
              air_temperature: null,
              relative_humidity: null,
              wind_avg: null,
              station_pressure: null,
            },
          ],
        },
      },
      '2026-05-12T12:00:00.000Z',
    )

    expect(findMetric(snapshot.metrics, 'Temperature')).toEqual({
      label: 'Temperature',
      primary: 'N/A',
      secondary: '-',
    })
    expect(findMetric(snapshot.metrics, 'Average Wind')).toEqual({
      label: 'Average Wind',
      primary: 'N/A',
      secondary: '-',
    })
    expect(findMetric(snapshot.panels.hardware, 'Battery')).toEqual({
      label: 'Battery',
      primary: 'N/A',
      secondary: '-',
    })
    expect(findMetric(snapshot.panels.hardware, 'Rain Correction')).toEqual({
      label: 'Rain Correction',
      primary: 'N/A',
      secondary: '-',
    })
  })

  it('returns placeholder data without calling the API when the token is missing', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const snapshot = await resolveWeatherStationSnapshot(
      {},
      fetcher,
      '2026-05-12T12:00:00.000Z',
    )

    expect(fetcher).not.toHaveBeenCalled()
    expect(snapshot.configured).toBe(false)
    expect(snapshot.source).toBe('placeholder')
    expect(findMetric(snapshot.metrics, 'Temperature').primary).toBe('N/A')
  })
})
