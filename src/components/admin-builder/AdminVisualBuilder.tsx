import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS as DndCSS } from '@dnd-kit/utilities'
import type {
  BuilderDocument,
  BuilderDocumentKey,
  BuilderMediaAsset,
  BuilderNode,
  BuilderSelection,
} from '../../../shared/builder'
import { createBuilderId, createBuilderNode } from '../../../shared/builder'
import {
  AboutPageView,
  ContactPageView,
  HomePageView,
  ProjectsPageView,
  SiteNavigation,
  SkillsPageView,
  StatusPageView,
} from '../PublicSiteViews'
import type {
  AboutImageBlock,
  AboutParagraphBlock,
  HomeCard,
  Project,
  ProjectImage,
  ProjectStatus,
  SiteSettings,
  SkillGroup,
} from '../../types/models'
import { defaultHeaderActions, defaultSiteNavItems } from '../../lib/siteNavigation'
import {
  findBuilderNode,
  getBuilderNode,
  getNavigationFromBuilderDocument,
} from '../../lib/builderDocuments'
import {
  applyBuilderPresentationSurfaceStyle,
  applyBuilderPresentationTextStyle,
} from '../../lib/builderPresentation'
import type { PublicBuilderContext } from '../../lib/publicBuilder'
import { publicApi } from '../../lib/api'
import { applyStatusPowerModeToWallboard } from '../../lib/statusPowerSimulation'
import {
  addBuilderChildNode,
  duplicateBuilderNode,
  moveBuilderNode,
  removeBuilderNode,
  reorderBuilderSiblings,
  updateBuilderDocumentNode,
} from './treeUtils'
import {
  extractPercentFromText,
  extractWallboard,
  sortGuests,
  sortNodes,
  type ProxmoxGuest,
  type ProxmoxNode,
  type ProxmoxWallboard,
} from '../../pages/StatusPage'
import { BuilderPresentationControls } from './BuilderPresentationControls'
import { ProjectRichContentEditor } from './ProjectRichContentEditor'
import { ProjectPageEditor, type ProjectPagePatch } from './ProjectPageEditor'
import { resolveProjectBlocks } from '../../../shared/projectBlocks'

type InspectorTab = 'content' | 'layout' | 'style' | 'settings'
type VisualSnapshot = {
  activePage: BuilderDocumentKey
  selection: BuilderSelection
  siteSettings: SiteSettings
  homeCards: HomeCard[]
  projects: Project[]
  documents: Partial<Record<BuilderDocumentKey, BuilderDocument>>
}

interface InspectorRect {
  x: number
  y: number
  width: number
  height: number
}

type InspectorGestureMode = 'move' | 'resize'

interface InspectorGestureState {
  pointerId: number
  mode: InspectorGestureMode
  originX: number
  originY: number
  startRect: InspectorRect
  workspaceWidth: number
  workspaceHeight: number
}

interface AdminVisualBuilderProps {
  activePage: BuilderDocumentKey
  onActivePageChange: (page: BuilderDocumentKey) => void
  siteSettings: SiteSettings
  setSiteSettings: React.Dispatch<React.SetStateAction<SiteSettings>>
  homeCards: HomeCard[]
  setHomeCards: React.Dispatch<React.SetStateAction<HomeCard[]>>
  projects: Project[]
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>
  documents: Partial<Record<BuilderDocumentKey, BuilderDocument>>
  setDocuments: React.Dispatch<React.SetStateAction<Record<BuilderDocumentKey, BuilderDocument | null>>>
  builderMedia: BuilderMediaAsset[]
  onUploadBuilderMedia: (file: File, options?: { altText?: string; caption?: string }) => Promise<BuilderMediaAsset>
  onDeleteBuilderMedia: (id: number) => Promise<void>
  onUploadAboutImage: (blockId: string, file: File | null) => Promise<void>
  onSavePage: (page: BuilderDocumentKey) => Promise<void>
  onSelectProject: (projectId: number | null) => void
  onSelectHomeCard: (cardId: number | null) => void
  /** Uploads pictures for a saved project and resolves with the ones that were added. */
  onUploadProjectImages: (projectId: number, files: File[]) => Promise<ProjectImage[]>
  onMakeProjectCover: (projectId: number, imageId: number) => void
  dataVersion: number
  isBusy: boolean
}

const pageOptions: Array<{ key: BuilderDocumentKey; label: string }> = [
  { key: 'page.home', label: 'Home' },
  { key: 'page.about', label: 'About' },
  { key: 'page.projects', label: 'Projects' },
  { key: 'page.skills', label: 'Skills' },
  { key: 'page.status', label: 'Status' },
  { key: 'page.contact', label: 'Contact' },
  { key: 'layout.nav', label: 'Navigation' },
]

function clampNumber(value: number, min: number, max: number): number {
  if (max <= min) {
    return min
  }

  return Math.min(max, Math.max(min, value))
}

function getDefaultInspectorRect(workspaceWidth: number, workspaceHeight: number): InspectorRect {
  const minWidth = Math.min(320, Math.max(260, workspaceWidth - 32))
  const maxWidth = Math.max(minWidth, workspaceWidth - 16)
  const minHeight = Math.min(420, Math.max(320, workspaceHeight - 32))
  const maxHeight = Math.max(minHeight, workspaceHeight - 16)
  const width = clampNumber(430, minWidth, maxWidth)
  const height = clampNumber(720, minHeight, maxHeight)

  return {
    x: Math.max(16, workspaceWidth - width - 16),
    y: 16,
    width,
    height,
  }
}

function clampInspectorRect(
  rect: InspectorRect,
  workspaceWidth: number,
  workspaceHeight: number,
): InspectorRect {
  const minWidth = Math.min(320, Math.max(260, workspaceWidth - 16))
  const maxWidth = Math.max(minWidth, workspaceWidth - 16)
  const minHeight = Math.min(420, Math.max(320, workspaceHeight - 16))
  const maxHeight = Math.max(minHeight, workspaceHeight - 16)
  const width = clampNumber(rect.width, minWidth, maxWidth)
  const height = clampNumber(rect.height, minHeight, maxHeight)

  return {
    width,
    height,
    x: clampNumber(rect.x, 0, Math.max(0, workspaceWidth - width)),
    y: clampNumber(rect.y, 0, Math.max(0, workspaceHeight - height)),
  }
}

function toDocumentState(
  documents: Partial<Record<BuilderDocumentKey, BuilderDocument>>,
): Record<BuilderDocumentKey, BuilderDocument | null> {
  return {
    'layout.nav': documents['layout.nav'] ?? null,
    'page.home': documents['page.home'] ?? null,
    'page.about': documents['page.about'] ?? null,
    'page.projects': documents['page.projects'] ?? null,
    'page.skills': documents['page.skills'] ?? null,
    'page.status': documents['page.status'] ?? null,
    'page.contact': documents['page.contact'] ?? null,
  }
}

const skillsIntro =
  'My strengths sit at the intersection of infrastructure, self-hosting, monitoring, security, and practical software. I enjoy building systems that are both useful and understandable, whether that means a live dashboard, a secure remote-access workflow, or a service stack that I can fully run and maintain myself.'

function cloneValue<T>(value: T): T {
  return structuredClone(value)
}

function nowIso() {
  return new Date().toISOString()
}

function createTempHomeCard(id: number): HomeCard {
  const timestamp = nowIso()
  return {
    id,
    title: 'New Card',
    subtitle: '',
    body: '',
    ctaLabel: 'Open',
    ctaUrl: '/',
    widthUnits: 1,
    heightUnits: 1,
    sortOrder: 0,
    isVisible: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function createTempProject(id: number, isFeatured = false): Project {
  const timestamp = nowIso()
  return {
    id,
    slug: `draft-${Math.abs(id)}`,
    title: 'New Project',
    summary: '',
    details: '',
    tech: [],
    links: [],
    detailCards: [],
    demoUrl: null,
    repoUrl: null,
    status: 'draft',
    publishAt: null,
    isFeatured,
    sortOrder: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    images: [],
  }
}

function createTempParagraphBlock(): AboutParagraphBlock {
  return {
    id: createBuilderId('about-block'),
    type: 'paragraph',
    content: 'New paragraph block.',
    showTopRule: false,
  }
}

function createTempImageBlock(): AboutImageBlock {
  return {
    id: createBuilderId('about-block'),
    type: 'image',
    src: '',
    alt: '',
    caption: '',
    showTopRule: false,
  }
}

function createTempSkillGroup(): SkillGroup {
  return {
    id: createBuilderId('skill-group'),
    title: 'New Group',
    items: [''],
  }
}

function sortProjectsForPreview(projects: Project[]) {
  return [...projects].sort((left, right) => {
    if (left.isFeatured !== right.isFeatured) {
      return Number(right.isFeatured) - Number(left.isFeatured)
    }
    return left.sortOrder - right.sortOrder || left.createdAt.localeCompare(right.createdAt)
  })
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length || fromIndex === toIndex) {
    return items
  }

  const nextItems = [...items]
  const [item] = nextItems.splice(fromIndex, 1)
  nextItems.splice(toIndex, 0, item)
  return nextItems
}

function findIndexById<T extends { id: number | string }>(items: T[], id: number | string) {
  return items.findIndex((item) => item.id === id)
}

function parseLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function parseCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function buildSnapshot(props: {
  activePage: BuilderDocumentKey
  selection: BuilderSelection
  siteSettings: SiteSettings
  homeCards: HomeCard[]
  projects: Project[]
  documents: Partial<Record<BuilderDocumentKey, BuilderDocument>>
}): VisualSnapshot {
  return {
    activePage: props.activePage,
    selection: cloneValue(props.selection),
    siteSettings: cloneValue(props.siteSettings),
    homeCards: cloneValue(props.homeCards),
    projects: cloneValue(props.projects),
    documents: cloneValue(props.documents),
  }
}

function humanizeLabel(value: string): string {
  return value
    .replace(/^page\./, '')
    .replace(/^layout\./, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function getCanvasRouteKey(page: BuilderDocumentKey): 'home' | 'about' | 'projects' | 'skills' | 'status' | 'contact' {
  if (page === 'page.about') {
    return 'about'
  }
  if (page === 'page.projects') {
    return 'projects'
  }
  if (page === 'page.skills') {
    return 'skills'
  }
  if (page === 'page.status') {
    return 'status'
  }
  if (page === 'page.contact') {
    return 'contact'
  }
  return 'home'
}

function getPageLabel(docKey: BuilderDocumentKey | string): string {
  return pageOptions.find((option) => option.key === docKey)?.label ?? humanizeLabel(docKey)
}

function getInspectorTitle(
  selection: BuilderSelection,
  selectedNode: BuilderNode | null,
): string {
  const explicitTitle = selectedNode?.title?.trim()
  if (explicitTitle && !/^[a-z0-9-]{24,}$/i.test(explicitTitle)) {
    return explicitTitle
  }

  if (selectedNode?.binding?.kind === 'about-block') {
    return selectedNode.type === 'image/media' ? 'About Image' : 'About Paragraph'
  }
  if (selectedNode?.binding?.kind === 'project') {
    return 'Project Card'
  }
  if (selectedNode?.binding?.kind === 'home-card') {
    return 'Home Card'
  }
  if (selectedNode?.binding?.kind === 'skill-group') {
    return 'Skill Group'
  }
  if (selectedNode?.binding?.kind === 'site-settings') {
    return explicitTitle || 'Page Content'
  }
  if (selectedNode?.binding?.kind === 'nav-item') {
    return 'Navigation Item'
  }

  if (selection.nodeId === null) {
    return `${getPageLabel(selection.docKey)} Page`
  }

  return selectedNode ? humanizeLabel(selectedNode.type) : 'Selection'
}

function getInspectorSubtitle(
  selection: BuilderSelection,
  selectedNode: BuilderNode | null,
): string {
  const binding = selectedNode?.binding?.kind ? humanizeLabel(selectedNode.binding.kind) : 'Builder Block'
  const type = selectedNode?.type ? humanizeLabel(selectedNode.type) : 'Page Root'
  return `${getPageLabel(selection.docKey)} · ${binding} · ${type}`
}

function applySelectionToCanvas(root: HTMLElement | null, selection: BuilderSelection) {
  if (!root) {
    return
  }

  root.querySelectorAll<HTMLElement>('[data-builder-selected="true"]').forEach((element) => {
    element.removeAttribute('data-builder-selected')
  })

  if (!selection.nodeId) {
    return
  }

  const escapedNodeId = globalThis.CSS?.escape ? globalThis.CSS.escape(selection.nodeId) : selection.nodeId
  const selector = `[data-builder-node-id="${escapedNodeId}"]`
  root.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    element.dataset.builderSelected = 'true'
  })
}

function clearPreviewPresentation(root: HTMLElement | null) {
  if (!root) {
    return
  }

  root.querySelectorAll<HTMLElement>('[data-builder-live-preview="true"]').forEach((element) => {
    element.removeAttribute('data-builder-live-preview')
    element.removeAttribute('data-builder-preview-variant')
    element.removeAttribute('data-builder-preview-emphasis')
    element.removeAttribute('data-builder-preview-visible')
    element.style.textAlign = ''
    element.style.fontSize = ''
    element.style.fontWeight = ''
    element.style.lineHeight = ''
    element.style.letterSpacing = ''
    element.style.textTransform = ''
    element.style.color = ''
    element.style.gap = ''
    element.style.display = ''
    element.style.flexWrap = ''
    element.style.gridTemplateColumns = ''
    element.style.maxWidth = ''
    element.style.width = ''
    element.style.gridColumn = ''
    element.style.removeProperty('--builder-surface-bg')
    element.style.removeProperty('--builder-surface-border-color')
    element.style.removeProperty('--builder-surface-shadow-color')
    element.style.removeProperty('--builder-surface-text-color')
    element.style.removeProperty('--builder-surface-muted-color')

    const image = element.querySelector<HTMLElement>('img')
    if (image) {
      image.style.objectFit = ''
    }
  })
}

function applyPreviewPresentation(
  root: HTMLElement | null,
  selection: BuilderSelection,
  selectedNode: BuilderNode | null,
) {
  clearPreviewPresentation(root)

  if (!root || !selection.nodeId || !selectedNode) {
    return
  }

  const escapedNodeId = globalThis.CSS?.escape ? globalThis.CSS.escape(selection.nodeId) : selection.nodeId
  const elements = root.querySelectorAll<HTMLElement>(`[data-builder-node-id="${escapedNodeId}"]`)
  if (elements.length === 0) {
    return
  }

  const presentation = selectedNode.presentation ?? {}

  elements.forEach((element) => {
    element.dataset.builderLivePreview = 'true'

    if (presentation.variant) {
      element.dataset.builderPreviewVariant = presentation.variant
    }
    if (presentation.emphasis) {
      element.dataset.builderPreviewEmphasis = presentation.emphasis
    }
    if (presentation.visible === false) {
      element.dataset.builderPreviewVisible = 'false'
    }

    if (presentation.textAlign) {
      element.style.textAlign = presentation.textAlign
    }

    applyBuilderPresentationSurfaceStyle(element, presentation)
    applyBuilderPresentationTextStyle(element, presentation)

    if (presentation.spacing === 'compact') {
      element.style.gap = '0.6rem'
    } else if (presentation.spacing === 'loose') {
      element.style.gap = '1.5rem'
    } else if (presentation.spacing === 'cozy') {
      element.style.gap = '1rem'
    }

    if (presentation.layout === 'row') {
      element.style.display = 'flex'
      element.style.flexWrap = 'wrap'
    } else if (presentation.layout === 'grid') {
      element.style.display = 'grid'
      element.style.gridTemplateColumns = 'repeat(auto-fit, minmax(220px, 1fr))'
    } else if (presentation.layout === 'flow') {
      element.style.display = 'block'
    }

    if (presentation.width === 'full') {
      element.style.width = '100%'
      element.style.maxWidth = 'none'
    } else if (presentation.width === 'content') {
      element.style.maxWidth = '68rem'
    }

    if (presentation.span) {
      element.style.gridColumn = `span ${presentation.span}`
    }

    if (selectedNode.type === 'image/media') {
      const image = element.querySelector<HTMLElement>('img')
      if (image && presentation.imageFit) {
        image.style.objectFit = presentation.imageFit
      }
    }
  })
}

function getSelectionRect(root: HTMLElement | null, selection: BuilderSelection) {
  if (!root || !selection.nodeId) {
    return null
  }

  const escapedNodeId = globalThis.CSS?.escape ? globalThis.CSS.escape(selection.nodeId) : selection.nodeId
  const element = root.querySelector<HTMLElement>(`[data-builder-node-id="${escapedNodeId}"]`)
  if (!element) {
    return null
  }

  const previewRect = root.getBoundingClientRect()
  const targetRect = element.getBoundingClientRect()
  return {
    top: targetRect.top - previewRect.top + root.scrollTop,
    left: targetRect.left - previewRect.left + root.scrollLeft,
    width: targetRect.width,
    height: targetRect.height,
  }
}

function createNodeByType(type: BuilderNode['type']): BuilderNode {
  if (type === 'text') {
    return createBuilderNode('text', createBuilderId('text'), {
      title: 'Text',
      content: {
        text: 'New text block.',
      },
    })
  }

  if (type === 'image/media') {
    return createBuilderNode('image/media', createBuilderId('media'), {
      title: 'Image',
      content: {
        src: '',
        alt: '',
        caption: '',
      },
      presentation: {
        imageFit: 'cover',
      },
    })
  }

  if (type === 'embed') {
    return createBuilderNode('embed', createBuilderId('embed'), {
      title: 'Embed',
      content: {
        provider: 'embed',
        title: 'Embedded content',
        url: '',
      },
    })
  }

  if (type === 'button/link') {
    return createBuilderNode('button/link', createBuilderId('link'), {
      title: 'Link',
      content: {
        label: 'Open link',
        href: '/',
      },
    })
  }

  if (type === 'spacer') {
    return createBuilderNode('spacer', createBuilderId('spacer'), {
      title: 'Spacer',
      content: {
        height: 40,
      },
    })
  }

  if (type === 'collection') {
    return createBuilderNode('collection', createBuilderId('collection'), {
      title: 'Collection',
      children: [],
    })
  }

  if (type === 'section') {
    return createBuilderNode('section', createBuilderId('section'), {
      title: 'Section',
      children: [],
    })
  }

  return createBuilderNode('container/box', createBuilderId('box'), {
    title: 'Box',
    children: [],
  })
}

function NodeBadge({ children }: { children: ReactNode }) {
  return <span className="admin-builder__node-badge">{children}</span>
}

function SortableLayerItem({
  node,
  selectedNodeId,
  onSelect,
  children,
  draggable,
}: {
  node: BuilderNode
  selectedNodeId: string | null
  onSelect: (nodeId: string) => void
  children?: ReactNode
  draggable: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
    data: {
      parentId: node.id,
    },
    disabled: !draggable,
  })

  return (
    <li
      ref={setNodeRef}
      className={`admin-builder__layer-item ${selectedNodeId === node.id ? 'is-selected' : ''} ${
        isDragging ? 'is-dragging' : ''
      }`}
      style={{
        transform: DndCSS.Transform.toString(transform),
        transition,
      }}
    >
      <button type="button" className="admin-builder__layer-button" onClick={() => onSelect(node.id)}>
        <span>{node.title || node.id}</span>
        <NodeBadge>{node.type}</NodeBadge>
      </button>
      {draggable && (
        <button
          type="button"
          className="admin-builder__drag-handle"
          aria-label={`Drag ${node.title || node.id}`}
          {...attributes}
          {...listeners}
        >
          Drag
        </button>
      )}
      {children}
    </li>
  )
}

function LayersTree({
  nodes,
  selectedNodeId,
  onSelect,
}: {
  nodes: BuilderNode[]
  selectedNodeId: string | null
  onSelect: (nodeId: string) => void
}) {
  return (
    <ul className="admin-builder__layer-list">
      {nodes.map((node) => (
        <SortableLayerItem
          key={node.id}
          node={node}
          selectedNodeId={selectedNodeId}
          onSelect={onSelect}
          draggable={!node.binding}
        >
          {node.children && node.children.length > 0 && (
            <LayersTree nodes={node.children} selectedNodeId={selectedNodeId} onSelect={onSelect} />
          )}
        </SortableLayerItem>
      ))}
    </ul>
  )
}

function StatusPreview({
  document,
  siteSettings,
  builder,
}: {
  document: BuilderDocument | null
  siteSettings: SiteSettings
  builder?: PublicBuilderContext
}) {
  const [rawSnapshot, setRawSnapshot] = useState<Awaited<ReturnType<typeof publicApi.getStackStatus>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hideOfflineGuests, setHideOfflineGuests] = useState(true)
  const [showAllMobileGuests, setShowAllMobileGuests] = useState(false)
  const [isCompactMobile] = useState(false)
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null)
  const [refreshNow, setRefreshNow] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const nextSnapshot = await publicApi.getStackStatus()
        if (cancelled) {
          return
        }
        setRawSnapshot(nextSnapshot)
        setError(null)
      } catch {
        if (!cancelled) {
          setError("Couldn't load the live status feed.")
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
          setNextRefreshAt(Date.now() + 5_000)
        }
      }
    }

    void load()
    const refreshTimer = window.setInterval(() => setRefreshNow(Date.now()), 1_000)
    return () => {
      cancelled = true
      window.clearInterval(refreshTimer)
    }
  }, [])

  const wallboard = applyStatusPowerModeToWallboard(
    extractWallboard(rawSnapshot?.raw ?? null),
    siteSettings.statusPowerMode,
  )
  const orderedGuests = wallboard ? sortGuests(wallboard.guests) : []
  const orderedNodes = wallboard ? sortNodes(wallboard.nodes) : []
  const visibleGuests = hideOfflineGuests ? orderedGuests.filter((guest) => guest.isRunning) : orderedGuests
  const displayedGuests = showAllMobileGuests ? visibleGuests : visibleGuests.slice(0, 6)
  const remainingGuestCount = Math.max(0, visibleGuests.length - displayedGuests.length)
  const spotlightNodes = orderedNodes.slice(0, 3)
  const compactNodes = orderedNodes.slice(0, 2)
  const batteryPercent = wallboard?.power ? extractPercentFromText(wallboard.power.summary.batteryCapacity) : null
  const loadPercent = wallboard?.power ? extractPercentFromText(wallboard.power.summary.load) : null

  return (
    <StatusPageView
      snapshot={rawSnapshot}
      wallboard={wallboard as ProxmoxWallboard | null}
      isUsingCachedSnapshot={false}
      error={error}
      isLoading={isLoading}
      hideOfflineGuests={hideOfflineGuests}
      isCompactMobile={isCompactMobile}
      showAllMobileGuests={showAllMobileGuests}
      nextRefreshAt={nextRefreshAt}
      refreshNow={refreshNow}
      refreshCountdown={nextRefreshAt === null ? null : Math.max(0, Math.ceil((nextRefreshAt - refreshNow) / 1_000))}
      visibleGuests={visibleGuests as ProxmoxGuest[]}
      displayedGuests={displayedGuests as ProxmoxGuest[]}
      remainingGuestCount={remainingGuestCount}
      guestPanelTitle="Guests"
      guestPanelSummary="I sort these by CPU so the busiest guests stay near the top."
      hasMobileGuestOverflow={false}
      spotlightNodes={spotlightNodes as ProxmoxNode[]}
      compactNodes={compactNodes as ProxmoxNode[]}
      batteryPercent={batteryPercent}
      loadPercent={loadPercent}
      onRetry={() => {
        setIsLoading(true)
        void publicApi.getStackStatus().then((nextSnapshot) => {
          setRawSnapshot(nextSnapshot)
          setError(null)
          setIsLoading(false)
          setNextRefreshAt(Date.now() + 5_000)
        }).catch(() => {
          setError("Couldn't load the live status feed.")
          setIsLoading(false)
        })
      }}
      onToggleOfflineGuests={setHideOfflineGuests}
      onToggleMobileGuests={() => setShowAllMobileGuests((current) => !current)}
      document={document}
      builder={builder}
    />
  )
}

export function AdminVisualBuilder({
  activePage,
  onActivePageChange,
  siteSettings,
  setSiteSettings,
  homeCards,
  setHomeCards,
  projects,
  setProjects,
  documents,
  setDocuments,
  builderMedia,
  onUploadBuilderMedia,
  onDeleteBuilderMedia,
  onUploadAboutImage,
  onSavePage,
  onSelectProject,
  onSelectHomeCard,
  onUploadProjectImages,
  onMakeProjectCover,
  dataVersion,
  isBusy,
}: AdminVisualBuilderProps) {
  const [selection, setSelection] = useState<BuilderSelection>({
    docKey: activePage,
    nodeId: null,
    path: [],
  })
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('content')
  const [history, setHistory] = useState<VisualSnapshot[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [showLayers, setShowLayers] = useState(false)
  const [showInspector, setShowInspector] = useState(false)
  const [inspectorRect, setInspectorRect] = useState<InspectorRect>({
    x: 0,
    y: 16,
    width: 430,
    height: 720,
  })
  const [hasPlacedInspector, setHasPlacedInspector] = useState(false)
  const [inspectorGesture, setInspectorGesture] = useState<InspectorGestureState | null>(null)
  const previewRef = useRef<HTMLDivElement | null>(null)
  const workspaceRef = useRef<HTMLDivElement | null>(null)
  const inspectorRef = useRef<HTMLElement | null>(null)
  const tempIdRef = useRef(-1)
  // The project whose own page is open in the page editor, in place of the Projects canvas.
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null)
  const lastCommitRef = useRef<{ key: string; index: number } | null>(null)
  const coalesceTimerRef = useRef<number | undefined>(undefined)
  const canvasScrollTopRef = useRef(0)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const canvasPage = activePage === 'layout.nav' ? 'page.home' : activePage
  const canvasRouteKey = getCanvasRouteKey(canvasPage)
  const navDocument = documents['layout.nav'] ?? null
  const inspectedDocKey = selection.docKey as BuilderDocumentKey
  const inspectedDocument = documents[inspectedDocKey] ?? null
  const selectedNode =
    selection.nodeId === null
      ? inspectedDocument?.root ?? null
      : selection.nodeId === 'layout.nav'
        ? navDocument?.root ?? null
        : getBuilderNode(inspectedDocument, selection.nodeId)
  const selectedRect = getSelectionRect(previewRef.current, selection)
  const canUndo = historyIndex > 0
  const canRedo = historyIndex >= 0 && historyIndex < history.length - 1
  const fallbackNavigation = useMemo(
    () => ({
      brandLabel: 'nbdevlab',
      brandHref: '/',
      navItems: defaultSiteNavItems.map((item) =>
        item.action === 'admin' ? { ...item, visible: true } : item,
      ),
      headerActions: defaultHeaderActions,
    }),
    [],
  )
  const navigation = getNavigationFromBuilderDocument(navDocument, fallbackNavigation)
  const previewNavigation = useMemo(
    () => ({
      ...navigation,
      navItems: navigation.navItems.filter((item) => item.kind !== 'action'),
      headerActions: [],
    }),
    [navigation],
  )
  const inspectorTitle = getInspectorTitle(selection, selectedNode)
  const inspectorSubtitle = getInspectorSubtitle(selection, selectedNode)
  const inspectorStyle = showInspector
    ? {
        left: `${inspectorRect.x}px`,
        top: `${inspectorRect.y}px`,
        width: `${inspectorRect.width}px`,
        height: `${inspectorRect.height}px`,
        right: 'auto',
        bottom: 'auto',
      }
    : undefined

  useEffect(() => {
    applySelectionToCanvas(previewRef.current, selection)
  }, [selection, activePage, documents, siteSettings, homeCards, projects])

  useEffect(() => {
    applyPreviewPresentation(previewRef.current, selection, selectedNode)
  }, [selection, selectedNode])

  useEffect(() => {
    const initialSelection: BuilderSelection = {
      docKey: activePage,
      nodeId: null,
      path: [],
    }
    setSelection(initialSelection)
    const nextSnapshot = buildSnapshot({
      activePage,
      selection: initialSelection,
      siteSettings,
      homeCards,
      projects,
      documents,
    })
    setHistory([nextSnapshot])
    setHistoryIndex(0)
  }, [dataVersion])

  useEffect(() => {
    if (selection.docKey !== activePage && selection.docKey !== 'layout.nav') {
      setSelection((current) => ({
        ...current,
        docKey: activePage,
      }))
    }
  }, [activePage, selection.docKey])

  useEffect(() => {
    previewRef.current?.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto',
    })
  }, [activePage])

  useEffect(() => {
    if (selection.nodeId && editingProjectId === null) {
      setShowInspector(true)
    }
  }, [selection.nodeId, editingProjectId])

  useEffect(() => {
    if (!showInspector) {
      return
    }

    const workspace = workspaceRef.current
    if (!workspace) {
      return
    }

    const nextRect = hasPlacedInspector
      ? clampInspectorRect(inspectorRect, workspace.clientWidth, workspace.clientHeight)
      : getDefaultInspectorRect(workspace.clientWidth, workspace.clientHeight)

    if (
      nextRect.x !== inspectorRect.x ||
      nextRect.y !== inspectorRect.y ||
      nextRect.width !== inspectorRect.width ||
      nextRect.height !== inspectorRect.height
    ) {
      setInspectorRect(nextRect)
    }

    if (!hasPlacedInspector) {
      setHasPlacedInspector(true)
    }
  }, [
    hasPlacedInspector,
    inspectorRect.height,
    inspectorRect.width,
    inspectorRect.x,
    inspectorRect.y,
    showInspector,
  ])

  useEffect(() => {
    if (!showInspector) {
      return
    }

    const handleResize = () => {
      const workspace = workspaceRef.current
      if (!workspace) {
        return
      }

      setInspectorRect((current) =>
        clampInspectorRect(current, workspace.clientWidth, workspace.clientHeight),
      )
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [showInspector])

  useEffect(() => {
    if (!inspectorGesture) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== inspectorGesture.pointerId) {
        return
      }

      const deltaX = event.clientX - inspectorGesture.originX
      const deltaY = event.clientY - inspectorGesture.originY

      const nextRect =
        inspectorGesture.mode === 'move'
          ? {
              ...inspectorGesture.startRect,
              x: inspectorGesture.startRect.x + deltaX,
              y: inspectorGesture.startRect.y + deltaY,
            }
          : {
              ...inspectorGesture.startRect,
              width: inspectorGesture.startRect.width + deltaX,
              height: inspectorGesture.startRect.height + deltaY,
            }

      setInspectorRect(
        clampInspectorRect(
          nextRect,
          inspectorGesture.workspaceWidth,
          inspectorGesture.workspaceHeight,
        ),
      )
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId === inspectorGesture.pointerId) {
        setInspectorGesture(null)
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [inspectorGesture])

  const beginInspectorGesture = (
    event: ReactPointerEvent<HTMLElement>,
    mode: InspectorGestureMode,
  ) => {
    const workspace = workspaceRef.current
    if (!workspace) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const currentRect = clampInspectorRect(
      {
        ...inspectorRect,
        width: inspectorRef.current?.offsetWidth ?? inspectorRect.width,
        height: inspectorRef.current?.offsetHeight ?? inspectorRect.height,
      },
      workspace.clientWidth,
      workspace.clientHeight,
    )

    setInspectorRect(currentRect)
    setInspectorGesture({
      pointerId: event.pointerId,
      mode,
      originX: event.clientX,
      originY: event.clientY,
      startRect: currentRect,
      workspaceWidth: workspace.clientWidth,
      workspaceHeight: workspace.clientHeight,
    })
  }

  const handleInspectorHeadPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target
    if (target instanceof Element && target.closest('button, input, textarea, select, a, label')) {
      return
    }

    beginInspectorGesture(event, 'move')
  }

  /**
   * `coalesceKey` names the field being edited. Edits to the same field in quick succession replace the last
   * history entry, so Undo takes back the run of typing and not one letter. A pause of a second and a half ends
   * the run.
   */
  const commitMutation = (mutator: (snapshot: VisualSnapshot) => VisualSnapshot, coalesceKey?: string) => {
    const current = buildSnapshot({
      activePage,
      selection,
      siteSettings,
      homeCards,
      projects,
      documents,
    })
    const next = mutator(cloneValue(current))
    setSiteSettings(next.siteSettings)
    setHomeCards(next.homeCards)
    setProjects(next.projects)
    setDocuments(toDocumentState(next.documents))
    onActivePageChange(next.activePage)
    setSelection(next.selection)

    const last = lastCommitRef.current
    const continuesLastEdit =
      coalesceKey !== undefined &&
      last !== null &&
      last.key === coalesceKey &&
      last.index === historyIndex &&
      historyIndex > 0 &&
      historyIndex === history.length - 1

    if (continuesLastEdit) {
      setHistory((currentHistory) => [...currentHistory.slice(0, historyIndex), next])
    } else {
      setHistory((currentHistory) => [...currentHistory.slice(0, historyIndex + 1), next])
      setHistoryIndex((currentIndex) => currentIndex + 1)
    }
    window.clearTimeout(coalesceTimerRef.current)
    lastCommitRef.current =
      coalesceKey === undefined
        ? null
        : { key: coalesceKey, index: continuesLastEdit ? historyIndex : historyIndex + 1 }
    if (coalesceKey !== undefined) {
      coalesceTimerRef.current = window.setTimeout(() => {
        lastCommitRef.current = null
      }, 1500)
    }
  }

  const restoreSnapshot = (snapshot: VisualSnapshot) => {
    lastCommitRef.current = null
    setSiteSettings(snapshot.siteSettings)
    setHomeCards(snapshot.homeCards)
    // Uploads are saved straight away, so undo must not take a picture back out of a project's list.
    const liveImages = new Map(projects.map((project) => [project.id, project.images]))
    setProjects(
      snapshot.projects.map((project) => ({ ...project, images: liveImages.get(project.id) ?? project.images })),
    )
    setDocuments(toDocumentState(snapshot.documents))
    onActivePageChange(snapshot.activePage)
    setSelection(snapshot.selection)
  }

  const onUndo = () => {
    if (!canUndo) {
      return
    }
    const nextIndex = historyIndex - 1
    setHistoryIndex(nextIndex)
    restoreSnapshot(history[nextIndex])
  }

  const onRedo = () => {
    if (!canRedo) {
      return
    }
    const nextIndex = historyIndex + 1
    setHistoryIndex(nextIndex)
    restoreSnapshot(history[nextIndex])
  }

  const updateDocument = (
    docKey: BuilderDocumentKey,
    updater: (document: BuilderDocument) => BuilderDocument,
  ) => {
    commitMutation((snapshot) => {
      const existingDocument = snapshot.documents[docKey]
      if (!existingDocument) {
        return snapshot
      }
      snapshot.documents[docKey] = updater(existingDocument)
      snapshot.selection.docKey = docKey
      return snapshot
    })
  }

  const updateSelectedNodePresentation = (
    field: keyof NonNullable<BuilderNode['presentation']>,
    value: unknown,
  ) => {
    if (!selection.nodeId) {
      return
    }

    updateDocument(selection.docKey as BuilderDocumentKey, (document) =>
      updateBuilderDocumentNode(document, selection.nodeId!, (node) => ({
        ...node,
        presentation: {
          ...(node.presentation ?? {}),
          [field]: value,
        },
      })),
    )
  }

  const selectNode = (docKey: BuilderDocumentKey, nodeId: string | null) => {
    const root = documents[docKey]?.root
    setSelection({
      docKey,
      nodeId,
      path: nodeId && root ? findBuilderNode(root, nodeId)?.path ?? [] : [],
    })
  }

  const onCanvasNavigate = (target: string) => {
    if (target === '/admin') {
      setSelection({ docKey: 'layout.nav', nodeId: 'nav-admin', path: [] })
      onActivePageChange('layout.nav')
      return
    }

    if (target === '/') {
      onActivePageChange('page.home')
      return
    }

    if (target.startsWith('/about')) {
      onActivePageChange('page.about')
      return
    }
    if (target.startsWith('/projects')) {
      onActivePageChange('page.projects')
      return
    }
    if (target.startsWith('/skills')) {
      onActivePageChange('page.skills')
      return
    }
    if (target.startsWith('/status')) {
      onActivePageChange('page.status')
      return
    }
    if (target.startsWith('/weather')) {
      setSelection({ docKey: 'layout.nav', nodeId: 'nav-weather', path: [] })
      onActivePageChange('layout.nav')
      return
    }
    if (target.startsWith('/contact')) {
      onActivePageChange('page.contact')
    }
  }

  const builderContext: PublicBuilderContext = {
    mode: 'builder',
    onNavigate: onCanvasNavigate,
    onAction: (action) => {
      if (action === 'admin') {
        setSelection({ docKey: 'layout.nav', nodeId: 'nav-admin', path: [] })
        onActivePageChange('layout.nav')
        return
      }
      if (action === 'rain-screen') {
        setSelection({ docKey: 'layout.nav', nodeId: 'nav-rain-screen', path: [] })
        onActivePageChange('layout.nav')
      }
    },
  }

  const onCanvasClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    const selectable = target.closest<HTMLElement>('[data-builder-node-id]')
    if (!selectable || !previewRef.current?.contains(selectable)) {
      return
    }

    const nodeId = selectable.dataset.builderNodeId ?? null
    const docKey = (selectable.dataset.builderDocKey as BuilderDocumentKey | undefined) ??
      (selectable.dataset.builderRegion === 'site-header' || selectable.dataset.builderRegion === 'site-nav'
        ? 'layout.nav'
        : activePage)

    event.preventDefault()
    event.stopPropagation()
    setSelection({
      docKey,
      nodeId,
      path: nodeId && documents[docKey] ? findBuilderNode(documents[docKey].root, nodeId)?.path ?? [] : [],
    })

    if (nodeId?.startsWith('project-')) {
      const projectId = Number(nodeId.replace('project-', ''))
      onSelectProject(Number.isFinite(projectId) ? projectId : null)
      if (docKey === 'page.projects' && Number.isFinite(projectId)) {
        canvasScrollTopRef.current = previewRef.current?.scrollTop ?? 0
        setEditingProjectId(projectId)
        setShowInspector(false)
        setShowLayers(false)
      }
    }
    if (nodeId?.startsWith('home-card-')) {
      const cardId = Number(nodeId.replace('home-card-', ''))
      onSelectHomeCard(Number.isFinite(cardId) ? cardId : null)
    }
  }

  const editingProject =
    activePage === 'page.projects' && editingProjectId !== null
      ? projects.find((project) => project.id === editingProjectId) ?? null
      : null

  const closeProjectPage = () => {
    setEditingProjectId(null)
    // Back to the project that was clicked, once the canvas is on screen again.
    window.requestAnimationFrame(() => previewRef.current?.scrollTo({ top: canvasScrollTopRef.current }))
  }

  const updateEditingProject = (changes: Partial<Project>, editKey: string) => {
    if (!editingProject) {
      return
    }

    const projectId = editingProject.id
    commitMutation((snapshot) => {
      snapshot.projects = snapshot.projects.map((item) =>
        item.id === projectId ? { ...item, ...changes, updatedAt: nowIso() } : item,
      )
      return snapshot
    }, `project:${projectId}:${editKey}`)
  }

  const currentLayerNodes: BuilderNode[] = inspectedDocument?.root.children ?? []

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }

    const docKey = selection.docKey as BuilderDocumentKey
    const currentDocument = documents[docKey]
    if (!currentDocument) {
      return
    }

    const activeLocation = findBuilderNode(currentDocument.root, String(active.id))
    const overLocation = findBuilderNode(currentDocument.root, String(over.id))

    if (!activeLocation || !overLocation || activeLocation.parentId !== overLocation.parentId || !activeLocation.parentId) {
      return
    }

    const node = activeLocation.node
    if (node.binding) {
      return
    }

    updateDocument(docKey, (document) =>
      reorderBuilderSiblings(document, activeLocation.parentId!, String(active.id), String(over.id)),
    )
  }

  const addGenericNode = (type: BuilderNode['type']) => {
    const docKey = selection.docKey as BuilderDocumentKey
    const document = documents[docKey]
    if (!document) {
      return
    }
    const selected = selectedNode
    const parentId =
      selected && (selected.type === 'collection' || selected.type === 'section' || selected.type === 'container/box')
        ? selected.id
        : document.root.id

    const nextNode = createNodeByType(type)
    updateDocument(docKey, (currentDocument) => addBuilderChildNode(currentDocument, parentId, nextNode))
    setSelection({ docKey, nodeId: nextNode.id, path: [] })
  }

  const duplicateSelected = () => {
    if (!selection.nodeId) {
      return
    }

    if (selection.docKey === 'page.projects' && selection.nodeId.startsWith('project-')) {
      const projectId = Number(selection.nodeId.replace('project-', ''))
      const source = projects.find((project) => project.id === projectId)
      if (!source) {
        return
      }

      commitMutation((snapshot) => {
        const id = tempIdRef.current--
        snapshot.projects.push({
          ...cloneValue(source),
          id,
          slug: `draft-${Math.abs(id)}`,
          title: `${source.title} Copy`,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        })
        snapshot.selection = { docKey: 'page.projects', nodeId: `project-${id}`, path: [] }
        return snapshot
      })
      return
    }

    if (selection.docKey === 'page.home' && selection.nodeId.startsWith('home-card-')) {
      const cardId = Number(selection.nodeId.replace('home-card-', ''))
      const source = homeCards.find((card) => card.id === cardId)
      if (!source) {
        return
      }

      commitMutation((snapshot) => {
        const id = tempIdRef.current--
        snapshot.homeCards.push({
          ...cloneValue(source),
          id,
          title: `${source.title} Copy`,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        })
        snapshot.selection = { docKey: 'page.home', nodeId: `home-card-${id}`, path: [] }
        return snapshot
      })
      return
    }

    if (selection.docKey === 'page.about' && selection.nodeId.startsWith('about-')) {
      const blockId = selection.nodeId.replace('about-', '')
      const source = siteSettings.aboutBlocks.find((block) => block.id === blockId)
      if (!source) {
        return
      }
      commitMutation((snapshot) => {
        const nextBlock = cloneValue(source)
        nextBlock.id = createBuilderId('about-block')
        snapshot.siteSettings.aboutBlocks.push(nextBlock)
        snapshot.selection = { docKey: 'page.about', nodeId: `about-${nextBlock.id}`, path: [] }
        return snapshot
      })
      return
    }

    if (selection.docKey === 'page.skills' && selection.nodeId.startsWith('skill-group-')) {
      const groupId = selection.nodeId.replace('skill-group-', '')
      const source = siteSettings.skillsGroups.find((group) => group.id === groupId)
      if (!source) {
        return
      }
      commitMutation((snapshot) => {
        const nextGroup = cloneValue(source)
        nextGroup.id = createBuilderId('skill-group')
        nextGroup.title = `${source.title} Copy`
        snapshot.siteSettings.skillsGroups.push(nextGroup)
        snapshot.selection = { docKey: 'page.skills', nodeId: `skill-group-${nextGroup.id}`, path: [] }
        return snapshot
      })
      return
    }

    updateDocument(selection.docKey as BuilderDocumentKey, (document) =>
      duplicateBuilderNode(document, selection.nodeId!),
    )
  }

  const deleteSelected = () => {
    if (!selection.nodeId) {
      return
    }

    if (selection.docKey === 'page.projects' && selection.nodeId.startsWith('project-')) {
      const projectId = Number(selection.nodeId.replace('project-', ''))
      commitMutation((snapshot) => {
        snapshot.projects = snapshot.projects.filter((project) => project.id !== projectId)
        snapshot.selection = { docKey: 'page.projects', nodeId: null, path: [] }
        return snapshot
      })
      return
    }

    if (selection.docKey === 'page.home' && selection.nodeId.startsWith('home-card-')) {
      const cardId = Number(selection.nodeId.replace('home-card-', ''))
      commitMutation((snapshot) => {
        snapshot.homeCards = snapshot.homeCards.filter((card) => card.id !== cardId)
        snapshot.selection = { docKey: 'page.home', nodeId: null, path: [] }
        return snapshot
      })
      return
    }

    if (selection.docKey === 'page.about' && selection.nodeId.startsWith('about-')) {
      const blockId = selection.nodeId.replace('about-', '')
      commitMutation((snapshot) => {
        snapshot.siteSettings.aboutBlocks = snapshot.siteSettings.aboutBlocks.filter((block) => block.id !== blockId)
        snapshot.selection = { docKey: 'page.about', nodeId: null, path: [] }
        return snapshot
      })
      return
    }

    if (selection.docKey === 'page.skills' && selection.nodeId.startsWith('skill-group-')) {
      const groupId = selection.nodeId.replace('skill-group-', '')
      commitMutation((snapshot) => {
        snapshot.siteSettings.skillsGroups = snapshot.siteSettings.skillsGroups.filter((group) => group.id !== groupId)
        snapshot.selection = { docKey: 'page.skills', nodeId: null, path: [] }
        return snapshot
      })
      return
    }

    updateDocument(selection.docKey as BuilderDocumentKey, (document) =>
      removeBuilderNode(document, selection.nodeId!),
    )
    setSelection((current) => ({ ...current, nodeId: null, path: [] }))
  }

  const moveSelected = (direction: -1 | 1) => {
    if (!selection.nodeId) {
      return
    }

    if (selection.docKey === 'page.projects' && selection.nodeId.startsWith('project-')) {
      const projectId = Number(selection.nodeId.replace('project-', ''))
      commitMutation((snapshot) => {
        const currentIndex = findIndexById(snapshot.projects, projectId)
        snapshot.projects = moveItem(snapshot.projects, currentIndex, currentIndex + direction)
        return snapshot
      })
      return
    }

    if (selection.docKey === 'page.home' && selection.nodeId.startsWith('home-card-')) {
      const cardId = Number(selection.nodeId.replace('home-card-', ''))
      commitMutation((snapshot) => {
        const currentIndex = findIndexById(snapshot.homeCards, cardId)
        snapshot.homeCards = moveItem(snapshot.homeCards, currentIndex, currentIndex + direction)
        return snapshot
      })
      return
    }

    if (selection.docKey === 'page.about' && selection.nodeId.startsWith('about-')) {
      const blockId = selection.nodeId.replace('about-', '')
      commitMutation((snapshot) => {
        const currentIndex = snapshot.siteSettings.aboutBlocks.findIndex((block) => block.id === blockId)
        snapshot.siteSettings.aboutBlocks = moveItem(snapshot.siteSettings.aboutBlocks, currentIndex, currentIndex + direction)
        return snapshot
      })
      return
    }

    if (selection.docKey === 'page.skills' && selection.nodeId.startsWith('skill-group-')) {
      const groupId = selection.nodeId.replace('skill-group-', '')
      commitMutation((snapshot) => {
        const currentIndex = snapshot.siteSettings.skillsGroups.findIndex((group) => group.id === groupId)
        snapshot.siteSettings.skillsGroups = moveItem(snapshot.siteSettings.skillsGroups, currentIndex, currentIndex + direction)
        return snapshot
      })
      return
    }

    updateDocument(selection.docKey as BuilderDocumentKey, (document) =>
      moveBuilderNode(document, selection.nodeId!, direction),
    )
  }

  const addLegacyItem = () => {
    if (selection.docKey === 'page.projects') {
      commitMutation((snapshot) => {
        const id = tempIdRef.current--
        const isFeatured = selection.nodeId === 'projects-featured' || selection.nodeId === 'projects-featured-list'
        snapshot.projects.push(createTempProject(id, isFeatured))
        snapshot.selection = { docKey: 'page.projects', nodeId: `project-${id}`, path: [] }
        return snapshot
      })
      return
    }

    if (selection.docKey === 'page.home') {
      commitMutation((snapshot) => {
        const id = tempIdRef.current--
        snapshot.homeCards.push(createTempHomeCard(id))
        snapshot.selection = { docKey: 'page.home', nodeId: `home-card-${id}`, path: [] }
        return snapshot
      })
      return
    }

    if (selection.docKey === 'page.about') {
      commitMutation((snapshot) => {
        const selectedAboutBlockId =
          selection.nodeId && selection.nodeId.startsWith('about-')
            ? selection.nodeId.replace('about-', '')
            : null
        const nextBlock =
          selectedAboutBlockId &&
          siteSettings.aboutBlocks.find((block) => block.id === selectedAboutBlockId)?.type === 'image'
            ? createTempImageBlock()
            : createTempParagraphBlock()
        snapshot.siteSettings.aboutBlocks.push(nextBlock)
        snapshot.selection = { docKey: 'page.about', nodeId: `about-${nextBlock.id}`, path: [] }
        return snapshot
      })
      return
    }

    if (selection.docKey === 'page.skills') {
      commitMutation((snapshot) => {
        const nextGroup = createTempSkillGroup()
        snapshot.siteSettings.skillsGroups.push(nextGroup)
        snapshot.selection = { docKey: 'page.skills', nodeId: `skill-group-${nextGroup.id}`, path: [] }
        return snapshot
      })
      return
    }

    if (selection.docKey === 'layout.nav') {
      const utilities =
        selection.nodeId === 'nav-utilities' ||
        selection.nodeId === 'nav-admin' ||
        selection.nodeId === 'nav-rain-screen'

      const nextNode = createBuilderNode('navItem', createBuilderId('nav-item'), {
        title: 'New Link',
        content: {
          label: 'New Link',
          kind: utilities ? 'action' : 'internal',
          href: utilities ? '' : '/projects',
          action: utilities ? 'rain-screen' : null,
          visible: true,
          locked: false,
        },
      })

      updateDocument('layout.nav', (document) =>
        addBuilderChildNode(document, utilities ? 'nav-utilities' : 'nav-primary', nextNode),
      )
      setSelection({ docKey: 'layout.nav', nodeId: nextNode.id, path: [] })
      return
    }

    addGenericNode('container/box')
  }

  const renderCanvasPage = () => {
    if (canvasPage === 'page.home') {
      return (
        <HomePageView
          hero={{
            homeEyebrow: siteSettings.homeEyebrow,
            homeTitle: siteSettings.homeTitle,
            homeTagline: siteSettings.homeTagline,
            homeIntro: siteSettings.homeIntro,
          }}
          cards={homeCards.filter((card) => card.isVisible)}
          featuredProjects={projects.filter((project) => project.isFeatured)}
          statusSnapshot={null}
          statusError={null}
          error={null}
          document={documents['page.home'] ?? null}
          projectsDocument={documents['page.projects'] ?? null}
          statusDocument={documents['page.status'] ?? null}
          builder={builderContext}
        />
      )
    }

    if (canvasPage === 'page.about') {
      return (
        <AboutPageView
          aboutBlocks={siteSettings.aboutBlocks}
          notice={null}
          document={documents['page.about'] ?? null}
          builder={builderContext}
        />
      )
    }

    if (canvasPage === 'page.projects') {
      return (
        <ProjectsPageView
          projects={sortProjectsForPreview(projects)}
          isLoading={false}
          error={null}
          document={documents['page.projects'] ?? null}
          builder={builderContext}
        />
      )
    }

    if (canvasPage === 'page.skills') {
      return (
        <SkillsPageView
          title="Technical Focus"
          intro={skillsIntro}
          groups={siteSettings.skillsGroups}
          notice={null}
          document={documents['page.skills'] ?? null}
          builder={builderContext}
        />
      )
    }

    if (canvasPage === 'page.contact') {
      return (
        <ContactPageView
          settings={siteSettings}
          notice={null}
          isSending={false}
          onSubmitContact={async () => false}
          document={documents['page.contact'] ?? null}
          builder={builderContext}
        />
      )
    }

    return <StatusPreview document={documents['page.status'] ?? null} siteSettings={siteSettings} builder={builderContext} />
  }

  const renderContentInspector = () => {
    if (!selectedNode) {
      return <p className="admin-builder__empty">Select a card, block, or section in the canvas to edit it.</p>
    }

    if (selection.docKey === 'page.projects' && selection.nodeId?.startsWith('project-')) {
      const projectId = Number(selection.nodeId.replace('project-', ''))
      const project = projects.find((item) => item.id === projectId)
      if (!project) {
        return null
      }

      return (
        <div className="admin-builder__field-stack">
          <label>
            Title
            <input
              type="text"
              value={project.title}
              onChange={(event) =>
                commitMutation((snapshot) => {
                  snapshot.projects = snapshot.projects.map((item) =>
                    item.id === projectId ? { ...item, title: event.target.value } : item,
                  )
                  return snapshot
                })
              }
            />
          </label>
          <label>
            Summary
            <textarea
              rows={5}
              value={project.summary}
              onChange={(event) =>
                commitMutation((snapshot) => {
                  snapshot.projects = snapshot.projects.map((item) =>
                    item.id === projectId ? { ...item, summary: event.target.value } : item,
                  )
                  return snapshot
                })
              }
            />
          </label>
          <label>
            Details
            <textarea
              rows={10}
              value={project.details}
              onChange={(event) =>
                commitMutation((snapshot) => {
                  snapshot.projects = snapshot.projects.map((item) =>
                    item.id === projectId ? { ...item, details: event.target.value } : item,
                  )
                  return snapshot
                })
              }
            />
          </label>
          <label>
            Tags
            <input
              type="text"
              value={project.tech.join(', ')}
              onChange={(event) =>
                commitMutation((snapshot) => {
                  snapshot.projects = snapshot.projects.map((item) =>
                    item.id === projectId ? { ...item, tech: parseCsv(event.target.value) } : item,
                  )
                  return snapshot
                })
              }
            />
          </label>
          <ProjectRichContentEditor
            links={project.links}
            detailCards={project.detailCards}
            onLinksChange={(links) =>
              commitMutation((snapshot) => {
                snapshot.projects = snapshot.projects.map((item) =>
                  item.id === projectId ? { ...item, links } : item,
                )
                return snapshot
              })
            }
            onDetailCardsChange={(detailCards) =>
              commitMutation((snapshot) => {
                snapshot.projects = snapshot.projects.map((item) =>
                  item.id === projectId ? { ...item, detailCards } : item,
                )
                return snapshot
              })
            }
          />
          <label>
            Status
            <select
              value={project.status}
              onChange={(event) =>
                commitMutation((snapshot) => {
                  snapshot.projects = snapshot.projects.map((item) =>
                    item.id === projectId ? { ...item, status: event.target.value as Project['status'] } : item,
                  )
                  return snapshot
                })
              }
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </label>
          <label className="admin-inline-checkbox">
            <input
              type="checkbox"
              checked={project.isFeatured}
              onChange={(event) =>
                commitMutation((snapshot) => {
                  snapshot.projects = snapshot.projects.map((item) =>
                    item.id === projectId ? { ...item, isFeatured: event.target.checked } : item,
                  )
                  return snapshot
                })
              }
            />
            Featured
          </label>
        </div>
      )
    }

    if (selection.docKey === 'page.home' && selection.nodeId?.startsWith('home-card-')) {
      const cardId = Number(selection.nodeId.replace('home-card-', ''))
      const card = homeCards.find((item) => item.id === cardId)
      if (!card) {
        return null
      }

      return (
        <div className="admin-builder__field-stack">
          <label>
            Title
            <input
              type="text"
              value={card.title}
              onChange={(event) =>
                commitMutation((snapshot) => {
                  snapshot.homeCards = snapshot.homeCards.map((item) =>
                    item.id === cardId ? { ...item, title: event.target.value } : item,
                  )
                  return snapshot
                })
              }
            />
          </label>
          <label>
            Subtitle
            <input
              type="text"
              value={card.subtitle}
              onChange={(event) =>
                commitMutation((snapshot) => {
                  snapshot.homeCards = snapshot.homeCards.map((item) =>
                    item.id === cardId ? { ...item, subtitle: event.target.value } : item,
                  )
                  return snapshot
                })
              }
            />
          </label>
          <label>
            Body
            <textarea
              rows={4}
              value={card.body}
              onChange={(event) =>
                commitMutation((snapshot) => {
                  snapshot.homeCards = snapshot.homeCards.map((item) =>
                    item.id === cardId ? { ...item, body: event.target.value } : item,
                  )
                  return snapshot
                })
              }
            />
          </label>
          <label>
            CTA Label
            <input
              type="text"
              value={card.ctaLabel}
              onChange={(event) =>
                commitMutation((snapshot) => {
                  snapshot.homeCards = snapshot.homeCards.map((item) =>
                    item.id === cardId ? { ...item, ctaLabel: event.target.value } : item,
                  )
                  return snapshot
                })
              }
            />
          </label>
          <label>
            CTA URL
            <input
              type="text"
              value={card.ctaUrl}
              onChange={(event) =>
                commitMutation((snapshot) => {
                  snapshot.homeCards = snapshot.homeCards.map((item) =>
                    item.id === cardId ? { ...item, ctaUrl: event.target.value } : item,
                  )
                  return snapshot
                })
              }
            />
          </label>
          <label className="admin-inline-checkbox">
            <input
              type="checkbox"
              checked={card.isVisible}
              onChange={(event) =>
                commitMutation((snapshot) => {
                  snapshot.homeCards = snapshot.homeCards.map((item) =>
                    item.id === cardId ? { ...item, isVisible: event.target.checked } : item,
                  )
                  return snapshot
                })
              }
            />
            Visible
          </label>
        </div>
      )
    }

    if (selection.docKey === 'page.about' && selection.nodeId?.startsWith('about-')) {
      const blockId = selection.nodeId.replace('about-', '')
      const block = siteSettings.aboutBlocks.find((item) => item.id === blockId)
      if (!block) {
        return null
      }

      return (
        <div className="admin-builder__field-stack">
          <label className="admin-inline-checkbox">
            <input
              type="checkbox"
              checked={block.showTopRule}
              onChange={(event) =>
                commitMutation((snapshot) => {
                  snapshot.siteSettings.aboutBlocks = snapshot.siteSettings.aboutBlocks.map((item) =>
                    item.id === blockId ? { ...item, showTopRule: event.target.checked } : item,
                  )
                  return snapshot
                })
              }
            />
            Top divider
          </label>
          {block.type === 'paragraph' ? (
            <label>
              Content
              <textarea
                rows={7}
                value={block.content}
                onChange={(event) =>
                  commitMutation((snapshot) => {
                    snapshot.siteSettings.aboutBlocks = snapshot.siteSettings.aboutBlocks.map((item) =>
                      item.id === blockId && item.type === 'paragraph'
                        ? { ...item, content: event.target.value }
                        : item,
                    )
                    return snapshot
                  })
                }
              />
            </label>
          ) : (
            <>
              <label>
                Image URL
                <input
                  type="text"
                  value={block.src}
                  onChange={(event) =>
                    commitMutation((snapshot) => {
                      snapshot.siteSettings.aboutBlocks = snapshot.siteSettings.aboutBlocks.map((item) =>
                        item.id === blockId && item.type === 'image'
                          ? { ...item, src: event.target.value }
                          : item,
                      )
                      return snapshot
                    })
                  }
                />
              </label>
              <label>
                Upload image
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null
                    event.target.value = ''
                    void onUploadAboutImage(blockId, file)
                  }}
                />
              </label>
              <label>
                Alt Text
                <input
                  type="text"
                  value={block.alt}
                  onChange={(event) =>
                    commitMutation((snapshot) => {
                      snapshot.siteSettings.aboutBlocks = snapshot.siteSettings.aboutBlocks.map((item) =>
                        item.id === blockId && item.type === 'image'
                          ? { ...item, alt: event.target.value }
                          : item,
                      )
                      return snapshot
                    })
                  }
                />
              </label>
              <label>
                Caption
                <textarea
                  rows={3}
                  value={block.caption}
                  onChange={(event) =>
                    commitMutation((snapshot) => {
                      snapshot.siteSettings.aboutBlocks = snapshot.siteSettings.aboutBlocks.map((item) =>
                        item.id === blockId && item.type === 'image'
                          ? { ...item, caption: event.target.value }
                          : item,
                      )
                      return snapshot
                    })
                  }
                />
              </label>
            </>
          )}
        </div>
      )
    }

    if (selection.docKey === 'page.skills' && selection.nodeId?.startsWith('skill-group-')) {
      const groupId = selection.nodeId.replace('skill-group-', '')
      const group = siteSettings.skillsGroups.find((item) => item.id === groupId)
      if (!group) {
        return null
      }

      return (
        <div className="admin-builder__field-stack">
          <label>
            Group Title
            <input
              type="text"
              value={group.title}
              onChange={(event) =>
                commitMutation((snapshot) => {
                  snapshot.siteSettings.skillsGroups = snapshot.siteSettings.skillsGroups.map((item) =>
                    item.id === groupId ? { ...item, title: event.target.value } : item,
                  )
                  return snapshot
                })
              }
            />
          </label>
          <label>
            Skills
            <textarea
              rows={8}
              value={group.items.join('\n')}
              onChange={(event) =>
                commitMutation((snapshot) => {
                  snapshot.siteSettings.skillsGroups = snapshot.siteSettings.skillsGroups.map((item) =>
                    item.id === groupId ? { ...item, items: parseLines(event.target.value) } : item,
                  )
                  return snapshot
                })
              }
            />
          </label>
        </div>
      )
    }

    if (selection.docKey === 'layout.nav' && selection.nodeId) {
      const node = selectedNode
      if (!node) {
        return null
      }
      return (
        <div className="admin-builder__field-stack">
          <label>
            Label
            <input
              type="text"
              value={String(node.content?.label ?? node.title ?? '')}
              onChange={(event) =>
                updateDocument('layout.nav', (document) =>
                  updateBuilderDocumentNode(document, selection.nodeId!, (currentNode) => ({
                    ...currentNode,
                    title: event.target.value,
                    content: {
                      ...(currentNode.content ?? {}),
                      label: event.target.value,
                    },
                  })),
                )
              }
            />
          </label>
          <label>
            Kind
            <select
              value={String(node.content?.kind ?? 'internal')}
              onChange={(event) =>
                updateDocument('layout.nav', (document) =>
                  updateBuilderDocumentNode(document, selection.nodeId!, (currentNode) => ({
                    ...currentNode,
                    content: {
                      ...(currentNode.content ?? {}),
                      kind: event.target.value,
                    },
                  })),
                )
              }
            >
              <option value="internal">Internal route</option>
              <option value="external">External URL</option>
              <option value="action">Action</option>
            </select>
          </label>
          <label>
            Href / Route
            <input
              type="text"
              value={String(node.content?.href ?? '')}
              onChange={(event) =>
                updateDocument('layout.nav', (document) =>
                  updateBuilderDocumentNode(document, selection.nodeId!, (currentNode) => ({
                    ...currentNode,
                    content: {
                      ...(currentNode.content ?? {}),
                      href: event.target.value,
                    },
                  })),
                )
              }
            />
          </label>
          <label>
            Action
            <select
              value={String(node.content?.action ?? 'rain-screen')}
              onChange={(event) =>
                updateDocument('layout.nav', (document) =>
                  updateBuilderDocumentNode(document, selection.nodeId!, (currentNode) => ({
                    ...currentNode,
                    content: {
                      ...(currentNode.content ?? {}),
                      action: event.target.value,
                    },
                  })),
                )
              }
            >
              <option value="rain-screen">Rain Screen</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="admin-inline-checkbox">
            <input
              type="checkbox"
              checked={Boolean(node.content?.visible ?? true)}
              onChange={(event) =>
                updateDocument('layout.nav', (document) =>
                  updateBuilderDocumentNode(document, selection.nodeId!, (currentNode) => ({
                    ...currentNode,
                    content: {
                      ...(currentNode.content ?? {}),
                      visible: event.target.checked,
                    },
                    presentation: {
                      ...(currentNode.presentation ?? {}),
                      visible: event.target.checked,
                    },
                  })),
                )
              }
            />
            Visible
          </label>
        </div>
      )
    }

    if (selection.docKey === 'page.home' && selection.nodeId?.startsWith('home-hero')) {
      return (
        <div className="admin-builder__field-stack">
          <label>
            Eyebrow
            <input
              type="text"
              value={siteSettings.homeEyebrow}
              onChange={(event) =>
                commitMutation((snapshot) => {
                  snapshot.siteSettings.homeEyebrow = event.target.value
                  return snapshot
                })
              }
            />
          </label>
          <label>
            Title
            <input
              type="text"
              value={siteSettings.homeTitle}
              onChange={(event) =>
                commitMutation((snapshot) => {
                  snapshot.siteSettings.homeTitle = event.target.value
                  return snapshot
                })
              }
            />
          </label>
          <label>
            Tagline
            <textarea
              rows={3}
              value={siteSettings.homeTagline}
              onChange={(event) =>
                commitMutation((snapshot) => {
                  snapshot.siteSettings.homeTagline = event.target.value
                  return snapshot
                })
              }
            />
          </label>
          <label>
            Intro
            <textarea
              rows={5}
              value={siteSettings.homeIntro}
              onChange={(event) =>
                commitMutation((snapshot) => {
                  snapshot.siteSettings.homeIntro = event.target.value
                  return snapshot
                })
              }
            />
          </label>
        </div>
      )
    }

    if (selection.docKey === 'page.contact' && selection.nodeId?.startsWith('contact-')) {
      return (
        <div className="admin-builder__field-stack">
          <label>
            Intro
            <textarea
              rows={4}
              value={siteSettings.contactIntro}
              onChange={(event) =>
                commitMutation((snapshot) => {
                  snapshot.siteSettings.contactIntro = event.target.value
                  return snapshot
                })
              }
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={siteSettings.email}
              onChange={(event) =>
                commitMutation((snapshot) => {
                  snapshot.siteSettings.email = event.target.value
                  return snapshot
                })
              }
            />
          </label>
          <label>
            Phone
            <input
              type="text"
              value={siteSettings.phone}
              onChange={(event) =>
                commitMutation((snapshot) => {
                  snapshot.siteSettings.phone = event.target.value
                  return snapshot
                })
              }
            />
          </label>
          <label>
            Location
            <input
              type="text"
              value={siteSettings.location}
              onChange={(event) =>
                commitMutation((snapshot) => {
                  snapshot.siteSettings.location = event.target.value
                  return snapshot
                })
              }
            />
          </label>
        </div>
      )
    }

    if (selectedNode.type === 'image/media') {
      return (
        <div className="admin-builder__field-stack">
          <label>
            Image URL
            <input
              type="text"
              value={String(selectedNode.content?.src ?? '')}
              onChange={(event) =>
                updateDocument(selection.docKey as BuilderDocumentKey, (document) =>
                  updateBuilderDocumentNode(document, selection.nodeId!, (node) => ({
                    ...node,
                    content: {
                      ...(node.content ?? {}),
                      src: event.target.value,
                    },
                  })),
                )
              }
            />
          </label>
          <label>
            Upload media
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null
                event.target.value = ''
                if (!file) {
                  return
                }
                void onUploadBuilderMedia(file).then((asset) => {
                  updateDocument(selection.docKey as BuilderDocumentKey, (document) =>
                    updateBuilderDocumentNode(document, selection.nodeId!, (node) => ({
                      ...node,
                      content: {
                        ...(node.content ?? {}),
                        src: asset.url,
                        alt: asset.altText,
                        caption: asset.caption,
                      },
                    })),
                  )
                })
              }}
            />
          </label>
          <label>
            Alt Text
            <input
              type="text"
              value={String(selectedNode.content?.alt ?? '')}
              onChange={(event) =>
                updateDocument(selection.docKey as BuilderDocumentKey, (document) =>
                  updateBuilderDocumentNode(document, selection.nodeId!, (node) => ({
                    ...node,
                    content: {
                      ...(node.content ?? {}),
                      alt: event.target.value,
                    },
                  })),
                )
              }
            />
          </label>
          <label>
            Caption
            <textarea
              rows={3}
              value={String(selectedNode.content?.caption ?? '')}
              onChange={(event) =>
                updateDocument(selection.docKey as BuilderDocumentKey, (document) =>
                  updateBuilderDocumentNode(document, selection.nodeId!, (node) => ({
                    ...node,
                    content: {
                      ...(node.content ?? {}),
                      caption: event.target.value,
                    },
                  })),
                )
              }
            />
          </label>
          {builderMedia.length > 0 && (
            <div className="admin-builder__media-grid">
              {builderMedia.slice(0, 6).map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  className="admin-builder__media-tile"
                  onClick={() =>
                    updateDocument(selection.docKey as BuilderDocumentKey, (document) =>
                      updateBuilderDocumentNode(document, selection.nodeId!, (node) => ({
                        ...node,
                        content: {
                          ...(node.content ?? {}),
                          src: asset.url,
                          alt: asset.altText,
                          caption: asset.caption,
                        },
                      })),
                    )
                  }
                >
                  <img src={asset.url} alt={asset.altText} />
                  <span>{asset.originalName}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )
    }

    if (selectedNode.type === 'text' || selectedNode.type === 'embed' || selectedNode.type === 'button/link' || selectedNode.type === 'container/box' || selectedNode.type === 'section') {
      return (
        <div className="admin-builder__field-stack">
          <label>
            Title
            <input
              type="text"
              value={selectedNode.title ?? ''}
              onChange={(event) =>
                updateDocument(selection.docKey as BuilderDocumentKey, (document) =>
                  updateBuilderDocumentNode(document, selection.nodeId!, (node) => ({
                    ...node,
                    title: event.target.value,
                  })),
                )
              }
            />
          </label>
          {'text' in (selectedNode.content ?? {}) || selectedNode.type === 'text' ? (
            <label>
              Text
              <textarea
                rows={5}
                value={String(selectedNode.content?.text ?? '')}
                onChange={(event) =>
                  updateDocument(selection.docKey as BuilderDocumentKey, (document) =>
                    updateBuilderDocumentNode(document, selection.nodeId!, (node) => ({
                      ...node,
                      content: {
                        ...(node.content ?? {}),
                        text: event.target.value,
                      },
                    })),
                  )
                }
              />
            </label>
          ) : null}
          {selectedNode.type === 'button/link' && (
            <label>
              Href
              <input
                type="text"
                value={String(selectedNode.content?.href ?? '')}
                onChange={(event) =>
                  updateDocument(selection.docKey as BuilderDocumentKey, (document) =>
                    updateBuilderDocumentNode(document, selection.nodeId!, (node) => ({
                      ...node,
                      content: {
                        ...(node.content ?? {}),
                        href: event.target.value,
                      },
                    })),
                  )
                }
              />
            </label>
          )}
          {selectedNode.type === 'embed' && (
            <>
              <label>
                Provider
                <input
                  type="text"
                  value={String(selectedNode.content?.provider ?? '')}
                  onChange={(event) =>
                    updateDocument(selection.docKey as BuilderDocumentKey, (document) =>
                      updateBuilderDocumentNode(document, selection.nodeId!, (node) => ({
                        ...node,
                        content: {
                          ...(node.content ?? {}),
                          provider: event.target.value,
                        },
                      })),
                    )
                  }
                />
              </label>
              <label>
                URL
                <input
                  type="text"
                  value={String(selectedNode.content?.url ?? '')}
                  onChange={(event) =>
                    updateDocument(selection.docKey as BuilderDocumentKey, (document) =>
                      updateBuilderDocumentNode(document, selection.nodeId!, (node) => ({
                        ...node,
                        content: {
                          ...(node.content ?? {}),
                          url: event.target.value,
                        },
                      })),
                    )
                  }
                />
              </label>
            </>
          )}
        </div>
      )
    }

    return (
      <div className="admin-builder__field-stack">
        <p className="admin-builder__empty">No content editor is wired for this node yet.</p>
      </div>
    )
  }

  const renderLayoutInspector = () => (
    <div className="admin-builder__field-stack">
      <section className="admin-builder__inspector-section">
        <div className="admin-builder__section-head">
          <p className="eyebrow">Arrange</p>
          <h3>Order and placement</h3>
        </div>
        <div className="admin-builder__action-grid">
          <button className="button" type="button" onClick={() => moveSelected(-1)}>
            Move Up
          </button>
          <button className="button" type="button" onClick={() => moveSelected(1)}>
            Move Down
          </button>
          <button className="button" type="button" onClick={addLegacyItem}>
            Add Here
          </button>
          <button className="button" type="button" onClick={duplicateSelected} disabled={!selection.nodeId}>
            Duplicate
          </button>
          <button className="button" type="button" onClick={deleteSelected} disabled={!selection.nodeId}>
            Delete
          </button>
        </div>
      </section>

      <section className="admin-builder__inspector-section">
        <div className="admin-builder__section-head">
          <p className="eyebrow">Insert</p>
          <h3>New blocks</h3>
        </div>
        <div className="admin-builder__action-grid admin-builder__action-grid--compact">
          <button className="button" type="button" onClick={() => addGenericNode('text')}>
            + Text
          </button>
          <button className="button" type="button" onClick={() => addGenericNode('image/media')}>
            + Image
          </button>
          <button className="button" type="button" onClick={() => addGenericNode('container/box')}>
            + Box
          </button>
          <button className="button" type="button" onClick={() => addGenericNode('embed')}>
            + Embed
          </button>
        </div>
      </section>
    </div>
  )

  const renderStyleInspector = () => {
    if (!selection.nodeId || !selectedNode) {
      return <p className="admin-builder__empty">Select something to change its presentation.</p>
    }

    return (
      <BuilderPresentationControls
        presentation={selectedNode.presentation}
        nodeType={selectedNode.type}
        bindingKind={selectedNode.binding?.kind}
        onChange={updateSelectedNodePresentation}
      />
    )
  }

  const renderSettingsInspector = () => (
    <div className="admin-builder__field-stack">
      <section className="admin-builder__inspector-section">
        <div className="admin-builder__section-head">
          <p className="eyebrow">Selection</p>
          <h3>Metadata</h3>
        </div>
        <dl className="admin-builder__meta-list">
          <div>
            <dt>Page</dt>
            <dd>{getPageLabel(selection.docKey)}</dd>
          </div>
          <div>
            <dt>Node</dt>
            <dd>{selection.nodeId ?? 'Page Root'}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{selectedNode?.type ? humanizeLabel(selectedNode.type) : 'n/a'}</dd>
          </div>
          <div>
            <dt>Binding</dt>
            <dd>{selectedNode?.binding?.kind ? humanizeLabel(selectedNode.binding.kind) : 'Builder Native'}</dd>
          </div>
        </dl>
      </section>
      <div className="admin-builder__media-grid">
        {builderMedia.slice(0, 4).map((asset) => (
          <div key={asset.id} className="admin-builder__media-tile admin-builder__media-tile--readonly">
            <img src={asset.url} alt={asset.altText} />
            <span>{asset.originalName}</span>
            <button className="button" type="button" onClick={() => void onDeleteBuilderMedia(asset.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <section className="admin-builder admin-builder--immersive">
      <header className="admin-builder__header">
        <div className="admin-builder__page-nav" role="tablist" aria-label="Builder pages">
          {pageOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              className={activePage === option.key ? 'is-active' : ''}
              onClick={() => {
                onActivePageChange(option.key)
                setSelection({
                  docKey: option.key,
                  nodeId: null,
                  path: [],
                })
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="admin-builder__header-actions">
          {!editingProject && (
            <>
              <button
                className={`button ${showLayers ? 'button--solid' : ''}`}
                type="button"
                onClick={() => setShowLayers((current) => !current)}
              >
                {showLayers ? 'Hide Structure' : 'Structure'}
              </button>
              <button
                className={`button ${showInspector ? 'button--solid' : ''}`}
                type="button"
                onClick={() => setShowInspector((current) => !current)}
              >
                {showInspector ? 'Hide Inspector' : 'Inspector'}
              </button>
            </>
          )}
          <button className="button" type="button" onClick={onUndo} disabled={!canUndo}>
            Undo
          </button>
          <button className="button" type="button" onClick={onRedo} disabled={!canRedo}>
            Redo
          </button>
          <button className="button button--solid" type="button" disabled={isBusy} onClick={() => void onSavePage(activePage)}>
            Save {pageOptions.find((option) => option.key === activePage)?.label ?? 'Page'}
          </button>
        </div>
      </header>

      <div ref={workspaceRef} className="admin-builder__workspace admin-builder__workspace--immersive">
        <div className="admin-builder__canvas-shell admin-builder__canvas-shell--immersive">
          {editingProject ? (
            <div key="project-page" className="admin-builder__canvas admin-builder__canvas--page-editor">
              <div className="page-editor-shell">
                <div className="page-editor-shell__head">
                  <button className="button" type="button" onClick={closeProjectPage}>
                    ← All projects
                  </button>
                  <div className="page-editor-shell__title">
                    <p className="eyebrow">Editing this project's page</p>
                    <strong>{editingProject.title || 'Untitled project'}</strong>
                  </div>
                  <label className="page-editor-shell__status">
                    Status
                    <select
                      value={editingProject.status}
                      onChange={(event) =>
                        updateEditingProject({ status: event.target.value as ProjectStatus }, 'status')
                      }
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      {editingProject.status === 'scheduled' && <option value="scheduled">Scheduled</option>}
                    </select>
                  </label>
                  <label className="admin-inline-checkbox">
                    <input
                      type="checkbox"
                      checked={editingProject.isFeatured}
                      onChange={(event) => updateEditingProject({ isFeatured: event.target.checked }, 'featured')}
                    />
                    Featured
                  </label>
                </div>
                <p className="page-editor-shell__hint">
                  Click any part of the page to change it. Drag a block by its handle to move it, and drag its right
                  edge to make it narrower or wider. Changes go live when you press Save Projects.
                </p>
                <ProjectPageEditor
                  title={editingProject.title}
                  eyebrow={editingProject.isFeatured ? 'Featured Build' : 'Project Detail'}
                  summary={editingProject.summary}
                  tech={editingProject.tech}
                  links={editingProject.links}
                  blocks={resolveProjectBlocks(editingProject)}
                  isArranged={(editingProject.contentBlocks ?? []).length > 0}
                  images={editingProject.images}
                  uploadBlockedReason={
                    editingProject.id > 0
                      ? ''
                      : 'This project is new. Press Save Projects once, then you can add pictures to it.'
                  }
                  onChange={(patch: ProjectPagePatch, editKey) => updateEditingProject(patch, editKey)}
                  onUploadImages={(files) => onUploadProjectImages(editingProject.id, files)}
                  onMakeCover={(imageId) => onMakeProjectCover(editingProject.id, imageId)}
                />
              </div>
            </div>
          ) : (
            <div key="canvas" className="admin-builder__canvas" ref={previewRef} onClickCapture={onCanvasClickCapture}>
              <div className="public-shell admin-builder__site-shell">
                <div className="scene-backdrop" aria-hidden="true">
                  <div className="scene-backdrop__mesh" />
                </div>

                <SiteNavigation
                  siteVisible
                  isMenuOpen={false}
                  isMobileNavHidden={false}
                  isAdminAuthenticated={true}
                  onMenuToggle={() => undefined}
                  onCloseMenu={() => undefined}
                  navItems={previewNavigation.navItems}
                  headerActions={previewNavigation.headerActions}
                  brandLabel={previewNavigation.brandLabel}
                  brandHref={previewNavigation.brandHref}
                  builder={builderContext}
                />

                <main className={`public-main public-main--${canvasRouteKey} public-main--visible admin-builder__site-main`}>
                  {renderCanvasPage()}
                </main>
              </div>

            </div>
          )}

          {!editingProject && selection.nodeId && selectedRect && (
            <div className="admin-builder__selection-toolbar admin-builder__selection-toolbar--docked">
              <button className="button" type="button" onClick={() => moveSelected(-1)}>
                Up
              </button>
              <button className="button" type="button" onClick={() => moveSelected(1)}>
                Down
              </button>
              <button className="button" type="button" onClick={duplicateSelected}>
                Duplicate
              </button>
              <button className="button" type="button" onClick={deleteSelected}>
                Delete
              </button>
              <button className="button button--solid" type="button" onClick={addLegacyItem}>
                +
              </button>
            </div>
          )}

          <aside className={`admin-builder__layers admin-builder__drawer admin-builder__drawer--layers ${showLayers ? 'is-open' : ''}`}>
            <div className="admin-builder__panel-head">
              <div>
                <p className="eyebrow">Layers</p>
                <h2>{pageOptions.find((option) => option.key === selection.docKey)?.label ?? 'Document'}</h2>
              </div>
              <div className="admin-builder__panel-actions">
                <button className="button" type="button" onClick={addLegacyItem}>
                  Add
                </button>
                <button className="button" type="button" onClick={() => setShowLayers(false)}>
                  Close
                </button>
              </div>
            </div>

            {inspectedDocument ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={currentLayerNodes.map((node) => node.id)} strategy={verticalListSortingStrategy}>
                  <LayersTree
                    nodes={currentLayerNodes}
                    selectedNodeId={selection.nodeId}
                    onSelect={(nodeId) => selectNode(selection.docKey as BuilderDocumentKey, nodeId)}
                  />
                </SortableContext>
              </DndContext>
            ) : (
              <p className="admin-builder__empty">No builder document loaded for this page yet.</p>
            )}
          </aside>
        </div>

        <aside
          ref={inspectorRef}
          className={`admin-builder__inspector admin-builder__drawer admin-builder__drawer--inspector ${showInspector ? 'is-open' : ''}`}
          style={inspectorStyle}
        >
          <div
            className={`admin-builder__panel-head admin-builder__panel-head--draggable${inspectorGesture?.mode === 'move' ? ' is-dragging' : ''}`}
            onPointerDown={handleInspectorHeadPointerDown}
          >
            <div className="admin-builder__inspector-heading">
              <p className="eyebrow">Inspector</p>
              <h2>{inspectorTitle}</h2>
              <p className="admin-builder__inspector-subtitle">{inspectorSubtitle}</p>
            </div>
            <div className="admin-builder__panel-actions">
              <span className="admin-builder__drag-indicator" aria-hidden="true" />
              <button className="button" type="button" onClick={() => setShowInspector(false)}>
                Close
              </button>
            </div>
          </div>
          <div className="admin-builder__inspector-tabs">
            {(['content', 'layout', 'style', 'settings'] as InspectorTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                className={inspectorTab === tab ? 'is-active' : ''}
                onClick={() => setInspectorTab(tab)}
              >
                {tab[0].toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <div className="admin-builder__inspector-body">
            {inspectorTab === 'content' && renderContentInspector()}
            {inspectorTab === 'layout' && renderLayoutInspector()}
            {inspectorTab === 'style' && renderStyleInspector()}
            {inspectorTab === 'settings' && renderSettingsInspector()}
          </div>
          <button
            className="admin-builder__inspector-resize-handle"
            type="button"
            aria-label="Resize inspector"
            onPointerDown={(event) => beginInspectorGesture(event, 'resize')}
          />
        </aside>
      </div>
    </section>
  )
}
