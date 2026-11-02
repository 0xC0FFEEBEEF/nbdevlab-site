import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

afterEach(() => {
  cleanup()
  window.history.replaceState({}, '', '/')
  vi.restoreAllMocks()
})

describe('the missing-page experience', () => {
  it('opens without the home intro, consent overlay, or site API requests', () => {
    window.history.replaceState({}, '', '/a/page/that/is/not/here')
    const fetch = vi.spyOn(globalThis, 'fetch')
    render(<App />)
    const frame = screen.getByTitle('Page not found — NBDEVLAB')
    expect(frame).toHaveAttribute('src', '/404.html')
    expect(frame).toHaveAttribute('allow', 'autoplay')
    expect(screen.queryByRole('button', { name: /enter website/i })).not.toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
    expect(document.title).toBe('NBDEVLAB — Page Not Found')
  })
})
