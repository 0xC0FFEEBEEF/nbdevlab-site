import { useState } from 'react'
import {
  announcementHasText,
  announcementLimits,
  isAnnouncementExpired,
  normalizeAnnouncement,
  normalizeAnnouncementLink,
  stripComfortableLength,
  toDateKey,
  type Announcement,
  type AnnouncementStyle,
  type AnnouncementTone,
} from '../../shared/announcement'
import { AnnouncementCard, AnnouncementStrip } from './Announcement'

interface AnnouncementSettingsPanelProps {
  /** What is typed into the form right now. */
  draft: Announcement
  /** What the site is using. */
  saved: Announcement
  isBusy: boolean
  onChange: (draft: Announcement) => void
  onSave: () => void
  onDiscard: () => void
}

const styleChoices: { value: AnnouncementStyle; label: string; hint: string }[] = [
  {
    value: 'strip',
    label: 'Top strip',
    hint: 'A thin line above the menu, for news that can be read in passing.',
  },
  {
    value: 'takeover',
    label: 'Take-over',
    hint: 'Covers the page until the visitor presses Got it. Each visitor sees it once. Keep it for things nobody should miss.',
  },
]

const toneChoices: { value: AnnouncementTone; label: string }[] = [
  { value: 'plain', label: 'White' },
  { value: 'alert', label: 'Amber' },
]

const lastDayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

function describeSaved(saved: Announcement, today: string): string {
  if (!saved.enabled) {
    return 'It is switched off, so visitors see nothing.'
  }

  if (isAnnouncementExpired(saved, today)) {
    const lastDay = lastDayFormat.format(new Date(`${saved.expiresOn}T00:00:00Z`))
    return `It is switched on, but its last day was ${lastDay}, so visitors no longer see it.`
  }

  return saved.style === 'takeover'
    ? 'It is showing now as a take-over.'
    : 'It is showing now as a strip above the menu.'
}

function PreviewPage() {
  return (
    <div className="admin-announce__page" aria-hidden="true">
      <div className="admin-announce__page-nav">
        <span>nbdevlab</span>
        <span>Home · Projects · Homelab · Status · About</span>
      </div>
      <div className="admin-announce__page-body">
        <i />
        <i />
        <i />
      </div>
    </div>
  )
}

export function AnnouncementSettingsPanel({
  draft,
  saved,
  isBusy,
  onChange,
  onSave,
  onDiscard,
}: AnnouncementSettingsPanelProps) {
  const [openedAt] = useState(() => new Date())
  const today = toDateKey(openedAt)

  const cleaned = normalizeAnnouncement(draft)
  const isStrip = cleaned.style === 'strip'
  const isDirty = JSON.stringify(cleaned) !== JSON.stringify(saved)
  const preview: Announcement = { ...cleaned, updatedAt: cleaned.updatedAt || openedAt.toISOString() }
  const activeStyle = styleChoices.find((choice) => choice.value === cleaned.style) ?? styleChoices[0]

  const problem = (() => {
    if (draft.linkUrl.trim() !== '' && normalizeAnnouncementLink(draft.linkUrl) === '') {
      return 'The link address has to start with / for a page on this site, or with https://.'
    }

    if (cleaned.enabled && !announcementHasText(cleaned)) {
      return isStrip
        ? 'Write the message before switching it on.'
        : 'Write a headline or a message before switching it on.'
    }

    return ''
  })()

  const set = (changes: Partial<Announcement>) => onChange({ ...draft, ...changes })

  return (
    <section className="admin-panel admin-maintenance-panel admin-announce">
      <div className="admin-maintenance-panel__header">
        <div className="admin-maintenance-panel__copy">
          <h2>Announcement</h2>
          <p>One message for every visitor, on every public page. {describeSaved(saved, today)}</p>
        </div>
        <label className="admin-inline-checkbox admin-maintenance-panel__toggle">
          <input type="checkbox" checked={draft.enabled} onChange={(event) => set({ enabled: event.target.checked })} />
          Show it on the site
        </label>
      </div>

      <div className="admin-announce__preview">
        <p className="admin-announce__preview-label">
          Preview{!cleaned.enabled && ' · not shown to visitors while it is switched off'}
        </p>
        <div className={`admin-announce__stage admin-announce__stage--${cleaned.style}`} inert>
          {isStrip ? (
            <>
              {announcementHasText(cleaned) ? (
                <AnnouncementStrip announcement={preview} onDismiss={() => undefined} />
              ) : (
                <p className="admin-announce__empty">The strip appears here once it has a message.</p>
              )}
              <PreviewPage />
            </>
          ) : (
            <>
              <PreviewPage />
              <div className="admin-announce__dim">
                {announcementHasText(cleaned) ? (
                  <AnnouncementCard announcement={preview} onDismiss={() => undefined} />
                ) : (
                  <p className="admin-announce__empty">The take-over appears here once it has a headline or a message.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="admin-announce__form">
        <fieldset className="admin-announce__choice">
          <legend>Style</legend>
          <div className="admin-editor__actions">
            {styleChoices.map((choice) => (
              <button
                key={choice.value}
                className={`button${cleaned.style === choice.value ? ' button--solid' : ''}`}
                type="button"
                aria-pressed={cleaned.style === choice.value}
                onClick={() => set({ style: choice.value })}
              >
                {choice.label}
              </button>
            ))}
          </div>
          <p className="admin-announce__hint">{activeStyle.hint}</p>
        </fieldset>

        <fieldset className="admin-announce__choice">
          <legend>Colour</legend>
          <div className="admin-editor__actions">
            {toneChoices.map((choice) => (
              <button
                key={choice.value}
                className={`button${cleaned.tone === choice.value ? ' button--solid' : ''}`}
                type="button"
                aria-pressed={cleaned.tone === choice.value}
                onClick={() => set({ tone: choice.value })}
              >
                {choice.label}
              </button>
            ))}
          </div>
          <p className="admin-announce__hint">
            {isStrip ? 'Colours the slashes and the label.' : 'Colours the dot and the label line.'}
          </p>
        </fieldset>

        <label>
          Label (optional)
          <input
            type="text"
            value={draft.label}
            maxLength={announcementLimits.label}
            placeholder="Notice"
            onChange={(event) => set({ label: event.target.value })}
          />
        </label>

        {!isStrip && (
          <label>
            Headline
            <input
              type="text"
              value={draft.title}
              maxLength={announcementLimits.title}
              placeholder="Hurricane preparation"
              onChange={(event) => set({ title: event.target.value })}
            />
          </label>
        )}

        <label className="admin-announce__wide">
          Message
          <textarea
            rows={isStrip ? 2 : 5}
            value={draft.message}
            maxLength={announcementLimits.message}
            onChange={(event) => set({ message: event.target.value })}
          />
          <span className="admin-announce__hint">
            {cleaned.message.length} of {announcementLimits.message} characters.{' '}
            {isStrip
              ? cleaned.message.length > stripComfortableLength
                ? 'This is long for a strip and will wrap onto several lines. A take-over suits longer text.'
                : 'Keep it to one line.'
              : 'Leave an empty line between paragraphs.'}
          </span>
        </label>

        <label>
          Link text (optional)
          <input
            type="text"
            value={draft.linkLabel}
            maxLength={announcementLimits.linkLabel}
            placeholder="Lab status"
            onChange={(event) => set({ linkLabel: event.target.value })}
          />
        </label>

        <label>
          Link address (optional)
          <input
            type="text"
            inputMode="url"
            value={draft.linkUrl}
            maxLength={announcementLimits.linkUrl}
            placeholder="/status or https://…"
            onChange={(event) => set({ linkUrl: event.target.value })}
          />
        </label>

        <label>
          Last day to show it (optional)
          <input type="date" value={draft.expiresOn} onChange={(event) => set({ expiresOn: event.target.value })} />
          <span className="admin-announce__hint">Leave it empty to keep it up until you switch it off.</span>
        </label>

        {isStrip && (
          <div className="admin-announce__checks">
            <label className="admin-inline-checkbox">
              <input type="checkbox" checked={draft.animate} onChange={(event) => set({ animate: event.target.checked })} />
              Light the slashes one after another
            </label>
            <label className="admin-inline-checkbox">
              <input
                type="checkbox"
                checked={draft.dismissible}
                onChange={(event) => set({ dismissible: event.target.checked })}
              />
              Visitors can close it
            </label>
          </div>
        )}
      </div>

      <div className="admin-editor__actions admin-announce__actions">
        <button
          className="button button--solid"
          type="button"
          disabled={isBusy || !isDirty || problem !== ''}
          onClick={onSave}
        >
          Save announcement
        </button>
        <button className="button" type="button" disabled={isBusy || !isDirty} onClick={onDiscard}>
          Discard changes
        </button>
        <p className="admin-announce__state" role="status">
          {problem || (isDirty ? 'Unsaved changes.' : 'No unsaved changes.')}
        </p>
      </div>
    </section>
  )
}
