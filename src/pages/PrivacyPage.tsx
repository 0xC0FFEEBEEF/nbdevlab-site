import type { CSSProperties } from 'react'

export function PrivacyPage() {
  return (
    <section className="public-page privacy-page reveal-card" style={{ '--delay': '120ms' } as CSSProperties}>
      <p className="eyebrow">Privacy</p>
      <h1>Privacy</h1>
      <div className="privacy-page__body">
        <p>
          This site uses Google Analytics 4 to collect anonymous usage statistics — which pages get
          visited and roughly how often. That&apos;s it: no ads, no personalization, no selling of
          anything to anyone.
        </p>
        <p>
          Analytics cookies are only set after you accept the cookie notice. If you decline, Google
          Analytics runs in a cookieless mode that stores nothing on your device.
        </p>
      </div>
      <footer className="privacy-page__note">
        <p className="eyebrow">Your Choice</p>
        <p>
          Changed your mind? Clear this site&apos;s data in your browser and the cookie notice will
          ask again on your next visit.
        </p>
      </footer>
    </section>
  )
}
