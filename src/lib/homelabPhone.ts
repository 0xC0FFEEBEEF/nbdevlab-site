// Small-screen help for the /homelab page. The page body is generated artwork (src/content/homelab.html), so these
// helpers add to it from the outside instead of changing the markup.

/** Diagrams drawn at less than this share of their natural width get a full-screen viewer. */
const ZOOMABLE_BELOW = 0.62
/** Viewer zoom steps, as a share of the natural width. The viewer opens on DEFAULT_SCALE. */
const SCALES = [0.5, 0.8, 1.1, 1.5]
const DEFAULT_SCALE = 0.8

/**
 * Gives every table cell the name of its column (`data-label`) and marks blank cells (`data-empty`), so phones can
 * show each row as a short list ("CPU  2× Xeon ...") instead of a table that runs off the screen. The ARIA roles
 * keep the table readable as a table when CSS turns its rows into blocks.
 */
export function labelTableCells(root: HTMLElement) {
  root.querySelectorAll('table').forEach((table) => {
    const labels = [...table.querySelectorAll('thead th')].map((th) => th.textContent?.trim() ?? '')
    table.setAttribute('role', 'table')
    table.querySelectorAll('thead, tbody').forEach((group) => group.setAttribute('role', 'rowgroup'))
    table.querySelectorAll('tr').forEach((row) => row.setAttribute('role', 'row'))
    table.querySelectorAll('th').forEach((th) => th.setAttribute('role', 'columnheader'))
    table.querySelectorAll('tbody tr').forEach((row) => {
      ;[...row.children].forEach((cell, index) => {
        cell.setAttribute('role', 'cell')
        if (labels[index]) cell.setAttribute('data-label', labels[index])
        if (!cell.textContent?.trim()) cell.setAttribute('data-empty', '')
      })
    })
  })
}

/** The heading a figure belongs to: the nearest h3/h2 before it, else its section's h2. */
function figureTitle(figure: Element): string {
  for (let node = figure.previousElementSibling; node; node = node.previousElementSibling) {
    if (node.matches('h2, h3')) return node.textContent?.trim() ?? ''
  }
  return figure.closest('section')?.querySelector('h2')?.textContent?.trim() ?? 'Diagram'
}

function naturalWidth(svg: SVGSVGElement): number {
  return Number(svg.dataset.w) || svg.viewBox.baseVal?.width || svg.getBoundingClientRect().width || 1
}

/**
 * On narrow screens each diagram is drawn far below its natural size. A tap on it (or its Zoom button) opens the same
 * live diagram full screen at a readable size, centred on the spot that was tapped. Returns the cleanup.
 */
export function enableDiagramZoom(root: HTMLElement): () => void {
  const scrollers = [...root.querySelectorAll<HTMLElement>('.fig-scroll')].filter((node) => node.querySelector('svg.pz'))
  const cleanups: Array<() => void> = []
  let closeViewer: (() => void) | null = null

  const sync = () => {
    scrollers.forEach((scroller) => {
      const svg = scroller.querySelector<SVGSVGElement>('svg.pz')
      const shown = svg?.getBoundingClientRect().width ?? 0
      scroller.classList.toggle('fig-zoomable', Boolean(svg) && shown > 0 && shown / naturalWidth(svg!) < ZOOMABLE_BELOW)
    })
  }

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(sync)
    scrollers.forEach((scroller) => observer.observe(scroller))
    cleanups.push(() => observer.disconnect())
  } else {
    window.addEventListener('resize', sync)
    cleanups.push(() => window.removeEventListener('resize', sync))
  }
  sync()

  scrollers.forEach((scroller) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'fig-zoom'
    button.setAttribute('aria-label', `Open the ${figureTitle(scroller.closest('figure') ?? scroller)} diagram full screen`)
    button.innerHTML =
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9"/></svg><span>Zoom</span>'
    scroller.append(button)

    const onClick = (event: MouseEvent) => {
      const svg = scroller.querySelector<SVGSVGElement>('svg.pz')
      if (!svg || !scroller.classList.contains('fig-zoomable') || closeViewer) return
      const box = svg.getBoundingClientRect()
      const fromButton = button.contains(event.target as Node)
      const clamp = (value: number) => Math.min(1, Math.max(0, value))
      // From the button: start at the top left, where the diagram's title and key are.
      const focusX = fromButton ? 0 : clamp((event.clientX - box.left) / box.width)
      const focusY = fromButton ? 0 : clamp((event.clientY - box.top) / box.height)
      closeViewer = openViewer(root, scroller, svg, button, focusX, focusY, () => {
        closeViewer = null
      })
    }

    scroller.addEventListener('click', onClick)
    cleanups.push(() => {
      scroller.removeEventListener('click', onClick)
      button.remove()
      scroller.classList.remove('fig-zoomable')
    })
  })

  return () => {
    closeViewer?.()
    cleanups.forEach((cleanup) => cleanup())
  }
}

function openViewer(
  root: HTMLElement,
  scroller: HTMLElement,
  svg: SVGSVGElement,
  returnFocus: HTMLElement,
  focusX: number,
  focusY: number,
  onClosed: () => void,
): () => void {
  const title = figureTitle(scroller.closest('figure') ?? scroller)
  const natural = naturalWidth(svg)

  // The viewer is a .homelab-page too, so the diagram keeps its colours and, with .motion, its animation.
  const viewer = document.createElement('div')
  viewer.className = `homelab-page homelab-zoom${root.classList.contains('motion') ? ' motion' : ''}`
  viewer.setAttribute('role', 'dialog')
  viewer.setAttribute('aria-modal', 'true')
  viewer.setAttribute('aria-label', `${title} diagram`)
  viewer.innerHTML = `
    <div class="homelab-zoom__bar">
      <p class="homelab-zoom__title"></p>
      <button type="button" class="homelab-zoom__step" data-step="-1" aria-label="Zoom out">−</button>
      <button type="button" class="homelab-zoom__step" data-step="1" aria-label="Zoom in">+</button>
      <button type="button" class="homelab-zoom__close">Close</button>
    </div>
    <div class="homelab-zoom__stage" tabindex="0" aria-label="Diagram, scroll to move around"></div>`
  viewer.querySelector('.homelab-zoom__title')!.textContent = title
  const stage = viewer.querySelector<HTMLElement>('.homelab-zoom__stage')!
  const closeButton = viewer.querySelector<HTMLButtonElement>('.homelab-zoom__close')!
  const stepButtons = [...viewer.querySelectorAll<HTMLButtonElement>('.homelab-zoom__step')]

  // Move the live diagram (not a copy) so its packets keep moving; a spacer holds its place on the page.
  const spacer = document.createElement('div')
  spacer.className = 'fig-zoom-spacer'
  spacer.style.height = `${svg.getBoundingClientRect().height}px`
  svg.replaceWith(spacer)
  stage.append(svg)
  document.body.append(viewer)

  const previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'

  let scale = DEFAULT_SCALE
  const applyScale = (next: number, centreX: number, centreY: number) => {
    scale = next
    svg.style.width = `${Math.round(natural * scale)}px`
    stage.scrollLeft = centreX * stage.scrollWidth - stage.clientWidth / 2
    stage.scrollTop = centreY * stage.scrollHeight - stage.clientHeight / 2
    stepButtons[0].disabled = scale <= SCALES[0]
    stepButtons[1].disabled = scale >= SCALES[SCALES.length - 1]
  }
  applyScale(scale, focusX, focusY)

  const onStep = (event: Event) => {
    const step = Number((event.currentTarget as HTMLElement).dataset.step)
    const index = SCALES.indexOf(scale) + step
    if (index < 0 || index >= SCALES.length) return
    const centreX = (stage.scrollLeft + stage.clientWidth / 2) / stage.scrollWidth
    const centreY = (stage.scrollTop + stage.clientHeight / 2) / stage.scrollHeight
    applyScale(SCALES[index], centreX, centreY)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== 'Tab') return
    // Keep the keyboard inside the viewer while it covers the page.
    const focusable = [...stepButtons.filter((button) => !button.disabled), closeButton, stage]
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const outside = !viewer.contains(document.activeElement)
    if (event.shiftKey && (outside || document.activeElement === first)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (outside || document.activeElement === last)) {
      event.preventDefault()
      first.focus()
    }
  }

  let closed = false
  function close() {
    if (closed) return
    closed = true
    window.removeEventListener('keydown', onKeyDown)
    svg.style.width = ''
    spacer.replaceWith(svg)
    viewer.remove()
    document.body.style.overflow = previousOverflow
    if (returnFocus.isConnected) returnFocus.focus({ preventScroll: true })
    onClosed()
  }

  stepButtons.forEach((button) => button.addEventListener('click', onStep))
  closeButton.addEventListener('click', close)
  window.addEventListener('keydown', onKeyDown)
  closeButton.focus({ preventScroll: true })

  return close
}
