import { useEffect, useState } from 'react'
import { publicApi } from '../lib/api'
import type { StackStatusSnapshot } from '../lib/stackStatus'
import type { HomeCard, Project } from '../types/models'
import { HomePageView, type HeroContent } from '../components/PublicSiteViews'
import type { BuilderDocument } from '../../shared/builder'
import { defaultMaintenanceMessage } from '../../shared/maintenance'

const defaultHeroSettings: HeroContent = {
  homeEyebrow: '',
  homeTitle: 'Hello There',
  homeTagline: 'I build and document homelab infrastructure, self-hosted services, and hands-on systems projects.',
  homeIntro:
    "I build and document real homelab infrastructure around Proxmox, self-hosted services, monitoring, security, automation, and live operational visibility. nbdevlab is where I share what I'm running, what I'm learning, and what I'm building next.",
}

export function HomePage() {
  const [cards, setCards] = useState<HomeCard[]>([])
  const [featuredProjects, setFeaturedProjects] = useState<Project[]>([])
  const [hero, setHero] = useState<HeroContent>(defaultHeroSettings)
  const [document, setDocument] = useState<BuilderDocument | null>(null)
  const [projectsDocument, setProjectsDocument] = useState<BuilderDocument | null>(null)
  const [statusDocument, setStatusDocument] = useState<BuilderDocument | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [statusSnapshot, setStatusSnapshot] = useState<StackStatusSnapshot | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [maintenanceMessage, setMaintenanceMessage] = useState(defaultMaintenanceMessage)
  const [hasLoadedSiteSettings, setHasLoadedSiteSettings] = useState(false)

  useEffect(() => {
    void (async () => {
      const [cardsResult, settingsResult, projectsResult] = await Promise.allSettled([
        publicApi.listHomeCards(),
        publicApi.getSiteSettings(),
        publicApi.listProjects(),
      ])
      const documentResult = await Promise.allSettled([
        publicApi.getBuilderDocument('page.home'),
        publicApi.getBuilderDocument('page.projects'),
        publicApi.getBuilderDocument('page.status'),
      ])

      if (cardsResult.status === 'fulfilled') {
        setCards(cardsResult.value)
      } else {
        setError('Homepage content is temporarily unavailable.')
      }

      if (settingsResult.status === 'fulfilled') {
        const settings = settingsResult.value
        setHero({
          homeEyebrow: settings.homeEyebrow ?? defaultHeroSettings.homeEyebrow,
          homeTitle: settings.homeTitle ?? defaultHeroSettings.homeTitle,
          homeTagline: settings.homeTagline ?? defaultHeroSettings.homeTagline,
          homeIntro: settings.homeIntro ?? defaultHeroSettings.homeIntro,
        })
        setMaintenanceMode(settings.maintenanceMode)
        setMaintenanceMessage(settings.maintenanceMessage)
      }

      setHasLoadedSiteSettings(true)

      if (projectsResult.status === 'fulfilled') {
        setFeaturedProjects(projectsResult.value.filter((project) => project.isFeatured))
      }

      if (documentResult[0]?.status === 'fulfilled') {
        setDocument(documentResult[0].value)
      }

      if (documentResult[1]?.status === 'fulfilled') {
        setProjectsDocument(documentResult[1].value)
      }

      if (documentResult[2]?.status === 'fulfilled') {
        setStatusDocument(documentResult[2].value)
      }
    })()
  }, [])

  useEffect(() => {
    if (!hasLoadedSiteSettings) {
      return
    }

    if (maintenanceMode) {
      setStatusSnapshot(null)
      setStatusError(null)
      return
    }

    let cancelled = false

    const loadStatus = async () => {
      try {
        const snapshot = await publicApi.getStackStatus()
        if (cancelled) {
          return
        }

        setStatusSnapshot(snapshot)
        setStatusError(null)
      } catch {
        if (cancelled) {
          return
        }

        setStatusError("Couldn't load the live status feed.")
      }
    }

    void loadStatus()

    const intervalId = window.setInterval(() => {
      void loadStatus()
    }, 15_000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [hasLoadedSiteSettings, maintenanceMode])

  return (
    <HomePageView
      hero={hero}
      cards={cards}
      featuredProjects={featuredProjects}
      maintenanceMode={maintenanceMode}
      maintenanceMessage={maintenanceMessage}
      statusSnapshot={statusSnapshot}
      statusError={statusError}
      error={error}
      document={document}
      projectsDocument={projectsDocument}
      statusDocument={statusDocument}
    />
  )
}
