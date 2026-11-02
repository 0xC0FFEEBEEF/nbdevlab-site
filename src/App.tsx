import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AnalyticsTracker } from './components/AnalyticsTracker'
import { BlackHoleCanvas, type BlackHoleCanvasHandle } from './components/BlackHoleCanvas'
import { ConsentBanner } from './components/ConsentBanner'
import { IntroSettingsPanel } from './components/IntroSettingsPanel'
import { IntroOverlay } from './components/IntroOverlay'
import { PublicLayout } from './components/PublicLayout'
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion'
import { publicApi } from './lib/api'
import {
  getDigitalRainProfile,
  readIntroPreferences,
  writeIntroPreferences,
} from './lib/introPreferences'
import { AdminPage } from './pages/AdminPage'
import { AboutPage } from './pages/AboutPage'
import { ContactPage } from './pages/ContactPage'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { SkillsPage } from './pages/SkillsPage'
import { StatusPage } from './pages/StatusPage'
import { WeatherPage } from './pages/WeatherPage'
import { defaultIntroConfig } from './types/intro'
import { defaultGateSettings, normalizeGateSettings } from '../shared/gateSettings'
import { isSitePath } from '../shared/siteRoutes'

const HomelabPage = lazy(() => import('./pages/HomelabPage').then((module) => ({ default: module.HomelabPage })))

function getInitialIntroSeen(storageKey: string) {
  if (typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem(storageKey) === '1'
}

function SiteApp() {
  const reducedMotion = usePrefersReducedMotion()
  const blackHoleRef = useRef<BlackHoleCanvasHandle>(null)
  const initialRuntimeRef = useRef<{
    introSeen: boolean
    preferences: ReturnType<typeof readIntroPreferences>
  } | null>(null)
  if (initialRuntimeRef.current === null) {
    initialRuntimeRef.current = {
      introSeen: getInitialIntroSeen(defaultIntroConfig.storageKey),
      preferences: readIntroPreferences(),
    }
  }

  const [introPreferences, setIntroPreferences] = useState(initialRuntimeRef.current.preferences)
  const [introSeenOnBoot] = useState(initialRuntimeRef.current.introSeen)
  const [isIntroComplete, setIsIntroComplete] = useState(introSeenOnBoot)
  const [isIntroSettingsOpen, setIsIntroSettingsOpen] = useState(false)
  const [introStartsAtGate, setIntroStartsAtGate] = useState(false)
  const [introOverlaySeed, setIntroOverlaySeed] = useState(0)
  const [gateCanvasSeed, setGateCanvasSeed] = useState(0)
  const [gateCanvasStartsInFireflies, setGateCanvasStartsInFireflies] = useState(
    introSeenOnBoot && initialRuntimeRef.current.preferences.mode === 'gate',
  )
  const [skipDefaultReveal, setSkipDefaultReveal] = useState(introSeenOnBoot)
  const [gateRevealProgress, setGateRevealProgress] = useState(introSeenOnBoot ? 1 : 0)
  const [siteGateSettings, setSiteGateSettings] = useState<ReturnType<typeof normalizeGateSettings> | null>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const settings = await publicApi.getSiteSettings()
        if (!cancelled) {
          setSiteGateSettings(normalizeGateSettings(settings.gateSettings))
        }
      } catch {
        if (!cancelled) {
          setSiteGateSettings(defaultGateSettings)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const patchIntroPreferences = (patch: Partial<typeof introPreferences>) => {
    const next = { ...introPreferences, ...patch }
    writeIntroPreferences(next)
    setIntroPreferences(next)

    if (next.mode !== introPreferences.mode && next.mode === 'gate') {
      setGateCanvasStartsInFireflies(isIntroComplete)
      setGateCanvasSeed((current) => current + 1)
    }
  }

  const reopenIntro = () => {
    setIsIntroSettingsOpen(false)
    setSkipDefaultReveal(false)
    setGateRevealProgress(0)
    setIntroStartsAtGate(false)
    setIntroOverlaySeed((current) => current + 1)
    setIsIntroComplete(false)

    if (introPreferences.mode === 'gate') {
      setGateCanvasStartsInFireflies(false)
      setGateCanvasSeed((current) => current + 1)
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }

  const showGateCanvas = introPreferences.mode === 'gate'
  const activeGateSettings = siteGateSettings ?? defaultGateSettings
  const gateMotionPreset = siteGateSettings?.intensityPreset ?? introPreferences.gateIntensity
  const rainProfile = getDigitalRainProfile(introPreferences)

  return (
    <>
      {showGateCanvas ? (
        <BlackHoleCanvas
          key={`gate-canvas:${gateCanvasSeed}:${gateMotionPreset}:${gateCanvasStartsInFireflies ? 'fireflies' : 'gate'}`}
          ref={blackHoleRef}
          reducedMotion={reducedMotion}
          startInFireflies={gateCanvasStartsInFireflies}
          gateRevealProgress={gateCanvasStartsInFireflies || reducedMotion || isIntroComplete ? 1 : gateRevealProgress}
          motionPreset={gateMotionPreset}
          gateSettings={activeGateSettings}
        />
      ) : null}

      {!isIntroComplete && (
        <IntroOverlay
          key={`intro-overlay:${introOverlaySeed}`}
          config={defaultIntroConfig}
          reducedMotion={reducedMotion}
          preferences={introPreferences}
          mode={introPreferences.mode}
          rainProfile={rainProfile}
          startAtGate={introStartsAtGate}
          onExitStart={() => {
            if (introPreferences.mode === 'gate') {
              blackHoleRef.current?.triggerExpansion()
            }
          }}
          onComplete={() => {
            setGateRevealProgress(1)
            setIntroStartsAtGate(false)
            setIsIntroComplete(true)
            setSkipDefaultReveal(false)
          }}
          onScrambleProgress={setGateRevealProgress}
          onHoverEnter={() => {
            if (introPreferences.mode === 'gate') {
              blackHoleRef.current?.triggerCollapse(true)
            }
          }}
          onHoverLeave={() => {
            if (introPreferences.mode === 'gate') {
              blackHoleRef.current?.triggerCollapse(false)
            }
          }}
          onOpenSettings={() => setIsIntroSettingsOpen(true)}
        />
      )}

      <IntroSettingsPanel
        open={isIntroSettingsOpen}
        preferences={introPreferences}
        onClose={() => setIsIntroSettingsOpen(false)}
        onPatch={patchIntroPreferences}
        onPreviewIntro={reopenIntro}
      />

      <AnalyticsTracker />
      <ConsentBanner visible={isIntroComplete} />

      <div
        className={`site-shell ${isIntroComplete ? 'site-shell--visible' : ''} ${
          skipDefaultReveal ? 'site-shell--no-reveal' : ''
        }`}
      >
        <Routes>
          <Route
            element={
              <PublicLayout
                siteVisible={isIntroComplete}
                onOpenIntroSettings={() => setIsIntroSettingsOpen(true)}
              />
            }
          >
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/skills" element={<SkillsPage />} />
            <Route path="/status" element={<StatusPage />} />
            <Route path="/homelab" element={<Suspense fallback={<p role="status">Loading homelab…</p>}><HomelabPage /></Suspense>} />
            <Route path="/weather" element={<WeatherPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
          </Route>
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </>
  )
}

function RouteView() {
  const { pathname } = useLocation()
  return isSitePath(pathname) ? <SiteApp /> : <NotFoundPage />
}

function App() {
  return <BrowserRouter><RouteView /></BrowserRouter>
}

export default App
