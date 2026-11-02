import { useEffect, useState } from 'react'
import { publicApi } from '../lib/api'
import type { Project } from '../types/models'
import { ProjectsPageView } from '../components/PublicSiteViews'
import type { BuilderDocument } from '../../shared/builder'

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [document, setDocument] = useState<BuilderDocument | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [projectList, builderDocument] = await Promise.all([
          publicApi.listProjects(),
          publicApi.getBuilderDocument('page.projects').catch(() => null),
        ])
        setProjects(projectList)
        setDocument(builderDocument)
      } catch {
        setError('Projects are temporarily unavailable.')
      } finally {
        setIsLoading(false)
      }
    })()
  }, [])

  return <ProjectsPageView projects={projects} isLoading={isLoading} error={error} document={document} />
}
