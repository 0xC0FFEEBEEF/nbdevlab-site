import { useEffect, useRef } from 'react'
import homelabMarkup from '../content/homelab.html?raw'
import { animateHomelab } from '../lib/homelabMotion'
import { enableDiagramZoom, labelTableCells } from '../lib/homelabPhone'
import { publicApi } from '../lib/api'
import { readGuestCounts, readWallPower } from '../lib/stackStatus'
import './HomelabPage.css'

// Keep the prop stable so parent updates don't replace the animated DOM.
const homelabContent = { __html: homelabMarkup }

export function HomelabPage() {
  const pageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const page = pageRef.current
    if (!page) return

    const previousTitle = document.title
    document.title = 'Homelab | nbdevlab'
    const stopMotion = animateHomelab(page)
    labelTableCells(page)
    const stopZoom = enableDiagramZoom(page)

    // Links such as /homelab#power arrive before this markup exists, so go to the section now.
    const sectionId = window.location.hash.slice(1)
    if (sectionId) page.querySelector(`[id="${CSS.escape(sectionId)}"]`)?.scrollIntoView()

    return () => {
      stopZoom()
      stopMotion()
      document.title = previousTitle
    }
  }, [])

  // Two hero stats follow the status feed: power at the wall and running guests. Each keeps the snapshot figure
  // from the map until a complete reading arrives, and says so if the feed stops after being live.
  useEffect(() => {
    const page = pageRef.current
    const statParts = (name: string) => {
      const stat = page?.querySelector<HTMLElement>(`[data-live="${name}"]`)
      const value = stat?.querySelector('b')
      const label = stat?.querySelector('span')
      return stat && value && label ? { stat, value, label, wasLive: false } : null
    }
    const power = statParts('wall-power')
    const guests = statParts('guests')
    if (!power && !guests) return

    let stopped = false
    const refresh = async () => {
      let snapshot = null
      try {
        snapshot = await publicApi.getStackStatus()
      } catch {
        // Keep what is on screen.
      }
      if (stopped) return

      const wall = readWallPower(snapshot)
      if (power && wall) {
        power.wasLive = true
        power.value.textContent = `≈${wall.watts} W`
        power.label.textContent = 'at the wall · live'
        power.stat.title = `${wall.upsWatts} W through the UPS + ${wall.surgeWatts} W on surge-only power`
      } else if (power?.wasLive) {
        power.label.textContent = 'at the wall · last reading'
      }

      const counts = readGuestCounts(snapshot)
      if (guests && counts) {
        guests.wasLive = true
        guests.value.textContent = String(counts.running)
        guests.label.textContent = `guests running of ${counts.total} · live`
      } else if (guests?.wasLive) {
        guests.label.textContent = guests.label.textContent.replace(' · live', ' · last reading')
      }
    }

    void refresh()
    const timer = window.setInterval(() => void refresh(), 60_000)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [])

  // Versioned, local artwork from the supplied map; never user or API HTML.
  return <div ref={pageRef} className="homelab-page" dangerouslySetInnerHTML={homelabContent} />
}
