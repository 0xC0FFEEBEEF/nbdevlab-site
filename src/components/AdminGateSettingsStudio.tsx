import { useEffect, useMemo, useRef, useState } from 'react'
import { BlackHoleCanvas, type BlackHoleCanvasHandle } from './BlackHoleCanvas'
import {
  defaultGateSettings,
  normalizeGateSettings,
  type GateIntensityPreset,
  type GateSettings,
} from '../../shared/gateSettings'

interface AdminGateSettingsStudioProps {
  gateSettings: GateSettings
  onChange: (next: GateSettings) => void
  onSave: () => void
  isBusy: boolean
}

interface SliderFieldProps {
  label: string
  description: string
  value: number
  min: number
  max: number
  step: number
  formatValue?: (value: number) => string
  onChange: (value: number) => void
}

function SliderField({
  label,
  description,
  value,
  min,
  max,
  step,
  formatValue = (nextValue) => nextValue.toFixed(step < 1 ? 2 : 0),
  onChange,
}: SliderFieldProps) {
  return (
    <label className="admin-intro-studio__field">
      <span className="admin-intro-studio__field-head">
        <strong>{label}</strong>
        <span>{formatValue(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
      <small>{description}</small>
    </label>
  )
}

function PresetButtonRow({
  value,
  onChange,
}: {
  value: GateIntensityPreset
  onChange: (value: GateIntensityPreset) => void
}) {
  const options: GateIntensityPreset[] = ['soft', 'standard', 'intense']

  return (
    <div className="admin-intro-studio__preset-row" role="group" aria-label="Gate intensity preset">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={value === option ? 'is-active' : ''}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

export function AdminGateSettingsStudio({
  gateSettings,
  onChange,
  onSave,
  isBusy,
}: AdminGateSettingsStudioProps) {
  const previewCanvasRef = useRef<BlackHoleCanvasHandle>(null)
  const normalizedGateSettings = useMemo(() => normalizeGateSettings(gateSettings), [gateSettings])
  const settingsSignature = useMemo(
    () => JSON.stringify(normalizedGateSettings),
    [normalizedGateSettings],
  )
  const [previewRun, setPreviewRun] = useState(0)
  const [autoReplay, setAutoReplay] = useState(true)
  const [showRevealMock, setShowRevealMock] = useState(false)

  const patchGateSettings = (patch: Partial<GateSettings>) => {
    onChange(normalizeGateSettings({ ...normalizedGateSettings, ...patch }, normalizedGateSettings))
  }

  useEffect(() => {
    setPreviewRun((current) => current + 1)
  }, [settingsSignature])

  useEffect(() => {
    setShowRevealMock(false)

    const expandTimeout = window.setTimeout(() => {
      previewCanvasRef.current?.triggerExpansion()
    }, 760)
    const revealDelay = Math.round(
      normalizedGateSettings.transformDurationMs *
        Math.min(normalizedGateSettings.fadeToBlackEnd + 0.12, 1),
    )
    const revealTimeout = window.setTimeout(() => {
      setShowRevealMock(true)
    }, revealDelay)
    const loopTimeout = autoReplay
      ? window.setTimeout(() => {
          setPreviewRun((current) => current + 1)
        }, revealDelay + 1900)
      : 0

    return () => {
      window.clearTimeout(expandTimeout)
      window.clearTimeout(revealTimeout)
      if (loopTimeout) {
        window.clearTimeout(loopTimeout)
      }
    }
  }, [autoReplay, normalizedGateSettings, previewRun])

  return (
    <section className="admin-panel admin-intro-studio">
      <div className="admin-intro-studio__header">
        <div>
          <p className="admin-intro-studio__eyebrow">Intro Studio</p>
          <h2>Gate particle controls</h2>
          <p className="admin-intro-studio__hint">
            Every control below drives the same gate canvas used on the live site. The preview loops
            automatically and updates as you tune it.
          </p>
        </div>
        <div className="admin-editor__actions">
          <label className="admin-inline-checkbox admin-intro-studio__toggle">
            <input
              type="checkbox"
              checked={autoReplay}
              onChange={(event) => setAutoReplay(event.currentTarget.checked)}
            />
            Auto replay
          </label>
          <button
            className="button"
            type="button"
            onClick={() => setPreviewRun((current) => current + 1)}
          >
            Replay Preview
          </button>
          <button
            className="button"
            type="button"
            onClick={() => onChange(defaultGateSettings)}
          >
            Reset Defaults
          </button>
          <button
            className="button button--solid"
            type="button"
            disabled={isBusy}
            onClick={onSave}
          >
            Save Gate Settings
          </button>
        </div>
      </div>

      <div className="admin-intro-studio__layout">
        <div className="admin-intro-studio__preview-panel">
          <div className="admin-intro-studio__preview-frame">
            <div
              className={`admin-intro-studio__preview-site ${
                showRevealMock ? 'admin-intro-studio__preview-site--visible' : ''
              }`}
            >
              <div className="admin-intro-studio__preview-nav">
                <span>NBDEVLAB</span>
                <span>Home</span>
                <span>Projects</span>
                <span>Contact</span>
              </div>
              <div className="admin-intro-studio__preview-card">
                <p>Homepage reveal</p>
                <h3>Particles fade down, then the page comes forward.</h3>
                <span>Live CMS preview</span>
              </div>
            </div>
            <BlackHoleCanvas
              key={`gate-preview:${previewRun}:${settingsSignature}`}
              ref={previewCanvasRef}
              gateRevealProgress={1}
              gateSettings={normalizedGateSettings}
              motionPreset={normalizedGateSettings.intensityPreset}
              layout="contained"
            />
            <div className="admin-intro-studio__preview-overlay">
              <span>ENTER</span>
            </div>
          </div>
        </div>

        <div className="admin-intro-studio__controls">
          <section className="admin-intro-studio__section">
            <div className="admin-intro-studio__section-head">
              <p>Preset</p>
            </div>
            <PresetButtonRow
              value={normalizedGateSettings.intensityPreset}
              onChange={(intensityPreset) => patchGateSettings({ intensityPreset })}
            />
          </section>

          <section className="admin-intro-studio__section">
            <div className="admin-intro-studio__section-head">
              <p>Particle field</p>
            </div>
            <div className="admin-intro-studio__field-grid">
              <SliderField
                label="Particle density"
                description="Overall gate particle count. Default is already cut to half."
                value={normalizedGateSettings.particleDensity}
                min={0.15}
                max={1.4}
                step={0.01}
                formatValue={(value) => `${value.toFixed(2)}x`}
                onChange={(particleDensity) => patchGateSettings({ particleDensity })}
              />
              <SliderField
                label="Firefly density"
                description="How many of those particles survive as fireflies on the page."
                value={normalizedGateSettings.fireflyDensity}
                min={0.08}
                max={1.6}
                step={0.01}
                formatValue={(value) => `${value.toFixed(2)}x`}
                onChange={(fireflyDensity) => patchGateSettings({ fireflyDensity })}
              />
              <SliderField
                label="Gate dot scale"
                description="Core gate particle size before the transition."
                value={normalizedGateSettings.gateDotScale}
                min={0.35}
                max={2.5}
                step={0.01}
                formatValue={(value) => `${value.toFixed(2)}x`}
                onChange={(gateDotScale) => patchGateSettings({ gateDotScale })}
              />
              <SliderField
                label="Trail opacity"
                description="Brightness and persistence of the orbital streaks."
                value={normalizedGateSettings.trailOpacityScale}
                min={0}
                max={2.5}
                step={0.01}
                formatValue={(value) => `${value.toFixed(2)}x`}
                onChange={(trailOpacityScale) => patchGateSettings({ trailOpacityScale })}
              />
              <SliderField
                label="Line width"
                description="Thickness of the gate particle trails."
                value={normalizedGateSettings.lineWidthScale}
                min={0.3}
                max={2.2}
                step={0.01}
                formatValue={(value) => `${value.toFixed(2)}x`}
                onChange={(lineWidthScale) => patchGateSettings({ lineWidthScale })}
              />
              <SliderField
                label="Spread multiplier"
                description="How far the particles push out during the handoff."
                value={normalizedGateSettings.transformSpread}
                min={0.2}
                max={2.6}
                step={0.01}
                formatValue={(value) => `${value.toFixed(2)}x`}
                onChange={(transformSpread) => patchGateSettings({ transformSpread })}
              />
            </div>
          </section>

          <section className="admin-intro-studio__section">
            <div className="admin-intro-studio__section-head">
              <p>Transition timing</p>
            </div>
            <div className="admin-intro-studio__field-grid">
              <SliderField
                label="Transform duration"
                description="Total travel time from black hole to settled state."
                value={normalizedGateSettings.transformDurationMs}
                min={900}
                max={7000}
                step={50}
                formatValue={(value) => `${Math.round(value)}ms`}
                onChange={(transformDurationMs) => patchGateSettings({ transformDurationMs })}
              />
              <SliderField
                label="Fade to black start"
                description="When the travelling particles begin dimming."
                value={normalizedGateSettings.fadeToBlackStart}
                min={0}
                max={0.95}
                step={0.01}
                onChange={(fadeToBlackStart) => patchGateSettings({ fadeToBlackStart })}
              />
              <SliderField
                label="Fade to black end"
                description="When the moving particles are fully darkened."
                value={normalizedGateSettings.fadeToBlackEnd}
                min={0.05}
                max={1}
                step={0.01}
                onChange={(fadeToBlackEnd) => patchGateSettings({ fadeToBlackEnd })}
              />
              <SliderField
                label="Firefly blend start"
                description="How late the settled fireflies begin taking over."
                value={normalizedGateSettings.fireflyBlendStart}
                min={0.2}
                max={0.98}
                step={0.01}
                onChange={(fireflyBlendStart) => patchGateSettings({ fireflyBlendStart })}
              />
              <SliderField
                label="Gate background persistence"
                description="Black-hole phase canvas persistence while the ring is active."
                value={normalizedGateSettings.gateClearAlphaScale}
                min={0.35}
                max={2}
                step={0.01}
                formatValue={(value) => `${value.toFixed(2)}x`}
                onChange={(gateClearAlphaScale) => patchGateSettings({ gateClearAlphaScale })}
              />
              <SliderField
                label="Firefly background persistence"
                description="How much black remains on the page after the handoff."
                value={normalizedGateSettings.fireflyClearAlphaScale}
                min={0.35}
                max={2}
                step={0.01}
                formatValue={(value) => `${value.toFixed(2)}x`}
                onChange={(fireflyClearAlphaScale) => patchGateSettings({ fireflyClearAlphaScale })}
              />
            </div>
          </section>

          <section className="admin-intro-studio__section">
            <div className="admin-intro-studio__section-head">
              <p>Firefly motion</p>
            </div>
            <div className="admin-intro-studio__field-grid">
              <SliderField
                label="Firefly size"
                description="Core size of the settled main-page fireflies."
                value={normalizedGateSettings.fireflySizeScale}
                min={0.4}
                max={2.4}
                step={0.01}
                formatValue={(value) => `${value.toFixed(2)}x`}
                onChange={(fireflySizeScale) => patchGateSettings({ fireflySizeScale })}
              />
              <SliderField
                label="Firefly glow"
                description="Glow radius after the transition completes."
                value={normalizedGateSettings.fireflyGlowScale}
                min={0.35}
                max={2.8}
                step={0.01}
                formatValue={(value) => `${value.toFixed(2)}x`}
                onChange={(fireflyGlowScale) => patchGateSettings({ fireflyGlowScale })}
              />
              <SliderField
                label="Firefly drift"
                description="Baseline drift speed for the settled particles."
                value={normalizedGateSettings.fireflyDriftScale}
                min={0}
                max={2.5}
                step={0.01}
                formatValue={(value) => `${value.toFixed(2)}x`}
                onChange={(fireflyDriftScale) => patchGateSettings({ fireflyDriftScale })}
              />
              <SliderField
                label="Firefly sway"
                description="Organic side-to-side motion layered onto the drift."
                value={normalizedGateSettings.fireflySwayScale}
                min={0}
                max={2.5}
                step={0.01}
                formatValue={(value) => `${value.toFixed(2)}x`}
                onChange={(fireflySwayScale) => patchGateSettings({ fireflySwayScale })}
              />
              <SliderField
                label="Firefly twinkle"
                description="Speed and amplitude of the firefly sparkle."
                value={normalizedGateSettings.fireflyTwinkleScale}
                min={0.15}
                max={3}
                step={0.01}
                formatValue={(value) => `${value.toFixed(2)}x`}
                onChange={(fireflyTwinkleScale) => patchGateSettings({ fireflyTwinkleScale })}
              />
              <SliderField
                label="Edge padding"
                description="How close the fireflies can drift toward the frame edge."
                value={normalizedGateSettings.edgePadding}
                min={0}
                max={96}
                step={1}
                formatValue={(value) => `${Math.round(value)}px`}
                onChange={(edgePadding) => patchGateSettings({ edgePadding })}
              />
            </div>
          </section>
        </div>
      </div>
    </section>
  )
}
