import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertRenderedFrame } from '../public/404-assets/graphics-health.js'
import { RecordedScene } from '../public/404-assets/recorded-scene.js'
import { STORY } from '../public/404-assets/score.js'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); document.body.innerHTML = '' })

describe('camera graphics health', () => {
  function context() {
    return { NO_ERROR: 0, RGBA: 6408, UNSIGNED_BYTE: 5121, isContextLost: vi.fn(() => false), getError: vi.fn(() => 0), readPixels: vi.fn((_x, _y, _w, _h, _format, _type, pixels) => pixels.set([0, 0, 0, 255, 5, 12, 40, 255])) }
  }

  it('accepts an actual picture', () => {
    expect(() => assertRenderedFrame(context(), 2, 1)).not.toThrow()
  })

  it('detects a black picture even when the driver reports no draw error', () => {
    const gl = context()
    gl.readPixels.mockImplementation((_x, _y, _w, _h, _format, _type, pixels) => pixels.set([0, 0, 0, 255, 0, 0, 0, 255]))
    expect(() => assertRenderedFrame(gl, 2, 1)).toThrow('empty picture')
  })

  it('rejects a lost context before reading its pixels', () => {
    const gl = context()
    gl.isContextLost.mockReturnValue(true)
    expect(() => assertRenderedFrame(gl, 2, 1)).toThrow('draw failed')
    expect(gl.readPixels).not.toHaveBeenCalled()
  })
})

describe('recorded camera compatibility', () => {
  function recording(ready = 1) {
    vi.stubGlobal('innerWidth', 390); vi.stubGlobal('innerHeight', 844)
    vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockReturnValue(ready)
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    const canvas = document.createElement('canvas'); document.body.append(canvas)
    return { scene: new RecordedScene(canvas), play }
  }

  it('loads a silent inline portrait recording after graphics fail', async () => {
    const { scene } = recording()
    expect(await scene.ready).toBe(true)
    expect(scene.element.muted).toBe(true)
    expect(scene.element.playsInline).toBe(true)
    expect(scene.element.src).toContain('orbit-portrait.mp4')
    scene.close()
  })

  it('follows pause, current picture time, the hard cut, and replay', async () => {
    const { scene, play } = recording()
    await scene.ready
    scene.sync(3, true)
    expect(scene.element.currentTime).toBe(3)
    expect(play).toHaveBeenCalledOnce()
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    scene.sync(8, false)
    expect(scene.element.currentTime).toBe(8)
    scene.sync(STORY.final, true)
    expect(scene.element.hidden).toBe(true)
    scene.sync(0, true)
    expect(scene.element.hidden).toBe(false)
    expect(scene.element.currentTime).toBe(0)
    expect(play).toHaveBeenCalledTimes(2)
    scene.close()
  })

  it('switches orientation and rejoins the current scene time', async () => {
    const { scene } = recording()
    await scene.ready
    vi.stubGlobal('innerWidth', 844); vi.stubGlobal('innerHeight', 390)
    scene.resize(); await scene.ready
    scene.sync(7, false)
    expect(scene.element.src).toContain('orbit-landscape.mp4')
    expect(scene.element.currentTime).toBe(7)
    scene.close()
  })

  it('times out unavailable video so the ordinary 404 remains reachable', async () => {
    vi.useFakeTimers()
    const { scene } = recording(0)
    await vi.advanceTimersByTimeAsync(8000)
    expect(await scene.ready).toBe(false)
    scene.close()
  })
})
