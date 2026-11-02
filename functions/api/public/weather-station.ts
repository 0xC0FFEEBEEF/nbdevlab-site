import type { AppEnv } from '../../_shared/types'
import { persistWeatherStationSnapshotHistory } from '../../_shared/weatherStationHistory'
import { resolveWeatherStationSnapshot } from '../../../src/lib/weatherStation'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data: body }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function errorResponse(error: string, status = 400): Response {
  return new Response(JSON.stringify({ success: false, data: null, error }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export const onRequestGet: PagesFunction<AppEnv> = async (context) => {
  try {
    const snapshot = await resolveWeatherStationSnapshot(context.env)
    try {
      return jsonResponse(await persistWeatherStationSnapshotHistory(context.env.DB, snapshot))
    } catch (historyError) {
      console.warn('Failed to persist Tempest weather station history.', historyError)
      return jsonResponse(snapshot)
    }
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to load Tempest weather station data.',
      502,
    )
  }
}
