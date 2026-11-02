import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { ConsentBanner } from './ConsentBanner'
import { readStoredConsent, writeStoredConsent } from '../lib/consent'

function renderBanner(visible = true) {
  return render(
    <MemoryRouter>
      <ConsentBanner visible={visible} />
    </MemoryRouter>,
  )
}

describe('ConsentBanner', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.dataLayer = []
  })

  it('shows when visible and no choice is stored', () => {
    renderBanner()
    expect(screen.getByRole('region', { name: 'Cookie consent' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
  })

  it('stays hidden while the intro is running', () => {
    renderBanner(false)
    expect(screen.queryByRole('region', { name: 'Cookie consent' })).not.toBeInTheDocument()
  })

  it('stays hidden once a choice was stored', () => {
    writeStoredConsent('denied')
    renderBanner()
    expect(screen.queryByRole('region', { name: 'Cookie consent' })).not.toBeInTheDocument()
  })

  it('persists and hides on accept', () => {
    renderBanner()
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    expect(readStoredConsent()).toBe('granted')
    expect(screen.queryByRole('region', { name: 'Cookie consent' })).not.toBeInTheDocument()
  })

  it('persists and hides on decline', () => {
    renderBanner()
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
    expect(readStoredConsent()).toBe('denied')
    expect(screen.queryByRole('region', { name: 'Cookie consent' })).not.toBeInTheDocument()
  })
})
