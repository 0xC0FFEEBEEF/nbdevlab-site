import type { Announcement } from '../../shared/announcement'
import type { GateSettings } from '../../shared/gateSettings'
import type { ProjectBlock } from '../../shared/projectBlocks'
import type { ProjectDetailCard, ProjectLink } from '../../shared/projectContent'
import type { StatusPowerMode } from '../../shared/statusPowerMode'

export type ProjectStatus = 'draft' | 'published' | 'scheduled'

export interface AboutParagraphBlock {
  id: string
  type: 'paragraph'
  content: string
  showTopRule: boolean
}

export interface AboutImageBlock {
  id: string
  type: 'image'
  src: string
  alt: string
  caption: string
  showTopRule: boolean
}

export type AboutBlock = AboutParagraphBlock | AboutImageBlock

export interface SkillGroup {
  id: string
  title: string
  items: string[]
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
  /** The arranged project page. Empty or missing until the page has been arranged in the editor. */
  contentBlocks?: ProjectBlock[]
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
  /** Missing in responses from a Worker that predates announcements. */
  announcement?: Announcement
  statusPowerMode: StatusPowerMode
  aboutBlocks: AboutBlock[]
  skillsGroups: SkillGroup[]
  homeEyebrow: string
  homeTitle: string
  homeTagline: string
  homeIntro: string
  gateSettings: GateSettings
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

export type MessageStatus = 'new' | 'read' | 'archived'

export interface ContactMessage {
  id: number
  name: string
  email: string
  message: string
  status: MessageStatus
  createdAt: string
}

export interface ApiEnvelope<T> {
  success: boolean
  data: T
  error?: string
}

export interface ReorderPayload {
  orderedIds: number[]
}
