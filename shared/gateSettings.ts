export type GateIntensityPreset = 'soft' | 'standard' | 'intense'

export interface GateSettings {
  intensityPreset: GateIntensityPreset
  particleDensity: number
  fireflyDensity: number
  transformDurationMs: number
  transformSpread: number
  fireflyBlendStart: number
  fadeToBlackStart: number
  fadeToBlackEnd: number
  gateDotScale: number
  trailOpacityScale: number
  gateClearAlphaScale: number
  fireflyClearAlphaScale: number
  lineWidthScale: number
  fireflySizeScale: number
  fireflyGlowScale: number
  fireflyDriftScale: number
  fireflySwayScale: number
  fireflyTwinkleScale: number
  edgePadding: number
}

export const defaultGateSettings: GateSettings = {
  intensityPreset: 'standard',
  particleDensity: 0.5,
  fireflyDensity: 0.5,
  transformDurationMs: 3200,
  transformSpread: 1,
  fireflyBlendStart: 0.68,
  fadeToBlackStart: 0.34,
  fadeToBlackEnd: 0.7,
  gateDotScale: 1,
  trailOpacityScale: 1,
  gateClearAlphaScale: 1,
  fireflyClearAlphaScale: 1,
  lineWidthScale: 1,
  fireflySizeScale: 1,
  fireflyGlowScale: 1,
  fireflyDriftScale: 1,
  fireflySwayScale: 1,
  fireflyTwinkleScale: 1,
  edgePadding: 18,
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function asNumber(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value) ? clampNumber(value, min, max) : fallback
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback
}

export function cloneGateSettings(settings: GateSettings = defaultGateSettings): GateSettings {
  return { ...settings }
}

export function normalizeGateSettings(
  value: unknown,
  defaults: GateSettings = defaultGateSettings,
): GateSettings {
  const source = typeof value === 'object' && value !== null ? (value as Partial<GateSettings>) : {}

  const fadeToBlackStart = asNumber(source.fadeToBlackStart, defaults.fadeToBlackStart, 0, 0.95)
  const fadeToBlackEnd = asNumber(source.fadeToBlackEnd, defaults.fadeToBlackEnd, fadeToBlackStart + 0.02, 1)

  return {
    intensityPreset: asEnum(source.intensityPreset, ['soft', 'standard', 'intense'], defaults.intensityPreset),
    particleDensity: asNumber(source.particleDensity, defaults.particleDensity, 0.15, 1.4),
    fireflyDensity: asNumber(source.fireflyDensity, defaults.fireflyDensity, 0.08, 1.6),
    transformDurationMs: asNumber(source.transformDurationMs, defaults.transformDurationMs, 900, 7000),
    transformSpread: asNumber(source.transformSpread, defaults.transformSpread, 0.2, 2.6),
    fireflyBlendStart: asNumber(source.fireflyBlendStart, defaults.fireflyBlendStart, 0.2, 0.98),
    fadeToBlackStart,
    fadeToBlackEnd,
    gateDotScale: asNumber(source.gateDotScale, defaults.gateDotScale, 0.35, 2.5),
    trailOpacityScale: asNumber(source.trailOpacityScale, defaults.trailOpacityScale, 0, 2.5),
    gateClearAlphaScale: asNumber(source.gateClearAlphaScale, defaults.gateClearAlphaScale, 0.35, 2),
    fireflyClearAlphaScale: asNumber(source.fireflyClearAlphaScale, defaults.fireflyClearAlphaScale, 0.35, 2),
    lineWidthScale: asNumber(source.lineWidthScale, defaults.lineWidthScale, 0.3, 2.2),
    fireflySizeScale: asNumber(source.fireflySizeScale, defaults.fireflySizeScale, 0.4, 2.4),
    fireflyGlowScale: asNumber(source.fireflyGlowScale, defaults.fireflyGlowScale, 0.35, 2.8),
    fireflyDriftScale: asNumber(source.fireflyDriftScale, defaults.fireflyDriftScale, 0, 2.5),
    fireflySwayScale: asNumber(source.fireflySwayScale, defaults.fireflySwayScale, 0, 2.5),
    fireflyTwinkleScale: asNumber(source.fireflyTwinkleScale, defaults.fireflyTwinkleScale, 0.15, 3),
    edgePadding: asNumber(source.edgePadding, defaults.edgePadding, 0, 96),
  }
}
