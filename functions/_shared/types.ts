import type { Announcement } from '../../shared/announcement'
import type { GateSettings } from '../../shared/gateSettings'
import type { ProjectBlock } from '../../shared/projectBlocks'
import type { ProjectDetailCard, ProjectLink } from '../../shared/projectContent'
import type { StatusPowerMode } from '../../shared/statusPowerMode'
import type { ImageTransformer } from './imageResponse'

export type ProjectStatus = 'draft' | 'published' | 'scheduled'
export type MessageStatus = 'new' | 'read' | 'archived'

export type AboutBlock =
  | {
      id: string
      type: 'paragraph'
      content: string
      showTopRule: boolean
    }
  | {
      id: string
      type: 'image'
      src: string
      alt: string
      caption: string
      showTopRule: boolean
    }

export type SkillGroup = {
  id: string
  title: string
  items: string[]
}

export interface AppEnv {
  DB: D1Database
  IMAGES: R2Bucket
  IMAGE_TRANSFORMS?: ImageTransformer
  IMAGE_WEBP?: string
  TURNSTILE_SECRET?: string
  USER?: string
  PASS?: string
  ADMIN_USER?: string
  ADMIN_PASS?: string
  ADMIN_SESSION_SECRET?: string
  STATUS_API_BASE_URL?: string
  TEMPEST_ACCESS_TOKEN?: string
  TEMPEST_STATION_ID?: string
  TEMPEST_API_BASE_URL?: string
}

export interface ApiEnvelope<T> {
  success: boolean
  data: T
  error?: string
}

export interface ProjectImage {
  id: number
  projectId: number
  url: string
  altText: string
  position: number
  createdAt: string
}

export interface Project {
  id: number
  slug: string
  title: string
  summary: string
  details: string
  tech: string[]
  links: ProjectLink[]
  detailCards: ProjectDetailCard[]
  /** The arranged project page. Empty until the page has been arranged in the editor. */
  contentBlocks: ProjectBlock[]
  demoUrl: string | null
  repoUrl: string | null
  status: ProjectStatus
  publishAt: string | null
  isFeatured: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
  images: ProjectImage[]
}

export interface SiteSettings {
  email: string
  phone: string
  location: string
  socials: Record<string, string>
  contactIntro: string
  maintenanceMode: boolean
  maintenanceMessage: string
  announcement: Announcement
  statusPowerMode: StatusPowerMode
  homeEyebrow: string
  homeTitle: string
  homeTagline: string
  homeIntro: string
  aboutBlocks: AboutBlock[]
  skillsGroups: SkillGroup[]
  gateSettings: GateSettings
}

export interface ContactMessage {
  id: number
  name: string
  email: string
  message: string
  status: MessageStatus
  createdAt: string
}

export interface HomeCard {
  id: number
  title: string
  subtitle: string
  body: string
  ctaLabel: string
  ctaUrl: string
  widthUnits: number
  heightUnits: number
  sortOrder: number
  isVisible: boolean
  createdAt: string
  updatedAt: string
}
