import type { GateIntensityPreset } from '../../shared/gateSettings'

export type IntroMode = 'gate' | 'rain'
export type GateIntensity = GateIntensityPreset
export type RainDensity = 'low' | 'medium' | 'high'
export type RainSpeed = 'slow' | 'medium' | 'fast'
export type RainOpacity = 'soft' | 'standard' | 'bright'
export type RainScale = 'compact' | 'standard' | 'large'

export interface IntroPreferences {
  mode: IntroMode
  showStatus: boolean
  showWord: boolean
  showEnterLabel: boolean
  showIntroSettingsButton: boolean
  gateIntensity: GateIntensity
  rainDensity: RainDensity
  rainSpeed: RainSpeed
  rainOpacity: RainOpacity
  rainScale: RainScale
}

export const introPreferencesStorageKey = 'nbdevlab:intro:preferences:v1'

export const defaultIntroPreferences: IntroPreferences = {
  mode: 'gate',
  showStatus: true,
  showWord: true,
  showEnterLabel: true,
  showIntroSettingsButton: true,
  gateIntensity: 'standard',
  rainDensity: 'medium',
  rainSpeed: 'medium',
  rainOpacity: 'standard',
  rainScale: 'standard',
}

function hasWindow() {
  return typeof window !== 'undefined'
}

function prefersSoftMobileGate() {
  if (!hasWindow()) {
    return false
  }

  const shortestSide = Math.min(window.innerWidth || 0, window.innerHeight || 0)
  return window.matchMedia('(max-width: 640px)').matches || shortestSide <= 540
}

export function getRuntimeIntroDefaults(): IntroPreferences {
  if (!prefersSoftMobileGate()) {
    return defaultIntroPreferences
  }

  return {
    ...defaultIntroPreferences,
    gateIntensity: 'soft',
  }
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback
}

function normalizeIntroPreferences(value: unknown, defaults: IntroPreferences): IntroPreferences {
  const source = typeof value === 'object' && value !== null ? (value as Partial<IntroPreferences>) : {}

  return {
    mode: asEnum(source.mode, ['gate', 'rain'], defaults.mode),
    showStatus: asBoolean(source.showStatus, defaults.showStatus),
    showWord: asBoolean(source.showWord, defaults.showWord),
    showEnterLabel: asBoolean(source.showEnterLabel, defaults.showEnterLabel),
    showIntroSettingsButton: asBoolean(
      source.showIntroSettingsButton,
      defaults.showIntroSettingsButton,
    ),
    gateIntensity: asEnum(
      source.gateIntensity,
      ['soft', 'standard', 'intense'],
      defaults.gateIntensity,
    ),
    rainDensity: asEnum(source.rainDensity, ['low', 'medium', 'high'], defaults.rainDensity),
    rainSpeed: asEnum(source.rainSpeed, ['slow', 'medium', 'fast'], defaults.rainSpeed),
    rainOpacity: asEnum(source.rainOpacity, ['soft', 'standard', 'bright'], defaults.rainOpacity),
    rainScale: asEnum(source.rainScale, ['compact', 'standard', 'large'], defaults.rainScale),
  }
}

export interface DigitalRainProfile {
  density: number
  minSpeed: number
  maxSpeed: number
  opacity: number
  fontSize: number
}

export function getDigitalRainProfile(preferences: IntroPreferences): DigitalRainProfile {
  const densityMap: Record<RainDensity, number> = {
    low: 0.18,
    medium: 0.28,
    high: 0.4,
  }

  const speedMap: Record<RainSpeed, { minSpeed: number; maxSpeed: number }> = {
    slow: { minSpeed: 18, maxSpeed: 44 },
    medium: { minSpeed: 24, maxSpeed: 74 },
    fast: { minSpeed: 34, maxSpeed: 96 },
  }

  const opacityMap: Record<RainOpacity, number> = {
    soft: 0.14,
    standard: 0.2,
    bright: 0.28,
  }

  const scaleMap: Record<RainScale, number> = {
    compact: 14,
    standard: 18,
    large: 22,
  }

  const speed = speedMap[preferences.rainSpeed]

  return {
    density: densityMap[preferences.rainDensity],
    minSpeed: speed.minSpeed,
    maxSpeed: speed.maxSpeed,
    opacity: opacityMap[preferences.rainOpacity],
    fontSize: scaleMap[preferences.rainScale],
  }
}

export function readIntroPreferences(): IntroPreferences {
  const defaults = getRuntimeIntroDefaults()

  if (!hasWindow()) {
    return defaults
  }

  try {
    const raw = window.localStorage.getItem(introPreferencesStorageKey)
    if (!raw) {
      window.localStorage.setItem(introPreferencesStorageKey, JSON.stringify(defaults))
      return defaults
    }

    const normalized = normalizeIntroPreferences(JSON.parse(raw), defaults)
    window.localStorage.setItem(introPreferencesStorageKey, JSON.stringify(normalized))
    return normalized
  } catch {
    return defaults
  }
}

export function writeIntroPreferences(preferences: IntroPreferences) {
  if (!hasWindow()) {
    return
  }

  try {
    window.localStorage.setItem(introPreferencesStorageKey, JSON.stringify(preferences))
  } catch {
    // Ignore storage failures and keep the current runtime settings.
  }
}
