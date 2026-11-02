import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { SiteAnnouncement } from './Announcement'
import { defaultAnnouncement, type Announcement } from '../../shared/announcement'

const strip: Announcement = {
  ...defaultAnnouncement,
  enabled: true,
  label: 'Notice',
  message: 'The lab is running in a minimal state.',
  linkLabel: 'Lab status',
  linkUrl: '/status',
  updatedAt: '2026-10-12T15:00:00.000Z',
}

const takeover: Announcement = {
  ...strip,
  style: 'takeover',
  title: 'Hurricane preparation',
  message: 'First paragraph.\n\nSecond paragraph.',
}

function renderAnnouncement(announcement: Announcement, siteVisible = true) {
  return render(
    <MemoryRouter>
      <SiteAnnouncement announcement={announcement} siteVisible={siteVisible} />
    </MemoryRouter>,
  )
}

describe('SiteAnnouncement', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('shows nothing while it is switched off, empty, or the intro is running', () => {
    renderAnnouncement({ ...strip, enabled: false })
    renderAnnouncement({ ...strip, message: '' })
    renderAnnouncement(strip, false)
    expect(screen.queryByRole('complementary', { name: 'Announcement' })).not.toBeInTheDocument()
  })

  it('shows nothing after its last day', () => {
    renderAnnouncement({ ...strip, expiresOn: '2020-01-01' })
    expect(screen.queryByRole('complementary', { name: 'Announcement' })).not.toBeInTheDocument()
  })

  it('renders the strip with its label, message, link and three slashes on each side', () => {
    const { container } = renderAnnouncement(strip)
    const region = screen.getByRole('complementary', { name: 'Announcement' })

    expect(region).toHaveTextContent('Notice The lab is running in a minimal state. Lab status')
    expect(screen.getByRole('link', { name: 'Lab status' })).toHaveAttribute('href', '/status')
    expect(container.querySelector('.announce-marks--lead')).toHaveTextContent('///')
    expect(container.querySelector('.announce-marks--trail')).toHaveTextContent('\\\\\\')
    expect(region).toHaveClass('announce-strip--animated')
  })

  it('keeps the slashes still when the animation is switched off', () => {
    renderAnnouncement({ ...strip, animate: false })
    expect(screen.getByRole('complementary', { name: 'Announcement' })).not.toHaveClass('announce-strip--animated')
  })

  it('stays dismissed for the same announcement and returns for a new one', () => {
    const first = renderAnnouncement(strip)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss announcement' }))
    expect(screen.queryByRole('complementary', { name: 'Announcement' })).not.toBeInTheDocument()
    first.unmount()

    const again = renderAnnouncement(strip)
    expect(screen.queryByRole('complementary', { name: 'Announcement' })).not.toBeInTheDocument()
    again.unmount()

    renderAnnouncement({ ...strip, message: 'Back to normal.', updatedAt: '2026-10-14T09:00:00.000Z' })
    expect(screen.getByRole('complementary', { name: 'Announcement' })).toHaveTextContent('Back to normal.')
  })

  it('offers no dismiss button when visitors may not close the strip', () => {
    renderAnnouncement({ ...strip, dismissible: false })
    expect(screen.queryByRole('button', { name: 'Dismiss announcement' })).not.toBeInTheDocument()
  })

  it('opens the take-over as a dialog, focuses Got it, and closes on Escape', () => {
    renderAnnouncement(takeover)
    const dialog = screen.getByRole('dialog', { name: 'Hurricane preparation' })

    expect(dialog).toHaveTextContent('First paragraph.')
    expect(dialog.querySelectorAll('.announce-card__body p')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Got it' })).toHaveFocus()
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
  })

  it('does not show a take-over again once Got it was pressed', () => {
    const first = renderAnnouncement(takeover)
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    first.unmount()

    renderAnnouncement(takeover)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
