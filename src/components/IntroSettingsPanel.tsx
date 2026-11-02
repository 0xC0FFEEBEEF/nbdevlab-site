import { useEffect } from 'react'
import type {
  IntroMode,
  IntroPreferences,
  RainDensity,
  RainOpacity,
  RainScale,
  RainSpeed,
} from '../lib/introPreferences'

interface IntroSettingsPanelProps {
  open: boolean
  preferences: IntroPreferences
  onClose: () => void
  onPatch: (patch: Partial<IntroPreferences>) => void
  onPreviewIntro: () => void
}

interface ChoiceOption<T extends string> {
  value: T
  label: string
}

const modeOptions: ChoiceOption<IntroMode>[] = [
  { value: 'gate', label: 'New Gate' },
  { value: 'rain', label: 'Rain Screen' },
]

const rainDensityOptions: ChoiceOption<RainDensity>[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

const rainSpeedOptions: ChoiceOption<RainSpeed>[] = [
  { value: 'slow', label: 'Slow' },
  { value: 'medium', label: 'Medium' },
  { value: 'fast', label: 'Fast' },
]

const rainOpacityOptions: ChoiceOption<RainOpacity>[] = [
  { value: 'soft', label: 'Soft' },
  { value: 'standard', label: 'Standard' },
  { value: 'bright', label: 'Bright' },
]

const rainScaleOptions: ChoiceOption<RainScale>[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'standard', label: 'Standard' },
  { value: 'large', label: 'Large' },
]

function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: ChoiceOption<T>[]
  onChange: (value: T) => void
}) {
  return (
    <section className="intro-settings__section">
      <div className="intro-settings__section-head">
        <p>{label}</p>
      </div>
      <div className="intro-settings__choices" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`intro-settings__choice ${value === option.value ? 'is-active' : ''}`}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="intro-settings__toggle">
      <span className="intro-settings__toggle-copy">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <span className={`intro-settings__switch ${checked ? 'is-on' : ''}`}>
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} />
        <span aria-hidden="true" />
      </span>
    </label>
  )
}

export function IntroSettingsPanel({
  open,
  preferences,
  onClose,
  onPatch,
  onPreviewIntro,
}: IntroSettingsPanelProps) {
  useEffect(() => {
    if (!open) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose, open])

  if (!open) {
    return null
  }

  return (
    <div className="intro-settings" data-open="true">
      <button
        type="button"
        className="intro-settings__scrim"
        aria-label="Close intro settings"
        onClick={onClose}
      />

      <aside
        className="intro-settings__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="intro-settings-title"
      >
        <div className="intro-settings__header">
          <div>
            <p className="intro-settings__eyebrow">Intro Controls</p>
            <h2 id="intro-settings-title">Intro settings</h2>
          </div>
          <button type="button" className="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="intro-settings__body">
          <ChoiceGroup
            label="Default intro mode"
            value={preferences.mode}
            options={modeOptions}
            onChange={(mode) => onPatch({ mode })}
          />

          <section className="intro-settings__section">
            <div className="intro-settings__section-head intro-settings__section-head--split">
              <p>Preview</p>
              <button type="button" className="button button--solid" onClick={onPreviewIntro}>
                Preview Intro
              </button>
            </div>
            <p className="intro-settings__hint">
              Play the selected intro again.
            </p>
          </section>

          <section className="intro-settings__section">
            <div className="intro-settings__section-head">
              <p>Display</p>
            </div>
            <div className="intro-settings__toggles">
              <ToggleRow
                label="Status label"
                description="Show the label above the wordmark."
                checked={preferences.showStatus}
                onChange={(showStatus) => onPatch({ showStatus })}
              />
              <ToggleRow
                label="Title wordmark"
                description="Show the nbdevlab wordmark."
                checked={preferences.showWord}
                onChange={(showWord) => onPatch({ showWord })}
              />
              <ToggleRow
                label="Enter CTA"
                description="Show the enter prompt."
                checked={preferences.showEnterLabel}
                onChange={(showEnterLabel) => onPatch({ showEnterLabel })}
              />
              <ToggleRow
                label="Intro gear button"
                description="Show the settings button during the intro."
                checked={preferences.showIntroSettingsButton}
                onChange={(showIntroSettingsButton) => onPatch({ showIntroSettingsButton })}
              />
            </div>
          </section>

          {preferences.mode === 'rain' ? (
            <>
              <ChoiceGroup
                label="Rain density"
                value={preferences.rainDensity}
                options={rainDensityOptions}
                onChange={(rainDensity) => onPatch({ rainDensity })}
              />
              <ChoiceGroup
                label="Rain speed"
                value={preferences.rainSpeed}
                options={rainSpeedOptions}
                onChange={(rainSpeed) => onPatch({ rainSpeed })}
              />
              <ChoiceGroup
                label="Rain opacity"
                value={preferences.rainOpacity}
                options={rainOpacityOptions}
                onChange={(rainOpacity) => onPatch({ rainOpacity })}
              />
              <ChoiceGroup
                label="Glyph size"
                value={preferences.rainScale}
                options={rainScaleOptions}
                onChange={(rainScale) => onPatch({ rainScale })}
              />
            </>
          ) : null}
        </div>
      </aside>
    </div>
  )
}
