import {
  builderBootstrapKey,
  builderDocumentKeys,
  cloneBuilderDocument,
  createBuilderDocument,
  createBuilderNode,
  defaultNavigationItems,
  isBuilderDocumentKey,
  normalizeBuilderDocument,
  parseBuilderDocument,
  serializeBuilderDocument,
  type BuilderDocument,
  type BuilderMediaAsset,
  type BuilderNode,
  type NavItemConfig,
} from '../../shared/builder'
import { ensureSiteContentSync } from './contentSync'
import { ensureDefaultProjects } from './defaultProjects'
import { loadHomeCards, loadProjectsWithImages, loadSiteSettings, nowIso } from './utils'
import type { HomeCard, Project, SiteSettings } from './types'

interface BuilderDocumentRow {
  doc_key: string
  schema_version: number
  document_json: string
  created_at: string
  updated_at: string
}

interface BuilderBootstrapRow {
  bootstrap_key: string
  status: string
  started_at: string
  completed_at: string | null
}

interface BuilderMediaRow {
  id: number
  r2_key: string
  original_name: string
  mime_type: string
  alt_text: string | null
  caption: string | null
  created_at: string
  updated_at: string
}

function resolveStoredDocumentSource(source: BuilderDocument['source'] | undefined): BuilderDocument['source'] {
  return source === 'admin' || source === 'fallback' || source === 'seeded' ? source : 'seeded'
}

export interface BuilderSnapshot {
  siteSettings: SiteSettings
  homeCards: HomeCard[]
  projects: Project[]
}

export interface StoredBuilderDocument extends BuilderDocument {
  createdAt: string
}

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9.\-_]/g, '-').slice(0, 120)
}

function suggestAltText(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toPlainText(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

function createTextNode(
  id: string,
  text: string,
  extras: Partial<BuilderNode> = {},
): BuilderNode {
  return createBuilderNode('text', id, {
    ...extras,
    content: {
      text,
    },
  })
}

function createBoxNode(
  id: string,
  title: string,
  extras: Partial<BuilderNode> = {},
): BuilderNode {
  return createBuilderNode('container/box', id, {
    ...extras,
    title,
  })
}

function createSectionNode(
  id: string,
  title: string,
  extras: Partial<BuilderNode> = {},
): BuilderNode {
  return createBuilderNode('section', id, {
    ...extras,
    title,
  })
}

function createCollectionNode(
  id: string,
  title: string,
  children: BuilderNode[],
  extras: Partial<BuilderNode> = {},
): BuilderNode {
  return createBuilderNode('collection', id, {
    ...extras,
    title,
    children,
  })
}

function createMediaNode(
  id: string,
  title: string,
  src: string,
  extras: Partial<BuilderNode> = {},
): BuilderNode {
  return createBuilderNode('image/media', id, {
    ...extras,
    title,
    content: {
      src,
    },
  })
}

function createLinkNode(
  id: string,
  label: string,
  href: string,
  extras: Partial<BuilderNode> = {},
): BuilderNode {
  return createBuilderNode('button/link', id, {
    ...extras,
    title: label,
    content: {
      label,
      href,
    },
  })
}

function createNavItemNode(item: NavItemConfig): BuilderNode {
  return createBuilderNode('navItem', item.id, {
    title: item.label,
    content: {
      label: item.label,
      kind: item.kind,
      href: item.href ?? null,
      action: item.action ?? null,
      visible: item.visible,
      locked: item.locked ?? false,
    },
    presentation: {
      visible: item.visible,
      variant: item.kind,
    },
  })
}

function createDynamicWidgetNode(
  id: string,
  title: string,
  source: string,
  settings: Record<string, unknown> = {},
): BuilderNode {
  return createBuilderNode('dynamicWidget', id, {
    title,
    content: {
      source,
    },
    settings,
  })
}

function mapProjectCards(projects: Project[]): BuilderNode[] {
  return projects.map((project) => {
    const firstImage = project.images[0]

    return createBoxNode(`project-${project.id}`, project.title, {
      binding: {
        kind: 'project',
        id: project.id,
        key: project.slug,
      },
      content: {
        title: project.title,
        summary: project.summary,
        tech: project.tech,
        links: project.links,
        detailCards: project.detailCards,
        demoUrl: project.demoUrl,
        repoUrl: project.repoUrl,
        status: project.status,
        isFeatured: project.isFeatured,
        imageUrl: firstImage?.url ?? null,
        imageAlt: firstImage?.altText ?? '',
      },
      presentation: {
        variant: project.isFeatured ? 'featured' : 'standard',
        spacing: 'cozy',
      },
      children: [
        createTextNode(`project-${project.id}-title`, project.title, {
          binding: {
            kind: 'project',
            id: project.id,
            field: 'title',
          },
        }),
        createTextNode(`project-${project.id}-summary`, project.summary, {
          binding: {
            kind: 'project',
            id: project.id,
            field: 'summary',
          },
        }),
      ],
    })
  })
}

function mapHomeCards(cards: HomeCard[]): BuilderNode[] {
  return cards.map((card) =>
    createBoxNode(`home-card-${card.id}`, card.title, {
      binding: {
        kind: 'home-card',
        id: card.id,
      },
      content: {
        title: card.title,
        subtitle: card.subtitle,
        body: card.body,
        ctaLabel: card.ctaLabel,
        ctaUrl: card.ctaUrl,
        widthUnits: card.widthUnits,
        heightUnits: card.heightUnits,
        isVisible: card.isVisible,
      },
      presentation: {
        width: 'content',
        visible: card.isVisible,
        span: card.widthUnits,
      },
      children: [
        createTextNode(`home-card-${card.id}-subtitle`, card.subtitle, {
          binding: {
            kind: 'home-card',
            id: card.id,
            field: 'subtitle',
          },
        }),
        createTextNode(`home-card-${card.id}-body`, card.body, {
          binding: {
            kind: 'home-card',
            id: card.id,
            field: 'body',
          },
        }),
      ],
    }),
  )
}

function mapAboutBlocks(settings: SiteSettings): BuilderNode[] {
  return settings.aboutBlocks.map((block) => {
    if (block.type === 'image') {
      return createMediaNode(`about-${block.id}`, block.alt || block.caption || 'About image', block.src, {
        binding: {
          kind: 'about-block',
          id: block.id,
        },
        content: {
          alt: block.alt,
          caption: block.caption,
          showTopRule: block.showTopRule,
          src: block.src,
        },
        presentation: {
          imageFit: 'contain',
          visible: true,
        },
      })
    }

    return createTextNode(`about-${block.id}`, block.content, {
      binding: {
        kind: 'about-block',
        id: block.id,
      },
      content: {
        showTopRule: block.showTopRule,
      },
    })
  })
}

function mapSkillGroups(settings: SiteSettings): BuilderNode[] {
  return settings.skillsGroups.map((group) =>
    createBoxNode(`skill-group-${group.id}`, group.title, {
      binding: {
        kind: 'skill-group',
        id: group.id,
      },
      content: {
        title: group.title,
        items: group.items,
      },
      children: group.items.map((item, index) =>
        createTextNode(`skill-group-${group.id}-item-${index + 1}`, item, {
          content: {
            item,
          },
        }),
      ),
    }),
  )
}

function buildNavigationDocument(): BuilderDocument {
  const navItems = defaultNavigationItems.map(createNavItemNode)
  const primaryNavChildren = navItems.filter((node) => node.type === 'navItem' && node.content?.kind === 'internal')
  const utilityNavChildren = navItems.filter((node) => node.type === 'navItem' && node.content?.kind === 'action')

  return createBuilderDocument(
    'layout.nav',
    'Navigation and Header',
    createSectionNode('nav-root', 'Header and Navigation', {
      children: [
        createBoxNode('nav-brand', 'Brand', {
          content: {
            label: 'nbdevlab',
            href: '/',
          },
          children: [createTextNode('nav-brand-text', 'nbdevlab')],
        }),
        createCollectionNode('nav-primary', 'Primary Navigation', primaryNavChildren),
        createCollectionNode('nav-utilities', 'Utility Actions', utilityNavChildren),
      ],
    }),
    'Site navigation, brand, and utility actions.',
    'seeded',
  )
}

function buildHomeDocument(snapshot: BuilderSnapshot): BuilderDocument {
  const hero = snapshot.siteSettings
  const cards = snapshot.homeCards

  return createBuilderDocument(
    'page.home',
    'Home',
    createSectionNode('home-root', 'Homepage', {
      children: [
        createBoxNode('home-hero', 'Hero', {
          binding: {
            kind: 'site-settings',
            key: 'home.hero',
          },
          children: [
            createTextNode('home-hero-eyebrow', hero.homeEyebrow, {
              binding: { kind: 'site-settings', field: 'homeEyebrow', key: 'home.hero' },
            }),
            createTextNode('home-hero-title', hero.homeTitle, {
              binding: { kind: 'site-settings', field: 'homeTitle', key: 'home.hero' },
            }),
            createTextNode('home-hero-tagline', hero.homeTagline, {
              binding: { kind: 'site-settings', field: 'homeTagline', key: 'home.hero' },
            }),
            createTextNode('home-hero-intro', hero.homeIntro, {
              binding: { kind: 'site-settings', field: 'homeIntro', key: 'home.hero' },
            }),
          ],
        }),
        createDynamicWidgetNode('home-status-teaser', 'Live Status Teaser', 'public.stack-status', {
          sourcePage: 'status',
          note: 'Live public status feed summary and metrics teaser.',
        }),
        createCollectionNode('home-cards', 'Homepage Cards', mapHomeCards(cards)),
        createBoxNode('home-currently-building', 'Currently Building', {
          content: {
            items: ['AICMS', 'PVE Dashboard', 'Cryo-AI'],
          },
          children: [
            createLinkNode('home-currently-building-aicms', 'AICMS', '/projects'),
            createLinkNode('home-currently-building-pve-dashboard', 'PVE Dashboard', '/projects'),
            createLinkNode('home-currently-building-cryo-ai', 'Cryo-AI', '/projects'),
          ],
        }),
      ],
    }),
    'Homepage hero, live status teaser, cards, and pulse section.',
    'seeded',
  )
}

function buildAboutDocument(settings: SiteSettings): BuilderDocument {
  return createBuilderDocument(
    'page.about',
    'About',
    createSectionNode('about-root', 'About Page', {
      children: [
        createCollectionNode('about-blocks', 'About Blocks', mapAboutBlocks(settings)),
        createTextNode(
          'about-built-with',
          'Built with Cloudflare Pages Functions, D1, R2, and custom status/project data pipelines.',
          {
            content: {
              kind: 'footer-note',
            },
          },
        ),
      ],
    }),
    'Editable About page blocks and footer note.',
    'seeded',
  )
}

function buildProjectsDocument(projects: Project[]): BuilderDocument {
  const featuredProjects = projects.filter((project) => project.isFeatured)
  const remainingProjects = projects.filter((project) => !project.isFeatured)

  return createBuilderDocument(
    'page.projects',
    'Projects',
    createSectionNode('projects-root', 'Projects Page', {
      children: [
        createTextNode(
          'projects-intro',
          'My homelab is built around Proxmox, self-hosted services, security tooling, and hands-on infrastructure experiments. A lot of these systems are tied together with Cloudflare Zero Trust, which I use to securely publish and reach selected internal services like Nextcloud, Technitium DNS, core Proxmox systems, and remote Windows lab machines without directly exposing the rest of the network.',
        ),
        createSectionNode('projects-featured', 'Featured Projects', {
          children: [createCollectionNode('projects-featured-list', 'Featured List', mapProjectCards(featuredProjects))],
        }),
        createSectionNode('projects-grid', 'Build Log', {
          children: [createCollectionNode('projects-remaining-list', 'Remaining List', mapProjectCards(remainingProjects))],
        }),
      ],
    }),
    'Featured builds and the remaining project grid.',
    'seeded',
  )
}

function buildSkillsDocument(settings: SiteSettings): BuilderDocument {
  return createBuilderDocument(
    'page.skills',
    'Skills',
    createSectionNode('skills-root', 'Skills Page', {
      children: [
        createTextNode('skills-title', 'Technical Focus', {
          binding: { kind: 'site-settings', key: 'skills.title' },
        }),
        createTextNode(
          'skills-intro',
          'My strengths sit at the intersection of infrastructure, self-hosting, monitoring, security, and practical software. I enjoy building systems that are both useful and understandable, whether that means a live dashboard, a secure remote-access workflow, or a service stack that I can fully run and maintain myself.',
          {
            binding: { kind: 'site-settings', key: 'skills.intro' },
          },
        ),
        createCollectionNode('skills-groups', 'Skill Groups', mapSkillGroups(settings)),
      ],
    }),
    'Skills title, intro, and grouped capability cards.',
    'seeded',
  )
}

function buildStatusDocument(): BuilderDocument {
  return createBuilderDocument(
    'page.status',
    'Status',
    createSectionNode('status-root', 'Status Page', {
      children: [
        createBoxNode('status-hero', 'Status Hero', {
          children: [
            createTextNode('status-hero-title', 'Lab Status'),
            createTextNode(
              'status-hero-summary',
              'This is a live look at what I have running right now. It pulls from the public status feed and shows guests, nodes, endpoints, and power in one place.',
            ),
            createTextNode(
              'status-hero-note',
              'When the lab is quiet, spare compute may run background Golem workloads to earn a little GLM. That is intentional and not necessarily a problem.',
            ),
          ],
        }),
        createCollectionNode('status-metrics', 'Status Metrics', [
          createDynamicWidgetNode('status-metric-endpoints', 'Endpoints', 'stack-status.metric', {
            metric: 'Endpoints',
          }),
          createDynamicWidgetNode('status-metric-online-nodes', 'Online Nodes', 'stack-status.metric', {
            metric: 'Online Nodes',
          }),
          createDynamicWidgetNode('status-metric-running-guests', 'Running Guests', 'stack-status.metric', {
            metric: 'Running Guests',
          }),
          createDynamicWidgetNode('status-metric-visible-guests', 'Visible Guests', 'stack-status.metric', {
            metric: 'Visible Guests',
          }),
          createDynamicWidgetNode('status-metric-average-cpu', 'Avg Node CPU', 'stack-status.metric', {
            metric: 'Avg Node CPU',
          }),
        ]),
        createSectionNode('status-overview', 'Overview Panels', {
          children: [
            createBoxNode('status-mobile-overview', 'Mobile Overview', {
              children: [
                createDynamicWidgetNode('status-power', 'Power', 'stack-status.power', {}),
                createDynamicWidgetNode('status-nodes', 'Nodes', 'stack-status.nodes', {}),
                createDynamicWidgetNode('status-endpoints', 'Public Endpoints', 'stack-status.endpoints', {}),
              ],
            }),
            createBoxNode('status-guests', 'Guests', {
              children: [
                createDynamicWidgetNode('status-guests-list', 'Guest List', 'stack-status.guests', {
                  sort: 'cpu-desc',
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    'Dynamic status layout and live-data widget regions.',
    'seeded',
  )
}

function buildContactDocument(settings: SiteSettings): BuilderDocument {
  const socialItems = Object.entries(settings.socials)
    .filter(([, value]) => toPlainText(value).length > 0)
    .map(([name, value]) => createLinkNode(`contact-social-${name}`, name, value))

  return createBuilderDocument(
    'page.contact',
    'Contact',
    createSectionNode('contact-root', 'Contact Page', {
      children: [
        createTextNode(
          'contact-intro',
          'Have a question, want to talk homelab infrastructure, or just want to reach out? Send me a message below or contact me directly.',
          {
            binding: { kind: 'site-settings', field: 'contactIntro', key: 'contact.page' },
          },
        ),
        createBoxNode('contact-details', 'Contact Details', {
          children: [
            createTextNode('contact-email', settings.email, {
              binding: { kind: 'site-settings', field: 'email', key: 'contact.page' },
            }),
            createTextNode('contact-phone', settings.phone, {
              binding: { kind: 'site-settings', field: 'phone', key: 'contact.page' },
            }),
            createTextNode('contact-location', settings.location, {
              binding: { kind: 'site-settings', field: 'location', key: 'contact.page' },
            }),
          ],
        }),
        createCollectionNode('contact-socials', 'Social Links', socialItems),
        createBoxNode('contact-form', 'Contact Form', {
          content: {
            kind: 'form',
          },
        }),
        createTextNode('contact-note', 'I usually respond by email when I can.', {
          content: {
            kind: 'note',
          },
        }),
      ],
    }),
    'Contact intro, details, socials, form, and note.',
    'seeded',
  )
}

export function buildBuilderDocumentsFromSnapshot(snapshot: BuilderSnapshot): BuilderDocument[] {
  return [
    buildNavigationDocument(),
    buildHomeDocument(snapshot),
    buildAboutDocument(snapshot.siteSettings),
    buildProjectsDocument(snapshot.projects),
    buildSkillsDocument(snapshot.siteSettings),
    buildStatusDocument(),
    buildContactDocument(snapshot.siteSettings),
  ]
}

export async function buildBuilderDocumentsFromLiveLayout(db: D1Database): Promise<BuilderDocument[]> {
  await ensureDefaultProjects(db)
  await ensureSiteContentSync(db)

  const [siteSettings, homeCards, projects] = await Promise.all([
    loadSiteSettings(db),
    loadHomeCards(db, false),
    loadProjectsWithImages(
      db,
      `SELECT
        id,
        slug,
        title,
        summary,
        details,
        tech_json,
        demo_url,
        repo_url,
        status,
        publish_at,
        is_featured,
        sort_order,
        created_at,
        updated_at
      FROM projects
      ORDER BY sort_order ASC, created_at DESC`,
      [],
    ),
  ])

  return buildBuilderDocumentsFromSnapshot({
    siteSettings,
    homeCards,
    projects,
  })
}

async function loadBootstrapState(db: D1Database): Promise<BuilderBootstrapRow | null> {
  return db
    .prepare(
      'SELECT bootstrap_key, status, started_at, completed_at FROM builder_bootstrap_state WHERE bootstrap_key = ? LIMIT 1',
    )
    .bind(builderBootstrapKey)
    .first<BuilderBootstrapRow>()
}

async function claimBootstrapState(db: D1Database): Promise<{ claimed: boolean; startedAt: string }> {
  const startedAt = `${nowIso()}-${crypto.randomUUID()}`

  await db
    .prepare(
      `INSERT OR IGNORE INTO builder_bootstrap_state (
         bootstrap_key,
         status,
         started_at,
         completed_at,
         metadata_json
       ) VALUES (?, 'running', ?, NULL, '{}')`,
    )
    .bind(builderBootstrapKey, startedAt)
    .run()

  const row = await loadBootstrapState(db)
  if (!row) {
    return { claimed: false, startedAt }
  }

  if (row.status === 'completed') {
    return { claimed: false, startedAt: row.started_at }
  }

  return {
    claimed: row.started_at === startedAt,
    startedAt: row.started_at,
  }
}

async function waitForBootstrapCompletion(db: D1Database): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const row = await loadBootstrapState(db)
    if (!row || row.status === 'completed') {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 75))
  }
}

export async function ensureBuilderBootstrap(db: D1Database): Promise<boolean> {
  const state = await claimBootstrapState(db)
  if (!state.claimed) {
    await waitForBootstrapCompletion(db)
    return false
  }

  try {
    const documents = await buildBuilderDocumentsFromLiveLayout(db)
    const timestamp = nowIso()

    await db.batch(
      documents.map((document) =>
        db
          .prepare(
            `INSERT INTO builder_documents (
               doc_key,
               schema_version,
               document_json,
               created_at,
               updated_at
             ) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(doc_key) DO UPDATE SET
               schema_version = excluded.schema_version,
               document_json = excluded.document_json,
               updated_at = excluded.updated_at`,
          )
          .bind(document.docKey, document.schemaVersion, serializeBuilderDocument(document), timestamp, timestamp),
      ),
    )

    await db
      .prepare(
        `UPDATE builder_bootstrap_state
         SET status = 'completed',
             completed_at = ?,
             metadata_json = ?
         WHERE bootstrap_key = ? AND started_at = ?`,
      )
      .bind(timestamp, JSON.stringify({ documentCount: documents.length }), builderBootstrapKey, state.startedAt)
      .run()

    await db
      .prepare('INSERT INTO admin_audit (action, metadata_json, created_at) VALUES (?, ?, ?)')
      .bind(
        'builder.bootstrap.completed',
        JSON.stringify({ documentCount: documents.length }),
        timestamp,
      )
      .run()

    return true
  } catch (error) {
    await db
      .prepare('DELETE FROM builder_bootstrap_state WHERE bootstrap_key = ? AND started_at = ?')
      .bind(builderBootstrapKey, state.startedAt)
      .run()
    throw error
  }
}

export async function listBuilderDocuments(db: D1Database): Promise<StoredBuilderDocument[]> {
  await ensureBuilderBootstrap(db)
  return listStoredBuilderDocuments(db)
}

export async function listStoredBuilderDocuments(db: D1Database): Promise<StoredBuilderDocument[]> {
  const rows = await db
    .prepare(
      'SELECT doc_key, schema_version, document_json, created_at, updated_at FROM builder_documents ORDER BY doc_key ASC',
    )
    .all<BuilderDocumentRow>()

  return (rows.results ?? [])
    .map((row) => {
      const document = parseBuilderDocument(row.document_json, row.doc_key)
      if (!document) {
        return null
      }

      return {
        ...document,
        schemaVersion: row.schema_version,
        updatedAt: row.updated_at,
        source: resolveStoredDocumentSource(document.source),
        createdAt: row.created_at,
      }
    })
    .filter((document): document is StoredBuilderDocument => Boolean(document))
}

export async function loadBuilderDocument(
  db: D1Database,
  docKey: string,
): Promise<StoredBuilderDocument | null> {
  await ensureBuilderBootstrap(db)
  return loadStoredBuilderDocument(db, docKey)
}

export async function loadStoredBuilderDocument(
  db: D1Database,
  docKey: string,
): Promise<StoredBuilderDocument | null> {
  const row = await db
    .prepare(
      'SELECT doc_key, schema_version, document_json, created_at, updated_at FROM builder_documents WHERE doc_key = ? LIMIT 1',
    )
    .bind(docKey)
    .first<BuilderDocumentRow>()

  if (row) {
    const document = parseBuilderDocument(row.document_json, row.doc_key)
    if (document) {
      return {
        ...document,
        schemaVersion: row.schema_version,
        updatedAt: row.updated_at,
        source: resolveStoredDocumentSource(document.source),
        createdAt: row.created_at,
      }
    }
  }

  return null
}

export async function saveBuilderDocument(
  db: D1Database,
  docKey: string,
  document: unknown,
): Promise<StoredBuilderDocument> {
  const normalized = normalizeBuilderDocument(docKey, document)
  if (!normalized) {
    throw new Error('Invalid builder document payload.')
  }

  const timestamp = nowIso()

  await db
    .prepare(
      `INSERT INTO builder_documents (
         doc_key,
         schema_version,
         document_json,
         created_at,
         updated_at
       ) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(doc_key) DO UPDATE SET
         schema_version = excluded.schema_version,
         document_json = excluded.document_json,
         updated_at = excluded.updated_at`,
    )
    .bind(
      docKey,
      normalized.schemaVersion,
      serializeBuilderDocument({ ...normalized, source: 'admin' }),
      timestamp,
      timestamp,
    )
    .run()

  await db
    .prepare('INSERT INTO admin_audit (action, metadata_json, created_at) VALUES (?, ?, ?)')
    .bind('builder.document.updated', JSON.stringify({ docKey }), timestamp)
    .run()

  return {
    ...normalized,
    docKey,
    schemaVersion: normalized.schemaVersion,
    updatedAt: timestamp,
    source: 'admin',
    createdAt: timestamp,
  }
}

export async function listBuilderMediaAssets(db: D1Database): Promise<BuilderMediaAsset[]> {
  const rows = await db
    .prepare(
      `SELECT
        id,
        r2_key,
        original_name,
        mime_type,
        alt_text,
        caption,
        created_at,
        updated_at
       FROM builder_media_assets
       ORDER BY created_at DESC, id DESC`,
    )
    .all<BuilderMediaRow>()

  return (rows.results ?? []).map((row) => ({
    id: row.id,
    r2Key: row.r2_key,
    originalName: row.original_name,
    mimeType: row.mime_type,
    altText: row.alt_text ?? '',
    caption: row.caption ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    url: `/api/public/builder/media/${row.id}`,
  }))
}

export async function loadBuilderMediaAsset(
  db: D1Database,
  id: number,
): Promise<BuilderMediaAsset | null> {
  const row = await db
    .prepare(
      `SELECT
        id,
        r2_key,
        original_name,
        mime_type,
        alt_text,
        caption,
        created_at,
        updated_at
       FROM builder_media_assets
       WHERE id = ?
       LIMIT 1`,
    )
    .bind(id)
    .first<BuilderMediaRow>()

  if (!row) {
    return null
  }

  return {
    id: row.id,
    r2Key: row.r2_key,
    originalName: row.original_name,
    mimeType: row.mime_type,
    altText: row.alt_text ?? '',
    caption: row.caption ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    url: `/api/public/builder/media/${row.id}`,
  }
}

export async function createBuilderMediaAsset(
  db: D1Database,
  bucket: R2Bucket,
  file: File,
  options?: { altText?: string; caption?: string },
): Promise<BuilderMediaAsset> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files can be uploaded as builder media.')
  }

  const timestamp = nowIso()
  const key = `builder/${Date.now()}-${crypto.randomUUID()}-${sanitizeFilename(file.name)}`

  await bucket.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type || 'application/octet-stream',
    },
  })

  let id = 0

  try {
    const insert = await db
      .prepare(
        `INSERT INTO builder_media_assets (
           r2_key,
           original_name,
           mime_type,
           alt_text,
           caption,
           created_at,
           updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        key,
        file.name,
        file.type || 'application/octet-stream',
        options?.altText?.trim() ?? suggestAltText(file.name),
        options?.caption?.trim() ?? '',
        timestamp,
        timestamp,
      )
      .run()

    id = Number(insert.meta.last_row_id ?? 0)
  } catch (error) {
    await bucket.delete(key)
    throw error
  }

  if (!Number.isInteger(id) || id <= 0) {
    await bucket.delete(key)
    throw new Error('Uploaded builder media but failed to record it.')
  }

  await db
    .prepare('INSERT INTO admin_audit (action, metadata_json, created_at) VALUES (?, ?, ?)')
    .bind('builder.media.uploaded', JSON.stringify({ mediaId: id, filename: file.name }), timestamp)
    .run()

  return {
    id,
    r2Key: key,
    originalName: file.name,
    mimeType: file.type || 'application/octet-stream',
    altText: options?.altText?.trim() ?? suggestAltText(file.name),
    caption: options?.caption?.trim() ?? '',
    createdAt: timestamp,
    updatedAt: timestamp,
    url: `/api/public/builder/media/${id}`,
  }
}

export async function deleteBuilderMediaAsset(
  db: D1Database,
  bucket: R2Bucket,
  id: number,
): Promise<boolean> {
  const row = await db
    .prepare('SELECT id, r2_key FROM builder_media_assets WHERE id = ? LIMIT 1')
    .bind(id)
    .first<{ id: number; r2_key: string }>()

  if (!row) {
    return false
  }

  await bucket.delete(row.r2_key)
  await db.prepare('DELETE FROM builder_media_assets WHERE id = ?').bind(id).run()

  await db
    .prepare('INSERT INTO admin_audit (action, metadata_json, created_at) VALUES (?, ?, ?)')
    .bind('builder.media.deleted', JSON.stringify({ mediaId: id }), nowIso())
    .run()

  return true
}

export { builderBootstrapKey, builderDocumentKeys, defaultNavigationItems, isBuilderDocumentKey }
