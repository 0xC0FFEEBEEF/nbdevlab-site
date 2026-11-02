import { useEffect, useState } from 'react'
import { publicApi } from '../lib/api'
import { defaultAboutBlocks, normalizeAboutBlocks } from '../lib/aboutBlocks'
import type { AboutBlock } from '../types/models'
import { AboutPageView } from '../components/PublicSiteViews'
import type { BuilderDocument } from '../../shared/builder'

export function AboutPage() {
  const [aboutBlocks, setAboutBlocks] = useState<AboutBlock[]>(defaultAboutBlocks)
  const [document, setDocument] = useState<BuilderDocument | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [settings, builderDocument] = await Promise.all([
          publicApi.getSiteSettings(),
          publicApi.getBuilderDocument('page.about').catch(() => null),
        ])
        setAboutBlocks(normalizeAboutBlocks(settings.aboutBlocks))
        setDocument(builderDocument)
      } catch {
        setNotice('About details are temporarily unavailable.')
      }
    })()
  }, [])

  return <AboutPageView aboutBlocks={aboutBlocks} notice={notice} document={document} />
}
