import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DigitalRainProfile, IntroMode, IntroPreferences } from '../lib/introPreferences'
import { computeScrambleFrame } from '../lib/introMachine'
import type { IntroConfig } from '../types/intro'
import { DigitalRain } from './DigitalRain'
import { SettingsGearButton } from './SettingsGearButton'

type IntroPhase = 'scramble' | 'gate' | 'exiting' | 'done'

interface IntroOverlayProps {
  config: IntroConfig
  reducedMotion: boolean
  preferences: IntroPreferences
  mode?: IntroMode
  rainProfile?: DigitalRainProfile
  startAtGate?: boolean
  onExitStart?: () => void
  onComplete: () => void
  onScrambleProgress?: (progress: number) => void
  onHoverEnter?: () => void
  onHoverLeave?: () => void
  onOpenSettings?: () => void
}

export function IntroOverlay({
  config,
  reducedMotion,
  preferences,
  mode = 'gate',
  rainProfile,
  startAtGate = false,
  onExitStart,
  onComplete,
  onScrambleProgress,
  onHoverEnter,
  onHoverLeave,
  onOpenSettings,
}: IntroOverlayProps) {
  const isRainMode = mode === 'rain'
  const skipScramble = startAtGate || (reducedMotion && config.reducedMotionSkipsScramble)
  const exitDurationMs = reducedMotion ? Math.min(config.exitDurationMs, 320) : config.exitDurationMs
  const [phase, setPhase] = useState<IntroPhase>(skipScramble ? 'gate' : 'scramble')
  const [displayWord, setDisplayWord] = useState(skipScramble ? config.targetWord : config.startWord)
  const [glitchVariant, setGlitchVariant] = useState<0 | 1>(0)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const exitTimeoutRef = useRef<number | null>(null)
  const glitchTimeoutRef = useRef<number | null>(null)

  const rainActive = isRainMode && (phase === 'gate' || phase === 'exiting')
  const rainMode = phase === 'exiting' ? 'burst-exit' : 'idle'

  const phaseLabel = useMemo(() => {
    if (phase === 'scramble') {
      return 'Bootstrapping interface'
    }
    if (phase === 'gate') {
      return 'Interface ready'
    }
    if (phase === 'exiting') {
      return 'Entering site'
    }
    return 'Done'
  }, [phase])

  useEffect(() => {
    if (skipScramble) {
      onScrambleProgress?.(1)
      return
    }

    if (phase === 'scramble') {
      onScrambleProgress?.(0)
      return
    }

    onScrambleProgress?.(1)
  }, [onScrambleProgress, phase, skipScramble])

  useEffect(() => {
    if (phase !== 'scramble') {
      return
    }

    const startTime = performance.now()

    const intervalId = window.setInterval(() => {
      const elapsedMs = performance.now() - startTime
      const frame = computeScrambleFrame({
        target: config.targetWord,
        elapsedMs,
        durationMs: config.scrambleDurationMs,
        charset: config.charset,
      })
      const progress =
        config.scrambleDurationMs <= 0
          ? 1
          : Math.max(0, Math.min(elapsedMs / config.scrambleDurationMs, 1))

      onScrambleProgress?.(progress)
      setDisplayWord(frame.word)

      if (frame.complete) {
        onScrambleProgress?.(1)
        setDisplayWord(config.targetWord)
        setPhase('gate')
      }
    }, config.tickMs)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [config.charset, config.scrambleDurationMs, config.targetWord, config.tickMs, onScrambleProgress, phase])

  useEffect(() => {
    if (phase !== 'gate') {
      return
    }

    buttonRef.current?.focus()
  }, [phase])

  useEffect(() => {
    if (!isRainMode || phase !== 'gate' || reducedMotion) {
      return
    }

    const triggerGlitch = () => {
      setGlitchVariant((current) => (current === 0 ? 1 : 0))
    }

    const scheduleNext = () => {
      const nextDelay = 3000 + Math.random() * 3000
      glitchTimeoutRef.current = window.setTimeout(() => {
        triggerGlitch()
        scheduleNext()
      }, nextDelay)
    }

    triggerGlitch()
    scheduleNext()

    return () => {
      if (glitchTimeoutRef.current !== null) {
        window.clearTimeout(glitchTimeoutRef.current)
      }
    }
  }, [isRainMode, phase, reducedMotion])

  const beginExit = useCallback(() => {
    if (phase !== 'gate') {
      return
    }

    if (exitTimeoutRef.current !== null) {
      window.clearTimeout(exitTimeoutRef.current)
    }

    setPhase('exiting')
    onHoverLeave?.()
    onExitStart?.()

    exitTimeoutRef.current = window.setTimeout(() => {
      window.localStorage.setItem(config.storageKey, '1')
      setPhase('done')
      onComplete()
    }, exitDurationMs)
  }, [config.storageKey, exitDurationMs, onComplete, onExitStart, onHoverLeave, phase])

  useEffect(() => {
    if (phase !== 'gate') {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        beginExit()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [beginExit, phase])

  useEffect(() => {
    return () => {
      if (exitTimeoutRef.current !== null) {
        window.clearTimeout(exitTimeoutRef.current)
      }
      if (glitchTimeoutRef.current !== null) {
        window.clearTimeout(glitchTimeoutRef.current)
      }
    }
  }, [])

  if (phase === 'done') {
    return null
  }

  return (
    <div
      className={`intro-overlay intro-overlay--${phase} ${
        isRainMode ? 'intro-overlay--rain-screen' : 'intro-overlay--gate-screen'
      }`}
      data-phase={phase}
      style={{ '--intro-exit-duration': `${exitDurationMs}ms` } as CSSProperties}
    >
      {isRainMode && rainProfile ? (
        <DigitalRain
          active={rainActive}
          reducedMotion={reducedMotion}
          density={rainProfile.density}
          minSpeed={rainProfile.minSpeed}
          maxSpeed={rainProfile.maxSpeed}
          opacity={rainProfile.opacity}
          fontSize={rainProfile.fontSize}
          mode={rainMode}
        />
      ) : null}
      <div className="intro-overlay__grain" aria-hidden="true" />
      {preferences.showIntroSettingsButton && phase !== 'exiting' ? (
        <SettingsGearButton
          className="settings-toggle--intro"
          label="Open intro settings"
          onClick={() => onOpenSettings?.()}
        />
      ) : null}
      <div className="intro-overlay__content" aria-live="polite">
        {isRainMode ? (
          <div className="intro-overlay__legacy-copy">
            {preferences.showStatus ? <p className="intro-overlay__status">{phaseLabel}</p> : null}
            {preferences.showWord ? (
              <h1 className="intro-overlay__word">{phase === 'gate' ? config.targetWord : displayWord}</h1>
            ) : null}
            {phase === 'gate' ? (
              <button
                ref={buttonRef}
                type="button"
                aria-label="Enter Website"
                className={`intro-overlay__enter intro-overlay__enter--glitch-${glitchVariant} ${
                  preferences.showEnterLabel ? '' : 'intro-overlay__enter--ghost'
                }`}
                data-label="Enter Website"
                onClick={beginExit}
              >
                {preferences.showEnterLabel ? (
                  <span>Enter Website</span>
                ) : (
                  <span className="intro-overlay__sr-only">Enter Website</span>
                )}
              </button>
            ) : null}
          </div>
        ) : phase === 'scramble' ? (
          <div className="intro-overlay__copy intro-overlay__copy--scramble">
            {preferences.showStatus ? <p className="intro-overlay__status">Bootstrapping interface</p> : null}
            {preferences.showWord ? <h1 className="intro-overlay__word">{displayWord}</h1> : null}
          </div>
        ) : (
          <button
            ref={buttonRef}
            type="button"
            aria-label="Enter Website"
            className={`intro-overlay__copy intro-overlay__copy--interactive ${
              phase === 'exiting' ? 'intro-overlay__copy--open' : ''
            }`}
            onClick={beginExit}
            onMouseEnter={phase === 'gate' ? onHoverEnter : undefined}
            onMouseLeave={phase === 'gate' ? onHoverLeave : undefined}
          >
            {preferences.showStatus ? (
              <p className="intro-overlay__status">
                {phase === 'exiting' ? 'Entering site' : 'Interface ready'}
              </p>
            ) : null}
            {preferences.showWord ? <h1 className="intro-overlay__word">{config.targetWord}</h1> : null}
            {preferences.showEnterLabel ? <span className="intro-overlay__enter-label">ENTER</span> : null}
          </button>
        )}
      </div>
    </div>
  )
}
