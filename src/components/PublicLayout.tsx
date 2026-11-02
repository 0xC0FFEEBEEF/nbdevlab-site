import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { adminApi, publicApi } from '../lib/api'
import { SiteNavigation } from './PublicSiteViews'
import { SiteAnnouncement } from './Announcement'
import { defaultHeaderActions, defaultSiteNavItems } from '../lib/siteNavigation'
import { getNavigationFromBuilderDocument } from '../lib/builderDocuments'
import type { BuilderDocument } from '../../shared/builder'
import { defaultAnnouncement, normalizeAnnouncement } from '../../shared/announcement'

interface PublicLayoutProps {
  siteVisible: boolean
  onOpenIntroSettings: () => void
}

export function PublicLayout({ siteVisible, onOpenIntroSettings }: PublicLayoutProps) {
  const location = useLocation()
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean | null>(null)
  const [isCompactNav, setIsCompactNav] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 640px)').matches : false,
  )
  const [menuState, setMenuState] = useState(() => ({
    isOpen: false,
    path: location.pathname,
  }))
  const [isMobileNavHidden, setIsMobileNavHidden] = useState(false)
  const [navigationDocument, setNavigationDocument] = useState<BuilderDocument | null>(null)
  const [maintenanceNotice, setMaintenanceNotice] = useState({
    enabled: false,
    message: '',
  })
  const [isMaintenanceNoticeDismissed, setIsMaintenanceNoticeDismissed] = useState(false)
  const [announcement, setAnnouncement] = useState(defaultAnnouncement)
  const isMenuOpen = menuState.isOpen && menuState.path === location.pathname
  const lastScrollYRef = useRef(0)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const [documentResult, settingsResult] = await Promise.allSettled([
        publicApi.getBuilderDocument('layout.nav'),
        publicApi.getSiteSettings(),
      ])

      if (cancelled) {
        return
      }

      setNavigationDocument(documentResult.status === 'fulfilled' ? documentResult.value : null)

      if (settingsResult.status === 'fulfilled') {
        setMaintenanceNotice({
          enabled: settingsResult.value.maintenanceMode,
          message: settingsResult.value.maintenanceMessage,
        })
        setAnnouncement(normalizeAnnouncement(settingsResult.value.announcement))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!maintenanceNotice.enabled) {
      setIsMaintenanceNoticeDismissed(false)
      return
    }

    const storageKey = `nbdevlab:maintenance-notice:${maintenanceNotice.message}`
    setIsMaintenanceNoticeDismissed(window.sessionStorage.getItem(storageKey) === '1')
  }, [maintenanceNotice.enabled, maintenanceNotice.message])

  useEffect(() => {
    let cancelled = false

    const loadSession = async () => {
      try {
        const session = await adminApi.getSession()
        if (!cancelled) {
          setIsAdminAuthenticated(session.authenticated)
        }
      } catch {
        if (!cancelled) {
          setIsAdminAuthenticated(false)
        }
      }
    }

    void loadSession()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isMenuOpen) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuState({
          isOpen: false,
          path: location.pathname,
        })
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isMenuOpen, location.pathname])

  // The open phone menu fills the screen below the bar: the page behind it should not scroll, and the cookie banner
  // (which sits above the whole site) waits until the menu closes.
  useEffect(() => {
    if (!isMenuOpen || !isCompactNav) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.classList.add('site-menu-open')
    return () => {
      document.body.style.overflow = previousOverflow
      document.body.classList.remove('site-menu-open')
    }
  }, [isMenuOpen, isCompactNav])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)')

    const syncCompactNav = () => {
      const compact = media.matches
      setIsCompactNav(compact)
      if (!compact) {
        setMenuState({
          isOpen: false,
          path: location.pathname,
        })
      }
    }

    syncCompactNav()

    media.addEventListener('change', syncCompactNav)
    return () => {
      media.removeEventListener('change', syncCompactNav)
    }
  }, [location.pathname])

  useEffect(() => {
    const isPhoneViewport = () => window.matchMedia('(max-width: 640px)').matches

    const syncNavVisibility = () => {
      const currentScrollY = window.scrollY

      if (!isPhoneViewport() || isMenuOpen) {
        setIsMobileNavHidden(false)
        lastScrollYRef.current = currentScrollY
        return
      }

      const scrollDelta = currentScrollY - lastScrollYRef.current

      if (currentScrollY <= 24 || scrollDelta < -10) {
        setIsMobileNavHidden(false)
      } else if (currentScrollY > 96 && scrollDelta > 10) {
        setIsMobileNavHidden(true)
      }

      lastScrollYRef.current = currentScrollY
    }

    lastScrollYRef.current = window.scrollY

    window.addEventListener('scroll', syncNavVisibility, { passive: true })
    window.addEventListener('resize', syncNavVisibility)

    return () => {
      window.removeEventListener('scroll', syncNavVisibility)
      window.removeEventListener('resize', syncNavVisibility)
    }
  }, [isMenuOpen, location.pathname])

  const routeKey = (() => {
    if (location.pathname.startsWith('/projects')) {
      return 'projects'
    }
    if (location.pathname.startsWith('/status')) {
      return 'status'
    }
    if (location.pathname.startsWith('/homelab')) {
      return 'homelab'
    }
    if (location.pathname.startsWith('/weather')) {
      return 'weather'
    }
    if (location.pathname.startsWith('/skills')) {
      return 'skills'
    }
    if (location.pathname.startsWith('/contact')) {
      return 'contact'
    }
    if (location.pathname.startsWith('/about')) {
      return 'about'
    }
    return 'home'
  })()

  const closeMenu = () => {
    setIsMobileNavHidden(false)
    setMenuState({
      isOpen: false,
      path: location.pathname,
    })
  }

  const dismissMaintenanceNotice = () => {
    if (!maintenanceNotice.enabled) {
      return
    }

    const storageKey = `nbdevlab:maintenance-notice:${maintenanceNotice.message}`
    window.sessionStorage.setItem(storageKey, '1')
    setIsMaintenanceNoticeDismissed(true)
  }

  const navItems = defaultSiteNavItems.map((item) =>
    item.action === 'admin' ? { ...item, visible: true } : item,
  )
  const navigation = getNavigationFromBuilderDocument(navigationDocument, {
    brandLabel: 'nbdevlab',
    brandHref: '/',
    navItems,
    headerActions: defaultHeaderActions,
  })

  return (
    <div className={`public-shell public-shell--${routeKey}`}>
      <div className="scene-backdrop" aria-hidden="true">
        <div className="scene-backdrop__mesh" />
      </div>
      <SiteAnnouncement announcement={announcement} siteVisible={siteVisible} />
      <SiteNavigation
        siteVisible={siteVisible}
        isMenuOpen={isMenuOpen}
        isMobileNavHidden={isMobileNavHidden}
        isAdminAuthenticated={isAdminAuthenticated}
        isCompactNav={isCompactNav}
        onMenuToggle={() => {
          setIsMobileNavHidden(false)
          setMenuState({
            isOpen: !isMenuOpen,
            path: location.pathname,
          })
        }}
        onCloseMenu={closeMenu}
        navItems={navigation.navItems}
        headerActions={navigation.headerActions}
        brandLabel={navigation.brandLabel}
        brandHref={navigation.brandHref}
        onOpenIntroSettings={onOpenIntroSettings}
      />

      {/* The status page states the maintenance itself, so the banner would repeat the same message there. */}
      {siteVisible && maintenanceNotice.enabled && !isMaintenanceNoticeDismissed && routeKey !== 'status' ? (
        <section className="maintenance-banner reveal-card" aria-live="polite">
          <div className="maintenance-banner__copy">
            <p className="eyebrow">Maintenance Mode</p>
            <p>{maintenanceNotice.message}</p>
          </div>
          <button className="button" type="button" onClick={dismissMaintenanceNotice}>
            Dismiss
          </button>
        </section>
      ) : null}

      <main className={`public-main public-main--${routeKey} ${siteVisible ? 'public-main--visible' : ''}`}>
        <Outlet />
      </main>
    </div>
  )
}
