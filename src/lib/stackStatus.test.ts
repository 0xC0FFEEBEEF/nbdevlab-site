import { describe, expect, it } from 'vitest'
import {
  isCloudflareChallengeResponse,
  normalizeStackStatusPayload,
  readGuestCounts,
  readWallPower,
} from './stackStatus'

describe('stackStatus', () => {
  it('normalizes service arrays from wrapped payloads', () => {
    const snapshot = normalizeStackStatusPayload(
      {
        success: true,
        data: {
          status: 'degraded',
          summary: 'One dependency is degraded.',
          updatedAt: '2026-04-02T18:05:00.000Z',
          region: 'homelab',
          services: [
            {
              name: 'website',
              status: 'operational',
              responseTimeMs: 42,
              checkedAt: '2026-04-02T18:05:00.000Z',
            },
            {
              name: 'api',
              status: 'degraded',
              message: 'Tunnel reconnecting',
              latencyMs: 187,
            },
          ],
        },
      },
      'https://api.nbdevlab.com/api/status',
      'https://api.nbdevlab.com/healthz',
      '2026-04-02T18:05:30.000Z',
    )

    expect(snapshot.overallStatus).toBe('degraded')
    expect(snapshot.summary).toBe('One dependency is degraded.')
    expect(snapshot.counts.total).toBe(2)
    expect(snapshot.counts.operational).toBe(1)
    expect(snapshot.counts.degraded).toBe(1)
    expect(snapshot.services[0]?.name).toBe('website')
    expect(snapshot.services[1]?.summary).toBe('Tunnel reconnecting')
    expect(snapshot.metrics).toContainEqual({ label: 'Region', value: 'homelab' })
  })

  it('normalizes named service maps', () => {
    const snapshot = normalizeStackStatusPayload(
      {
        website: {
          ok: true,
          version: '2026.04.02',
        },
        tunnel: {
          healthy: false,
          detail: 'Connector is offline',
        },
      },
      'https://api.nbdevlab.com/api/status',
      'https://api.nbdevlab.com/healthz',
    )

    expect(snapshot.services).toHaveLength(2)
    expect(snapshot.counts.outage).toBe(1)
    expect(snapshot.overallStatus).toBe('outage')
    expect(snapshot.services[0]?.metrics[0]).toEqual({
      label: 'Version',
      value: '2026.04.02',
    })
  })

  it('detects challenge pages returned by Cloudflare', () => {
    const response = new Response('<html><title>Just a moment...</title></html>', {
      status: 403,
      headers: {
        'content-type': 'text/html; charset=UTF-8',
        'cf-mitigated': 'challenge',
      },
    })

    expect(isCloudflareChallengeResponse(response, 'Just a moment...')).toBe(true)
  })

  it('normalizes the current endpoint-based payload shape', () => {
    const snapshot = normalizeStackStatusPayload(
      {
        generatedAt: '2026-04-03T03:56:33.228Z',
        status: 'ok',
        summary: {
          endpointCount: 2,
          healthyEndpointCount: 2,
          issueCount: 0,
          nodeCount: 2,
          onlineNodeCount: 2,
          guestCount: 46,
          runningGuestCount: 14,
          averageNodeCpuPercent: 56.4,
        },
        power: {
          available: true,
          summary: {
            modelName: 'LX1500GAVR',
            batteryCapacity: '100 %',
            remainingRuntime: '5 min.',
          },
        },
        endpoints: [
          {
            name: 'Byteme2',
            status: 'healthy',
            nodeCount: 1,
            onlineNodeCount: 1,
            guestCount: 43,
            runningGuestCount: 13,
          },
          {
            name: 'Byteme3',
            status: 'healthy',
            nodeCount: 1,
            onlineNodeCount: 1,
            guestCount: 3,
            runningGuestCount: 1,
          },
        ],
      },
      'https://api.nbdevlab.com/api/status',
      'https://api.nbdevlab.com/healthz',
      '2026-04-03T03:56:33.500Z',
    )

    expect(snapshot.overallStatus).toBe('operational')
    expect(snapshot.summary).toBe('0 issues across 2 endpoints; 14 guests currently running.')
    expect(snapshot.counts.operational).toBe(2)
    expect(snapshot.services.map((service) => service.name)).toEqual(['Byteme2', 'Byteme3'])
    expect(snapshot.metrics).toContainEqual({ label: 'Guest Count', value: '46' })
    expect(snapshot.metrics).toContainEqual({ label: 'UPS Availability', value: 'Operational' })
  })
})

describe('readWallPower', () => {
  const feed = (wall: unknown) => ({ raw: { power: { available: true, wall } } })

  it('reads the total at the wall when the feed has a complete reading', () => {
    expect(
      readWallPower(feed({ available: true, watts: 470.4, upsWatts: 108, surgeWatts: 362, updatedAt: '2026-10-15T15:22:30.000Z' })),
    ).toEqual({ watts: 470, upsWatts: 108, surgeWatts: 362, updatedAt: '2026-10-15T15:22:30.000Z' })
  })

  it('gives nothing for a missing, unavailable or partial reading', () => {
    expect(readWallPower({ raw: { power: { available: true } } })).toBeNull()
    expect(readWallPower(feed({ available: false, watts: null, upsWatts: null, surgeWatts: null }))).toBeNull()
    expect(readWallPower(feed({ available: true, watts: 470, upsWatts: 108, surgeWatts: null }))).toBeNull()
    expect(readWallPower(null)).toBeNull()
  })
})

describe('readGuestCounts', () => {
  const feed = (summary: Record<string, unknown>) => ({
    raw: { summary: { endpointCount: 2, healthyEndpointCount: 2, guestCount: 69, runningGuestCount: 12, ...summary } },
  })

  it('reads running and defined guests when every host answered', () => {
    expect(readGuestCounts(feed({}))).toEqual({ running: 12, total: 69 })
  })

  it('gives nothing when a host is missing or the numbers do not add up', () => {
    expect(readGuestCounts(feed({ healthyEndpointCount: 1 }))).toBeNull()
    expect(readGuestCounts(feed({ endpointCount: 0, healthyEndpointCount: 0 }))).toBeNull()
    expect(readGuestCounts(feed({ runningGuestCount: 70 }))).toBeNull()
    expect(readGuestCounts(feed({ guestCount: '69' }))).toBeNull()
    expect(readGuestCounts({ raw: {} })).toBeNull()
  })
})
