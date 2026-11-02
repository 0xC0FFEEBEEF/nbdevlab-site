import { useEffect, useState } from 'react'
import { publicApi } from '../lib/api'
import { cloneAboutBlocks, defaultAboutBlocks } from '../lib/aboutBlocks'
import { cloneSkillGroups, defaultSkillGroups } from '../lib/skillsGroups'
import type { SiteSettings } from '../types/models'
import { ContactPageView } from '../components/PublicSiteViews'
import { TURNSTILE_FIELD } from '../lib/turnstile'
import type { BuilderDocument } from '../../shared/builder'
import { defaultGateSettings } from '../../shared/gateSettings'
import { defaultMaintenanceMessage } from '../../shared/maintenance'

const defaultSettings: SiteSettings = {
  email: 'you@example.com',
  phone: '',
  location: 'Mississippi, USA',
  socials: {},
  contactIntro:
    'Have a question, want to talk homelab infrastructure, or just want to reach out? Send me a message below or contact me directly.',
  maintenanceMode: false,
  maintenanceMessage: defaultMaintenanceMessage,
  statusPowerMode: 'live',
  aboutBlocks: cloneAboutBlocks(defaultAboutBlocks),
  skillsGroups: cloneSkillGroups(defaultSkillGroups),
  homeEyebrow: '',
  homeTitle: 'Hello There',
  homeTagline: 'I build and document homelab infrastructure, self-hosted services, and hands-on systems projects.',
  homeIntro:
    "I build and document real homelab infrastructure around Proxmox, self-hosted services, monitoring, security, automation, and live operational visibility. nbdevlab is where I share what I'm running, what I'm learning, and what I'm building next.",
  gateSettings: defaultGateSettings,
}

export function ContactPage() {
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings)
  const [document, setDocument] = useState<BuilderDocument | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const [siteSettings, builderDocument] = await Promise.all([
          publicApi.getSiteSettings(),
          publicApi.getBuilderDocument('page.contact').catch(() => null),
        ])
        setSettings(siteSettings)
        setDocument(builderDocument)
      } catch {
        setNotice('Contact details are temporarily unavailable.')
      }
    })()
  }, [])

  const onSubmitContact = async (formData: FormData) => {
    const name = String(formData.get('name') ?? '').trim()
    const email = String(formData.get('email') ?? '').trim()
    const message = String(formData.get('message') ?? '').trim()
    const turnstileToken = String(formData.get(TURNSTILE_FIELD) ?? '')

    if (!name || !email || !message) {
      setNotice('Please fill out all fields before sending.')
      return false
    }
    if (!turnstileToken) {
      setNotice('Still checking that you are human. Give it a second and send again.')
      return false
    }

    setIsSending(true)
    setNotice(null)

    try {
      await publicApi.sendContactMessage({ name, email, message, turnstileToken })
      setNotice('Message sent. I will get back to you soon.')
      return true
    } catch {
      setNotice('Message failed to send. Please try again.')
      return false
    } finally {
      setIsSending(false)
    }
  }

  return (
    <ContactPageView
      settings={settings}
      notice={notice}
      isSending={isSending}
      onSubmitContact={onSubmitContact}
      document={document}
    />
  )
}
