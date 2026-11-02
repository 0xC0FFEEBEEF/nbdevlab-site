import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { GateIntensity } from '../lib/introPreferences'
import { defaultGateSettings, normalizeGateSettings, type GateSettings } from '../../shared/gateSettings'

export interface BlackHoleCanvasHandle {
  triggerCollapse: (on: boolean) => void
  triggerExpansion: () => void
}

interface BlackHoleCanvasProps {
  reducedMotion?: boolean
  startInFireflies?: boolean
  gateRevealProgress?: number
  motionPreset?: GateIntensity
  gateSettings?: GateSettings
  layout?: 'fixed' | 'contained'
  className?: string
}

type BlackHoleVisualState = 'gate' | 'hover' | 'transforming' | 'fireflies'

const BASE_MAX_ORBIT = 255
const BACKGROUND_COLOR = 'rgba(0,0,0,'
const TRANSFORM_SPEED_SCALE = 0.42
const TRANSFORM_SETTLE_START = 0.32
const CARD_MASK_DELAY_MS = 720
const CARD_MASK_FADE_MS = 420
const CARD_MASK_PADDING = 18
const FIREFLY_SWAY_FORCE = 0.000024
const FIREFLY_MAX_SPEED_X = 0.024
const FIREFLY_MAX_SPEED_Y = 0.018
const FIRELFY_CARD_MASK_SELECTOR = [
  '.home-card',
  '.home-status-teaser__metric',
  '.home-hero-project',
  '.project-card',
  '.project-detail-modal__panel',
  '.project-detail-modal__nav-button',
  '.skill-card',
  '.status-metric-card',
  '.status-panel',
  '.status-guest-card',
  '.status-node-card',
  '.status-endpoint-card',
  '.status-power-card',
  '.status-compact-stat',
  '.status-compact-item',
].join(', ')

interface Star {
  baseRadius: number
  currentRadius: number
  hoverRadius: number
  spreadBoost: number
  speed: number
  startRotation: number
  trailAlpha: number
  fireflySize: number
  becomesFirefly: boolean
  targetX: number
  targetY: number
  prevX: number
  prevY: number
  currentX: number
  currentY: number
  driftX: number
  driftY: number
  flutterPhaseX: number
  flutterPhaseY: number
  flutterSpeedX: number
  flutterSpeedY: number
  twinkleOffset: number
  twinkleSpeed: number
  travelStart: number
  travelEnd: number
  fadeStart: number
  fadeEnd: number
  fireflyBlendStart: number
  fireflyBlendEnd: number
  spreadEnd: number
}

interface FieldProfile {
  particleCount: number
  fireflyCount: number
  gateClearAlpha: number
  fireflyClearAlpha: number
  lineWidth: number
  trailOpacityScale: number
  minTrailAlpha: number
  gateDotAlphaScale: number
  gateDotSize: number
}

interface GateGeometry {
  centerY: number
  maxOrbit: number
}

interface FireflyMaskRect {
  x: number
  y: number
  width: number
  height: number
  radius: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress
}

function easeOutQuart(progress: number) {
  return 1 - (1 - progress) ** 4
}

function easeInOutCubic(progress: number) {
  return progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2
}

function fillRoundedRect(ctx: CanvasRenderingContext2D, rect: FireflyMaskRect) {
  ctx.beginPath()

  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(rect.x, rect.y, rect.width, rect.height, rect.radius)
  } else {
    const radius = Math.min(rect.radius, rect.width / 2, rect.height / 2)

    ctx.moveTo(rect.x + radius, rect.y)
    ctx.lineTo(rect.x + rect.width - radius, rect.y)
    ctx.quadraticCurveTo(rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + radius)
    ctx.lineTo(rect.x + rect.width, rect.y + rect.height - radius)
    ctx.quadraticCurveTo(
      rect.x + rect.width,
      rect.y + rect.height,
      rect.x + rect.width - radius,
      rect.y + rect.height,
    )
    ctx.lineTo(rect.x + radius, rect.y + rect.height)
    ctx.quadraticCurveTo(rect.x, rect.y + rect.height, rect.x, rect.y + rect.height - radius)
    ctx.lineTo(rect.x, rect.y + radius)
    ctx.quadraticCurveTo(rect.x, rect.y, rect.x + radius, rect.y)
  }

  ctx.fill()
}

function getGateGeometry(width: number, height: number): GateGeometry {
  const shortestSide = Math.min(width, height)
  const isPhoneViewport = width <= 640
  const isPortrait = height >= width
  const isTallPhone = isPhoneViewport && height > width * 1.45

  if (!isPhoneViewport) {
    return {
      centerY: height / 2,
      maxOrbit: BASE_MAX_ORBIT,
    }
  }

  const maxOrbit = isPortrait
    ? Math.min(BASE_MAX_ORBIT, width * 0.42, height * 0.3)
    : Math.min(BASE_MAX_ORBIT, shortestSide * 0.34)

  const upwardOffset = isTallPhone ? Math.min(height * 0.055, 46) : Math.min(height * 0.035, 28)

  return {
    centerY: height / 2 - upwardOffset,
    maxOrbit,
  }
}

function createViewportTarget(width: number, height: number, padding: number) {
  const margin = Math.max(0, padding)
  return {
    x: margin + Math.random() * Math.max(width - margin * 2, 1),
    y: margin + Math.random() * Math.max(height - margin * 2, 1),
  }
}

function getFieldProfile(
  width: number,
  height: number,
  reducedMotion: boolean,
  motionPreset: GateIntensity,
  gateSettings: GateSettings,
): FieldProfile {
  const area = width * height
  const compactViewport = width < 720 || Math.min(width, height) < 540
  const ultraCompactViewport = width < 540 || Math.min(width, height) < 430

  const reducedProfile = reducedMotion
    ? {
      particleCount: clamp(Math.round(area / (ultraCompactViewport ? 1450 : 1400)), ultraCompactViewport ? 150 : 180, compactViewport ? 420 : 760),
      fireflyCount: clamp(Math.round(area / 96_000), ultraCompactViewport ? 8 : 10, compactViewport ? 18 : 22),
      gateClearAlpha: ultraCompactViewport ? 0.24 : compactViewport ? 0.32 : 0.22,
      fireflyClearAlpha: 0.3,
      lineWidth: ultraCompactViewport ? 0.64 : compactViewport ? 0.56 : 0.76,
      trailOpacityScale: ultraCompactViewport ? 0.3 : compactViewport ? 0.2 : 0.3,
      minTrailAlpha: ultraCompactViewport ? 0.024 : 0.018,
      gateDotAlphaScale: ultraCompactViewport ? 1.2 : compactViewport ? 0.22 : 0,
      gateDotSize: ultraCompactViewport ? 1.02 : compactViewport ? 0.72 : 0,
    }
    : null

  const baseProfile =
    reducedProfile ??
    {
    particleCount: clamp(
      Math.round(area / (ultraCompactViewport ? 1180 : compactViewport ? 920 : 760)),
      ultraCompactViewport ? 260 : compactViewport ? 280 : 760,
      ultraCompactViewport ? 520 : compactViewport ? 560 : 1500,
    ),
    fireflyCount: clamp(Math.round(area / 80_000), ultraCompactViewport ? 10 : 12, compactViewport ? 20 : 32),
    gateClearAlpha: ultraCompactViewport ? 0.19 : compactViewport ? 0.3 : 0.18,
    fireflyClearAlpha: ultraCompactViewport ? 0.32 : compactViewport ? 0.3 : 0.24,
    lineWidth: ultraCompactViewport ? 0.74 : compactViewport ? 0.56 : clamp(Math.min(width, height) / 940, 0.82, 1),
    trailOpacityScale: ultraCompactViewport ? 0.46 : compactViewport ? 0.24 : 0.52,
    minTrailAlpha: ultraCompactViewport ? 0.032 : compactViewport ? 0.015 : 0.03,
    gateDotAlphaScale: ultraCompactViewport ? 1.64 : compactViewport ? 0.28 : 0,
    gateDotSize: ultraCompactViewport ? 1.18 : compactViewport ? 0.78 : 0,
  }

  const intensityProfile =
    reducedMotion || motionPreset === 'standard'
      ? baseProfile
      : motionPreset === 'soft'
        ? {
            ...baseProfile,
            particleCount: Math.max(180, Math.round(baseProfile.particleCount * 0.78)),
            fireflyCount: Math.max(8, Math.round(baseProfile.fireflyCount * 0.9)),
            gateClearAlpha: clamp(baseProfile.gateClearAlpha + 0.05, 0.16, 0.62),
            lineWidth: Math.max(0.42, baseProfile.lineWidth * 0.9),
            trailOpacityScale: baseProfile.trailOpacityScale * 0.82,
            gateDotAlphaScale: baseProfile.gateDotAlphaScale * 0.9,
          }
        : {
            ...baseProfile,
            particleCount: Math.min(1700, Math.round(baseProfile.particleCount * 1.14)),
            fireflyCount: Math.min(42, Math.round(baseProfile.fireflyCount * 1.08)),
            gateClearAlpha: clamp(baseProfile.gateClearAlpha - 0.03, 0.1, 0.42),
            lineWidth: baseProfile.lineWidth * 1.08,
            trailOpacityScale: baseProfile.trailOpacityScale * 1.12,
            gateDotAlphaScale: baseProfile.gateDotAlphaScale * 1.08,
          }

  const particleCount = clamp(
    Math.round(intensityProfile.particleCount * gateSettings.particleDensity),
    reducedMotion ? 48 : 72,
    2200,
  )
  const fireflyCount = clamp(
    Math.round(intensityProfile.fireflyCount * gateSettings.fireflyDensity),
    4,
    Math.max(4, particleCount),
  )

  return {
    ...intensityProfile,
    particleCount,
    fireflyCount,
    gateClearAlpha: clamp(intensityProfile.gateClearAlpha * gateSettings.gateClearAlphaScale, 0.06, 0.82),
    fireflyClearAlpha: clamp(intensityProfile.fireflyClearAlpha * gateSettings.fireflyClearAlphaScale, 0.06, 0.84),
    lineWidth: Math.max(0.12, intensityProfile.lineWidth * gateSettings.lineWidthScale),
    trailOpacityScale: intensityProfile.trailOpacityScale * gateSettings.trailOpacityScale,
    gateDotSize: intensityProfile.gateDotSize * gateSettings.gateDotScale,
  }
}

function seedFireflyMotion(reducedMotion: boolean, gateSettings: GateSettings) {
  const angle = Math.random() * Math.PI * 2
  const speed = reducedMotion ? 0 : (0.0036 + Math.random() * 0.0068) * gateSettings.fireflyDriftScale
  return {
    driftX: Math.cos(angle) * speed,
    driftY: Math.sin(angle) * speed * 0.82,
    flutterPhaseX: Math.random() * Math.PI * 2,
    flutterPhaseY: Math.random() * Math.PI * 2,
    flutterSpeedX: 0.44 + Math.random() * 1.08,
    flutterSpeedY: 0.36 + Math.random() * 0.92,
    twinkleOffset: Math.random() * Math.PI * 2,
    twinkleSpeed: (0.75 + Math.random() * 1.5) * gateSettings.fireflyTwinkleScale,
  }
}

function advanceFirefly(
  star: Star,
  width: number,
  height: number,
  timestamp: number,
  deltaMs: number,
  reducedMotion: boolean,
  gateSettings: GateSettings,
) {
  if (!reducedMotion) {
    const swayX =
      Math.sin(timestamp * 0.001 * star.flutterSpeedX + star.flutterPhaseX) *
      FIREFLY_SWAY_FORCE *
      gateSettings.fireflySwayScale
    const swayY =
      Math.cos(timestamp * 0.001 * star.flutterSpeedY + star.flutterPhaseY) *
      FIREFLY_SWAY_FORCE *
      gateSettings.fireflySwayScale

    const maxSpeedX = FIREFLY_MAX_SPEED_X * Math.max(gateSettings.fireflyDriftScale, 0.2)
    const maxSpeedY = FIREFLY_MAX_SPEED_Y * Math.max(gateSettings.fireflyDriftScale, 0.2)
    star.driftX = clamp(star.driftX * 0.992 + swayX * deltaMs, -maxSpeedX, maxSpeedX)
    star.driftY = clamp(star.driftY * 0.992 + swayY * deltaMs, -maxSpeedY, maxSpeedY)
    star.currentX += star.driftX * deltaMs
    star.currentY += star.driftY * deltaMs
  }

  const edgePadding = gateSettings.edgePadding
  const minX = edgePadding
  const maxX = Math.max(minX, width - edgePadding)
  const minY = edgePadding
  const maxY = Math.max(minY, height - edgePadding)

  if (star.currentX <= minX) {
    star.currentX = minX
    star.driftX = Math.abs(star.driftX) * 0.92
  } else if (star.currentX >= maxX) {
    star.currentX = maxX
    star.driftX = -Math.abs(star.driftX) * 0.92
  }

  if (star.currentY <= minY) {
    star.currentY = minY
    star.driftY = Math.abs(star.driftY) * 0.92
  } else if (star.currentY >= maxY) {
    star.currentY = maxY
    star.driftY = -Math.abs(star.driftY) * 0.92
  }
}

export const BlackHoleCanvas = forwardRef<BlackHoleCanvasHandle, BlackHoleCanvasProps>(
  function BlackHoleCanvas(
    {
      reducedMotion = false,
      startInFireflies = false,
      gateRevealProgress = 1,
      motionPreset = 'standard',
      gateSettings = defaultGateSettings,
      layout = 'fixed',
      className,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const starsRef = useRef<Star[]>([])
    const protectedRectsRef = useRef<FireflyMaskRect[]>([])
    const protectedRectsDirtyRef = useRef(true)
    const lastProtectedRectsMeasureRef = useRef(0)
    const resolvedGateSettings = useMemo(() => normalizeGateSettings(gateSettings), [gateSettings])
    const gateRevealProgressRef = useRef(startInFireflies ? 1 : clamp(gateRevealProgress, 0, 1))
    const [visualState, setVisualState] = useState<BlackHoleVisualState>(startInFireflies ? 'fireflies' : 'gate')
    const stateRef = useRef({
      collapse: false,
      transforming: false,
      fireflies: startInFireflies,
      transformStartMs: startInFireflies ? -1 : 0,
      firefliesStartMs: startInFireflies ? 0 : -1,
    })

    useEffect(() => {
      gateRevealProgressRef.current = startInFireflies ? 1 : clamp(gateRevealProgress, 0, 1)
    }, [gateRevealProgress, startInFireflies])

    useImperativeHandle(ref, () => ({
      triggerCollapse(on: boolean) {
        if (stateRef.current.transforming || stateRef.current.fireflies) {
          return
        }

        stateRef.current.collapse = on
        setVisualState(on ? 'hover' : 'gate')
      },
      triggerExpansion() {
        if (stateRef.current.transforming || stateRef.current.fireflies) {
          return
        }

        for (const star of starsRef.current) {
          star.prevX = star.currentX
          star.prevY = star.currentY
        }

        stateRef.current.collapse = false
        stateRef.current.transforming = true
        stateRef.current.fireflies = false
        stateRef.current.transformStartMs = performance.now()
        stateRef.current.firefliesStartMs = -1
        setVisualState('transforming')
      },
    }))

    useEffect(() => {
      const container = containerRef.current
      if (!container) {
        return
      }

      const canvas = document.createElement('canvas')
      container.appendChild(canvas)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return
      }

      let width = 0
      let height = 0
      let centerX = 0
      let centerY = 0
      let maxOrbit = BASE_MAX_ORBIT
      let frameId = 0
      let lastTimestamp = performance.now()
      let fieldProfile = getFieldProfile(
        window.innerWidth,
        window.innerHeight,
        reducedMotion,
        motionPreset,
        resolvedGateSettings,
      )

      const sizeCanvas = () => {
        const ratio = Math.min(window.devicePixelRatio || 1, 2)
        const rect = container.getBoundingClientRect()
        width = rect.width
        height = rect.height
        canvas.width = Math.floor(width * ratio)
        canvas.height = Math.floor(height * ratio)
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
        centerX = width / 2
        const geometry = getGateGeometry(width, height)
        centerY = geometry.centerY
        maxOrbit = geometry.maxOrbit
        fieldProfile = getFieldProfile(width, height, reducedMotion, motionPreset, resolvedGateSettings)
      }

      const buildStars = () => {
        const startAsFireflies = stateRef.current.fireflies
        const fireflyStride = Math.max(1, Math.round(fieldProfile.particleCount / fieldProfile.fireflyCount))

        starsRef.current = Array.from({ length: fieldProfile.particleCount }, (_, index) => {
          const r1 = Math.random() * (maxOrbit / 2) + 1
          const r2 = Math.random() * (maxOrbit / 2) + maxOrbit
          const orbital = (r1 + r2) / 2
          const speed = (Math.floor(Math.random() * 2.5) + 1.5) * Math.PI / 180
          const startRotation = (Math.floor(Math.random() * 360) + 1) * Math.PI / 180
          let collapseBonus = orbital - maxOrbit * 0.7
          if (collapseBonus < 0) {
            collapseBonus = 0
          }

          const target = createViewportTarget(width, height, resolvedGateSettings.edgePadding)
          const motion = seedFireflyMotion(reducedMotion, resolvedGateSettings)
          const orbitX = centerX + Math.cos(startRotation) * orbital
          const orbitY = centerY + Math.sin(startRotation) * orbital
          const becomesFirefly = index % fireflyStride === 0
          const radialBias = clamp(orbital / Math.max(maxOrbit, 1), 0, 1)
          const cadenceGroup = index % 4
          const cadenceOffset = [-0.1, -0.02, 0.06, 0.14][cadenceGroup]
          const travelWindow = [0.84, 0.72, 0.6, 0.5][cadenceGroup]
          const spreadWindow = [0.72, 0.62, 0.52, 0.46][cadenceGroup]
          const fadeWindow = [0.54, 0.44, 0.36, 0.28][cadenceGroup]
          const fireflyBlendWindow = [0.34, 0.28, 0.22, 0.18][cadenceGroup]
          const timingBias = cadenceOffset + (Math.random() - 0.5) * 0.04 + (radialBias - 0.5) * 0.05
          const travelStart = clamp(0.12 + timingBias * 0.7, 0.02, 0.3)
          const travelEnd = clamp(
            travelStart + travelWindow + (0.5 - radialBias) * 0.08 + Math.random() * 0.04,
            travelStart + 0.28,
            1,
          )
          const spreadEnd = clamp(
            travelStart * 0.44 + spreadWindow + (0.5 - radialBias) * 0.06 + Math.random() * 0.04,
            0.28,
            0.96,
          )
          const fadeStart = clamp(
            resolvedGateSettings.fadeToBlackStart + timingBias * 0.42 + radialBias * 0.05,
            0.18,
            0.9,
          )
          const fadeEnd = clamp(
            Math.max(
              fadeStart + 0.16,
              fadeStart + fadeWindow + radialBias * 0.08 + Math.random() * 0.04,
              resolvedGateSettings.fadeToBlackEnd + cadenceOffset * 0.28,
            ),
            fadeStart + 0.16,
            1,
          )
          const fireflyBlendStart = clamp(
            resolvedGateSettings.fireflyBlendStart + cadenceOffset * 0.38 - radialBias * 0.04,
            0.24,
            0.94,
          )
          const fireflyBlendEnd = clamp(
            Math.max(
              fireflyBlendStart + 0.12,
              fireflyBlendStart + fireflyBlendWindow + Math.random() * 0.03,
            ),
            fireflyBlendStart + 0.12,
            1,
          )

          return {
            baseRadius: orbital,
            currentRadius: orbital,
            hoverRadius: maxOrbit / 2 + collapseBonus,
            spreadBoost:
              (120 + Math.random() * (Math.min(width, height) * 0.22)) *
              resolvedGateSettings.transformSpread,
            speed,
            startRotation,
            trailAlpha: Math.max(fieldProfile.minTrailAlpha, (1 - orbital / 255) * fieldProfile.trailOpacityScale),
            fireflySize: (0.7 + Math.random() * 1.25) * resolvedGateSettings.fireflySizeScale,
            becomesFirefly,
            targetX: target.x,
            targetY: target.y,
            prevX: startAsFireflies ? target.x : orbitX,
            prevY: startAsFireflies ? target.y : orbitY,
            currentX: startAsFireflies ? target.x : orbitX,
            currentY: startAsFireflies ? target.y : orbitY,
            driftX: motion.driftX,
            driftY: motion.driftY,
            flutterPhaseX: motion.flutterPhaseX,
            flutterPhaseY: motion.flutterPhaseY,
            flutterSpeedX: motion.flutterSpeedX,
            flutterSpeedY: motion.flutterSpeedY,
            twinkleOffset: motion.twinkleOffset,
            twinkleSpeed: motion.twinkleSpeed,
            travelStart,
            travelEnd,
            fadeStart,
            fadeEnd,
            fireflyBlendStart,
            fireflyBlendEnd,
            spreadEnd,
          }
        })
      }

      const measureProtectedRects = (measureTimestamp: number) => {
        const elements = Array.from(document.querySelectorAll<HTMLElement>(FIRELFY_CARD_MASK_SELECTOR))
        const padding = width <= 640 ? Math.max(CARD_MASK_PADDING - 6, 10) : CARD_MASK_PADDING

        protectedRectsRef.current = elements
          .map((element) => {
            const rect = element.getBoundingClientRect()
            if (rect.width < 8 || rect.height < 8) {
              return null
            }

            const styles = window.getComputedStyle(element)
            if (styles.display === 'none' || styles.visibility === 'hidden' || Number(styles.opacity) < 0.01) {
              return null
            }

            const x = clamp(rect.left - padding, 0, width)
            const y = clamp(rect.top - padding, 0, height)
            const right = clamp(rect.right + padding, 0, width)
            const bottom = clamp(rect.bottom + padding, 0, height)
            const measuredWidth = right - x
            const measuredHeight = bottom - y

            if (measuredWidth < 8 || measuredHeight < 8) {
              return null
            }

            const borderRadius = Number.parseFloat(styles.borderTopLeftRadius) || 0

            return {
              x,
              y,
              width: measuredWidth,
              height: measuredHeight,
              radius: borderRadius + padding,
            }
          })
          .filter((rect): rect is FireflyMaskRect => rect !== null)

        protectedRectsDirtyRef.current = false
        lastProtectedRectsMeasureRef.current = measureTimestamp
      }

      sizeCanvas()
      buildStars()

      const resizeObserver = new ResizeObserver(() => {
        sizeCanvas()
        buildStars()
      })

      resizeObserver.observe(container)

      const markProtectedRectsDirty = () => {
        protectedRectsDirtyRef.current = true
      }

      const mutationObserver = new MutationObserver(markProtectedRectsDirty)
      mutationObserver.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'data-state'],
      })

      window.addEventListener('scroll', markProtectedRectsDirty, { passive: true })
      window.addEventListener('resize', markProtectedRectsDirty)

      const startTime = performance.now()

      const draw = (timestamp: number) => {
        const deltaMs = Math.min(timestamp - lastTimestamp, 32)
        lastTimestamp = timestamp

        const currentTime = (timestamp - startTime) / 50
        const state = stateRef.current
        const transformProgress =
          state.transforming && state.transformStartMs > 0
            ? clamp((timestamp - state.transformStartMs) / resolvedGateSettings.transformDurationMs, 0, 1)
            : state.fireflies
              ? 1
              : 0
        const transformEase = easeOutQuart(transformProgress)
        const transformSettleEase = easeOutQuart(
          clamp((transformProgress - TRANSFORM_SETTLE_START) / (1 - TRANSFORM_SETTLE_START), 0, 1),
        )
        const transformSpeedScale = lerp(1, TRANSFORM_SPEED_SCALE, transformEase)
        const gateReveal =
          state.transforming || state.fireflies
            ? 1
            : Math.pow(clamp(gateRevealProgressRef.current, 0, 1), 1.45)
        const settledGate = !state.transforming && !state.fireflies && !state.collapse && gateReveal >= 0.995
        const clearAlpha = state.fireflies
          ? fieldProfile.fireflyClearAlpha
          : state.transforming
            ? lerp(
                clamp(fieldProfile.gateClearAlpha + 0.05, 0.14, 0.3),
                clamp(fieldProfile.fireflyClearAlpha * 0.8, 0.08, 0.34),
                easeInOutCubic(clamp((transformProgress - 0.58) / 0.32, 0, 1)),
              )
            : settledGate
              ? clamp(fieldProfile.gateClearAlpha + 0.24, fieldProfile.gateClearAlpha, 0.52)
              : fieldProfile.gateClearAlpha

        if (state.transforming && transformProgress >= 1) {
          for (const star of starsRef.current) {
            star.prevX = star.currentX
            star.prevY = star.currentY
          }
          state.transforming = false
          state.fireflies = true
          state.firefliesStartMs = timestamp
          setVisualState('fireflies')
        }

        if (state.fireflies && state.firefliesStartMs < 0) {
          state.firefliesStartMs = timestamp
        }

        if (
          state.fireflies &&
          (protectedRectsDirtyRef.current || timestamp - lastProtectedRectsMeasureRef.current > 160)
        ) {
          measureProtectedRects(timestamp)
        }

        ctx.globalCompositeOperation = 'source-over'
        ctx.fillStyle = `${BACKGROUND_COLOR}${clearAlpha})`
        ctx.fillRect(0, 0, width, height)
        ctx.globalCompositeOperation = 'screen'
        ctx.lineWidth =
          state.transforming || state.fireflies
            ? fieldProfile.lineWidth
            : lerp(Math.max(fieldProfile.lineWidth * 0.38, 0.16), fieldProfile.lineWidth, gateReveal)
        ctx.lineCap = 'round'

        for (const star of starsRef.current) {
          const orbitRadius =
            state.collapse && !state.transforming && !state.fireflies
              ? lerp(star.currentRadius, star.hoverRadius, 0.18)
              : lerp(star.currentRadius, star.baseRadius, 0.12)
          star.currentRadius = orbitRadius

          const orbitAngle =
            star.startRotation + currentTime * star.speed * (state.transforming ? transformSpeedScale : 1)
          const spreadProgress = state.transforming
            ? easeOutQuart(
                clamp(
                  (transformProgress - star.travelStart * 0.38) /
                    Math.max(star.spreadEnd - star.travelStart * 0.38, 0.12),
                  0,
                  1,
                ),
              )
            : Math.min(transformProgress / 0.32, 1)
          const expandedRadius = orbitRadius + star.spreadBoost * spreadProgress
          const orbitX = centerX + Math.cos(orbitAngle) * expandedRadius
          const orbitY = centerY + Math.sin(orbitAngle) * expandedRadius

          let drawX = orbitX
          let drawY = orbitY
          let trailAlpha = state.transforming || state.fireflies ? 0 : star.trailAlpha * gateReveal
          let dotAlpha = 0

          if (state.transforming) {
            const travelProgress = clamp(
              (transformProgress - star.travelStart) / Math.max(star.travelEnd - star.travelStart, 0.02),
              0,
              1,
            )
            const travelEase = easeInOutCubic(travelProgress)
            const fireflyBlend = star.becomesFirefly
              ? easeOutQuart(
                  clamp(
                    (transformProgress - star.fireflyBlendStart) /
                      Math.max(star.fireflyBlendEnd - star.fireflyBlendStart, 0.06),
                    0,
                    1,
                  ),
                )
              : 0
            const fadeToBlack = easeOutQuart(
              clamp(
                (transformProgress - star.fadeStart) /
                  Math.max(star.fadeEnd - star.fadeStart, 0.02),
                0,
                1,
              ),
            )
            const fadeOut =
              star.becomesFirefly
                ? 1
                : 1 -
                  easeOutQuart(
                    clamp(
                      (transformProgress - Math.min(star.fadeStart + 0.08, 0.96)) /
                        Math.max(star.fadeEnd - Math.min(star.fadeStart + 0.08, 0.96), 0.08),
                      0,
                      1,
                    ),
                  )
            const twinkle =
              0.66 + 0.34 * Math.sin(timestamp * 0.001 * star.twinkleSpeed + star.twinkleOffset)

            const transformX = lerp(orbitX, star.targetX, travelEase)
            const transformY = lerp(orbitY, star.targetY, travelEase)

            if (star.becomesFirefly && fireflyBlend > 0) {
              advanceFirefly(star, width, height, timestamp, deltaMs, reducedMotion, resolvedGateSettings)
              drawX = lerp(transformX, star.currentX, fireflyBlend)
              drawY = lerp(transformY, star.currentY, fireflyBlend)
            } else {
              drawX = transformX
              drawY = transformY
              star.currentX = transformX
              star.currentY = transformY
            }

            trailAlpha = 0
            const transformDotAlpha =
              (0.18 + star.trailAlpha * 1.08) *
              (0.3 + travelEase * 0.74) *
              lerp(1.08, 0.82, transformSettleEase) *
              fadeOut *
              (1 - fadeToBlack * 0.8)
            const fireflyDotAlpha =
              (0.06 + star.trailAlpha * 0.26) *
              twinkle *
              (0.92 + Math.min(Math.hypot(star.driftX, star.driftY) / Math.hypot(FIREFLY_MAX_SPEED_X, FIREFLY_MAX_SPEED_Y), 1) * 0.14)
            dotAlpha = star.becomesFirefly
              ? lerp(transformDotAlpha, fireflyDotAlpha, fireflyBlend)
              : transformDotAlpha
          } else if (state.fireflies) {
            if (!star.becomesFirefly) {
              continue
            }
            advanceFirefly(star, width, height, timestamp, deltaMs, reducedMotion, resolvedGateSettings)
            const twinkle =
              0.66 + 0.34 * Math.sin(timestamp * 0.001 * star.twinkleSpeed + star.twinkleOffset)
            const motionEnergy = Math.min(
              Math.hypot(star.driftX, star.driftY) / Math.hypot(FIREFLY_MAX_SPEED_X, FIREFLY_MAX_SPEED_Y),
              1,
            )

            drawX = star.currentX
            drawY = star.currentY
            dotAlpha = (0.06 + star.trailAlpha * 0.3) * twinkle * (0.9 + motionEnergy * 0.18)
          } else {
            star.currentX = drawX
            star.currentY = drawY
            dotAlpha = star.trailAlpha * fieldProfile.gateDotAlphaScale * gateReveal
          }

          if (trailAlpha > 0.01) {
            ctx.save()
            ctx.strokeStyle = `rgba(255,255,255,${trailAlpha})`
            ctx.beginPath()
            ctx.moveTo(star.prevX, star.prevY)
            ctx.lineTo(drawX, drawY)
            ctx.stroke()
            ctx.restore()
          }

          if (dotAlpha > 0.01) {
            ctx.save()
            if (!state.transforming && !state.fireflies) {
              ctx.fillStyle = `rgba(255,255,255,${dotAlpha * 0.14})`
              ctx.beginPath()
              ctx.arc(drawX, drawY, fieldProfile.gateDotSize + star.fireflySize * 0.9, 0, Math.PI * 2)
              ctx.fill()

              ctx.fillStyle = `rgba(255,255,255,${dotAlpha})`
              ctx.beginPath()
              ctx.arc(drawX, drawY, fieldProfile.gateDotSize * 0.46 + star.fireflySize * 0.4, 0, Math.PI * 2)
              ctx.fill()
            } else if (state.transforming) {
              const fireflyBlend = star.becomesFirefly
                ? easeOutQuart(
                    clamp(
                      (transformProgress - star.fireflyBlendStart) /
                        Math.max(star.fireflyBlendEnd - star.fireflyBlendStart, 0.06),
                      0,
                      1,
                    ),
                  )
                : 0
              const blendEase = Math.max(transformSettleEase, fireflyBlend)
              const glowScale = lerp(4.9, 2.35, blendEase) * resolvedGateSettings.fireflyGlowScale
              const glowAlpha = lerp(dotAlpha * 0.2, dotAlpha * 0.12, blendEase)
              const coreScale = lerp(0.98, 0.78, blendEase)

              ctx.fillStyle = `rgba(255,255,255,${glowAlpha})`
              ctx.beginPath()
              ctx.arc(drawX, drawY, star.fireflySize * glowScale, 0, Math.PI * 2)
              ctx.fill()

              ctx.fillStyle = `rgba(255,255,255,${Math.min(dotAlpha, 1)})`
              ctx.beginPath()
              ctx.arc(drawX, drawY, Math.max(star.fireflySize * coreScale, 0.5), 0, Math.PI * 2)
              ctx.fill()
            } else {
              ctx.fillStyle = `rgba(255,255,255,${dotAlpha * 0.12})`
              ctx.beginPath()
              ctx.arc(drawX, drawY, star.fireflySize * 2.4 * resolvedGateSettings.fireflyGlowScale, 0, Math.PI * 2)
              ctx.fill()

              ctx.fillStyle = `rgba(255,255,255,${Math.min(dotAlpha * 1.08, 1)})`
              ctx.beginPath()
              ctx.arc(drawX, drawY, Math.max(star.fireflySize * 0.78, 0.42), 0, Math.PI * 2)
              ctx.fill()
            }
            ctx.restore()
          }

          star.prevX = drawX
          star.prevY = drawY
        }

        const fireflyCardMaskStrength =
          state.fireflies && state.firefliesStartMs >= 0
            ? easeInOutCubic(
                clamp(
                  (timestamp - state.firefliesStartMs - CARD_MASK_DELAY_MS) / CARD_MASK_FADE_MS,
                  0,
                  1,
                ),
              )
            : 0

        if (fireflyCardMaskStrength > 0.001 && protectedRectsRef.current.length > 0) {
          ctx.save()
          ctx.globalCompositeOperation = 'source-over'
          ctx.fillStyle = `rgba(0,0,0,${fireflyCardMaskStrength})`

          for (const rect of protectedRectsRef.current) {
            fillRoundedRect(ctx, rect)
          }

          ctx.restore()
        }

        frameId = requestAnimationFrame(draw)
      }

      frameId = requestAnimationFrame(draw)

      return () => {
        cancelAnimationFrame(frameId)
        resizeObserver.disconnect()
        mutationObserver.disconnect()
        window.removeEventListener('scroll', markProtectedRectsDirty)
        window.removeEventListener('resize', markProtectedRectsDirty)
        canvas.remove()
      }
    }, [layout, motionPreset, reducedMotion, resolvedGateSettings, startInFireflies])

    return (
      <div
        ref={containerRef}
        className={`blackhole-canvas blackhole-canvas--${layout} blackhole-canvas--${visualState}${className ? ` ${className}` : ''}`}
        data-state={visualState}
        aria-hidden="true"
      />
    )
  },
)
