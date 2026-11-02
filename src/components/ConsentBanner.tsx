import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { updateAnalyticsConsent } from '../lib/analytics'
import { readStoredConsent, type AnalyticsConsent } from '../lib/consent'

interface ConsentBannerProps {
  visible: boolean
}

export function ConsentBanner({ visible }: ConsentBannerProps) {
  const [consent, setConsent] = useState<AnalyticsConsent | null>(() => readStoredConsent())
  const { pathname } = useLocation()

  // Not on the admin: it sat on top of the editor's save buttons.
  if (!visible || consent !== null || pathname.startsWith('/admin')) {
    return null
  }

  const choose = (choice: AnalyticsConsent) => {
    updateAnalyticsConsent(choice)
    setConsent(choice)
  }

  return (
    <section className="consent-banner" role="region" aria-label="Cookie consent">
      <div className="consent-banner__copy">
        <p className="eyebrow">Cookies</p>
        <p>
          Anonymous usage stats via Google Analytics.{' '}
          <Link className="consent-banner__link" to="/privacy">
            Privacy
          </Link>
        </p>
      </div>
      <div className="consent-banner__actions">
        <button className="button" type="button" onClick={() => choose('denied')}>
          Decline
        </button>
        <button className="button button--solid" type="button" onClick={() => choose('granted')}>
          Accept
        </button>
      </div>
    </section>
  )
}
