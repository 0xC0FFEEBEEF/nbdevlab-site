// Keep client-side routing and the Worker's document fallback in agreement.
export const sitePaths = [
  '/', '/about', '/projects', '/skills', '/status', '/homelab',
  '/weather', '/contact', '/privacy', '/admin',
] as const

const routes = new Set<string>(sitePaths)

export function isSitePath(pathname: string): boolean {
  return routes.has(pathname.replace(/\/+$/, '') || '/')
}
