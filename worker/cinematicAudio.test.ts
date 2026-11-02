import { afterEach, describe, expect, it, vi } from 'vitest'
import { IncidentAudio } from '../public/404-assets/audio.js'

class MediaFixture {
  currentTime = 0
  paused = true
  ended = false
  muted = false
  preload = ''
  readyState = 1
  src = ''
  addEventListener = vi.fn()
  removeEventListener = vi.fn()
  play = vi.fn(async () => { this.paused = false })
  pause = vi.fn(() => { this.paused = true })
  load = vi.fn()
  removeAttribute = vi.fn()
}

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

function player() {
  const media = new MediaFixture()
  const NativeURL = URL
  vi.stubGlobal('URL', class extends NativeURL {
    static createObjectURL() { return 'blob:cinematic-score' }
    static revokeObjectURL() {}
  })
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2, 3]))))
  vi.stubGlobal('Audio', class { constructor() { return media } })
  return { media, audio: new IncidentAudio() }
}

describe('cinematic audio transport', () => {
  it('calls play synchronously on a tap once the mobile soundtrack is ready', async () => {
    const { media, audio } = player()
    await audio.ready
    const started = audio.start(6.2)
    expect(media.play).toHaveBeenCalledOnce()
    expect(media.currentTime).toBe(6.2)
    expect(await started).toBe(true)
  })

  it('reports blocked autoplay so the picture can continue silently', async () => {
    const { media, audio } = player()
    media.play.mockRejectedValue(new DOMException('Gesture required', 'NotAllowedError'))
    expect(await audio.start()).toBe(false)
    expect(media.paused).toBe(true)
  })

  it('joins and resumes sound at the current picture time', async () => {
    const { media, audio } = player()
    expect(await audio.start(8.4)).toBe(true)
    expect(audio.time()).toBe(8.4)
    audio.pause()
    expect(await audio.resume()).toBe(true)
    expect(media.currentTime).toBe(8.4)
    audio.stop()
    expect(media.currentTime).toBe(0)
  })

  it('does not hold the picture indefinitely on slow or unavailable audio', async () => {
    vi.useFakeTimers()
    const { media, audio } = player()
    media.play.mockImplementation(() => new Promise(() => {}))
    const started = audio.start()
    await vi.advanceTimersByTimeAsync(1500)
    expect(await started).toBe(false)
    expect(media.paused).toBe(true)
  })
})
