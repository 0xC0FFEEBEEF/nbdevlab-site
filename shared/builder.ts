export const builderSchemaVersion = 1
export const builderBootstrapKey = 'builder.bootstrap.v1'

export const builderDocumentKeys = [
  'layout.nav',
  'page.home',
  'page.about',
  'page.projects',
  'page.skills',
  'page.status',
  'page.contact',
] as const

export type BuilderDocumentKey = (typeof builderDocumentKeys)[number]

export type BuilderNodeType =
  | 'section'
  | 'container/box'
  | 'text'
  | 'image/media'
  | 'embed'
  | 'button/link'
  | 'collection'
  | 'dynamicWidget'
  | 'navItem'
  | 'spacer'

export interface BuilderPresentation {
  variant?: string
  emphasis?: 'subtle' | 'normal' | 'strong'
  textAlign?: 'left' | 'center' | 'right'
  fontSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'display'
  fontWeight?: 'regular' | 'medium' | 'semibold' | 'bold'
  lineHeight?: 'tight' | 'normal' | 'relaxed'
  letterSpacing?: 'tight' | 'normal' | 'wide' | 'eyebrow'
  textTransform?: 'none' | 'uppercase'
  textColor?: string
  mutedTextColor?: string
  surfaceColor?: string
  surfaceColorSecondary?: string
  borderColor?: string
  shadowColor?: string
  spacing?: 'compact' | 'cozy' | 'loose'
  width?: 'auto' | 'full' | 'content'
  span?: number
  visible?: boolean
  layout?: 'stack' | 'row' | 'grid' | 'flow'
  imageFit?: 'cover' | 'contain' | 'fill'
}

export interface BuilderNodeBinding {
  kind:
    | 'site-settings'
    | 'home-card'
    | 'about-block'
    | 'project'
    | 'skill-group'
    | 'nav-item'
    | 'status-widget'
    | 'builder-media'
  id?: number | string
  key?: string
  field?: string
}

export interface BuilderNode {
  id: string
  type: BuilderNodeType
  title?: string
  binding?: BuilderNodeBinding
  content?: Record<string, unknown>
  settings?: Record<string, unknown>
  presentation?: BuilderPresentation
  children?: BuilderNode[]
}

export interface BuilderDocument {
  docKey: BuilderDocumentKey | string
  schemaVersion: number
  title: string
  summary?: string
  root: BuilderNode
  updatedAt: string
  source?: 'seeded' | 'admin' | 'fallback'
}

export interface BuilderSelection {
  docKey: BuilderDocumentKey | string
  nodeId: string | null
  path: string[]
}

export interface BuilderDraftState {
  docKey: BuilderDocumentKey | string
  isDirty: boolean
  selectedNodeId: string | null
  history: BuilderDocument[]
  historyIndex: number
}

export interface NavItemConfig {
  id: string
  kind: 'internal' | 'external' | 'action'
  label: string
  href?: string
  action?: 'rain-screen' | 'admin'
  visible: boolean
  locked?: boolean
}

export interface BuilderMediaAsset {
  id: number
  r2Key: string
  originalName: string
  mimeType: string
  altText: string
  caption: string
  createdAt: string
  updatedAt: string
  url: string
}

export interface DynamicWidgetConfig {
  id: string
  kind: string
  title: string
  source: string
  settings: Record<string, unknown>
}

const builderNodeTypes = new Set<BuilderNodeType>([
  'section',
  'container/box',
  'text',
  'image/media',
  'embed',
  'button/link',
  'collection',
  'dynamicWidget',
  'navItem',
  'spacer',
])

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function normalizeId(value: unknown, fallbackPrefix: string, index: number): string {
  const normalized = asString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || `${fallbackPrefix}-${index + 1}`
}

function normalizeNodeType(value: unknown): BuilderNodeType | null {
  if (typeof value !== 'string') {
    return null
  }

  return builderNodeTypes.has(value as BuilderNodeType) ? (value as BuilderNodeType) : null
}

function normalizePresentation(value: unknown): BuilderPresentation | undefined {
  const record = asRecord(value)
  if (!record) {
    return undefined
  }

  const presentation: BuilderPresentation = {}

  const variant = asString(record.variant)
  if (variant) {
    presentation.variant = variant
  }

  const emphasis = asString(record.emphasis)
  if (emphasis === 'subtle' || emphasis === 'normal' || emphasis === 'strong') {
    presentation.emphasis = emphasis
  }

  const textAlign = asString(record.textAlign)
  if (textAlign === 'left' || textAlign === 'center' || textAlign === 'right') {
    presentation.textAlign = textAlign
  }

  const fontSize = asString(record.fontSize)
  if (fontSize === 'xs' || fontSize === 'sm' || fontSize === 'md' || fontSize === 'lg' || fontSize === 'xl' || fontSize === 'display') {
    presentation.fontSize = fontSize
  }

  const fontWeight = asString(record.fontWeight)
  if (fontWeight === 'regular' || fontWeight === 'medium' || fontWeight === 'semibold' || fontWeight === 'bold') {
    presentation.fontWeight = fontWeight
  }

  const lineHeight = asString(record.lineHeight)
  if (lineHeight === 'tight' || lineHeight === 'normal' || lineHeight === 'relaxed') {
    presentation.lineHeight = lineHeight
  }

  const letterSpacing = asString(record.letterSpacing)
  if (letterSpacing === 'tight' || letterSpacing === 'normal' || letterSpacing === 'wide' || letterSpacing === 'eyebrow') {
    presentation.letterSpacing = letterSpacing
  }

  const textTransform = asString(record.textTransform)
  if (textTransform === 'none' || textTransform === 'uppercase') {
    presentation.textTransform = textTransform
  }

  const textColor = asString(record.textColor)
  if (textColor) {
    presentation.textColor = textColor
  }

  const mutedTextColor = asString(record.mutedTextColor)
  if (mutedTextColor) {
    presentation.mutedTextColor = mutedTextColor
  }

  const surfaceColor = asString(record.surfaceColor)
  if (surfaceColor) {
    presentation.surfaceColor = surfaceColor
  }

  const surfaceColorSecondary = asString(record.surfaceColorSecondary)
  if (surfaceColorSecondary) {
    presentation.surfaceColorSecondary = surfaceColorSecondary
  }

  const borderColor = asString(record.borderColor)
  if (borderColor) {
    presentation.borderColor = borderColor
  }

  const shadowColor = asString(record.shadowColor)
  if (shadowColor) {
    presentation.shadowColor = shadowColor
  }

  const spacing = asString(record.spacing)
  if (spacing === 'compact' || spacing === 'cozy' || spacing === 'loose') {
    presentation.spacing = spacing
  }

  const width = asString(record.width)
  if (width === 'auto' || width === 'full' || width === 'content') {
    presentation.width = width
  }

  const span = asNumber(record.span)
  if (span !== null) {
    presentation.span = Math.max(1, Math.min(4, Math.round(span)))
  }

  if (typeof record.visible === 'boolean') {
    presentation.visible = record.visible
  }

  const layout = asString(record.layout)
  if (layout === 'stack' || layout === 'row' || layout === 'grid' || layout === 'flow') {
    presentation.layout = layout
  }

  const imageFit = asString(record.imageFit)
  if (imageFit === 'cover' || imageFit === 'contain' || imageFit === 'fill') {
    presentation.imageFit = imageFit
  }

  return Object.keys(presentation).length > 0 ? presentation : undefined
}

function normalizeBinding(value: unknown): BuilderNodeBinding | undefined {
  const record = asRecord(value)
  if (!record) {
    return undefined
  }

  const kind = asString(record.kind)
  if (
    kind !== 'site-settings' &&
    kind !== 'home-card' &&
    kind !== 'about-block' &&
    kind !== 'project' &&
    kind !== 'skill-group' &&
    kind !== 'nav-item' &&
    kind !== 'status-widget' &&
    kind !== 'builder-media'
  ) {
    return undefined
  }

  const binding: BuilderNodeBinding = { kind }

  const id = record.id
  if (typeof id === 'string' || typeof id === 'number') {
    binding.id = id
  }

  const key = asString(record.key)
  if (key) {
    binding.key = key
  }

  const field = asString(record.field)
  if (field) {
    binding.field = field
  }

  return binding
}

function normalizeNode(
  value: unknown,
  fallbackPrefix: string,
  index: number,
): BuilderNode | null {
  const record = asRecord(value)
  if (!record) {
    return null
  }

  const type = normalizeNodeType(record.type)
  if (!type) {
    return null
  }

  const children = Array.isArray(record.children)
    ? record.children
        .map((child, childIndex) => normalizeNode(child, `${fallbackPrefix}-${index + 1}`, childIndex))
        .filter((child): child is BuilderNode => Boolean(child))
    : undefined

  const node: BuilderNode = {
    id: normalizeId(record.id, fallbackPrefix, index),
    type,
  }

  const title = asString(record.title)
  if (title) {
    node.title = title
  }

  const binding = normalizeBinding(record.binding)
  if (binding) {
    node.binding = binding
  }

  const content = asRecord(record.content)
  if (content) {
    node.content = content
  }

  const settings = asRecord(record.settings)
  if (settings) {
    node.settings = settings
  }

  const presentation = normalizePresentation(record.presentation)
  if (presentation) {
    node.presentation = presentation
  }

  if (children && children.length > 0) {
    node.children = children
  }

  return node
}

function cloneNode(node: BuilderNode): BuilderNode {
  return {
    ...node,
    content: node.content ? JSON.parse(JSON.stringify(node.content)) : undefined,
    settings: node.settings ? JSON.parse(JSON.stringify(node.settings)) : undefined,
    presentation: node.presentation ? { ...node.presentation } : undefined,
    children: node.children?.map(cloneNode),
    binding: node.binding ? { ...node.binding } : undefined,
  }
}

export function createBuilderId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function isBuilderDocumentKey(value: string): value is BuilderDocumentKey {
  return (builderDocumentKeys as readonly string[]).includes(value)
}

export function cloneBuilderDocument(document: BuilderDocument): BuilderDocument {
  return {
    ...document,
    root: cloneNode(document.root),
  }
}

export function normalizeBuilderDocument(
  docKey: string,
  input: unknown,
): BuilderDocument | null {
  const record = asRecord(input)
  if (!record) {
    return null
  }

  const root = normalizeNode(record.root, docKey.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'builder', 0)
  if (!root) {
    return null
  }

  const source = asString(record.source)
  const normalizedSource =
    source === 'admin' || source === 'fallback' || source === 'seeded' ? source : 'seeded'

  return {
    docKey: asString(record.docKey) || docKey,
    schemaVersion: Math.max(1, Math.round(asNumber(record.schemaVersion) ?? builderSchemaVersion)),
    title: asString(record.title) || docKey,
    summary: asString(record.summary) || undefined,
    root,
    updatedAt: asString(record.updatedAt) || new Date().toISOString(),
    source: normalizedSource,
  }
}

export function parseBuilderDocument(raw: string | null, docKey: string): BuilderDocument | null {
  if (!raw?.trim()) {
    return null
  }

  try {
    return normalizeBuilderDocument(docKey, JSON.parse(raw))
  } catch {
    return null
  }
}

export function serializeBuilderDocument(document: BuilderDocument): string {
  return JSON.stringify(normalizeBuilderDocument(document.docKey, document) ?? cloneBuilderDocument(document))
}

export function createBuilderDocument(
  docKey: BuilderDocumentKey | string,
  title: string,
  root: BuilderNode,
  summary?: string,
  source: BuilderDocument['source'] = 'seeded',
): BuilderDocument {
  return {
    docKey,
    schemaVersion: builderSchemaVersion,
    title,
    summary,
    root,
    updatedAt: new Date().toISOString(),
    source,
  }
}

export function createBuilderNode(
  type: BuilderNodeType,
  id: string,
  extras: Omit<BuilderNode, 'type' | 'id'> = {},
): BuilderNode {
  return {
    id,
    type,
    ...extras,
  }
}

export const defaultNavigationItems: readonly NavItemConfig[] = [
  {
    id: 'nav-home',
    kind: 'internal',
    label: 'Home',
    href: '/',
    visible: true,
  },
  {
    id: 'nav-projects',
    kind: 'internal',
    label: 'Projects',
    href: '/projects',
    visible: true,
  },
  {
    id: 'nav-status',
    kind: 'internal',
    label: 'Status',
    href: '/status',
    visible: true,
  },
  {
    id: 'nav-weather',
    kind: 'internal',
    label: 'Wx',
    href: '/weather',
    visible: true,
  },
  {
    id: 'nav-about',
    kind: 'internal',
    label: 'About',
    href: '/about',
    visible: true,
  },
  {
    id: 'nav-skills',
    kind: 'internal',
    label: 'Skills',
    href: '/skills',
    visible: true,
  },
  {
    id: 'nav-contact',
    kind: 'internal',
    label: 'Contact',
    href: '/contact',
    visible: true,
  },
  {
    id: 'nav-rain-screen',
    kind: 'action',
    label: 'Rain Screen',
    action: 'rain-screen',
    visible: true,
    locked: true,
  },
  {
    id: 'nav-admin',
    kind: 'action',
    label: 'Admin',
    action: 'admin',
    visible: false,
    locked: true,
  },
]
