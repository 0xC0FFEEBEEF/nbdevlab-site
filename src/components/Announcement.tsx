import { useEffect, useId, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { Link } from 'react-router-dom'
import {
  isAnnouncementLive,
  splitAnnouncementParagraphs,
  toDateKey,
  type Announcement,
} from '../../shared/announcement'

const dismissedStorageKey = 'nbdevlab:announcement:dismissed'

function readDismissedStamp(): string {
  try {
    return window.localStorage.getItem(dismissedStorageKey) ?? ''
  } catch {
    return ''
  }
}

function rememberDismissedStamp(stamp: string) {
  try {
    window.localStorage.setItem(dismissedStorageKey, stamp)
  } catch {
    // Storage is blocked: the announcement stays dismissed until the page is reloaded.
  }
}

const announcementDateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })

function formatAnnouncementDate(timestamp: string): string {
  const date = new Date(timestamp)
  return timestamp && !Number.isNaN(date.getTime()) ? announcementDateFormat.format(date) : ''
}

/** The three slashes on each side of a strip message. They light up in turn, from the outside in. */
function AnnouncementMarks({ side }: { side: 'lead' | 'trail' }) {
  const glyph = side === 'lead' ? '/' : '\\'

  return (
    <span className={`announce-marks announce-marks--${side}`} aria-hidden="true">
      <i>{glyph}</i>
      <i>{glyph}</i>
      <i>{glyph}</i>
    </span>
  )
}

function AnnouncementLink({
  announcement,
  className,
  onFollow,
}: {
  announcement: Announcement
  className: string
  onFollow?: () => void
}) {
  if (!announcement.linkUrl) {
    return null
  }

  const label = announcement.linkLabel || 'Read more'

  if (announcement.linkUrl.startsWith('/')) {
    return (
      <Link className={className} to={announcement.linkUrl} onClick={onFollow}>
        {label}
      </Link>
    )
  }

  const opensNewTab = /^https?:/i.test(announcement.linkUrl)

  return (
    <a
      className={className}
      href={announcement.linkUrl}
      target={opensNewTab ? '_blank' : undefined}
      rel={opensNewTab ? 'noreferrer' : undefined}
      onClick={onFollow}
    >
      {label}
    </a>
  )
}

export function AnnouncementStrip({
  announcement,
  onDismiss,
}: {
  announcement: Announcement
  onDismiss?: () => void
}) {
  const canDismiss = announcement.dismissible && Boolean(onDismiss)
  const className = [
    'announce-strip',
    `announce-strip--${announcement.tone}`,
    announcement.animate ? 'announce-strip--animated' : '',
    // On phones a labelled strip puts the label between the slashes and the message on its own line.
    announcement.label ? 'announce-strip--labelled' : '',
    canDismiss ? 'announce-strip--dismissible' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <aside className={className} aria-label="Announcement">
      <div className="announce-strip__inner">
        <div className="announce-strip__line">
          <AnnouncementMarks side="lead" />
          <p className="announce-strip__text">
            {/* The spaces are for screen readers and copied text: the visible gaps come from margins. */}
            {announcement.label && <span className="announce-strip__label">{announcement.label} </span>}
            <span className="announce-strip__message">
              <span>{announcement.message.replace(/\s+/g, ' ')} </span>
              <AnnouncementLink announcement={announcement} className="announce-strip__link" />
            </span>
          </p>
          <AnnouncementMarks side="trail" />
        </div>
        {canDismiss && (
          <button
            type="button"
            className="announce-strip__dismiss"
            aria-label="Dismiss announcement"
            onClick={onDismiss}
          >
            <svg viewBox="0 0 14 14" aria-hidden="true">
              <path d="M2.5 2.5l9 9M11.5 2.5l-9 9" />
            </svg>
          </button>
        )}
      </div>
    </aside>
  )
}

export function AnnouncementCard({
  announcement,
  titleId,
  onDismiss,
  dismissRef,
}: {
  announcement: Announcement
  titleId?: string
  onDismiss: () => void
  dismissRef?: RefObject<HTMLButtonElement | null>
}) {
  const paragraphs = splitAnnouncementParagraphs(announcement.message)
  const labelLine = [announcement.label, formatAnnouncementDate(announcement.updatedAt)].filter(Boolean).join(' · ')

  return (
    <section className={`announce-card announce-card--${announcement.tone}`}>
      {labelLine && (
        <p className="announce-card__label">
          <span className="announce-card__dot" aria-hidden="true" />
          {labelLine}
        </p>
      )}
      {announcement.title && <h2 id={titleId}>{announcement.title}</h2>}
      {paragraphs.length > 0 && (
        <div className="announce-card__body">
          {paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      )}
      <div className="announce-card__actions">
        <button ref={dismissRef} type="button" className="button button--solid" onClick={onDismiss}>
          Got it
        </button>
        <AnnouncementLink announcement={announcement} className="announce-card__link" onFollow={onDismiss} />
      </div>
    </section>
  )
}

export function AnnouncementTakeover({
  announcement,
  onDismiss,
}: {
  announcement: Announcement
  onDismiss: () => void
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const dismissRef = useRef<HTMLButtonElement>(null)
  const onDismissRef = useRef(onDismiss)

  useEffect(() => {
    onDismissRef.current = onDismiss
  }, [onDismiss])

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dismissRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onDismissRef.current()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      // Keep the keyboard inside the dialog while it covers the page.
      const panel = panelRef.current
      const focusable = panel ? [...panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')] : []
      if (!panel || focusable.length === 0) {
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const isOutside = !panel.contains(document.activeElement)

      if (event.shiftKey && (isOutside || document.activeElement === first)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (isOutside || document.activeElement === last)) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus()
    }
  }, [])

  return (
    <div
      className="announce-takeover"
      role="dialog"
      aria-modal="true"
      aria-labelledby={announcement.title ? titleId : undefined}
      aria-label={announcement.title ? undefined : 'Announcement'}
      onClick={onDismiss}
    >
      <div className="announce-takeover__backdrop" />
      <div ref={panelRef} className="announce-takeover__panel" onClick={(event) => event.stopPropagation()}>
        <AnnouncementCard
          announcement={announcement}
          titleId={titleId}
          onDismiss={onDismiss}
          dismissRef={dismissRef}
        />
      </div>
    </div>
  )
}

/** Shows the saved announcement on the public site, unless this visitor already dismissed it. */
export function SiteAnnouncement({
  announcement,
  siteVisible,
}: {
  announcement: Announcement
  siteVisible: boolean
}) {
  const [dismissedStamp, setDismissedStamp] = useState(readDismissedStamp)

  if (!siteVisible || !isAnnouncementLive(announcement, toDateKey(new Date()))) {
    return null
  }

  const stamp = announcement.updatedAt || 'unstamped'
  const canDismiss = announcement.style === 'takeover' || announcement.dismissible

  if (canDismiss && dismissedStamp === stamp) {
    return null
  }

  const dismiss = () => {
    rememberDismissedStamp(stamp)
    setDismissedStamp(stamp)
  }

  return announcement.style === 'takeover' ? (
    <AnnouncementTakeover announcement={announcement} onDismiss={dismiss} />
  ) : (
    <AnnouncementStrip announcement={announcement} onDismiss={dismiss} />
  )
}
