import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const getStackStatus = vi.fn()
vi.mock('../lib/api', () => ({ publicApi: { getStackStatus: () => getStackStatus() } }))
vi.mock('../lib/homelabMotion', () => ({ animateHomelab: () => () => {} }))

const { HomelabPage } = await import('./HomelabPage')

describe('HomelabPage live stats', () => {
  it('shows the live total at the wall when the status feed has one', async () => {
    getStackStatus.mockResolvedValue({
      raw: {
        summary: { endpointCount: 2, healthyEndpointCount: 2, guestCount: 70, runningGuestCount: 14 },
        power: { wall: { available: true, watts: 470, upsWatts: 108, surgeWatts: 362, updatedAt: '' } },
      },
    })
    render(<HomelabPage />)

    expect(await screen.findByText('≈470 W')).toBeInTheDocument()
    expect(screen.getByText('guests running of 70 · live').closest('.stat')).toHaveTextContent('14')
    expect(screen.getByText('at the wall · live').closest('.stat')).toHaveAttribute(
      'title',
      '108 W through the UPS + 362 W on surge-only power',
    )
  })

  it('keeps the snapshot figure while the feed has no complete reading', async () => {
    getStackStatus.mockResolvedValue({ raw: { power: { available: true } } })
    render(<HomelabPage />)

    await vi.waitFor(() => expect(getStackStatus).toHaveBeenCalled())
    expect(screen.getByText('at the wall · snapshot')).toBeInTheDocument()
    expect(screen.queryByText(/· live/)).not.toBeInTheDocument()
  })
})
