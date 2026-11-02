type Point = [number, number]
type Leg = { points: Point[]; lengths: number[]; length: number; color: string }
type Segment = { leg: Leg; start: number; duration: number }
type Packet = { svg: SVGSVGElement; node: SVGGElement; segments: Segment[]; period: number; delay: number }
type Playhead = {
  svg: SVGSVGElement
  node: SVGGElement
  veil: SVGRectElement
  line: SVGLineElement
  tag: SVGRectElement
  text: SVGTextElement
  left: number
  right: number
  edge: number
  duration: number
  start: number | null
}

const distance = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1])

function position(leg: Leg, traveled: number): Point {
  let index = 1
  while (index < leg.lengths.length - 1 && leg.lengths[index] < traveled) index++
  const a = leg.points[index - 1]
  const b = leg.points[index]
  const fraction = (traveled - leg.lengths[index - 1]) / (leg.lengths[index] - leg.lengths[index - 1] || 1)
  return [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction]
}

// Adapted from the supplied map. All queries, classes, and listeners belong to this
// page, and every observer/frame is released when React leaves the route.
export function animateHomelab(root: HTMLElement) {
  const toggle = root.querySelector<HTMLInputElement>('#toggle-motion')!
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const packets: Packet[] = []
  const playheads: Playhead[] = []
  const visible = new Set<Element>()
  const diagrams = root.querySelectorAll<SVGSVGElement>('svg.pz')
  let animationFrame = 0
  let enabled = false
  let preference = true

  try {
    preference = localStorage.getItem('hm-motion') !== '0'
  } catch { /* Animation still works when storage is unavailable. */ }

  diagrams.forEach((svg) => {
    svg.querySelectorAll<SVGGElement>('.pk').forEach((node) => {
      const colors = node.dataset.c!.split(' ')
      const legs = node.dataset.legs!.split(';').map((source, index): Leg => {
        const points = source.trim().split(/\s+/).map((pair) => pair.split(',').map(Number) as Point)
        const lengths = [0]
        for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + distance(points[i - 1], points[i]))
        return { points, lengths, length: lengths[lengths.length - 1], color: colors[index] || colors[0] }
      })
      let time = 0
      const speed = Number(node.dataset.speed)
      const segments = legs.map((leg, index) => {
        const duration = Math.max(leg.length / speed, 0.05)
        const segment = { leg, start: time, duration }
        time += duration
        if (index < legs.length - 1) {
          time += Math.min(distance(leg.points[leg.points.length - 1], legs[index + 1].points[0]) / speed, 0.5)
            + Number(node.dataset.hold)
        }
        return segment
      })
      packets.push({ svg, node, segments, period: time + Number(node.dataset.rest), delay: Number(node.dataset.delay) })
    })

    svg.querySelectorAll<SVGGElement>('.ph').forEach((node) => {
      const veil = node.querySelector<SVGRectElement>('.ph-veil')!
      playheads.push({
        svg, node, veil,
        line: node.querySelector<SVGLineElement>('.ph-line')!,
        tag: node.querySelector<SVGRectElement>('.ph-tag')!,
        text: node.querySelector<SVGTextElement>('.ph-t')!,
        left: Number(node.dataset.x0), right: Number(node.dataset.x1),
        edge: Number(veil.getAttribute('x')) + Number(veil.getAttribute('width')),
        duration: Number(node.dataset.t), start: null,
      })
    })
  })

  const started = performance.now()
  function frame(timestamp: number) {
    animationFrame = 0
    if (!enabled || document.hidden || !visible.size) return
    const now = (timestamp - started) / 1000

    packets.forEach(({ svg, node, segments, period, delay }) => {
      if (!visible.has(svg)) return
      const time = (now + delay) % period
      const segment = segments.find((part) => time >= part.start && time < part.start + part.duration)
      if (!segment) {
        node.style.opacity = '0'
        return
      }
      const traveled = (time - segment.start) / segment.duration * segment.leg.length
      const [x, y] = position(segment.leg, traveled)
      node.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`)
      node.setAttribute('class', `pk k-${segment.leg.color}`)
      node.style.opacity = Math.max(0, Math.min(1, traveled / 10, (segment.leg.length - traveled) / 10)).toFixed(2)
    })

    playheads.forEach((head) => {
      if (!visible.has(head.svg)) return
      if (head.start === null) head.start = now
      head.node.classList.add('on')
      const time = (now - head.start) % 19
      const fraction = Math.min(time / 16, 1)
      const x = head.left + fraction * (head.right - head.left)
      const seconds = Math.round(fraction * head.duration)
      head.node.style.opacity = time < 16 ? '1' : '0'
      head.veil.setAttribute('x', x.toFixed(1))
      head.veil.setAttribute('width', Math.max(0, head.edge - x).toFixed(1))
      head.line.setAttribute('x1', x.toFixed(1))
      head.line.setAttribute('x2', x.toFixed(1))
      head.tag.setAttribute('x', (x - 22).toFixed(1))
      head.text.setAttribute('x', x.toFixed(1))
      head.text.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
    })
    animationFrame = requestAnimationFrame(frame)
  }

  function kick() {
    if (enabled && !document.hidden && visible.size && !animationFrame) animationFrame = requestAnimationFrame(frame)
  }

  const diagramObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) visible.add(entry.target)
      else visible.delete(entry.target)
    })
    kick()
  }, { rootMargin: '120px 0px' })
  diagrams.forEach((svg) => diagramObserver.observe(svg))

  const revealObserver = new IntersectionObserver((entries) => {
    let stagger = 0
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return
      const node = entry.target as HTMLElement
      node.style.setProperty('--d', `${Math.min(stagger++ * 0.07, 0.35)}s`)
      node.classList.add('rv-go')
      revealObserver.unobserve(node)
    })
  }, { rootMargin: '0px 0px -5% 0px' })

  function syncMotion() {
    enabled = preference && !reducedMotion.matches
    root.classList.toggle('motion', enabled)
    toggle.checked = enabled
    if (!enabled) {
      cancelAnimationFrame(animationFrame)
      animationFrame = 0
      root.classList.remove('rv-on')
      revealObserver.disconnect()
    }
    kick()
  }

  function onToggle() {
    preference = toggle.checked
    try { localStorage.setItem('hm-motion', preference ? '1' : '0') } catch { /* Optional preference. */ }
    syncMotion()
  }

  syncMotion()
  if (enabled) {
    root.classList.add('rv-on')
    root.querySelectorAll<HTMLElement>('.band > .eyebrow, .band > h2, .band > p, figcaption, .rules > div, .log li, .parked > div, .table-scroll tr').forEach((node) => {
      if (node.getBoundingClientRect().top < window.innerHeight * 0.9) return
      node.classList.add('rv-b')
      revealObserver.observe(node)
    })
  }

  toggle.addEventListener('change', onToggle)
  reducedMotion.addEventListener('change', syncMotion)
  document.addEventListener('visibilitychange', kick)

  return () => {
    enabled = false
    cancelAnimationFrame(animationFrame)
    diagramObserver.disconnect()
    revealObserver.disconnect()
    toggle.removeEventListener('change', onToggle)
    reducedMotion.removeEventListener('change', syncMotion)
    document.removeEventListener('visibilitychange', kick)
    root.classList.remove('motion', 'rv-on')
    root.querySelectorAll('.rv-b, .rv-go').forEach((node) => node.classList.remove('rv-b', 'rv-go'))
  }
}
