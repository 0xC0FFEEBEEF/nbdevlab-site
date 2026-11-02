import type {
  ApiEnvelope,
  ContactMessage,
  HomeCard,
  MessageStatus,
  Project,
  ProjectStatus,
  SiteSettings,
} from '../types/models'
import type { Announcement } from '../../shared/announcement'
import type { ProjectBlock } from '../../shared/projectBlocks'
import type { ProjectDetailCard, ProjectLink } from '../../shared/projectContent'
import { normalizeStackStatusPayload, type StackStatusSnapshot } from './stackStatus'
import type { WeatherStationSnapshot } from './weatherStation'
import type {
  BuilderDocument,
  BuilderDocumentKey,
  BuilderMediaAsset,
} from '../../shared/builder'

export interface ProjectInput {
  title: string
  summary: string
  details: string
  tech: string[]
  links: ProjectLink[]
  detailCards: ProjectDetailCard[]
  contentBlocks: ProjectBlock[]
  demoUrl?: string | null
  repoUrl?: string | null
  status: ProjectStatus
  publishAt: string | null
  isFeatured: boolean
}

export interface HomeCardInput {
  title: string
  subtitle: string
  body: string
  ctaLabel: string
  ctaUrl: string
  widthUnits: number
  heightUnits: number
  isVisible: boolean
}

export interface AboutImageUploadResult {
  id: number
  url: string
  filename: string
  suggestedAlt: string
}

export interface BuilderBootstrapPayload {
  bootstrapped: boolean
  documents: BuilderDocument[]
}

const directStatusApiBaseUrl = 'https://api.nbdevlab.com'
const directStatusFallbackOrigins = new Set(['https://www.nbdevlab.com', 'https://nbdevlab.com'])

function isCloudflareChallengeResponse(response: Response, bodyText: string): boolean {
  const mitigated = response.headers.get('cf-mitigated')
  if (mitigated && mitigated.toLowerCase() === 'challenge') {
    return true
  }

  if (response.status !== 403) {
    return false
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.includes('text/html')) {
    return false
  }

  return /just a moment|challenge-platform|enable javascript and cookies/i.test(bodyText)
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
  })
  const rawText = await response.text()

  if (isCloudflareChallengeResponse(response, rawText)) {
    throw new Error(
      'Cloudflare challenge is intercepting this API request. Exclude /api/* from managed challenge, bot-fight, or similar security rules on www.nbdevlab.com.',
    )
  }

  let body: ApiEnvelope<T>

  try {
    body = JSON.parse(rawText) as ApiEnvelope<T>
  } catch {
    throw new Error(`Invalid API response for ${path}`)
  }

  if (!response.ok || !body.success) {
    throw new Error(body.error ?? `Request failed: ${response.status}`)
  }

  return body.data
}

function shouldUseDirectStatusFallback(error: unknown): boolean {
  if (typeof window === 'undefined' || !directStatusFallbackOrigins.has(window.location.origin)) {
    return false
  }

  if (!(error instanceof Error)) {
    return false
  }

  return /Cloudflare challenge|Invalid API response|Request failed: 403|status api is behind a cloudflare challenge|allowlist \/api\/status and \/healthz/i.test(
    error.message,
  )
}

async function requestDirectStackStatus(): Promise<StackStatusSnapshot> {
  const sourceUrl = `${directStatusApiBaseUrl}/api/status`
  const healthUrl = `${directStatusApiBaseUrl}/healthz`
  const response = await fetch(sourceUrl, {
    credentials: 'omit',
    headers: {
      Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
    },
  })
  const rawText = await response.text()

  if (isCloudflareChallengeResponse(response, rawText)) {
    throw new Error(
      'Cloudflare challenge is intercepting the direct status API request. Allowlist the public status API for the site origin.',
    )
  }

  if (!response.ok) {
    throw new Error(`Status API returned ${response.status}.`)
  }

  let payload: unknown

  try {
    payload = JSON.parse(rawText) as unknown
  } catch {
    throw new Error('Status API did not return JSON.')
  }

  return normalizeStackStatusPayload(payload, sourceUrl, healthUrl)
}

async function sendJson<T, B>(path: string, method: string, payload: B): Promise<T> {
  return requestJson<T>(path, {
    method,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export const publicApi = {
  listHomeCards: () => requestJson<HomeCard[]>('/api/public/home-cards'),
  listProjects: () => requestJson<Project[]>('/api/public/projects'),
  getProject: (slug: string) => requestJson<Project>(`/api/public/projects/${encodeURIComponent(slug)}`),
  getSiteSettings: () => requestJson<SiteSettings>('/api/public/site-settings'),
  getBuilderBootstrap: () => requestJson<BuilderBootstrapPayload>('/api/public/builder/bootstrap'),
  getBuilderDocument: (docKey: BuilderDocumentKey) =>
    requestJson<BuilderDocument>(`/api/public/builder/documents/${encodeURIComponent(docKey)}`),
  getStackStatus: async () => {
    try {
      return await requestJson<StackStatusSnapshot>('/api/public/stack-status')
    } catch (error) {
      if (!shouldUseDirectStatusFallback(error)) {
        throw error
      }

      return requestDirectStackStatus()
    }
  },
  getWeatherStation: () => requestJson<WeatherStationSnapshot>('/api/public/weather-station'),
  sendContactMessage: (payload: { name: string; email: string; message: string; turnstileToken: string }) =>
    sendJson<{ id: number }, typeof payload>('/api/public/contact', 'POST', payload),
}

export const adminApi = {
  login: (payload: { username: string; password: string }) =>
    sendJson<{ authenticated: boolean }, { username: string; password: string }>(
      '/api/admin/auth/login',
      'POST',
      payload,
    ),
  logout: () =>
    requestJson<{ authenticated: boolean }>('/api/admin/auth/logout', {
      method: 'POST',
    }),
  getSession: () => requestJson<{ authenticated: boolean }>('/api/admin/auth/session'),
  listHomeCards: () => requestJson<HomeCard[]>('/api/admin/home-cards'),
  createHomeCard: (payload: HomeCardInput) =>
    sendJson<HomeCard, HomeCardInput>('/api/admin/home-cards', 'POST', payload),
  updateHomeCard: (id: number, payload: HomeCardInput) =>
    sendJson<HomeCard, HomeCardInput>(`/api/admin/home-cards/${id}`, 'PUT', payload),
  deleteHomeCard: (id: number) =>
    requestJson<{ id: number }>(`/api/admin/home-cards/${id}`, {
      method: 'DELETE',
    }),
  reorderHomeCards: (orderedIds: number[]) =>
    sendJson<{ updated: number }, { orderedIds: number[] }>(
      '/api/admin/home-cards/reorder',
      'POST',
      { orderedIds },
    ),
  listProjects: () => requestJson<Project[]>('/api/admin/projects'),
  createProject: (payload: ProjectInput) =>
    sendJson<Project, ProjectInput>('/api/admin/projects', 'POST', payload),
  updateProject: (id: number, payload: ProjectInput) =>
    sendJson<Project, ProjectInput>(`/api/admin/projects/${id}`, 'PUT', payload),
  deleteProject: (id: number) =>
    requestJson<{ id: number }>(`/api/admin/projects/${id}`, {
      method: 'DELETE',
    }),
  reorderProjects: (orderedIds: number[]) =>
    sendJson<{ updated: number }, { orderedIds: number[] }>(
      '/api/admin/projects/reorder',
      'POST',
      { orderedIds },
    ),
  uploadProjectImages: async (projectId: number, files: File[]) => {
    const formData = new FormData()
    files.forEach((file) => formData.append('images', file))

    return requestJson<Project>(`/api/admin/projects/${projectId}/images`, {
      method: 'POST',
      body: formData,
    })
  },
  reorderProjectImages: (projectId: number, orderedIds: number[]) =>
    sendJson<Project, { orderedIds: number[] }>(`/api/admin/projects/${projectId}/images`, 'PUT', { orderedIds }),
  uploadAboutImage: async (file: File) => {
    const formData = new FormData()
    formData.append('image', file)

    return requestJson<AboutImageUploadResult>('/api/admin/about-images', {
      method: 'POST',
      body: formData,
    })
  },
  getBuilderBootstrap: () => requestJson<BuilderBootstrapPayload>('/api/admin/builder/bootstrap'),
  getBuilderDocument: (docKey: BuilderDocumentKey) =>
    requestJson<BuilderDocument>(`/api/admin/builder/documents/${encodeURIComponent(docKey)}`),
  saveBuilderDocument: (docKey: BuilderDocumentKey, payload: BuilderDocument) =>
    sendJson<BuilderDocument, BuilderDocument>(
      `/api/admin/builder/documents/${encodeURIComponent(docKey)}`,
      'PUT',
      payload,
    ),
  listBuilderMedia: () => requestJson<BuilderMediaAsset[]>('/api/admin/builder/media'),
  uploadBuilderMedia: async (
    file: File,
    options?: {
      altText?: string
      caption?: string
    },
  ) => {
    const formData = new FormData()
    formData.append('asset', file)
    if (options?.altText) {
      formData.append('altText', options.altText)
    }
    if (options?.caption) {
      formData.append('caption', options.caption)
    }

    return requestJson<BuilderMediaAsset>('/api/admin/builder/media', {
      method: 'POST',
      body: formData,
    })
  },
  deleteBuilderMedia: (id: number) =>
    requestJson<{ id: number }>(`/api/admin/builder/media/${id}`, {
      method: 'DELETE',
    }),
  deleteImage: (imageId: number) =>
    requestJson<{ id: number }>(`/api/admin/images/${imageId}`, {
      method: 'DELETE',
    }),
  getSiteSettings: () => requestJson<SiteSettings>('/api/admin/site-settings'),
  updateSiteSettings: (payload: SiteSettings) =>
    sendJson<SiteSettings, SiteSettings>('/api/admin/site-settings', 'PUT', payload),
  // Sends the announcement alone, so unsaved edits on other tabs are not saved along with it.
  updateAnnouncement: (announcement: Announcement) =>
    sendJson<SiteSettings, { announcement: Announcement }>('/api/admin/site-settings', 'PUT', { announcement }),
  listMessages: () => requestJson<ContactMessage[]>('/api/admin/messages'),
  updateMessageStatus: (id: number, status: MessageStatus) =>
    sendJson<ContactMessage, { status: MessageStatus }>(
      `/api/admin/messages/${id}`,
      'PUT',
      { status },
    ),
}
