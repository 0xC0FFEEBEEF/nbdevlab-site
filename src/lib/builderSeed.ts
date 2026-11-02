import type {
  BuilderDocument,
  BuilderDocumentKey,
  BuilderNode,
  NavItemConfig,
} from '../../shared/builder'
import {
  builderDocumentKeys,
  createBuilderDocument,
  createBuilderNode,
  defaultNavigationItems,
} from '../../shared/builder'
import type { HomeCard, Project, SiteSettings } from '../types/models'

interface BuilderSeedSnapshot {
  siteSettings: SiteSettings
  homeCards: HomeCard[]
  projects: Project[]
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
      ...(extras.content ?? {}),
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
      ...(extras.content ?? {}),
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
      ...(extras.content ?? {}),
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
  const primaryNavChildren = navItems.filter((node) => node.content?.kind === 'internal')
  const utilityNavChildren = navItems.filter((node) => node.content?.kind === 'action')

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
    'fallback',
  )
}

function buildHomeDocument(snapshot: BuilderSeedSnapshot): BuilderDocument {
  const hero = snapshot.siteSettings

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
        createCollectionNode('home-cards', 'Homepage Cards', mapHomeCards(snapshot.homeCards)),
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
    'fallback',
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
    'fallback',
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
          children: [
            createCollectionNode('projects-featured-list', 'Featured List', mapProjectCards(featuredProjects)),
          ],
        }),
        createSectionNode('projects-grid', 'Build Log', {
          children: [
            createCollectionNode('projects-remaining-list', 'Remaining List', mapProjectCards(remainingProjects)),
          ],
        }),
      ],
    }),
    'Featured builds and the remaining project grid.',
    'fallback',
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
    'fallback',
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
                createDynamicWidgetNode('status-power', 'Power', 'stack-status.power'),
                createDynamicWidgetNode('status-nodes', 'Nodes', 'stack-status.nodes'),
                createDynamicWidgetNode('status-endpoints', 'Public Endpoints', 'stack-status.endpoints'),
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
    'fallback',
  )
}

function buildContactDocument(settings: SiteSettings): BuilderDocument {
  const socialItems = Object.entries(settings.socials)
    .filter(([, value]) => value.trim().length > 0)
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
    'fallback',
  )
}

export function buildFallbackBuilderDocuments(snapshot: BuilderSeedSnapshot): Record<BuilderDocumentKey, BuilderDocument> {
  const documents: BuilderDocument[] = [
    buildNavigationDocument(),
    buildHomeDocument(snapshot),
    buildAboutDocument(snapshot.siteSettings),
    buildProjectsDocument(snapshot.projects),
    buildSkillsDocument(snapshot.siteSettings),
    buildStatusDocument(),
    buildContactDocument(snapshot.siteSettings),
  ]

  return Object.fromEntries(
    builderDocumentKeys.map((docKey) => [
      docKey,
      documents.find((document) => document.docKey === docKey),
    ]),
  ) as Record<BuilderDocumentKey, BuilderDocument>
}
