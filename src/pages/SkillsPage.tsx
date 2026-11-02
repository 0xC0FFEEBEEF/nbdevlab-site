import { useEffect, useState } from 'react'
import { publicApi } from '../lib/api'
import { defaultSkillGroups, normalizeSkillGroups } from '../lib/skillsGroups'
import type { SkillGroup } from '../types/models'
import { SkillsPageView } from '../components/PublicSiteViews'
import type { BuilderDocument } from '../../shared/builder'

export function SkillsPage() {
  const [skillGroups, setSkillGroups] = useState<SkillGroup[]>(defaultSkillGroups)
  const [document, setDocument] = useState<BuilderDocument | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [settings, builderDocument] = await Promise.all([
          publicApi.getSiteSettings(),
          publicApi.getBuilderDocument('page.skills').catch(() => null),
        ])
        setSkillGroups(normalizeSkillGroups(settings.skillsGroups))
        setDocument(builderDocument)
      } catch {
        setNotice('Skills are temporarily unavailable.')
      }
    })()
  }, [])

  return (
    <SkillsPageView
      title="Technical Focus"
      intro="My strengths sit at the intersection of infrastructure, self-hosting, monitoring, security, and practical software. I enjoy building systems that are both useful and understandable, whether that means a live dashboard, a secure remote-access workflow, or a service stack that I can fully run and maintain myself."
      groups={skillGroups}
      notice={notice}
      document={document}
    />
  )
}
