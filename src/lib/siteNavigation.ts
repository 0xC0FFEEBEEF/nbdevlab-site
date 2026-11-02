export type SiteNavItemKind = 'route' | 'external' | 'action'
export type SiteNavAction = 'admin' | 'rain-screen'

export interface SiteNavItem {
  id: string
  label: string
  kind: SiteNavItemKind
  visible?: boolean
  route?: string
  href?: string
  action?: SiteNavAction
  reloadDocument?: boolean
}

export const defaultSiteNavItems: SiteNavItem[] = [
  { id: 'nav-home', label: 'Home', kind: 'route', route: '/', visible: true },
  { id: 'nav-projects', label: 'Projects', kind: 'route', route: '/projects', visible: true },
  { id: 'nav-homelab', label: 'Homelab', kind: 'route', route: '/homelab', visible: true },
  { id: 'nav-status', label: 'Status', kind: 'route', route: '/status', visible: true },
  { id: 'nav-weather', label: 'Wx', kind: 'route', route: '/weather', visible: true },
  { id: 'nav-about', label: 'About', kind: 'route', route: '/about', visible: true },
  { id: 'nav-skills', label: 'Skills', kind: 'route', route: '/skills', visible: true },
  { id: 'nav-contact', label: 'Contact', kind: 'route', route: '/contact', visible: true },
  { id: 'nav-admin', label: 'Admin', kind: 'action', action: 'admin', visible: false, reloadDocument: true },
]

export const defaultHeaderActions: SiteNavItem[] = []

export function normalizeNavItems(items: SiteNavItem[] | null | undefined): SiteNavItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    return defaultSiteNavItems.map((item) => ({ ...item }))
  }

  return items.map((item, index) => ({
    id: item.id || `nav-item-${index + 1}`,
    label: item.label ?? '',
    kind: item.kind ?? 'route',
    visible: item.visible !== false,
    route: item.route ?? '',
    href: item.href ?? '',
    action: item.action ?? undefined,
    reloadDocument: item.reloadDocument ?? false,
  }))
}

export function normalizeHeaderActions(items: SiteNavItem[] | null | undefined): SiteNavItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    return defaultHeaderActions.map((item) => ({ ...item }))
  }

  return items.map((item, index) => ({
    id: item.id || `header-action-${index + 1}`,
    label: item.label ?? '',
    kind: item.kind ?? 'action',
    visible: item.visible !== false,
    route: item.route ?? '',
    href: item.href ?? '',
    action: item.action ?? undefined,
    reloadDocument: item.reloadDocument ?? false,
  }))
}
