import { useEffect, useMemo, useRef, useState } from 'react'
import { BlackHoleCanvas, type BlackHoleCanvasHandle } from './BlackHoleCanvas'
import { defaultIntroConfig } from '../types/intro'
import {
  cloneGateSettings,
  defaultGateSettings,
  normalizeGateSettings,
  type GateIntensityPreset,
  type GateSettings,
} from '../../shared/gateSettings'

interface GateSettingsPanelProps {
  settings: GateSettings
  isBusy: boolean
  onChange: (settings: GateSettings) => void
  onSave: () => void
}

interface RangeFieldProps {
  label: string
  description: string
  min: number
  max: number
  step: number
  value: number
  onChange: (value: number) => void
  formatValue?: (value: number) => string
}

const intensityOptions: Array<{ value: GateIntensityPreset; label: string }> = [
  { value: 'soft', label: 'Soft' },
  { value: 'standard', label: 'Standard' },
  { value: 'intense', label: 'Intense' },
]

function RangeField({
  label,
  description,
  min,
  max,
  step,
  value,
  onChange,
  formatValue = (next) => `${next}`,
}: RangeFieldProps) {
  return (
    <label className="gate-settings__field">
      <span className="gate-settings__field-head">
        <strong>{label}</strong>
        <span>{formatValue(value)}</span>
      </span>
      <small>{description}</small>
      <div className="gate-settings__field-controls">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
    </label>
  )
}

function MockPreviewChrome({ stage }: { stage: 'gate' | 'revealing' | 'visible' }) {
  return (
    <div className={`gate-preview__site ${stage !== 'gate' ? 'is-revealing' : ''} ${stage === 'visible' ? 'is-visible' : ''}`}>
      <div className="gate-preview__nav">
        <span className="gate-preview__brand">nbdevlab</span>
        <div className="gate-preview__nav-items">
          <span>ABOUT</span>
          <span>PROJECTS</span>
          <span>CONTACT</span>
        </div>
      </div>
      <div className="gate-preview__content">
        <article className="gate-preview__hero">
          <p className="gate-preview__eyebrow">SYSTEMS / LAB / BUILD</p>
          <h3>Hello There</h3>
          <p>Previewing how the gate fades and hands off into the main page reveal.</p>
        </article>
        <div className="gate-preview__cards">
          <div className="gate-preview__card" />
          <div className="gate-preview__card" />
          <div className="gate-preview__card" />
        </div>
      </div>
    </div>
  )
}

export function GateSettingsPanel({ settings, isBusy, onChange, onSave }: GateSettingsPanelProps) {
  const previewCanvasRef = useRef<BlackHoleCanvasHandle>(null)
  const [previewRunId, setPreviewRunId] = useState(0)
  const [previewStage, setPreviewStage] = useState<'gate' | 'revealing' | 'visible'>('gate')
  const [previewHovered, setPreviewHovered] = useState(false)
  const [previewAutoLoop, setPreviewAutoLoop] = useState(true)
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop')
  const [previewReducedMotion, setPreviewReducedMotion] = useState(false)
  const normalizedSettings = useMemo(() => normalizeGateSettings(settings), [settings])
  const settingsSignature = useMemo(() => JSON.stringify(normalizedSettings), [normalizedSettings])

  useEffect(() => {
    setPreviewRunId((current) => current + 1)
  }, [settingsSignature, previewReducedMotion, previewViewport])

  useEffect(() => {
    setPreviewHovered(false)
    setPreviewStage('gate')
    const timeouts: number[] = []
    const introDelay = previewReducedMotion ? 220 : 900
    const revealDelay = introDelay + (previewReducedMotion ? 320 : defaultIntroConfig.exitDurationMs)
    const visibleDelay =
      introDelay + Math.max(Math.round(normalizedSettings.transformDurationMs * 0.84), previewReducedMotion ? 400 : 1400)
    const resetDelay = visibleDelay + 2200

    timeouts.push(
      window.setTimeout(() => {
        previewCanvasRef.current?.triggerExpansion()
      }, introDelay),
    )
    timeouts.push(
      window.setTimeout(() => {
        setPreviewStage('revealing')
      }, revealDelay),
    )
    timeouts.push(
      window.setTimeout(() => {
        setPreviewStage('visible')
      }, visibleDelay),
    )

    if (previewAutoLoop) {
      timeouts.push(
        window.setTimeout(() => {
          setPreviewRunId((current) => current + 1)
        }, resetDelay),
      )
    }

    return () => {
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId))
    }
  }, [normalizedSettings.transformDurationMs, previewAutoLoop, previewReducedMotion, previewRunId])

  useEffect(() => {
    if (previewReducedMotion || previewStage !== 'gate') {
      previewCanvasRef.current?.triggerCollapse(false)
      return
    }

    previewCanvasRef.current?.triggerCollapse(previewHovered)
  }, [previewHovered, previewReducedMotion, previewRunId, previewStage])

  const patchSettings = <K extends keyof GateSettings,>(key: K, value: GateSettings[K]) => {
    onChange(
      normalizeGateSettings({
        ...normalizedSettings,
        [key]: value,
      }),
    )
  }

  return (
    <div className="gate-settings">
      <div className="gate-settings__preview-shell">
        <div className="gate-settings__preview-head">
          <div>
            <p className="eyebrow">Live Gate Preview</p>
            <h2>Replayable intro handoff</h2>
          </div>
          <div className="gate-settings__preview-actions">
            <button className="button" type="button" onClick={() => setPreviewRunId((current) => current + 1)}>
              Replay Preview
            </button>
            <button
              className="button"
              type="button"
              onClick={() => onChange(cloneGateSettings(defaultGateSettings))}
            >
              Reset Defaults
            </button>
            <button className="button button--solid" type="button" onClick={onSave} disabled={isBusy}>
              Save Gate Settings
            </button>
          </div>
        </div>

        <div className="gate-settings__preview-toolbar">
          <label className="admin-inline-checkbox">
            <input
              type="checkbox"
              checked={previewAutoLoop}
              onChange={(event) => setPreviewAutoLoop(event.target.checked)}
            />
            Auto replay preview
          </label>
          <label className="admin-inline-checkbox">
            <input
              type="checkbox"
              checked={previewReducedMotion}
              onChange={(event) => setPreviewReducedMotion(event.target.checked)}
            />
            Reduced motion preview
          </label>
          <div className="gate-settings__viewport-toggle">
            <button
              type="button"
              className={`button ${previewViewport === 'desktop' ? 'button--solid' : ''}`}
              onClick={() => setPreviewViewport('desktop')}
            >
              Desktop
            </button>
            <button
              type="button"
              className={`button ${previewViewport === 'mobile' ? 'button--solid' : ''}`}
              onClick={() => setPreviewViewport('mobile')}
            >
              Mobile
            </button>
          </div>
        </div>

        <div
          className={`gate-preview gate-preview--${previewViewport} ${
            previewStage === 'gate' && !previewReducedMotion ? 'is-hover-reactive' : ''
          }`}
          onMouseEnter={() => setPreviewHovered(true)}
          onMouseLeave={() => setPreviewHovered(false)}
        >
          <BlackHoleCanvas
            key={`gate-preview:${previewRunId}:${settingsSignature}:${previewReducedMotion ? 'reduced' : 'full'}`}
            ref={previewCanvasRef}
            reducedMotion={previewReducedMotion}
            motionPreset={normalizedSettings.intensityPreset}
            gateSettings={normalizedSettings}
            layout="contained"
            className="gate-preview__canvas"
          />
          <div className={`gate-preview__intro ${previewStage !== 'gate' ? 'is-hidden' : ''}`}>
            <p>Interface ready</p>
            <h3>nbdevlab</h3>
            <button
              type="button"
              className={`gate-preview__enter ${previewHovered ? 'is-hovered' : ''}`}
              onFocus={() => setPreviewHovered(true)}
              onBlur={() => setPreviewHovered(false)}
            >
              ENTER
            </button>
          </div>
          <MockPreviewChrome stage={previewStage} />
        </div>
      </div>

      <div className="gate-settings__groups">
        <section className="gate-settings__group">
          <div className="gate-settings__group-head">
            <h3>Density And Motion</h3>
            <p>Controls the overall amount of matter on screen and how wide the transform spreads.</p>
          </div>

          <label className="gate-settings__field">
            <span className="gate-settings__field-head">
              <strong>Intensity Preset</strong>
              <span>{normalizedSettings.intensityPreset}</span>
            </span>
            <small>Base motion profile before the custom multipliers below are applied.</small>
            <select
              value={normalizedSettings.intensityPreset}
              onChange={(event) => patchSettings('intensityPreset', event.target.value as GateIntensityPreset)}
            >
              {intensityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <RangeField
            label="Particle Density"
            description="Total gate particles. Lower values thin out the transition cloud."
            min={0.15}
            max={1.4}
            step={0.01}
            value={normalizedSettings.particleDensity}
            onChange={(value) => patchSettings('particleDensity', value)}
            formatValue={(value) => `${Math.round(value * 100)}%`}
          />
          <RangeField
            label="Firefly Density"
            description="How many of the original particles remain alive as fireflies after the handoff."
            min={0.08}
            max={1.6}
            step={0.01}
            value={normalizedSettings.fireflyDensity}
            onChange={(value) => patchSettings('fireflyDensity', value)}
            formatValue={(value) => `${Math.round(value * 100)}%`}
          />
          <RangeField
            label="Transform Spread"
            description="How far the dissolving particle ring pushes outward before it resolves."
            min={0.2}
            max={2.6}
            step={0.01}
            value={normalizedSettings.transformSpread}
            onChange={(value) => patchSettings('transformSpread', value)}
          />
          <RangeField
            label="Transform Duration"
            description="Total lifetime of the particle transform in milliseconds."
            min={900}
            max={7000}
            step={10}
            value={normalizedSettings.transformDurationMs}
            onChange={(value) => patchSettings('transformDurationMs', value)}
            formatValue={(value) => `${Math.round(value)}ms`}
          />
        </section>

        <section className="gate-settings__group">
          <div className="gate-settings__group-head">
            <h3>Fade And Reveal Timing</h3>
            <p>Controls how early the transition cloud darkens out and when the surviving fireflies take over.</p>
          </div>

          <RangeField
            label="Firefly Blend Start"
            description="When the surviving particles stop reading like transform debris and start behaving like fireflies."
            min={0.2}
            max={0.98}
            step={0.01}
            value={normalizedSettings.fireflyBlendStart}
            onChange={(value) => patchSettings('fireflyBlendStart', value)}
          />
          <RangeField
            label="Fade To Black Start"
            description="How early the transition cloud begins fading into the black background."
            min={0}
            max={0.95}
            step={0.01}
            value={normalizedSettings.fadeToBlackStart}
            onChange={(value) => patchSettings('fadeToBlackStart', value)}
          />
          <RangeField
            label="Fade To Black End"
            description="How far through the transform the cloud should be almost fully dark."
            min={0.05}
            max={1}
            step={0.01}
            value={normalizedSettings.fadeToBlackEnd}
            onChange={(value) => patchSettings('fadeToBlackEnd', value)}
          />
          <RangeField
            label="Gate Background Fade"
            description="How aggressively the gate frame clears toward black while the dots are still orbiting."
            min={0.35}
            max={2}
            step={0.01}
            value={normalizedSettings.gateClearAlphaScale}
            onChange={(value) => patchSettings('gateClearAlphaScale', value)}
          />
          <RangeField
            label="Firefly Background Fade"
            description="How much motion blur remains behind the settled firefly layer."
            min={0.35}
            max={2}
            step={0.01}
            value={normalizedSettings.fireflyClearAlphaScale}
            onChange={(value) => patchSettings('fireflyClearAlphaScale', value)}
          />
        </section>

        <section className="gate-settings__group">
          <div className="gate-settings__group-head">
            <h3>Gate Surface</h3>
            <p>Controls the look of the gate dots and trails before the handoff begins.</p>
          </div>

          <RangeField
            label="Gate Dot Scale"
            description="Base size of the gate particles during the pre-enter state."
            min={0.35}
            max={2.5}
            step={0.01}
            value={normalizedSettings.gateDotScale}
            onChange={(value) => patchSettings('gateDotScale', value)}
          />
          <RangeField
            label="Trail Opacity"
            description="Brightness and persistence of the orbit trails around the gate."
            min={0}
            max={2.5}
            step={0.01}
            value={normalizedSettings.trailOpacityScale}
            onChange={(value) => patchSettings('trailOpacityScale', value)}
          />
          <RangeField
            label="Line Width"
            description="Thickness of drawn gate trails and transform strokes."
            min={0.3}
            max={2.2}
            step={0.01}
            value={normalizedSettings.lineWidthScale}
            onChange={(value) => patchSettings('lineWidthScale', value)}
          />
        </section>

        <section className="gate-settings__group">
          <div className="gate-settings__group-head">
            <h3>Fireflies</h3>
            <p>Controls the surviving particle swarm after the transition settles into the main page.</p>
          </div>

          <RangeField
            label="Firefly Size"
            description="Core size of each settled firefly."
            min={0.4}
            max={2.4}
            step={0.01}
            value={normalizedSettings.fireflySizeScale}
            onChange={(value) => patchSettings('fireflySizeScale', value)}
          />
          <RangeField
            label="Firefly Glow"
            description="Halo size around each firefly once the site is visible."
            min={0.35}
            max={2.8}
            step={0.01}
            value={normalizedSettings.fireflyGlowScale}
            onChange={(value) => patchSettings('fireflyGlowScale', value)}
          />
          <RangeField
            label="Drift Speed"
            description="How quickly the surviving particles meander around the page."
            min={0}
            max={2.5}
            step={0.01}
            value={normalizedSettings.fireflyDriftScale}
            onChange={(value) => patchSettings('fireflyDriftScale', value)}
          />
          <RangeField
            label="Sway Strength"
            description="How much the fireflies wobble and redirect over time."
            min={0}
            max={2.5}
            step={0.01}
            value={normalizedSettings.fireflySwayScale}
            onChange={(value) => patchSettings('fireflySwayScale', value)}
          />
          <RangeField
            label="Twinkle Speed"
            description="How quickly the fireflies pulse once they have settled."
            min={0.15}
            max={3}
            step={0.01}
            value={normalizedSettings.fireflyTwinkleScale}
            onChange={(value) => patchSettings('fireflyTwinkleScale', value)}
          />
          <RangeField
            label="Edge Padding"
            description="How close fireflies are allowed to drift toward the viewport edges."
            min={0}
            max={96}
            step={1}
            value={normalizedSettings.edgePadding}
            onChange={(value) => patchSettings('edgePadding', value)}
            formatValue={(value) => `${Math.round(value)}px`}
          />
        </section>
      </div>
    </div>
  )
}
