import type { BuilderDocument, BuilderNode } from '../../shared/builder'
import type { SiteNavItem } from './siteNavigation'

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asBoolean(value: unknown, fallback = true): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export interface BuilderNodeLocation {
  node: BuilderNode
  parentId: string | null
  index: number
  path: string[]
}

export interface BuilderNavigationState {
  brandLabel: string
  brandHref: string
  navItems: SiteNavItem[]
  headerActions: SiteNavItem[]
}

export function findBuilderNode(
  root: BuilderNode,
  nodeId: string,
  parentId: string | null = null,
  path: string[] = [],
): BuilderNodeLocation | null {
  if (root.id === nodeId) {
    return {
      node: root,
      parentId,
      index: path.length === 0 ? 0 : Number(path[path.length - 1] ?? 0),
      path,
    }
  }

  const children = root.children ?? []
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index]
    const found = findBuilderNode(child, nodeId, root.id, [...path, String(index)])
    if (found) {
      return found
    }
  }

  return null
}

export function flattenBuilderNodes(root: BuilderNode): BuilderNode[] {
  return [root, ...(root.children ?? []).flatMap(flattenBuilderNodes)]
}

export function getBuilderNode(document: BuilderDocument | null | undefined, nodeId: string): BuilderNode | null {
  if (!document) {
    return null
  }

  return findBuilderNode(document.root, nodeId)?.node ?? null
}

export function getBuilderNodeText(
  document: BuilderDocument | null | undefined,
  nodeId: string,
  fallback: string,
): string {
  const node = getBuilderNode(document, nodeId)
  if (node?.binding?.kind === 'site-settings' && node.binding.field) {
    return fallback
  }
  return asString(node?.content?.text) || node?.title || fallback
}

export function getBuilderNodeContentString(
  document: BuilderDocument | null | undefined,
  nodeId: string,
  key: string,
  fallback: string,
): string {
  const node = getBuilderNode(document, nodeId)
  return asString(node?.content?.[key]) || fallback
}

export function getBuilderUnhandledRootChildren(
  document: BuilderDocument | null | undefined,
  handledIds: Iterable<string>,
): BuilderNode[] {
  if (!document) {
    return []
  }

  const hiddenIds = new Set(handledIds)
  return (document.root.children ?? []).filter((child) => !hiddenIds.has(child.id))
}

function nodeToSiteNavItem(node: BuilderNode): SiteNavItem | null {
  const kind = asString(node.content?.kind)
  const label = asString(node.content?.label) || node.title || 'Untitled'
  const href = asString(node.content?.href)
  const action = asString(node.content?.action)
  const visible = asBoolean(node.content?.visible, node.presentation?.visible !== false)

  if (kind === 'internal') {
    return {
      id: node.id,
      label,
      kind: 'route',
      route: href || '/',
      visible,
      reloadDocument: false,
    }
  }

  if (kind === 'external') {
    return {
      id: node.id,
      label,
      kind: 'external',
      href,
      visible,
      reloadDocument: false,
    }
  }

  if (kind === 'action' && (action === 'rain-screen' || action === 'admin')) {
    return {
      id: node.id,
      label,
      kind: 'action',
      action,
      visible,
      reloadDocument: action === 'admin',
    }
  }

  return null
}

function withRequiredNavItems(navItems: SiteNavItem[], fallbackNavItems: SiteNavItem[]): SiteNavItem[] {
  const requiredRoutes = [
    { id: 'nav-homelab', route: '/homelab', after: '/projects' },
    { id: 'nav-weather', route: '/weather', after: '/status' },
  ]
  const items = [...navItems]

  for (const required of requiredRoutes) {
    const fallback = fallbackNavItems.find((item) => item.id === required.id || item.route === required.route)
    if (!fallback || items.some((item) => item.id === required.id || item.route === required.route)) continue

    const previousIndex = items.findIndex((item) => item.route === required.after)
    items.splice(previousIndex === -1 ? items.length : previousIndex + 1, 0, fallback)
  }

  return items
}

export function getNavigationFromBuilderDocument(
  document: BuilderDocument | null | undefined,
  fallback: BuilderNavigationState,
): BuilderNavigationState {
  if (!document) {
    return fallback
  }

  const brandNode = getBuilderNode(document, 'nav-brand')
  const brandLabel =
    asString(brandNode?.content?.label) ||
    getBuilderNodeText(document, 'nav-brand-text', fallback.brandLabel)
  const brandHref = asString(brandNode?.content?.href) || fallback.brandHref

  const primaryNode = getBuilderNode(document, 'nav-primary')
  const utilitiesNode = getBuilderNode(document, 'nav-utilities')

  const navItems = (primaryNode?.children ?? [])
    .map(nodeToSiteNavItem)
    .filter((item): item is SiteNavItem => Boolean(item))
  const headerActions = (utilitiesNode?.children ?? [])
    .map(nodeToSiteNavItem)
    .filter((item): item is SiteNavItem => Boolean(item))

  return {
    brandLabel,
    brandHref,
    navItems: navItems.length > 0 ? withRequiredNavItems(navItems, fallback.navItems) : fallback.navItems,
    headerActions: headerActions.length > 0 ? headerActions : fallback.headerActions,
  }
}
