import type { ProjectDetailCard, ProjectLink } from './projectContent'
import { normalizeSafeLink } from './safeLink'

/**
 * A project page is a list of blocks, read left to right and top to bottom on a twelve-column grid.
 * `span` is how many of the twelve columns a block takes, so two half-width blocks sit side by side.
 * On a phone every block takes the full width.
 */
export const projectBlockTypes = ['summary', 'text', 'heading', 'image', 'card', 'stages', 'tags', 'links', 'divider'] as const
export type ProjectBlockType = (typeof projectBlockTypes)[number]

export const projectBlockSpans = [4, 6, 8, 12] as const
export type ProjectBlockSpan = (typeof projectBlockSpans)[number]

interface ProjectBlockBase {
  id: string
  span: ProjectBlockSpan
}

/** The project's summary, the same text as on its card in the project grid. */
export interface ProjectSummaryBlock extends ProjectBlockBase {
  type: 'summary'
}

export interface ProjectTextBlock extends ProjectBlockBase {
  type: 'text'
  text: string
}

export interface ProjectHeadingBlock extends ProjectBlockBase {
  type: 'heading'
  text: string
}

/** One of the project's uploaded pictures or GIFs. `imageId` is null until one is chosen. */
export interface ProjectImageBlock extends ProjectBlockBase {
  type: 'image'
  imageId: number | null
  alt: string
  caption: string
}

export interface ProjectCardBlock extends ProjectBlockBase {
  type: 'card'
  title: string
  text: string
  linkLabel: string
  linkUrl: string
}

/** One step on a stage map. */
export interface ProjectStage {
  id: string
  label: string
  note: string
}

/**
 * A row of stages read left to right, such as how far along I am with what the project taught me.
 * `current` is the index of the stage the project is at now: the stages before it are done, the ones after it are ahead.
 */
export interface ProjectStagesBlock extends ProjectBlockBase {
  type: 'stages'
  title: string
  stages: ProjectStage[]
  current: number
}

/** The project's tech tags. */
export interface ProjectTagsBlock extends ProjectBlockBase {
  type: 'tags'
}

/** The project's link buttons. */
export interface ProjectLinksBlock extends ProjectBlockBase {
  type: 'links'
}

export interface ProjectDividerBlock extends ProjectBlockBase {
  type: 'divider'
}

export type ProjectBlock =
  | ProjectSummaryBlock
  | ProjectTextBlock
  | ProjectHeadingBlock
  | ProjectImageBlock
  | ProjectCardBlock
  | ProjectStagesBlock
  | ProjectTagsBlock
  | ProjectLinksBlock
  | ProjectDividerBlock

export const projectBlockLimits = {
  blocks: 60,
  text: 6000,
  heading: 140,
  alt: 240,
  caption: 240,
  cardTitle: 120,
  cardText: 2000,
  linkLabel: 60,
  linkUrl: 400,
  stagesTitle: 120,
  stages: 8,
  stageLabel: 80,
  stageNote: 240,
} as const

/** The stages a new stage map starts with. */
export const defaultProjectStageLabels = ['AI assistance', 'Soak in the information, learn how it works', 'Master it'] as const

/** Blocks that show a field of the project itself, so a page holds each of them at most once. */
export const singletonProjectBlockTypes: readonly ProjectBlockType[] = ['summary', 'tags', 'links']

function createId(prefix = 'block'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 12)}`
}

export function createProjectStage(label = ''): ProjectStage {
  return { id: createId('stage'), label, note: '' }
}

function asText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.replace(/\r\n?/g, '\n').slice(0, maxLength) : ''
}

function asLine(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.replace(/\s*\n\s*/g, ' ').slice(0, maxLength) : ''
}

function asSpan(value: unknown, fallback: ProjectBlockSpan): ProjectBlockSpan {
  return projectBlockSpans.includes(value as ProjectBlockSpan) ? (value as ProjectBlockSpan) : fallback
}

function asImageId(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

export function defaultProjectBlockSpan(type: ProjectBlockType): ProjectBlockSpan {
  return type === 'image' || type === 'card' ? 6 : 12
}

export function createProjectBlock(type: ProjectBlockType, id: string = createId()): ProjectBlock {
  const base = { id, span: defaultProjectBlockSpan(type) }

  switch (type) {
    case 'text':
      return { ...base, type, text: '' }
    case 'heading':
      return { ...base, type, text: '' }
    case 'image':
      return { ...base, type, imageId: null, alt: '', caption: '' }
    case 'card':
      return { ...base, type, title: '', text: '', linkLabel: '', linkUrl: '' }
    case 'stages':
      return { ...base, type, title: '', stages: defaultProjectStageLabels.map((label) => createProjectStage(label)), current: 0 }
    default:
      return { ...base, type }
  }
}

function asStages(value: unknown): ProjectStage[] {
  if (!Array.isArray(value)) {
    return []
  }

  const stages: ProjectStage[] = []
  const usedIds = new Set<string>()

  for (const item of value) {
    if (stages.length >= projectBlockLimits.stages) {
      break
    }

    if (typeof item !== 'object' || item === null) {
      continue
    }

    const record = item as Record<string, unknown>
    let id = typeof record.id === 'string' && record.id.trim() ? record.id.trim().slice(0, 80) : createId('stage')
    while (usedIds.has(id)) {
      id = createId('stage')
    }
    usedIds.add(id)

    stages.push({
      id,
      label: asLine(record.label, projectBlockLimits.stageLabel),
      note: asText(record.note, projectBlockLimits.stageNote),
    })
  }

  return stages
}

function asStageIndex(value: unknown, stageCount: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || stageCount === 0) {
    return 0
  }

  return Math.min(Math.max(value, 0), stageCount - 1)
}

/**
 * Cleans blocks that came from the database or from a request. Text is kept as typed (spaces and all), so this is
 * safe to run on every keystroke; only its length is capped.
 */
export function normalizeProjectBlocks(value: unknown): ProjectBlock[] {
  if (!Array.isArray(value)) {
    return []
  }

  const blocks: ProjectBlock[] = []
  const usedIds = new Set<string>()
  const usedSingletons = new Set<ProjectBlockType>()

  for (const item of value) {
    if (blocks.length >= projectBlockLimits.blocks) {
      break
    }

    if (typeof item !== 'object' || item === null) {
      continue
    }

    const record = item as Record<string, unknown>
    const type = record.type as ProjectBlockType
    if (!projectBlockTypes.includes(type)) {
      continue
    }

    if (singletonProjectBlockTypes.includes(type)) {
      if (usedSingletons.has(type)) {
        continue
      }
      usedSingletons.add(type)
    }

    let id = typeof record.id === 'string' && record.id.trim() ? record.id.trim().slice(0, 80) : createId()
    while (usedIds.has(id)) {
      id = createId()
    }
    usedIds.add(id)

    const base = { id, span: asSpan(record.span, defaultProjectBlockSpan(type)) }

    switch (type) {
      case 'text':
        blocks.push({ ...base, type, text: asText(record.text, projectBlockLimits.text) })
        break
      case 'heading':
        blocks.push({ ...base, type, text: asLine(record.text, projectBlockLimits.heading) })
        break
      case 'image':
        blocks.push({
          ...base,
          type,
          imageId: asImageId(record.imageId),
          alt: asLine(record.alt, projectBlockLimits.alt),
          caption: asLine(record.caption, projectBlockLimits.caption),
        })
        break
      case 'card':
        blocks.push({
          ...base,
          type,
          title: asLine(record.title, projectBlockLimits.cardTitle),
          text: asText(record.text, projectBlockLimits.cardText),
          linkLabel: asLine(record.linkLabel, projectBlockLimits.linkLabel),
          // Kept as typed: the page only turns it into a link when it is a safe address.
          linkUrl: asLine(record.linkUrl, projectBlockLimits.linkUrl),
        })
        break
      case 'stages': {
        const stages = asStages(record.stages)
        blocks.push({
          ...base,
          type,
          title: asLine(record.title, projectBlockLimits.stagesTitle),
          stages,
          current: asStageIndex(record.current, stages.length),
        })
        break
      }
      default:
        blocks.push({ ...base, type })
    }
  }

  return blocks
}

/** The class names that place a block on the page grid. The editor and the public page share them. */
export function projectBlockClassName(block: ProjectBlock): string {
  return `project-block project-block--${block.type} project-block--span-${block.span}`
}

/** The address a card's link goes to, or empty when what was typed is not a safe address. */
export function projectCardLink(block: ProjectCardBlock): string {
  return normalizeSafeLink(block.linkUrl, projectBlockLimits.linkUrl)
}

/** Where each stage stands against the current one. */
export function projectStageState(index: number, current: number): 'done' | 'now' | 'ahead' {
  return index < current ? 'done' : index === current ? 'now' : 'ahead'
}

export const projectStageStateLabels = { done: 'Done', now: 'Now', ahead: 'Ahead' } as const

/** The first stage map on a project page with a stage name in it. The project's card shows it. */
export function findProjectStageMap(blocks: readonly ProjectBlock[] | undefined): ProjectStagesBlock | null {
  for (const block of blocks ?? []) {
    if (block.type === 'stages' && block.stages.some((stage) => stage.label.trim())) {
      return block
    }
  }
  return null
}

export function splitProjectParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

interface LegacyProjectContent {
  details: string
  tech: readonly string[]
  links: readonly ProjectLink[]
  detailCards: readonly ProjectDetailCard[]
  images: readonly { id: number; altText: string }[]
}

/**
 * The page a project gets before anyone has arranged it: what the old fixed layout showed, as blocks.
 * The ids are fixed so the same project always produces the same blocks.
 */
export function buildDefaultProjectBlocks(project: LegacyProjectContent): ProjectBlock[] {
  const blocks: ProjectBlock[] = []
  const [cover, ...otherImages] = project.images

  if (cover) {
    blocks.push({ id: `default-image-${cover.id}`, type: 'image', span: 6, imageId: cover.id, alt: cover.altText, caption: '' })
  }

  blocks.push({ id: 'default-summary', type: 'summary', span: cover ? 6 : 12 })

  if (project.details.trim()) {
    blocks.push({ id: 'default-details', type: 'text', span: 12, text: project.details.trim() })
  }

  for (const image of otherImages) {
    blocks.push({ id: `default-image-${image.id}`, type: 'image', span: 6, imageId: image.id, alt: image.altText, caption: '' })
  }

  if (project.tech.length > 0) {
    blocks.push({ id: 'default-tags', type: 'tags', span: 12 })
  }

  if (project.links.length > 0) {
    blocks.push({ id: 'default-links', type: 'links', span: 12 })
  }

  for (const card of project.detailCards) {
    blocks.push({
      id: `default-card-${card.id}`,
      type: 'card',
      span: 6,
      title: card.title,
      text: card.body,
      linkLabel: card.linkLabel,
      linkUrl: card.linkUrl,
    })
  }

  return blocks
}

/** The blocks to show for a project: its own arrangement, or the default one until it has been arranged. */
export function resolveProjectBlocks(
  project: LegacyProjectContent & { contentBlocks?: readonly ProjectBlock[] },
): ProjectBlock[] {
  return project.contentBlocks && project.contentBlocks.length > 0
    ? [...project.contentBlocks]
    : buildDefaultProjectBlocks(project)
}
