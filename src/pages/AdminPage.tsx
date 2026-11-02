import { useEffect, useMemo, useRef, useState } from 'react'
import type { ClipboardEvent, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { adminApi, publicApi, type HomeCardInput, type ProjectInput } from '../lib/api'
import type { ProjectDetailCard, ProjectLink } from '../../shared/projectContent'
import { normalizeProjectBlocks, resolveProjectBlocks, type ProjectBlock } from '../../shared/projectBlocks'
import type {
  BuilderDocument,
  BuilderDocumentKey,
  BuilderMediaAsset,
  BuilderNode,
} from '../../shared/builder'
import { builderDocumentKeys } from '../../shared/builder'
import {
  cloneAboutBlocks,
  createImageBlock,
  createParagraphBlock,
  defaultAboutBlocks,
  normalizeAboutBlocks,
} from '../lib/aboutBlocks'
import {
  cloneSkillGroups,
  createSkillGroup,
  defaultSkillGroups,
  normalizeSkillGroups,
} from '../lib/skillsGroups'
import { buildFallbackBuilderDocuments } from '../lib/builderSeed'
import { flattenBuilderNodes, getBuilderNode } from '../lib/builderDocuments'
import { defaultAnnouncement, normalizeAnnouncement, type Announcement } from '../../shared/announcement'
import { defaultGateSettings, normalizeGateSettings } from '../../shared/gateSettings'
import { defaultMaintenanceMessage, normalizeMaintenanceMessage } from '../../shared/maintenance'
import {
  normalizeStatusPowerMode,
  statusPowerModeValues,
  type StatusPowerMode,
} from '../../shared/statusPowerMode'
import type {
  AboutBlock,
  ContactMessage,
  HomeCard,
  MessageStatus,
  Project,
  ProjectImage,
  ProjectStatus,
  SkillGroup,
  SiteSettings,
} from '../types/models'
import { AdminVisualBuilder } from '../components/admin-builder/AdminVisualBuilder'
import { BuilderPresentationControls } from '../components/admin-builder/BuilderPresentationControls'
import { ProjectPageEditor, type ProjectPagePatch } from '../components/admin-builder/ProjectPageEditor'
import { updateBuilderDocumentNode } from '../components/admin-builder/treeUtils'
import { GateSettingsPanel } from '../components/GateSettingsPanel'
import { AnnouncementSettingsPanel } from '../components/AnnouncementSettingsPanel'

type AdminTab =
  | 'home'
  | 'gate'
  | 'about'
  | 'skills'
  | 'projects'
  | 'status'
  | 'announcement'
  | 'contact'
  | 'layout'
  | 'messages'
type AdminMode = 'standard' | 'visual'

type AdminSiteSettings = SiteSettings

interface ProjectFormState {
  title: string
  summary: string
  details: string
  techCsv: string
  links: ProjectLink[]
  detailCards: ProjectDetailCard[]
  contentBlocks: ProjectBlock[]
  status: ProjectStatus
  publishAt: string
  isFeatured: boolean
}

interface HomeCardFormState {
  title: string
  subtitle: string
  body: string
  ctaLabel: string
  ctaUrl: string
  widthUnits: string
  heightUnits: string
  isVisible: boolean
}

const blankProjectForm: ProjectFormState = {
  title: '',
  summary: '',
  details: '',
  techCsv: '',
  links: [],
  detailCards: [],
  contentBlocks: [],
  status: 'draft',
  publishAt: '',
  isFeatured: false,
}

const blankHomeCardForm: HomeCardFormState = {
  title: '',
  subtitle: '',
  body: '',
  ctaLabel: '',
  ctaUrl: '',
  widthUnits: '1',
  heightUnits: '1',
  isVisible: true,
}

const blankSiteSettings: AdminSiteSettings = {
  email: '',
  phone: '',
  location: 'Mississippi, USA',
  socials: {},
  contactIntro:
    'Have a question, want to talk homelab infrastructure, or just want to reach out? Send me a message below or contact me directly.',
  maintenanceMode: false,
  maintenanceMessage: defaultMaintenanceMessage,
  announcement: defaultAnnouncement,
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

const statusPowerModeLabels: Record<StatusPowerMode, string> = {
  live: 'Live Feed',
  battery: 'Battery Power',
  utility: 'Utility Power',
}

const blankBuilderDocuments = Object.fromEntries(
  builderDocumentKeys.map((docKey) => [docKey, null]),
) as Record<BuilderDocumentKey, BuilderDocument | null>

function hydrateSiteSettings(settings: SiteSettings): AdminSiteSettings {
  return {
    ...blankSiteSettings,
    ...settings,
    maintenanceMessage: normalizeMaintenanceMessage(settings.maintenanceMessage),
    announcement: normalizeAnnouncement(settings.announcement),
    statusPowerMode: normalizeStatusPowerMode(settings.statusPowerMode, blankSiteSettings.statusPowerMode),
    gateSettings: normalizeGateSettings(settings.gateSettings),
    aboutBlocks: normalizeAboutBlocks(settings.aboutBlocks),
    skillsGroups: normalizeSkillGroups(settings.skillsGroups),
  }
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function parseLines(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

function getBuilderNodeLabel(node: BuilderNode): string {
  const label = readString(node.content?.label) || readString(node.content?.text) || node.title || node.id
  const compactLabel = label.replace(/\s+/g, ' ').trim()
  const preview = compactLabel.length > 56 ? `${compactLabel.slice(0, 55).trimEnd()}…` : compactLabel
  return `${preview || node.id} · ${node.type}`
}

function updateAboutBlock(
  blocks: AboutBlock[],
  blockId: string,
  updater: (block: AboutBlock) => AboutBlock,
): AboutBlock[] {
  return blocks.map((block) => (block.id === blockId ? updater(block) : block))
}

function updateSkillGroup(
  groups: SkillGroup[],
  groupId: string,
  updater: (group: SkillGroup) => SkillGroup,
): SkillGroup[] {
  return groups.map((group) => (group.id === groupId ? updater(group) : group))
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items
  }

  const nextItems = [...items]
  const [item] = nextItems.splice(fromIndex, 1)
  nextItems.splice(toIndex, 0, item)
  return nextItems
}

function normalizeProjectInput(form: ProjectFormState): ProjectInput {
  return {
    title: form.title.trim(),
    summary: form.summary.trim(),
    details: form.details.trim(),
    tech: form.techCsv
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    links: structuredClone(form.links),
    detailCards: structuredClone(form.detailCards),
    contentBlocks: normalizeProjectBlocks(form.contentBlocks),
    status: form.status,
    publishAt: form.publishAt || null,
    isFeatured: form.isFeatured,
  }
}

function formFromProject(project: Project): ProjectFormState {
  return {
    title: project.title,
    summary: project.summary,
    details: project.details,
    techCsv: project.tech.join(', '),
    links: structuredClone(project.links),
    detailCards: structuredClone(project.detailCards),
    contentBlocks: structuredClone(project.contentBlocks ?? []),
    status: project.status,
    publishAt: project.publishAt ? project.publishAt.slice(0, 16) : '',
    isFeatured: project.isFeatured,
  }
}

function clampUnits(value: number) {
  return Math.max(1, Math.min(4, Math.round(value)))
}

function normalizeHomeCardInput(form: HomeCardFormState): HomeCardInput {
  return {
    title: form.title.trim(),
    subtitle: form.subtitle.trim(),
    body: form.body.trim(),
    ctaLabel: form.ctaLabel.trim(),
    ctaUrl: form.ctaUrl.trim(),
    widthUnits: clampUnits(Number(form.widthUnits)),
    heightUnits: clampUnits(Number(form.heightUnits)),
    isVisible: form.isVisible,
  }
}

function formFromHomeCard(card: HomeCard): HomeCardFormState {
  return {
    title: card.title,
    subtitle: card.subtitle,
    body: card.body,
    ctaLabel: card.ctaLabel,
    ctaUrl: card.ctaUrl,
    widthUnits: String(card.widthUnits),
    heightUnits: String(card.heightUnits),
    isVisible: card.isVisible,
  }
}

export function AdminPage() {
  const nextTempIdRef = useRef(-1)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [adminMode, setAdminMode] = useState<AdminMode>('standard')
  const [activeTab, setActiveTab] = useState<AdminTab>('home')
  const [builderActivePage, setBuilderActivePage] = useState<BuilderDocumentKey>('page.home')
  const [dashboardVersion, setDashboardVersion] = useState(0)
  const [homeCards, setHomeCards] = useState<HomeCard[]>([])
  const [baselineHomeCards, setBaselineHomeCards] = useState<HomeCard[]>([])
  const [selectedHomeCardId, setSelectedHomeCardId] = useState<number | null>(null)
  const [homeCardForm, setHomeCardForm] = useState<HomeCardFormState>(blankHomeCardForm)
  const [projects, setProjects] = useState<Project[]>([])
  const [baselineProjects, setBaselineProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [projectForm, setProjectForm] = useState<ProjectFormState>(blankProjectForm)
  const [siteSettings, setSiteSettings] = useState<AdminSiteSettings>(blankSiteSettings)
  const [announcementDraft, setAnnouncementDraft] = useState<Announcement>(defaultAnnouncement)
  const [builderDocuments, setBuilderDocuments] =
    useState<Record<BuilderDocumentKey, BuilderDocument | null>>(blankBuilderDocuments)
  const [builderMedia, setBuilderMedia] = useState<BuilderMediaAsset[]>([])
  const [selectedLayoutDocKey, setSelectedLayoutDocKey] = useState<BuilderDocumentKey>('layout.nav')
  const [selectedLayoutNodeId, setSelectedLayoutNodeId] = useState<string | null>(null)
  const [layoutDocEditor, setLayoutDocEditor] = useState('')
  const [socialsText, setSocialsText] = useState('{}')
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  const selectedHomeCard = useMemo(
    () => homeCards.find((card) => card.id === selectedHomeCardId) ?? null,
    [homeCards, selectedHomeCardId],
  )

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  )

  const builderDocumentsForVisual = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(builderDocuments).filter(([, document]) => Boolean(document)),
      ) as Record<BuilderDocumentKey, BuilderDocument>,
    [builderDocuments],
  )

  const activeLayoutDocument = useMemo(
    () => builderDocuments[selectedLayoutDocKey] ?? null,
    [builderDocuments, selectedLayoutDocKey],
  )

  const activeLayoutNodes = useMemo(
    () => (activeLayoutDocument ? flattenBuilderNodes(activeLayoutDocument.root) : []),
    [activeLayoutDocument],
  )

  const selectedLayoutNode = useMemo(
    () =>
      activeLayoutDocument && selectedLayoutNodeId
        ? getBuilderNode(activeLayoutDocument, selectedLayoutNodeId)
        : null,
    [activeLayoutDocument, selectedLayoutNodeId],
  )

  const materializePendingProjectDraft = () => {
    if (selectedProjectId !== null) {
      return
    }

    if (
      !projectForm.title.trim() &&
      !projectForm.summary.trim() &&
      !projectForm.details.trim() &&
      !projectForm.techCsv.trim() &&
      projectForm.links.length === 0 &&
      projectForm.detailCards.length === 0
    ) {
      return
    }

    const tempId = nextTempIdRef.current--
    const timestamp = new Date().toISOString()
    const tempProject: Project = {
      id: tempId,
      slug: `draft-${Math.abs(tempId)}`,
      title: projectForm.title.trim() || 'New Project',
      summary: projectForm.summary.trim(),
      details: projectForm.details.trim(),
      tech: projectForm.techCsv
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      links: structuredClone(projectForm.links),
      detailCards: structuredClone(projectForm.detailCards),
      demoUrl: null,
      repoUrl: null,
      status: projectForm.status,
      publishAt: projectForm.publishAt || null,
      isFeatured: projectForm.isFeatured,
      sortOrder: projects.length,
      createdAt: timestamp,
      updatedAt: timestamp,
      images: [],
    }

    setProjects((current) => [...current, tempProject])
    setSelectedProjectId(tempId)
  }

  const materializePendingHomeCardDraft = () => {
    if (selectedHomeCardId !== null) {
      return
    }

    if (!homeCardForm.title.trim() && !homeCardForm.body.trim() && !homeCardForm.subtitle.trim()) {
      return
    }

    const tempId = nextTempIdRef.current--
    const timestamp = new Date().toISOString()
    const tempCard: HomeCard = {
      id: tempId,
      title: homeCardForm.title.trim() || 'New Home Card',
      subtitle: homeCardForm.subtitle.trim(),
      body: homeCardForm.body.trim(),
      ctaLabel: homeCardForm.ctaLabel.trim(),
      ctaUrl: homeCardForm.ctaUrl.trim(),
      widthUnits: clampUnits(Number(homeCardForm.widthUnits)),
      heightUnits: clampUnits(Number(homeCardForm.heightUnits)),
      sortOrder: homeCards.length,
      isVisible: homeCardForm.isVisible,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    setHomeCards((current) => [...current, tempCard])
    setSelectedHomeCardId(tempId)
  }

  const loadDashboard = async () => {
    setIsBusy(true)
    setNotice(null)

    try {
      const [homeCardData, projectData, messageData] = await Promise.all([
        adminApi.listHomeCards(),
        adminApi.listProjects(),
        adminApi.listMessages(),
      ])
      let settingsData: SiteSettings

      try {
        settingsData = await adminApi.getSiteSettings()
      } catch (settingsError) {
        settingsData = await publicApi.getSiteSettings()
        console.warn('Admin site settings API failed; loaded public site settings instead.', settingsError)
      }
      const [builderBootstrapResult, mediaAssetsResult] = await Promise.allSettled([
        adminApi.getBuilderBootstrap(),
        adminApi.listBuilderMedia(),
      ])

      setHomeCards(homeCardData)
      setBaselineHomeCards(homeCardData)
      setProjects(projectData)
      setBaselineProjects(projectData)
      const hydratedSettings = hydrateSiteSettings(settingsData)
      const fallbackDocuments = buildFallbackBuilderDocuments({
        siteSettings: hydratedSettings,
        homeCards: homeCardData,
        projects: projectData,
      })
      setSiteSettings(hydratedSettings)
      setAnnouncementDraft(normalizeAnnouncement(hydratedSettings.announcement))
      setSocialsText(JSON.stringify(hydratedSettings.socials, null, 2))
      setMessages(messageData)
      setBuilderMedia(mediaAssetsResult.status === 'fulfilled' ? mediaAssetsResult.value : [])
      setBuilderDocuments(() => {
        const nextDocuments = { ...blankBuilderDocuments, ...fallbackDocuments }
        if (builderBootstrapResult.status === 'fulfilled') {
          builderBootstrapResult.value.documents.forEach((document) => {
            if (document.docKey in nextDocuments) {
              nextDocuments[document.docKey as BuilderDocumentKey] = document
            }
          })
        }
        return nextDocuments
      })

      if (homeCardData.length > 0) {
        const firstCard = homeCardData[0]
        setSelectedHomeCardId(firstCard.id)
        setHomeCardForm(formFromHomeCard(firstCard))
      } else {
        setSelectedHomeCardId(null)
        setHomeCardForm(blankHomeCardForm)
      }

      if (projectData.length > 0) {
        const firstProject = projectData[0]
        setSelectedProjectId(firstProject.id)
        setProjectForm(formFromProject(firstProject))
      } else {
        setSelectedProjectId(null)
        setProjectForm(blankProjectForm)
      }

      const selectedLayoutDocument =
        builderBootstrapResult.status === 'fulfilled'
          ? builderBootstrapResult.value.documents.find((document) => document.docKey === selectedLayoutDocKey)
          : null

      if (selectedLayoutDocument) {
        setLayoutDocEditor(JSON.stringify(selectedLayoutDocument, null, 2))
      } else {
        setLayoutDocEditor('')
      }

      if (builderBootstrapResult.status === 'rejected' && adminMode === 'visual') {
        setNotice('Visual Builder data is unavailable right now. Standard mode still works.')
      }

      setDashboardVersion((current) => current + 1)
    } catch (requestError) {
      setNotice(requestError instanceof Error ? requestError.message : 'Failed to load admin data.')
    } finally {
      setIsBusy(false)
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const session = await adminApi.getSession()
        setIsLoggedIn(session.authenticated)
      } catch {
        setIsLoggedIn(false)
      } finally {
        setIsCheckingAuth(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (!isLoggedIn) {
      return
    }

    void loadDashboard()
  }, [isLoggedIn])

  useEffect(() => {
    const nextDocument = builderDocuments[selectedLayoutDocKey]
    setLayoutDocEditor(nextDocument ? JSON.stringify(nextDocument, null, 2) : '')
  }, [builderDocuments, selectedLayoutDocKey])

  useEffect(() => {
    if (activeLayoutNodes.length === 0) {
      setSelectedLayoutNodeId(null)
      return
    }

    if (
      selectedLayoutNodeId &&
      activeLayoutNodes.some((node) => node.id === selectedLayoutNodeId)
    ) {
      return
    }

    setSelectedLayoutNodeId(activeLayoutNodes[0]?.id ?? null)
  }, [activeLayoutNodes, selectedLayoutNodeId])

  const updateSelectedLayoutNode = (
    updater: (node: BuilderNode) => BuilderNode,
  ) => {
    if (!activeLayoutDocument || !selectedLayoutNodeId) {
      return
    }

    setBuilderDocuments((current) => ({
      ...current,
      [selectedLayoutDocKey]: updateBuilderDocumentNode(activeLayoutDocument, selectedLayoutNodeId, updater),
    }))
  }

  const updateSelectedLayoutNodeContent = (field: string, value: unknown) => {
    if (selectedLayoutNode?.binding?.kind === 'site-settings' && selectedLayoutNode.binding.field) {
      const fieldName = selectedLayoutNode.binding.field as keyof AdminSiteSettings
      setSiteSettings((current) => ({
        ...current,
        [fieldName]: value as AdminSiteSettings[typeof fieldName],
      }))
      return
    }

    updateSelectedLayoutNode((node) => ({
      ...node,
      content: {
        ...(node.content ?? {}),
        [field]: value,
      },
    }))
  }

  const updateSelectedLayoutNodePresentation = <
    K extends keyof NonNullable<BuilderNode['presentation']>,
  >(
    field: K,
    value: NonNullable<BuilderNode['presentation']>[K],
  ) => {
    updateSelectedLayoutNode((node) => ({
      ...node,
      presentation: {
        ...(node.presentation ?? {}),
        [field]: value,
      },
    }))
  }

  const selectedLayoutBindingField =
    selectedLayoutNode?.binding?.kind === 'site-settings' && selectedLayoutNode.binding.field
      ? (selectedLayoutNode.binding.field as keyof AdminSiteSettings)
      : null

  const selectedLayoutTextValue = selectedLayoutBindingField
    ? readString(siteSettings[selectedLayoutBindingField])
    : readString(selectedLayoutNode?.content?.text)

  const onLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsBusy(true)
    setNotice(null)

    try {
      const result = await adminApi.login({
        username: loginUsername,
        password: loginPassword,
      })
      setIsLoggedIn(result.authenticated)
      setLoginPassword('')
      setNotice(result.authenticated ? 'Signed in.' : 'Sign in failed.')
    } catch (requestError) {
      setNotice(requestError instanceof Error ? requestError.message : 'Sign in failed.')
      setIsLoggedIn(false)
    } finally {
      setIsBusy(false)
    }
  }

  const onLogout = async () => {
    setIsBusy(true)
    setNotice(null)

    try {
      await adminApi.logout()
    } catch {
      // Keep logout resilient even if request fails.
    } finally {
      setIsLoggedIn(false)
      setIsBusy(false)
    }
  }

  const onSelectHomeCard = (card: HomeCard) => {
    setSelectedHomeCardId(card.id)
    setHomeCardForm(formFromHomeCard(card))
    setNotice(null)
  }

  const onSaveHomeCard = async () => {
    const payload = normalizeHomeCardInput(homeCardForm)

    if (!payload.title) {
      setNotice('Home card title is required.')
      return
    }

    setIsBusy(true)
    setNotice(null)

    try {
      const saved = selectedHomeCard
        ? selectedHomeCard.id > 0
          ? await adminApi.updateHomeCard(selectedHomeCard.id, payload)
          : await adminApi.createHomeCard(payload)
        : await adminApi.createHomeCard(payload)

      await loadDashboard()
      setSelectedHomeCardId(saved.id)
      setNotice('Home card saved.')
    } catch (requestError) {
      setNotice(requestError instanceof Error ? requestError.message : 'Failed to save home card.')
    } finally {
      setIsBusy(false)
    }
  }

  const onDeleteHomeCard = async () => {
    if (!selectedHomeCard) {
      return
    }

    if (selectedHomeCard.id <= 0) {
      setHomeCards((current) => current.filter((card) => card.id !== selectedHomeCard.id))
      setSelectedHomeCardId(null)
      setHomeCardForm(blankHomeCardForm)
      setNotice('Local home card draft removed.')
      return
    }

    setIsBusy(true)
    setNotice(null)

    try {
      await adminApi.deleteHomeCard(selectedHomeCard.id)
      await loadDashboard()
      setNotice('Home card deleted.')
    } catch (requestError) {
      setNotice(requestError instanceof Error ? requestError.message : 'Failed to delete home card.')
    } finally {
      setIsBusy(false)
    }
  }

  const onMoveHomeCard = async (direction: -1 | 1) => {
    if (!selectedHomeCard) {
      return
    }

    const currentIndex = homeCards.findIndex((card) => card.id === selectedHomeCard.id)
    const targetIndex = currentIndex + direction

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= homeCards.length) {
      return
    }

    const reordered = [...homeCards]
    const [item] = reordered.splice(currentIndex, 1)
    reordered.splice(targetIndex, 0, item)
    setHomeCards(reordered)

    if (reordered.some((card) => card.id <= 0)) {
      setNotice('Local home card order updated. Save drafts before publishing order.')
      return
    }

    try {
      await adminApi.reorderHomeCards(reordered.map((card) => card.id))
      setNotice('Home card order updated.')
      await loadDashboard()
    } catch (requestError) {
      setNotice(requestError instanceof Error ? requestError.message : 'Failed to reorder home cards.')
    }
  }

  const onSelectProject = (project: Project) => {
    setSelectedProjectId(project.id)
    setProjectForm(formFromProject(project))
    setNotice(null)
  }

  const onSaveProject = async () => {
    const payload = normalizeProjectInput(projectForm)
    if (!payload.title || !payload.summary) {
      setNotice('Title and summary are required.')
      return
    }

    setIsBusy(true)
    setNotice(null)

    try {
      const saved = selectedProject
        ? selectedProject.id > 0
          ? await adminApi.updateProject(selectedProject.id, payload)
          : await adminApi.createProject(payload)
        : await adminApi.createProject(payload)

      await loadDashboard()
      setSelectedProjectId(saved.id)
      setNotice('Project saved.')
    } catch (requestError) {
      setNotice(requestError instanceof Error ? requestError.message : 'Failed to save project.')
    } finally {
      setIsBusy(false)
    }
  }

  const onDeleteProject = async () => {
    if (!selectedProject) {
      return
    }

    if (selectedProject.id <= 0) {
      setProjects((current) => current.filter((project) => project.id !== selectedProject.id))
      setSelectedProjectId(null)
      setProjectForm(blankProjectForm)
      setNotice('Local project draft removed.')
      return
    }

    setIsBusy(true)
    setNotice(null)

    try {
      await adminApi.deleteProject(selectedProject.id)
      await loadDashboard()
      setNotice('Project deleted.')
    } catch (requestError) {
      setNotice(requestError instanceof Error ? requestError.message : 'Failed to delete project.')
    } finally {
      setIsBusy(false)
    }
  }

  const onMoveProject = async (direction: -1 | 1) => {
    if (!selectedProject) {
      return
    }

    const currentIndex = projects.findIndex((project) => project.id === selectedProject.id)
    const targetIndex = currentIndex + direction

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= projects.length) {
      return
    }

    const reordered = [...projects]
    const [item] = reordered.splice(currentIndex, 1)
    reordered.splice(targetIndex, 0, item)

    setProjects(reordered)

    if (reordered.some((project) => project.id <= 0)) {
      setNotice('Local project order updated. Save drafts before publishing order.')
      return
    }

    try {
      await adminApi.reorderProjects(reordered.map((project) => project.id))
      setNotice('Project order updated.')
      await loadDashboard()
    } catch (requestError) {
      setNotice(requestError instanceof Error ? requestError.message : 'Failed to update order.')
    }
  }

  const onUploadImages = async (files: FileList | null) => {
    if (!selectedProject || !files || files.length === 0) {
      return
    }

    setIsBusy(true)
    setNotice(null)

    try {
      await adminApi.uploadProjectImages(selectedProject.id, Array.from(files))
      await loadDashboard()
      setNotice('Images uploaded.')
    } catch (requestError) {
      setNotice(requestError instanceof Error ? requestError.message : 'Image upload failed.')
    } finally {
      setIsBusy(false)
    }
  }

  const onReorderImages = async (orderedIds: number[]) => {
    if (!selectedProject) {
      return
    }

    setIsBusy(true)

    try {
      await adminApi.reorderProjectImages(selectedProject.id, orderedIds)
      await loadDashboard()
      setNotice('Image order saved.')
    } catch (requestError) {
      setNotice(requestError instanceof Error ? requestError.message : 'Image reorder failed.')
    } finally {
      setIsBusy(false)
    }
  }

  /** Replaces one project's picture list without touching anything else that is being edited. */
  const applyProjectImages = (projectId: number, images: ProjectImage[]) => {
    const withImages = (list: Project[]) =>
      list.map((project) => (project.id === projectId ? { ...project, images } : project))
    setProjects(withImages)
    setBaselineProjects(withImages)
  }

  /** Uploads pictures for the page editor. Unlike the upload below it keeps unsaved page edits. */
  const onUploadProjectImagesFor = async (projectId: number, files: File[]): Promise<ProjectImage[]> => {
    const known = new Set(
      projects.find((project) => project.id === projectId)?.images.map((image) => image.id) ?? [],
    )
    const saved = await adminApi.uploadProjectImages(projectId, files)
    applyProjectImages(projectId, saved.images)
    return saved.images.filter((image) => !known.has(image.id))
  }

  const onMakeProjectCoverFor = async (projectId: number, imageId: number) => {
    const project = projects.find((entry) => entry.id === projectId)
    if (!project) {
      return
    }

    try {
      const orderedIds = [imageId, ...project.images.map((image) => image.id).filter((id) => id !== imageId)]
      const saved = await adminApi.reorderProjectImages(projectId, orderedIds)
      applyProjectImages(projectId, saved.images)
      setNotice('That picture is now the one on the project card.')
    } catch (requestError) {
      setNotice(requestError instanceof Error ? requestError.message : 'Could not change the card picture.')
    }
  }

  const projectFormTech = projectForm.techCsv
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  const onProjectPageChange = (patch: ProjectPagePatch) => {
    setProjectForm((current) => ({
      ...current,
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
      ...(patch.tech !== undefined ? { techCsv: patch.tech.join(', ') } : {}),
      ...(patch.links !== undefined ? { links: patch.links } : {}),
      ...(patch.contentBlocks !== undefined ? { contentBlocks: patch.contentBlocks } : {}),
    }))
  }

  const onDeleteImage = async (imageId: number) => {
    setIsBusy(true)

    try {
      await adminApi.deleteImage(imageId)
      await loadDashboard()
      setNotice('Image deleted.')
    } catch (requestError) {
      setNotice(requestError instanceof Error ? requestError.message : 'Image delete failed.')
    } finally {
      setIsBusy(false)
    }
  }

  const onSaveContactSettings = async () => {
    setIsBusy(true)
    setNotice(null)

    try {
      const socials = JSON.parse(socialsText) as Record<string, string>
      const payload = {
        ...siteSettings,
        socials,
      }
      const saved = await adminApi.updateSiteSettings(payload)
      const hydratedSettings = hydrateSiteSettings(saved)
      setSiteSettings(hydratedSettings)
      setSocialsText(JSON.stringify(hydratedSettings.socials, null, 2))
      setNotice('Contact settings saved.')
    } catch (requestError) {
      setNotice(
        requestError instanceof Error
          ? requestError.message
          : 'Failed to save contact settings. Ensure socials is valid JSON.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const onSaveHomeHeader = async () => {
    setIsBusy(true)
    setNotice(null)

    try {
      const payload = {
        ...siteSettings,
        homeEyebrow: siteSettings.homeEyebrow.trim(),
        homeTitle: siteSettings.homeTitle.trim() || 'Hello There',
        homeTagline:
          siteSettings.homeTagline.trim() ||
          'I build and document homelab infrastructure, self-hosted services, and hands-on systems projects.',
        homeIntro:
          siteSettings.homeIntro.trim() ||
          "I build and document real homelab infrastructure around Proxmox, self-hosted services, monitoring, security, automation, and live operational visibility. nbdevlab is where I share what I'm running, what I'm learning, and what I'm building next.",
      }

      const saved = await adminApi.updateSiteSettings(payload)
      setSiteSettings(hydrateSiteSettings(saved))
      setNotice('Homepage main card content saved.')
    } catch (requestError) {
      setNotice(
        requestError instanceof Error
          ? requestError.message
          : 'Failed to save homepage main card content.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const onSaveGateSettings = async () => {
    setIsBusy(true)
    setNotice(null)

    try {
      const payload = {
        ...siteSettings,
        gateSettings: normalizeGateSettings(siteSettings.gateSettings),
      }
      const saved = await adminApi.updateSiteSettings(payload)
      setSiteSettings(hydrateSiteSettings(saved))
      setNotice('Gate animation settings saved.')
    } catch (requestError) {
      setNotice(
        requestError instanceof Error ? requestError.message : 'Failed to save gate animation settings.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const onSaveMaintenanceSettings = async () => {
    setIsBusy(true)
    setNotice(null)

    try {
      const payload = {
        ...siteSettings,
        maintenanceMessage: normalizeMaintenanceMessage(siteSettings.maintenanceMessage),
        statusPowerMode: normalizeStatusPowerMode(siteSettings.statusPowerMode),
      }
      const saved = await adminApi.updateSiteSettings(payload)
      setSiteSettings(hydrateSiteSettings(saved))
      setNotice('Status controls saved.')
    } catch (requestError) {
      setNotice(
        requestError instanceof Error ? requestError.message : 'Failed to save status controls.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const onSaveAnnouncement = async () => {
    setIsBusy(true)
    setNotice(null)

    try {
      const saved = await adminApi.updateAnnouncement(normalizeAnnouncement(announcementDraft))
      const announcement = normalizeAnnouncement(saved.announcement)
      setSiteSettings((current) => ({ ...current, announcement }))
      setAnnouncementDraft(announcement)
      setNotice(
        announcement.enabled
          ? 'Announcement saved. It is switched on.'
          : 'Announcement saved. It is switched off, so visitors see nothing.',
      )
    } catch (requestError) {
      setNotice(requestError instanceof Error ? requestError.message : 'Failed to save the announcement.')
    } finally {
      setIsBusy(false)
    }
  }

  const onSaveAboutPage = async () => {
    setIsBusy(true)
    setNotice(null)

    try {
      const payload = {
        ...siteSettings,
        aboutBlocks: normalizeAboutBlocks(siteSettings.aboutBlocks),
      }
      const saved = await adminApi.updateSiteSettings(payload)
      setSiteSettings(hydrateSiteSettings(saved))
      setNotice('About page content saved.')
    } catch (requestError) {
      setNotice(
        requestError instanceof Error ? requestError.message : 'Failed to save About page content.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const onSaveSkillsPage = async () => {
    setIsBusy(true)
    setNotice(null)

    try {
      const payload = {
        ...siteSettings,
        skillsGroups: normalizeSkillGroups(siteSettings.skillsGroups),
      }
      const saved = await adminApi.updateSiteSettings(payload)
      setSiteSettings(hydrateSiteSettings(saved))
      setNotice('Skills page content saved.')
    } catch (requestError) {
      setNotice(
        requestError instanceof Error ? requestError.message : 'Failed to save Skills page content.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const onUploadAboutImage = async (blockId: string, file: File | null) => {
    if (!file) {
      return
    }

    setIsBusy(true)
    setNotice(null)

    try {
      const uploaded = await adminApi.uploadAboutImage(file)
      setSiteSettings((current) => ({
        ...current,
        aboutBlocks: updateAboutBlock(current.aboutBlocks, blockId, (currentBlock) =>
          currentBlock.type === 'image'
            ? {
                ...currentBlock,
                src: uploaded.url,
                alt: currentBlock.alt.trim() || uploaded.suggestedAlt,
              }
            : currentBlock,
        ),
      }))
      setNotice('About image uploaded. Save the About page to publish it.')
    } catch (requestError) {
      setNotice(requestError instanceof Error ? requestError.message : 'About image upload failed.')
    } finally {
      setIsBusy(false)
    }
  }

  const onPasteAboutImage = (blockId: string, event: ClipboardEvent<HTMLDivElement>) => {
    const imageFile =
      Array.from(event.clipboardData.items)
        .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .find((file): file is File => file instanceof File) ?? null

    if (!imageFile) {
      return
    }

    event.preventDefault()
    void onUploadAboutImage(blockId, imageFile)
  }

  const onUpdateMessageStatus = async (messageId: number, status: MessageStatus) => {
    setIsBusy(true)

    try {
      const updated = await adminApi.updateMessageStatus(messageId, status)
      setMessages((current) =>
        current.map((message) => (message.id === messageId ? updated : message)),
      )
    } catch (requestError) {
      setNotice(requestError instanceof Error ? requestError.message : 'Failed to update message.')
    } finally {
      setIsBusy(false)
    }
  }

  const onToggleAdminMode = (nextMode: AdminMode) => {
    if (nextMode === adminMode) {
      return
    }

    if (nextMode === 'visual') {
      materializePendingHomeCardDraft()
      materializePendingProjectDraft()

      const nextBuilderPage: BuilderDocumentKey =
        activeTab === 'home'
          ? 'page.home'
          : activeTab === 'about'
            ? 'page.about'
            : activeTab === 'skills'
              ? 'page.skills'
              : activeTab === 'projects'
                ? 'page.projects'
                : activeTab === 'status'
                  ? 'page.status'
                  : activeTab === 'contact'
                  ? 'page.contact'
                  : activeTab === 'layout'
                    ? 'layout.nav'
                    : builderActivePage

      setBuilderActivePage(nextBuilderPage)
      setAdminMode('visual')
      return
    }

    if (builderActivePage === 'page.home') {
      setActiveTab('home')
    } else if (builderActivePage === 'page.about') {
      setActiveTab('about')
    } else if (builderActivePage === 'page.skills') {
      setActiveTab('skills')
    } else if (builderActivePage === 'page.projects') {
      setActiveTab('projects')
    } else if (builderActivePage === 'page.status') {
      setActiveTab('status')
    } else if (builderActivePage === 'page.contact') {
      setActiveTab('contact')
    } else if (builderActivePage === 'layout.nav') {
      setActiveTab('layout')
    }

    const selectedHomeCardDraft = homeCards.find((card) => card.id === selectedHomeCardId)
    if (selectedHomeCardDraft) {
      setHomeCardForm(formFromHomeCard(selectedHomeCardDraft))
    }
    const selectedProjectDraft = projects.find((project) => project.id === selectedProjectId)
    if (selectedProjectDraft) {
      setProjectForm(formFromProject(selectedProjectDraft))
    }

    setAdminMode('standard')
  }

  const onSaveLayoutDocument = async () => {
    setIsBusy(true)
    setNotice(null)

    try {
      if (selectedLayoutDocKey === 'page.home') {
        const savedSettings = await adminApi.updateSiteSettings({
          ...siteSettings,
          homeEyebrow: siteSettings.homeEyebrow.trim(),
          homeTitle: siteSettings.homeTitle.trim() || 'Hello There',
          homeTagline:
            siteSettings.homeTagline.trim() ||
            'I build and document homelab infrastructure, self-hosted services, and hands-on systems projects.',
          homeIntro:
            siteSettings.homeIntro.trim() ||
            "I build and document real homelab infrastructure around Proxmox, self-hosted services, monitoring, security, automation, and live operational visibility. nbdevlab is where I share what I'm running, what I'm learning, and what I'm building next.",
        })
        setSiteSettings(hydrateSiteSettings(savedSettings))
      }

      if (selectedLayoutDocKey === 'page.contact') {
        const savedSettings = await adminApi.updateSiteSettings({
          ...siteSettings,
          socials: JSON.parse(JSON.stringify(siteSettings.socials)) as Record<string, string>,
        })
        setSiteSettings(hydrateSiteSettings(savedSettings))
      }

      const payload = JSON.parse(layoutDocEditor) as BuilderDocument
      const saved = await adminApi.saveBuilderDocument(selectedLayoutDocKey, payload)
      setBuilderDocuments((current) => ({
        ...current,
        [selectedLayoutDocKey]: saved,
      }))
      setLayoutDocEditor(JSON.stringify(saved, null, 2))
      setNotice('Builder document saved.')
    } catch (requestError) {
      setNotice(requestError instanceof Error ? requestError.message : 'Failed to save builder document.')
    } finally {
      setIsBusy(false)
    }
  }

  const onDeleteBuilderMedia = async (id: number) => {
    setIsBusy(true)
    setNotice(null)

    try {
      await adminApi.deleteBuilderMedia(id)
      setBuilderMedia((current) => current.filter((asset) => asset.id !== id))
      setNotice('Builder media deleted.')
    } catch (requestError) {
      setNotice(requestError instanceof Error ? requestError.message : 'Failed to delete builder media.')
    } finally {
      setIsBusy(false)
    }
  }

  const onUploadBuilderMedia = async (file: File, options?: { altText?: string; caption?: string }) => {
    const asset = await adminApi.uploadBuilderMedia(file, options)
    setBuilderMedia((current) => [asset, ...current])
    return asset
  }

  const onSaveVisualPage = async (page: BuilderDocumentKey) => {
    setIsBusy(true)
    setNotice(null)

    try {
      if (page === 'page.home') {
        const savedSettings = await adminApi.updateSiteSettings({
          ...siteSettings,
          homeEyebrow: siteSettings.homeEyebrow.trim(),
          homeTitle: siteSettings.homeTitle.trim() || 'Hello There',
          homeTagline:
            siteSettings.homeTagline.trim() ||
            'I build and document homelab infrastructure, self-hosted services, and hands-on systems projects.',
          homeIntro:
            siteSettings.homeIntro.trim() ||
            "I build and document real homelab infrastructure around Proxmox, self-hosted services, monitoring, security, automation, and live operational visibility. nbdevlab is where I share what I'm running, what I'm learning, and what I'm building next.",
        })
        setSiteSettings(hydrateSiteSettings(savedSettings))

        for (const card of homeCards) {
          const payload = normalizeHomeCardInput(formFromHomeCard(card))
          if (card.id > 0) {
            await adminApi.updateHomeCard(card.id, payload)
          } else {
            await adminApi.createHomeCard(payload)
          }
        }
        const deletedHomeCards = baselineHomeCards.filter(
          (baselineCard) => baselineCard.id > 0 && !homeCards.some((card) => card.id === baselineCard.id),
        )
        for (const card of deletedHomeCards) {
          await adminApi.deleteHomeCard(card.id)
        }
      } else if (page === 'page.projects') {
        for (const project of projects) {
          const payload = normalizeProjectInput(formFromProject(project))
          if (project.id > 0) {
            await adminApi.updateProject(project.id, payload)
          } else {
            await adminApi.createProject(payload)
          }
        }
        const deletedProjects = baselineProjects.filter(
          (baselineProject) => baselineProject.id > 0 && !projects.some((project) => project.id === baselineProject.id),
        )
        for (const project of deletedProjects) {
          await adminApi.deleteProject(project.id)
        }
        const savedIds = projects.map((project) => project.id).filter((id) => id > 0)
        if (savedIds.length > 0) {
          await adminApi.reorderProjects(savedIds)
        }
      } else if (page === 'page.about') {
        await adminApi.updateSiteSettings({
          ...siteSettings,
          aboutBlocks: normalizeAboutBlocks(siteSettings.aboutBlocks),
        })
      } else if (page === 'page.skills') {
        await adminApi.updateSiteSettings({
          ...siteSettings,
          skillsGroups: normalizeSkillGroups(siteSettings.skillsGroups),
        })
      } else if (page === 'page.contact') {
        const payload = {
          ...siteSettings,
          socials: JSON.parse(JSON.stringify(siteSettings.socials)) as Record<string, string>,
        }
        await adminApi.updateSiteSettings(payload)
      }

      const activeDocument = builderDocuments[page]
      if (activeDocument) {
        const savedDocument = await adminApi.saveBuilderDocument(page, activeDocument)
        setBuilderDocuments((current) => ({
          ...current,
          [page]: savedDocument,
        }))
      }

      await loadDashboard()
      setNotice('Visual Builder changes saved.')
    } catch (requestError) {
      setNotice(requestError instanceof Error ? requestError.message : 'Failed to save Visual Builder changes.')
    } finally {
      setIsBusy(false)
    }
  }

  if (isCheckingAuth) {
    return (
      <section className="admin-login">
        <h1>Admin Login</h1>
        <p>Checking session...</p>
      </section>
    )
  }

  if (!isLoggedIn) {
    return (
      <section className="admin-login">
        <h1>Admin Login</h1>
        <p>Sign in with the credentials configured in Worker secrets.</p>
        <Link className="button admin-login__back-link" to="/">
          Back To Homepage
        </Link>
        <form className="admin-login__form" onSubmit={(event) => void onLogin(event)}>
          <label>
            Username
            <input
              type="text"
              name="username"
              value={loginUsername}
              onChange={(event) => setLoginUsername(event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              required
            />
          </label>
          <button className="button button--solid" type="submit" disabled={isBusy}>
            Enter Dashboard
          </button>
        </form>
        {notice && <p className="notice">{notice}</p>}
      </section>
    )
  }

  return (
    <section className={`admin-shell ${adminMode === 'visual' ? 'admin-shell--visual' : ''}`}>
      <header className="admin-shell__header">
        <h1>Site Dashboard</h1>
        <div className="admin-shell__header-actions">
          <Link className="button" to="/">
            Back To Homepage
          </Link>
          <button className="button" type="button" onClick={() => void loadDashboard()}>
            Refresh
          </button>
          <button className="button" type="button" onClick={() => void onLogout()}>
            Logout
          </button>
        </div>
      </header>

      <div className="admin-mode-toggle" role="tablist" aria-label="Admin editing mode">
        <button
          type="button"
          className={adminMode === 'standard' ? 'is-active' : ''}
          onClick={() => onToggleAdminMode('standard')}
        >
          Standard
        </button>
        <button
          type="button"
          className={adminMode === 'visual' ? 'is-active' : ''}
          onClick={() => onToggleAdminMode('visual')}
        >
          Visual Builder
        </button>
      </div>

      <div className={adminMode === 'visual' ? '' : 'admin-hidden'}>
        <AdminVisualBuilder
          activePage={builderActivePage}
          onActivePageChange={setBuilderActivePage}
          siteSettings={siteSettings}
          setSiteSettings={setSiteSettings}
          homeCards={homeCards}
          setHomeCards={setHomeCards}
          projects={projects}
          setProjects={setProjects}
          documents={builderDocumentsForVisual}
          setDocuments={setBuilderDocuments}
          builderMedia={builderMedia}
          onUploadBuilderMedia={onUploadBuilderMedia}
          onDeleteBuilderMedia={onDeleteBuilderMedia}
          onUploadAboutImage={onUploadAboutImage}
          onSavePage={onSaveVisualPage}
          onSelectProject={setSelectedProjectId}
          onSelectHomeCard={setSelectedHomeCardId}
          onUploadProjectImages={onUploadProjectImagesFor}
          onMakeProjectCover={(projectId, imageId) => void onMakeProjectCoverFor(projectId, imageId)}
          dataVersion={dashboardVersion}
          isBusy={isBusy}
        />
      </div>

      <div className={adminMode === 'standard' ? '' : 'admin-hidden'}>

      <nav className="admin-tabs" aria-label="Admin sections">
        <button
          className={activeTab === 'home' ? 'is-active' : ''}
          type="button"
          onClick={() => setActiveTab('home')}
        >
          Home Layout
        </button>
        <button
          className={activeTab === 'gate' ? 'is-active' : ''}
          type="button"
          onClick={() => setActiveTab('gate')}
        >
          Gate FX
        </button>
        <button
          className={activeTab === 'about' ? 'is-active' : ''}
          type="button"
          onClick={() => setActiveTab('about')}
        >
          About
        </button>
        <button
          className={activeTab === 'skills' ? 'is-active' : ''}
          type="button"
          onClick={() => setActiveTab('skills')}
        >
          Skills
        </button>
        <button
          className={activeTab === 'projects' ? 'is-active' : ''}
          type="button"
          onClick={() => setActiveTab('projects')}
        >
          Projects
        </button>
        <button
          className={activeTab === 'status' ? 'is-active' : ''}
          type="button"
          onClick={() => setActiveTab('status')}
        >
          Status
        </button>
        <button
          className={activeTab === 'announcement' ? 'is-active' : ''}
          type="button"
          onClick={() => setActiveTab('announcement')}
        >
          Announcement
        </button>
        <button
          className={activeTab === 'contact' ? 'is-active' : ''}
          type="button"
          onClick={() => setActiveTab('contact')}
        >
          Contact
        </button>
        <button
          className={activeTab === 'layout' ? 'is-active' : ''}
          type="button"
          onClick={() => setActiveTab('layout')}
        >
          Layout
        </button>
        <button
          className={activeTab === 'messages' ? 'is-active' : ''}
          type="button"
          onClick={() => setActiveTab('messages')}
        >
          Messages
        </button>
      </nav>

      {notice && <p className="notice">{notice}</p>}
      {isBusy && <p className="notice">Working...</p>}

      {activeTab === 'home' && (
        <div className="admin-grid">
          <aside className="admin-list">
            <button
              className="button button--solid"
              type="button"
              onClick={() => {
                setSelectedHomeCardId(null)
                setHomeCardForm(blankHomeCardForm)
              }}
            >
              New Home Card
            </button>
            <ul>
              {homeCards.map((card) => (
                <li key={card.id}>
                  <button
                    type="button"
                    className={selectedHomeCardId === card.id ? 'is-active' : ''}
                    onClick={() => onSelectHomeCard(card)}
                  >
                    <span>{card.title}</span>
                    <small>{card.widthUnits}x{card.heightUnits}</small>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="admin-editor">
            <h2>Main Card (Homepage Header)</h2>
            <label>
              Eyebrow
              <input
                type="text"
                value={siteSettings.homeEyebrow}
                onChange={(event) =>
                  setSiteSettings((current) => ({ ...current, homeEyebrow: event.target.value }))
                }
              />
            </label>
            <label>
              Title
              <input
                type="text"
                value={siteSettings.homeTitle}
                onChange={(event) =>
                  setSiteSettings((current) => ({ ...current, homeTitle: event.target.value }))
                }
                />
            </label>
            <label>
              Tagline
              <textarea
                rows={3}
                value={siteSettings.homeTagline}
                onChange={(event) =>
                  setSiteSettings((current) => ({ ...current, homeTagline: event.target.value }))
                }
              />
            </label>
            <label>
              Intro Text
              <textarea
                rows={3}
                value={siteSettings.homeIntro}
                onChange={(event) =>
                  setSiteSettings((current) => ({ ...current, homeIntro: event.target.value }))
                }
              />
            </label>
            <div className="admin-editor__actions">
              <button className="button button--solid" type="button" onClick={() => void onSaveHomeHeader()}>
                Save Main Card
              </button>
            </div>

            <h2>Layout Cards</h2>
            <label>
              Title
              <input
                type="text"
                value={homeCardForm.title}
                onChange={(event) =>
                  setHomeCardForm((current) => ({ ...current, title: event.target.value }))
                }
              />
            </label>
            <label>
              Subtitle
              <input
                type="text"
                value={homeCardForm.subtitle}
                onChange={(event) =>
                  setHomeCardForm((current) => ({ ...current, subtitle: event.target.value }))
                }
              />
            </label>
            <label>
              Body
              <textarea
                rows={4}
                value={homeCardForm.body}
                onChange={(event) =>
                  setHomeCardForm((current) => ({ ...current, body: event.target.value }))
                }
              />
            </label>
            <label>
              CTA Label
              <input
                type="text"
                value={homeCardForm.ctaLabel}
                onChange={(event) =>
                  setHomeCardForm((current) => ({ ...current, ctaLabel: event.target.value }))
                }
              />
            </label>
            <label>
              CTA URL (e.g. /projects)
              <input
                type="text"
                value={homeCardForm.ctaUrl}
                onChange={(event) =>
                  setHomeCardForm((current) => ({ ...current, ctaUrl: event.target.value }))
                }
              />
            </label>
            <label>
              Width Units (1-4)
              <select
                value={homeCardForm.widthUnits}
                onChange={(event) =>
                  setHomeCardForm((current) => ({ ...current, widthUnits: event.target.value }))
                }
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
              </select>
            </label>
            <label>
              Height Units (1-4)
              <select
                value={homeCardForm.heightUnits}
                onChange={(event) =>
                  setHomeCardForm((current) => ({ ...current, heightUnits: event.target.value }))
                }
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
              </select>
            </label>
            <label className="admin-inline-checkbox">
              <input
                type="checkbox"
                checked={homeCardForm.isVisible}
                onChange={(event) =>
                  setHomeCardForm((current) => ({ ...current, isVisible: event.target.checked }))
                }
              />
              Visible on homepage
            </label>

            <div className="admin-editor__actions">
              <button className="button button--solid" type="button" onClick={() => void onSaveHomeCard()}>
                Save Home Card
              </button>
              <button className="button" type="button" onClick={() => void onDeleteHomeCard()}>
                Delete Home Card
              </button>
              <button className="button" type="button" onClick={() => void onMoveHomeCard(-1)}>
                Move Up
              </button>
              <button className="button" type="button" onClick={() => void onMoveHomeCard(1)}>
                Move Down
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'gate' && (
        <GateSettingsPanel
          settings={siteSettings.gateSettings ?? defaultGateSettings}
          isBusy={isBusy}
          onChange={(gateSettings) =>
            setSiteSettings((current) => ({
              ...current,
              gateSettings,
            }))
          }
          onSave={() => void onSaveGateSettings()}
        />
      )}

      {activeTab === 'about' && (
        <div className="admin-panel admin-panel--about">
          <div className="admin-editor__actions">
            <button
              className="button"
              type="button"
              onClick={() =>
                setSiteSettings((current) => ({
                  ...current,
                  aboutBlocks: [...current.aboutBlocks, createParagraphBlock()],
                }))
              }
            >
              Add Paragraph
            </button>
            <button
              className="button"
              type="button"
              onClick={() =>
                setSiteSettings((current) => ({
                  ...current,
                  aboutBlocks: [...current.aboutBlocks, createImageBlock()],
                }))
              }
            >
              Add Image
            </button>
            <button className="button button--solid" type="button" onClick={() => void onSaveAboutPage()}>
              Save About Page
            </button>
          </div>

          <p className="admin-about-note">
            Paragraph blocks render as body copy. Image blocks can use uploaded files, pasted
            clipboard images, or manual URLs. Each block can also add a top divider line. Alt text
            is recommended, and you still need to save the About page after editing.
          </p>

          <div className="admin-about-blocks">
            {siteSettings.aboutBlocks.map((block, index) => (
              <article key={block.id} className="admin-about-block">
                <div className="admin-about-block__header">
                  <div>
                    <p className="eyebrow">Block {index + 1}</p>
                    <strong>{block.type === 'paragraph' ? 'Paragraph' : 'Image'}</strong>
                  </div>
                  <label>
                    Type
                    <select
                      value={block.type}
                      onChange={(event) => {
                        const nextType = event.target.value
                        setSiteSettings((current) => ({
                          ...current,
                          aboutBlocks: updateAboutBlock(current.aboutBlocks, block.id, () =>
                            nextType === 'image'
                              ? createImageBlock()
                              : createParagraphBlock(),
                          ).map((nextBlock) =>
                            nextBlock.id === block.id
                              ? { ...nextBlock, id: block.id, showTopRule: block.showTopRule }
                              : nextBlock,
                          ),
                        }))
                      }}
                    >
                      <option value="paragraph">Paragraph</option>
                      <option value="image">Image</option>
                    </select>
                  </label>
                </div>

                <label className="admin-inline-checkbox">
                  <input
                    type="checkbox"
                    checked={block.showTopRule}
                    onChange={(event) =>
                      setSiteSettings((current) => ({
                        ...current,
                        aboutBlocks: updateAboutBlock(current.aboutBlocks, block.id, (currentBlock) => ({
                          ...currentBlock,
                          showTopRule: event.target.checked,
                        })),
                      }))
                    }
                  />
                  Top divider
                </label>

                {block.type === 'paragraph' ? (
                  <label>
                    Content
                    <textarea
                      rows={6}
                      value={block.content}
                      onChange={(event) =>
                        setSiteSettings((current) => ({
                          ...current,
                          aboutBlocks: updateAboutBlock(current.aboutBlocks, block.id, (currentBlock) =>
                            currentBlock.type === 'paragraph'
                              ? { ...currentBlock, content: event.target.value }
                              : currentBlock,
                          ),
                        }))
                      }
                    />
                  </label>
                ) : (
                  <div
                    className="admin-about-block__fields"
                    onPaste={(event) => onPasteAboutImage(block.id, event)}
                  >
                    <label>
                      Image URL or Path
                      <input
                        type="text"
                        value={block.src}
                        onChange={(event) =>
                          setSiteSettings((current) => ({
                            ...current,
                            aboutBlocks: updateAboutBlock(current.aboutBlocks, block.id, (currentBlock) =>
                              currentBlock.type === 'image'
                                ? { ...currentBlock, src: event.target.value }
                                : currentBlock,
                            ),
                          }))
                        }
                      />
                    </label>
                    <label>
                      Upload Image
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null
                          event.target.value = ''
                          void onUploadAboutImage(block.id, file)
                        }}
                      />
                    </label>
                    <p className="admin-about-block__hint">
                      Upload a file or paste an image into this block. The uploaded image URL will be
                      filled in automatically.
                    </p>
                    <label>
                      Alt Text
                      <input
                        type="text"
                        value={block.alt}
                        onChange={(event) =>
                          setSiteSettings((current) => ({
                            ...current,
                            aboutBlocks: updateAboutBlock(current.aboutBlocks, block.id, (currentBlock) =>
                              currentBlock.type === 'image'
                                ? { ...currentBlock, alt: event.target.value }
                                : currentBlock,
                            ),
                          }))
                        }
                      />
                    </label>
                    <label>
                      Caption
                      <textarea
                        rows={3}
                        value={block.caption}
                        onChange={(event) =>
                          setSiteSettings((current) => ({
                            ...current,
                            aboutBlocks: updateAboutBlock(current.aboutBlocks, block.id, (currentBlock) =>
                              currentBlock.type === 'image'
                                ? { ...currentBlock, caption: event.target.value }
                                : currentBlock,
                            ),
                          }))
                        }
                      />
                    </label>
                    {block.src.trim() && (
                      <div className="admin-about-block__preview">
                        <img src={block.src} alt={block.alt.trim() || block.caption.trim() || ''} />
                      </div>
                    )}
                  </div>
                )}

                <div className="admin-editor__actions">
                  <button
                    className="button"
                    type="button"
                    onClick={() =>
                      setSiteSettings((current) => {
                        const blocks = [...current.aboutBlocks]
                        if (index === 0) {
                          return current
                        }
                        const [item] = blocks.splice(index, 1)
                        blocks.splice(index - 1, 0, item)
                        return { ...current, aboutBlocks: blocks }
                      })
                    }
                    disabled={index === 0}
                  >
                    Move Up
                  </button>
                  <button
                    className="button"
                    type="button"
                    onClick={() =>
                      setSiteSettings((current) => {
                        const blocks = [...current.aboutBlocks]
                        if (index >= blocks.length - 1) {
                          return current
                        }
                        const [item] = blocks.splice(index, 1)
                        blocks.splice(index + 1, 0, item)
                        return { ...current, aboutBlocks: blocks }
                      })
                    }
                    disabled={index >= siteSettings.aboutBlocks.length - 1}
                  >
                    Move Down
                  </button>
                  <button
                    className="button"
                    type="button"
                    onClick={() =>
                      setSiteSettings((current) => ({
                        ...current,
                        aboutBlocks: current.aboutBlocks.filter((currentBlock) => currentBlock.id !== block.id),
                      }))
                    }
                  >
                    Delete Block
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'skills' && (
        <div className="admin-panel admin-panel--skills">
          <div className="admin-editor__actions">
            <button
              className="button"
              type="button"
              onClick={() =>
                setSiteSettings((current) => ({
                  ...current,
                  skillsGroups: [...current.skillsGroups, createSkillGroup()],
                }))
              }
            >
              Add Group
            </button>
            <button className="button button--solid" type="button" onClick={() => void onSaveSkillsPage()}>
              Save Skills Page
            </button>
          </div>

          <p className="admin-skill-note">
            Add, remove, and rename skill groups or individual skills here. Save the Skills page
            when you are done.
          </p>

          <div className="admin-skill-groups">
            {siteSettings.skillsGroups.map((group, groupIndex) => (
              <article key={group.id} className="admin-skill-group">
                <div className="admin-skill-group__header">
                  <div>
                    <p className="eyebrow">Group {groupIndex + 1}</p>
                    <strong>{group.title.trim() || 'Untitled group'}</strong>
                  </div>
                  <label>
                    Group Title
                    <input
                      type="text"
                      value={group.title}
                      onChange={(event) =>
                        setSiteSettings((current) => ({
                          ...current,
                          skillsGroups: updateSkillGroup(current.skillsGroups, group.id, (currentGroup) => ({
                            ...currentGroup,
                            title: event.target.value,
                          })),
                        }))
                      }
                    />
                  </label>
                </div>

                <div className="admin-skill-items">
                  {group.items.map((item, itemIndex) => (
                    <div key={`${group.id}-${itemIndex}`} className="admin-skill-item">
                      <input
                        type="text"
                        value={item}
                        placeholder="Skill or platform"
                        onChange={(event) =>
                          setSiteSettings((current) => ({
                            ...current,
                            skillsGroups: updateSkillGroup(current.skillsGroups, group.id, (currentGroup) => ({
                              ...currentGroup,
                              items: currentGroup.items.map((currentItem, currentIndex) =>
                                currentIndex === itemIndex ? event.target.value : currentItem,
                              ),
                            })),
                          }))
                        }
                      />
                      <button
                        className="button"
                        type="button"
                        onClick={() =>
                          setSiteSettings((current) => ({
                            ...current,
                            skillsGroups: updateSkillGroup(current.skillsGroups, group.id, (currentGroup) => ({
                              ...currentGroup,
                              items: currentGroup.items.filter((_, currentIndex) => currentIndex !== itemIndex),
                            })),
                          }))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <div className="admin-editor__actions">
                  <button
                    className="button"
                    type="button"
                    onClick={() =>
                      setSiteSettings((current) => ({
                        ...current,
                        skillsGroups: updateSkillGroup(current.skillsGroups, group.id, (currentGroup) => ({
                          ...currentGroup,
                          items: [...currentGroup.items, ''],
                        })),
                      }))
                    }
                  >
                    Add Skill
                  </button>
                  <button
                    className="button"
                    type="button"
                    onClick={() =>
                      setSiteSettings((current) => ({
                        ...current,
                        skillsGroups: moveItem(current.skillsGroups, groupIndex, groupIndex - 1),
                      }))
                    }
                    disabled={groupIndex === 0}
                  >
                    Move Up
                  </button>
                  <button
                    className="button"
                    type="button"
                    onClick={() =>
                      setSiteSettings((current) => ({
                        ...current,
                        skillsGroups: moveItem(current.skillsGroups, groupIndex, groupIndex + 1),
                      }))
                    }
                    disabled={groupIndex >= siteSettings.skillsGroups.length - 1}
                  >
                    Move Down
                  </button>
                  <button
                    className="button"
                    type="button"
                    onClick={() =>
                      setSiteSettings((current) => ({
                        ...current,
                        skillsGroups: current.skillsGroups.filter((currentGroup) => currentGroup.id !== group.id),
                      }))
                    }
                  >
                    Delete Group
                  </button>
                </div>
              </article>
            ))}
          </div>

          {siteSettings.skillsGroups.length === 0 && (
            <p className="admin-skill-note">
              There are no skill groups yet. Add a group to start building the Skills page.
            </p>
          )}
        </div>
      )}

      {activeTab === 'projects' && (
        <div className="admin-grid">
          <aside className="admin-list">
            <button
              className="button button--solid"
              type="button"
              onClick={() => {
                setSelectedProjectId(null)
                setProjectForm(blankProjectForm)
              }}
            >
              New Project
            </button>
            <ul>
              {projects.map((project) => (
                <li key={project.id}>
                  <button
                    type="button"
                    className={selectedProjectId === project.id ? 'is-active' : ''}
                    onClick={() => onSelectProject(project)}
                  >
                    <span>{project.title}{project.isFeatured ? ' · featured' : ''}</span>
                    <small>{project.status}</small>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="admin-editor">
            <label>
              Title
              <input
                type="text"
                value={projectForm.title}
                onChange={(event) =>
                  setProjectForm((current) => ({ ...current, title: event.target.value }))
                }
              />
            </label>
            <label>
              Summary
              <textarea
                rows={5}
                value={projectForm.summary}
                onChange={(event) =>
                  setProjectForm((current) => ({ ...current, summary: event.target.value }))
                }
              />
            </label>
            <label>
              Tech (comma-separated)
              <input
                type="text"
                value={projectForm.techCsv}
                onChange={(event) =>
                  setProjectForm((current) => ({ ...current, techCsv: event.target.value }))
                }
              />
            </label>
            <label>
              Status
              <select
                value={projectForm.status}
                onChange={(event) =>
                  setProjectForm((current) => ({
                    ...current,
                    status: event.target.value as ProjectStatus,
                  }))
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
                checked={projectForm.isFeatured}
                onChange={(event) =>
                  setProjectForm((current) => ({ ...current, isFeatured: event.target.checked }))
                }
              />
              Featured project
            </label>
            <label>
              Publish At (for scheduled)
              <input
                type="datetime-local"
                value={projectForm.publishAt}
                onChange={(event) =>
                  setProjectForm((current) => ({ ...current, publishAt: event.target.value }))
                }
              />
            </label>

            <div className="admin-editor__actions">
              <button className="button button--solid" type="button" onClick={() => void onSaveProject()}>
                Save Project
              </button>
              <button className="button" type="button" onClick={() => void onDeleteProject()}>
                Delete Project
              </button>
              <button className="button" type="button" onClick={() => void onMoveProject(-1)}>
                Move Up
              </button>
              <button className="button" type="button" onClick={() => void onMoveProject(1)}>
                Move Down
              </button>
            </div>

            <section className="admin-project-page">
              <div className="admin-project-page__head">
                <h3>Project page</h3>
                <p>
                  What visitors see when they open this project. Click any part to change it, drag a block by its
                  handle to move it, and drag its right edge to resize it. Press Save Project when you are done.
                </p>
              </div>
              <ProjectPageEditor
                title={projectForm.title}
                eyebrow={projectForm.isFeatured ? 'Featured Build' : 'Project Detail'}
                summary={projectForm.summary}
                tech={projectFormTech}
                links={projectForm.links}
                blocks={resolveProjectBlocks({
                  contentBlocks: projectForm.contentBlocks,
                  details: projectForm.details,
                  tech: projectFormTech,
                  links: projectForm.links,
                  detailCards: projectForm.detailCards,
                  images: selectedProject?.images ?? [],
                })}
                isArranged={projectForm.contentBlocks.length > 0}
                images={selectedProject?.images ?? []}
                uploadBlockedReason={
                  selectedProject && selectedProject.id > 0
                    ? ''
                    : 'This project is new. Press Save Project once, then you can add pictures to it.'
                }
                onChange={onProjectPageChange}
                onUploadImages={(files) =>
                  selectedProject ? onUploadProjectImagesFor(selectedProject.id, files) : Promise.resolve([])
                }
                onMakeCover={
                  selectedProject ? (imageId) => void onMakeProjectCoverFor(selectedProject.id, imageId) : undefined
                }
              />
            </section>

            {selectedProject && (
              <>
                <label>
                  Upload Images
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => void onUploadImages(event.target.files)}
                  />
                </label>
                <div className="admin-images">
                  {selectedProject.images.map((image, index, images) => {
                    // The same list with this image moved to another position.
                    const movedTo = (position: number) => {
                      const ids = images.map((entry) => entry.id).filter((id) => id !== image.id)
                      ids.splice(position, 0, image.id)
                      return ids
                    }

                    return (
                      <article key={image.id}>
                        <img src={image.url} alt={image.altText || 'Project'} />
                        <p className="admin-images__label">
                          {index === 0 ? 'Cover · shown on the project card' : `Image ${index + 1}`}
                        </p>
                        <div className="admin-images__actions">
                          {index > 0 && (
                            <button className="button" type="button" onClick={() => void onReorderImages(movedTo(0))}>
                              Make cover
                            </button>
                          )}
                          {index > 1 && (
                            <button
                              className="button"
                              type="button"
                              onClick={() => void onReorderImages(movedTo(index - 1))}
                            >
                              Earlier
                            </button>
                          )}
                          {index < images.length - 1 && (
                            <button
                              className="button"
                              type="button"
                              onClick={() => void onReorderImages(movedTo(index + 1))}
                            >
                              Later
                            </button>
                          )}
                          <button className="button" type="button" onClick={() => void onDeleteImage(image.id)}>
                            Remove
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'status' && (
        <section className="admin-panel admin-maintenance-panel">
          <div className="admin-maintenance-panel__header">
            <div className="admin-maintenance-panel__copy">
              <h2>Status Controls</h2>
              <p>
                Control maintenance messaging and simulate utility or battery power from the CMS while you test the status page.
              </p>
            </div>
            <label className="admin-inline-checkbox admin-maintenance-panel__toggle">
              <input
                type="checkbox"
                checked={siteSettings.maintenanceMode}
                onChange={(event) =>
                  setSiteSettings((current) => ({ ...current, maintenanceMode: event.target.checked }))
                }
              />
              Enable maintenance mode
            </label>
          </div>
          <div className="admin-maintenance-panel__body">
            <label>
              Visitor Notice
              <textarea
                rows={4}
                value={siteSettings.maintenanceMessage}
                onChange={(event) =>
                  setSiteSettings((current) => ({ ...current, maintenanceMessage: event.target.value }))
                }
              />
            </label>
            <div>
              <strong>Status Power Simulation</strong>
              <p>Choose what the public status page should show for UPS source while you test the power-event view.</p>
              <div className="admin-editor__actions">
                {statusPowerModeValues.map((mode) => (
                  <button
                    key={mode}
                    className={`button${siteSettings.statusPowerMode === mode ? ' button--solid' : ''}`}
                    type="button"
                    onClick={() => setSiteSettings((current) => ({ ...current, statusPowerMode: mode }))}
                  >
                    {statusPowerModeLabels[mode]}
                  </button>
                ))}
              </div>
            </div>
            <div className="admin-editor__actions">
              <button className="button button--solid" type="button" onClick={() => void onSaveMaintenanceSettings()}>
                Save Status Controls
              </button>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'announcement' && (
        <AnnouncementSettingsPanel
          draft={announcementDraft}
          saved={normalizeAnnouncement(siteSettings.announcement)}
          isBusy={isBusy}
          onChange={setAnnouncementDraft}
          onSave={() => void onSaveAnnouncement()}
          onDiscard={() => setAnnouncementDraft(normalizeAnnouncement(siteSettings.announcement))}
        />
      )}

      {activeTab === 'contact' && (
        <div className="admin-panel">
          <label>
            Email
            <input
              type="email"
              value={siteSettings.email}
              onChange={(event) =>
                setSiteSettings((current) => ({ ...current, email: event.target.value }))
              }
            />
          </label>
          <label>
            Phone
            <input
              type="text"
              value={siteSettings.phone}
              onChange={(event) =>
                setSiteSettings((current) => ({ ...current, phone: event.target.value }))
              }
            />
          </label>
          <label>
            Location
            <input
              type="text"
              value={siteSettings.location}
              onChange={(event) =>
                setSiteSettings((current) => ({ ...current, location: event.target.value }))
              }
            />
          </label>
          <label>
            Contact Intro
            <textarea
              rows={3}
              value={siteSettings.contactIntro}
              onChange={(event) =>
                setSiteSettings((current) => ({ ...current, contactIntro: event.target.value }))
              }
            />
          </label>
          <label>
            Socials JSON
            <textarea
              rows={6}
              value={socialsText}
              onChange={(event) => setSocialsText(event.target.value)}
            />
          </label>
          <button className="button button--solid" type="button" onClick={() => void onSaveContactSettings()}>
            Save Contact Settings
          </button>
        </div>
      )}

      {activeTab === 'layout' && (
        <div className="admin-panel admin-panel--layout">
          <div className="admin-editor__actions">
            {builderDocumentKeys.map((docKey) => (
              <button
                key={docKey}
                className={`button ${selectedLayoutDocKey === docKey ? 'button--solid' : ''}`}
                type="button"
                onClick={() => setSelectedLayoutDocKey(docKey)}
              >
                {docKey}
              </button>
            ))}
          </div>
          <p className="admin-skill-note">
            Standard-mode builder controls for node content and presentation. Raw JSON stays
            available below when you need direct document edits.
          </p>
          <div className="admin-layout-workspace">
            <section className="admin-layout-tools">
              <label>
                Selected Builder Node
                <select
                  value={selectedLayoutNodeId ?? ''}
                  onChange={(event) => setSelectedLayoutNodeId(event.target.value || null)}
                >
                  {activeLayoutNodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {getBuilderNodeLabel(node)}
                    </option>
                  ))}
                </select>
              </label>

              {selectedLayoutNode ? (
                <div className="admin-builder__field-stack">
                  {(selectedLayoutNode.type !== 'text' || selectedLayoutNode.title) && (
                    <label>
                      Title
                      <input
                        type="text"
                        value={selectedLayoutNode.title ?? ''}
                        onChange={(event) =>
                          updateSelectedLayoutNode((node) => ({
                            ...node,
                            title: event.target.value,
                          }))
                        }
                      />
                    </label>
                  )}

                  {(selectedLayoutNode.type === 'text' ||
                    typeof selectedLayoutNode.content?.text === 'string' ||
                    selectedLayoutBindingField) && (
                    <label>
                      Text
                      <textarea
                        rows={5}
                        value={selectedLayoutTextValue}
                        onChange={(event) =>
                          updateSelectedLayoutNodeContent('text', event.target.value)
                        }
                      />
                    </label>
                  )}

                  {(selectedLayoutNode.type === 'button/link' ||
                    selectedLayoutNode.type === 'navItem' ||
                    typeof selectedLayoutNode.content?.label === 'string') && (
                    <label>
                      Label
                      <input
                        type="text"
                        value={readString(selectedLayoutNode.content?.label)}
                        onChange={(event) => updateSelectedLayoutNodeContent('label', event.target.value)}
                      />
                    </label>
                  )}

                  {(selectedLayoutNode.type === 'button/link' ||
                    selectedLayoutNode.type === 'navItem' ||
                    typeof selectedLayoutNode.content?.href === 'string') && (
                    <label>
                      URL / Route
                      <input
                        type="text"
                        value={readString(selectedLayoutNode.content?.href)}
                        onChange={(event) => updateSelectedLayoutNodeContent('href', event.target.value)}
                      />
                    </label>
                  )}

                  {selectedLayoutNode.type === 'navItem' && (
                    <>
                      <label>
                        Kind
                        <select
                          value={readString(selectedLayoutNode.content?.kind) || 'internal'}
                          onChange={(event) => updateSelectedLayoutNodeContent('kind', event.target.value)}
                        >
                          <option value="internal">Internal route</option>
                          <option value="external">External URL</option>
                          <option value="action">Action</option>
                        </select>
                      </label>
                      <label>
                        Action
                        <select
                          value={readString(selectedLayoutNode.content?.action) || 'rain-screen'}
                          onChange={(event) => updateSelectedLayoutNodeContent('action', event.target.value)}
                        >
                          <option value="rain-screen">Rain Screen</option>
                          <option value="admin">Admin</option>
                        </select>
                      </label>
                    </>
                  )}

                  {selectedLayoutNode.type === 'image/media' && (
                    <>
                      <label>
                        Image URL
                        <input
                          type="text"
                          value={readString(selectedLayoutNode.content?.src)}
                          onChange={(event) => updateSelectedLayoutNodeContent('src', event.target.value)}
                        />
                      </label>
                      <label>
                        Alt Text
                        <input
                          type="text"
                          value={readString(selectedLayoutNode.content?.alt)}
                          onChange={(event) => updateSelectedLayoutNodeContent('alt', event.target.value)}
                        />
                      </label>
                      <label>
                        Caption
                        <textarea
                          rows={3}
                          value={readString(selectedLayoutNode.content?.caption)}
                          onChange={(event) => updateSelectedLayoutNodeContent('caption', event.target.value)}
                        />
                      </label>
                    </>
                  )}

                  {selectedLayoutNode.type === 'embed' && (
                    <>
                      <label>
                        Provider
                        <input
                          type="text"
                          value={readString(selectedLayoutNode.content?.provider)}
                          onChange={(event) =>
                            updateSelectedLayoutNodeContent('provider', event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Embed URL
                        <input
                          type="text"
                          value={readString(selectedLayoutNode.content?.url)}
                          onChange={(event) => updateSelectedLayoutNodeContent('url', event.target.value)}
                        />
                      </label>
                    </>
                  )}

                  {selectedLayoutNode.type === 'spacer' && (
                    <label>
                      Spacer Height
                      <input
                        type="number"
                        min="0"
                        step="8"
                        value={String(selectedLayoutNode.content?.height ?? 24)}
                        onChange={(event) =>
                          updateSelectedLayoutNodeContent('height', Number(event.target.value) || 0)
                        }
                      />
                    </label>
                  )}

                  {Array.isArray(selectedLayoutNode.content?.items) && (
                    <label>
                      Items
                      <textarea
                        rows={5}
                        value={(selectedLayoutNode.content?.items as string[]).join('\n')}
                        onChange={(event) =>
                          updateSelectedLayoutNodeContent('items', parseLines(event.target.value))
                        }
                      />
                    </label>
                  )}

                  <BuilderPresentationControls
                    presentation={selectedLayoutNode.presentation}
                    nodeType={selectedLayoutNode.type}
                    bindingKind={selectedLayoutNode.binding?.kind}
                    onChange={updateSelectedLayoutNodePresentation}
                  />
                </div>
              ) : (
                <p className="admin-skill-note">No builder nodes are available for this document yet.</p>
              )}
            </section>

            <section className="admin-layout-json">
              <label>
                Builder Document JSON
                <textarea
                  rows={24}
                  value={layoutDocEditor}
                  onChange={(event) => setLayoutDocEditor(event.target.value)}
                />
              </label>
              <div className="admin-editor__actions">
                <button className="button button--solid" type="button" onClick={() => void onSaveLayoutDocument()}>
                  Save Builder Document
                </button>
                <button
                  className="button"
                  type="button"
                  onClick={() =>
                    setLayoutDocEditor(
                      builderDocuments[selectedLayoutDocKey]
                        ? JSON.stringify(builderDocuments[selectedLayoutDocKey], null, 2)
                        : '',
                    )
                  }
                >
                  Reset Editor
                </button>
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === 'messages' && (
        <div className="admin-panel admin-panel--messages">
          {messages.length === 0 && <p className="notice">No messages yet.</p>}
          {messages.map((message) => (
            <article key={message.id} className="message-card">
              <header>
                <h2>{message.name}</h2>
                <p>{message.email}</p>
                <small>{new Date(message.createdAt).toLocaleString()}</small>
              </header>
              <p>{message.message}</p>
              <label>
                Status
                <select
                  value={message.status}
                  onChange={(event) =>
                    void onUpdateMessageStatus(message.id, event.target.value as MessageStatus)
                  }
                >
                  <option value="new">New</option>
                  <option value="read">Read</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
            </article>
          ))}
        </div>
      )}
      </div>
    </section>
  )
}
