import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IntroOverlay } from './IntroOverlay'
import { defaultIntroPreferences } from '../lib/introPreferences'
import type { IntroConfig } from '../types/intro'

const config: IntroConfig = {
  startWord: 'hgdeklac',
  targetWord: 'nbdevlab',
  scrambleDurationMs: 120,
  tickMs: 20,
  exitDurationMs: 80,
  charset: 'ABCDEF',
  storageKey: 'intro-test-key',
  reducedMotionSkipsScramble: true,
}

describe('IntroOverlay', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows the gate only after scramble completion', () => {
    vi.useFakeTimers()
    const complete = vi.fn()

    render(
      <IntroOverlay
        config={config}
        reducedMotion={false}
        preferences={defaultIntroPreferences}
        onComplete={complete}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Enter Website' })).not.toBeInTheDocument()
    expect(screen.getByText('hgdeklac')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(180)
    })

    expect(screen.getByRole('button', { name: 'Enter Website' })).toBeInTheDocument()
    expect(screen.getByText('nbdevlab')).toBeInTheDocument()
    expect(screen.getByText('ENTER')).toBeInTheDocument()
    expect(document.querySelector('.intro-overlay__copy--interactive')).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('reports scramble progress before the gate appears', () => {
    vi.useFakeTimers()
    const complete = vi.fn()
    const progress = vi.fn()

    render(
      <IntroOverlay
        config={config}
        reducedMotion={false}
        preferences={defaultIntroPreferences}
        onComplete={complete}
        onScrambleProgress={progress}
      />,
    )

    expect(progress).toHaveBeenCalledWith(0)

    act(() => {
      vi.advanceTimersByTime(60)
    })

    expect(progress.mock.calls.some(([value]) => value > 0 && value < 1)).toBe(true)

    act(() => {
      vi.advanceTimersByTime(120)
    })

    expect(progress.mock.calls.at(-1)?.[0]).toBe(1)

    vi.useRealTimers()
  })

  it('exits on button click and stores intro flag', () => {
    vi.useFakeTimers()
    const complete = vi.fn()

    render(
      <IntroOverlay
        config={config}
        reducedMotion={false}
        preferences={defaultIntroPreferences}
        onComplete={complete}
      />,
    )

    act(() => {
      vi.advanceTimersByTime(180)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Enter Website' }))

    expect(document.querySelector('.intro-overlay')?.getAttribute('data-phase')).toBe('exiting')

    act(() => {
      vi.advanceTimersByTime(90)
    })

    expect(complete).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(config.storageKey)).toBe('1')

    vi.useRealTimers()
  })

  it('exits when Enter is pressed in gate state', () => {
    vi.useFakeTimers()
    const complete = vi.fn()

    render(
      <IntroOverlay
        config={config}
        reducedMotion={false}
        preferences={defaultIntroPreferences}
        onComplete={complete}
      />,
    )

    act(() => {
      vi.advanceTimersByTime(180)
    })

    fireEvent.keyDown(window, { key: 'Enter' })

    act(() => {
      vi.advanceTimersByTime(90)
    })

    expect(complete).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('skips scramble when reduced motion is enabled and focuses CTA', () => {
    const complete = vi.fn()

    render(
      <IntroOverlay
        config={config}
        reducedMotion
        preferences={defaultIntroPreferences}
        onComplete={complete}
      />,
    )

    const button = screen.getByRole('button', { name: 'Enter Website' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveFocus()
    expect(screen.getByText('nbdevlab')).toBeInTheDocument()
    expect(screen.getByText('ENTER')).toBeInTheDocument()
  })

  it('respects intro visibility preferences', () => {
    const complete = vi.fn()

    render(
      <IntroOverlay
        config={config}
        reducedMotion
        preferences={{
          ...defaultIntroPreferences,
          showStatus: false,
          showWord: false,
          showEnterLabel: false,
          showIntroSettingsButton: false,
        }}
        onComplete={complete}
      />,
    )

    expect(screen.getByRole('button', { name: 'Enter Website' })).toBeInTheDocument()
    expect(screen.queryByText('nbdevlab')).not.toBeInTheDocument()
    expect(screen.queryByText('ENTER')).not.toBeInTheDocument()
    expect(document.querySelector('.settings-toggle--intro')).not.toBeInTheDocument()
  })
})
