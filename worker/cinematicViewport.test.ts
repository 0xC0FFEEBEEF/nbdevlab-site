import { describe, expect, it } from 'vitest'
import { viewportProfile } from '../public/404-assets/viewport.js'

describe('cinematic viewport', () => {
  it.each([[320, 568], [390, 844], [430, 932], [768, 1024]])(
    'preserves the horizontal action on a %s × %s touch screen', (width, height) => {
      const view = viewportProfile(width, height, 3, true)
      expect((width / height) / view.focal).toBeCloseTo(1.6 / 1.7)
      expect(view.width / view.height).toBeCloseTo(width / height, 2)
      expect(view.width * view.height).toBeLessThanOrEqual(width >= 600 ? 650000 : 400000)
      expect(Math.max(view.width, view.height)).toBeLessThanOrEqual(1200)
    },
  )

  it('retains the approved desktop field of view', () => {
    const view = viewportProfile(1440, 900, 2, false)
    expect(view.focal).toBe(1.7)
    expect(view.compact).toBe(false)
    expect(view.width).toBe(1500)
  })

  it('returns to the original lens when a phone rotates to landscape', () => {
    const portrait = viewportProfile(390, 844, 3, true)
    const landscape = viewportProfile(844, 390, 3, true)
    expect(portrait.focal).toBeLessThan(landscape.focal)
    expect(landscape.focal).toBe(1.7)
    expect(landscape.width * landscape.height).toBeLessThanOrEqual(400000)
  })
})
