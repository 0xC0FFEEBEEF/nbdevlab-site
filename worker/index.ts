import type { AppEnv } from '../functions/_shared/types'
import { isSitePath } from '../shared/siteRoutes'
import { isAdminAuthenticated } from '../functions/_shared/auth'
import * as adminAuthLogin from '../functions/api/admin/auth/login'
import * as adminAuthLogout from '../functions/api/admin/auth/logout'
import * as adminAuthSession from '../functions/api/admin/auth/session'
import * as adminAboutImages from '../functions/api/admin/about-images'
import * as adminHomeCards from '../functions/api/admin/home-cards'
import * as adminHomeCardById from '../functions/api/admin/home-cards/[id]'
import * as adminHomeCardsReorder from '../functions/api/admin/home-cards/reorder'
import * as adminBuilderBootstrap from '../functions/api/admin/builder/bootstrap'
import * as adminBuilderDocumentByKey from '../functions/api/admin/builder/documents/[docKey]'
import * as adminBuilderMedia from '../functions/api/admin/builder/media'
import * as adminBuilderMediaById from '../functions/api/admin/builder/media/[id]'
import * as adminImageById from '../functions/api/admin/images/[id]'
import * as adminMessages from '../functions/api/admin/messages'
import * as adminMessageById from '../functions/api/admin/messages/[id]'
import * as adminProjects from '../functions/api/admin/projects'
import * as adminProjectById from '../functions/api/admin/projects/[id]'
import * as adminProjectImages from '../functions/api/admin/projects/[id]/images'
import * as adminProjectsReorder from '../functions/api/admin/projects/reorder'
import * as adminSiteSettings from '../functions/api/admin/site-settings'
import * as publicContact from '../functions/api/public/contact'
import * as publicAboutImageById from '../functions/api/public/about-images/[id]'
import * as publicBuilderBootstrap from '../functions/api/public/builder/bootstrap'
import * as publicBuilderDocumentByKey from '../functions/api/public/builder/documents/[docKey]'
import * as publicBuilderMediaById from '../functions/api/public/builder/media/[id]'
import * as publicHomeCards from '../functions/api/public/home-cards'
import * as publicImageById from '../functions/api/public/images/[id]'
import * as publicProjectBySlug from '../functions/api/public/projects/[slug]'
import * as publicProjects from '../functions/api/public/projects'
import * as publicSiteSettings from '../functions/api/public/site-settings'
import * as publicStackStatus from '../functions/api/public/stack-status'
import * as publicWeatherStation from '../functions/api/public/weather-station'

type HandlerKey =
  | 'onRequestGet'
  | 'onRequestPost'
  | 'onRequestPut'
  | 'onRequestDelete'
  | 'onRequestPatch'
  | 'onRequestHead'
  | 'onRequestOptions'

type HandlerModule = Partial<Record<HandlerKey, RouteHandler>>

interface WorkerEnv extends AppEnv {
  ASSETS: Fetcher
}

interface HandlerContext {
  request: Request
  env: AppEnv
  params: Record<string, string>
  data: Record<string, unknown>
  next: () => Promise<Response>
  waitUntil: (promise: Promise<unknown>) => void
  passThroughOnException: () => void
}

type RouteHandler = (context: HandlerContext) => Promise<Response> | Response

interface RouteDefinition {
  pattern: RegExp
  paramNames: string[]
  handlers: HandlerModule
  requiresAuth?: boolean
}

const methodToHandler = new Map<string, HandlerKey>([
  ['GET', 'onRequestGet'],
  ['POST', 'onRequestPost'],
  ['PUT', 'onRequestPut'],
  ['DELETE', 'onRequestDelete'],
  ['PATCH', 'onRequestPatch'],
  ['HEAD', 'onRequestHead'],
  ['OPTIONS', 'onRequestOptions'],
])

const routes: RouteDefinition[] = [
  {
    pattern: /^\/api\/public\/projects$/,
    paramNames: [],
    handlers: {
      onRequestGet: publicProjects.onRequestGet,
    },
  },
  {
    pattern: /^\/api\/public\/projects\/([^/]+)$/,
    paramNames: ['slug'],
    handlers: {
      onRequestGet: publicProjectBySlug.onRequestGet,
    },
  },
  {
    pattern: /^\/api\/public\/home-cards$/,
    paramNames: [],
    handlers: {
      onRequestGet: publicHomeCards.onRequestGet,
    },
  },
  {
    pattern: /^\/api\/public\/site-settings$/,
    paramNames: [],
    handlers: {
      onRequestGet: publicSiteSettings.onRequestGet,
    },
  },
  {
    pattern: /^\/api\/public\/stack-status$/,
    paramNames: [],
    handlers: {
      onRequestGet: publicStackStatus.onRequestGet,
    },
  },
  {
    pattern: /^\/api\/public\/weather-station$/,
    paramNames: [],
    handlers: {
      onRequestGet: publicWeatherStation.onRequestGet,
    },
  },
  {
    pattern: /^\/api\/public\/contact$/,
    paramNames: [],
    handlers: {
      onRequestPost: publicContact.onRequestPost,
    },
  },
  {
    pattern: /^\/api\/public\/about-images\/([^/]+)$/,
    paramNames: ['id'],
    handlers: {
      onRequestGet: publicAboutImageById.onRequestGet,
    },
  },
  {
    pattern: /^\/api\/public\/images\/([^/]+)$/,
    paramNames: ['id'],
    handlers: {
      onRequestGet: publicImageById.onRequestGet,
    },
  },
  {
    pattern: /^\/api\/public\/builder\/bootstrap$/,
    paramNames: [],
    handlers: {
      onRequestGet: publicBuilderBootstrap.onRequestGet,
    },
  },
  {
    pattern: /^\/api\/public\/builder\/documents\/([^/]+)$/,
    paramNames: ['docKey'],
    handlers: {
      onRequestGet: publicBuilderDocumentByKey.onRequestGet,
    },
  },
  {
    pattern: /^\/api\/public\/builder\/media\/([^/]+)$/,
    paramNames: ['id'],
    handlers: {
      onRequestGet: publicBuilderMediaById.onRequestGet,
    },
  },
  {
    pattern: /^\/api\/admin\/auth\/login$/,
    paramNames: [],
    handlers: {
      onRequestPost: adminAuthLogin.onRequestPost,
    },
  },
  {
    pattern: /^\/api\/admin\/auth\/logout$/,
    paramNames: [],
    handlers: {
      onRequestPost: adminAuthLogout.onRequestPost,
    },
  },
  {
    pattern: /^\/api\/admin\/auth\/session$/,
    paramNames: [],
    handlers: {
      onRequestGet: adminAuthSession.onRequestGet,
    },
  },
  {
    pattern: /^\/api\/admin\/about-images$/,
    paramNames: [],
    requiresAuth: true,
    handlers: {
      onRequestPost: adminAboutImages.onRequestPost,
    },
  },
  {
    pattern: /^\/api\/admin\/builder\/bootstrap$/,
    paramNames: [],
    requiresAuth: true,
    handlers: {
      onRequestGet: adminBuilderBootstrap.onRequestGet,
    },
  },
  {
    pattern: /^\/api\/admin\/builder\/documents\/([^/]+)$/,
    paramNames: ['docKey'],
    requiresAuth: true,
    handlers: {
      onRequestGet: adminBuilderDocumentByKey.onRequestGet,
      onRequestPut: adminBuilderDocumentByKey.onRequestPut,
    },
  },
  {
    pattern: /^\/api\/admin\/builder\/media$/,
    paramNames: [],
    requiresAuth: true,
    handlers: {
      onRequestGet: adminBuilderMedia.onRequestGet,
      onRequestPost: adminBuilderMedia.onRequestPost,
    },
  },
  {
    pattern: /^\/api\/admin\/builder\/media\/([^/]+)$/,
    paramNames: ['id'],
    requiresAuth: true,
    handlers: {
      onRequestDelete: adminBuilderMediaById.onRequestDelete,
    },
  },
  {
    pattern: /^\/api\/admin\/projects\/reorder$/,
    paramNames: [],
    requiresAuth: true,
    handlers: {
      onRequestPost: adminProjectsReorder.onRequestPost,
    },
  },
  {
    pattern: /^\/api\/admin\/projects$/,
    paramNames: [],
    requiresAuth: true,
    handlers: {
      onRequestGet: adminProjects.onRequestGet,
      onRequestPost: adminProjects.onRequestPost,
    },
  },
  {
    pattern: /^\/api\/admin\/projects\/([^/]+)\/images$/,
    paramNames: ['id'],
    requiresAuth: true,
    handlers: {
      onRequestPost: adminProjectImages.onRequestPost,
      onRequestPut: adminProjectImages.onRequestPut,
    },
  },
  {
    pattern: /^\/api\/admin\/projects\/([^/]+)$/,
    paramNames: ['id'],
    requiresAuth: true,
    handlers: {
      onRequestPut: adminProjectById.onRequestPut,
      onRequestDelete: adminProjectById.onRequestDelete,
    },
  },
  {
    pattern: /^\/api\/admin\/home-cards\/reorder$/,
    paramNames: [],
    requiresAuth: true,
    handlers: {
      onRequestPost: adminHomeCardsReorder.onRequestPost,
    },
  },
  {
    pattern: /^\/api\/admin\/home-cards$/,
    paramNames: [],
    requiresAuth: true,
    handlers: {
      onRequestGet: adminHomeCards.onRequestGet,
      onRequestPost: adminHomeCards.onRequestPost,
    },
  },
  {
    pattern: /^\/api\/admin\/home-cards\/([^/]+)$/,
    paramNames: ['id'],
    requiresAuth: true,
    handlers: {
      onRequestPut: adminHomeCardById.onRequestPut,
      onRequestDelete: adminHomeCardById.onRequestDelete,
    },
  },
  {
    pattern: /^\/api\/admin\/site-settings$/,
    paramNames: [],
    requiresAuth: true,
    handlers: {
      onRequestGet: adminSiteSettings.onRequestGet,
      onRequestPut: adminSiteSettings.onRequestPut,
    },
  },
  {
    pattern: /^\/api\/admin\/messages$/,
    paramNames: [],
    requiresAuth: true,
    handlers: {
      onRequestGet: adminMessages.onRequestGet,
    },
  },
  {
    pattern: /^\/api\/admin\/messages\/([^/]+)$/,
    paramNames: ['id'],
    requiresAuth: true,
    handlers: {
      onRequestPut: adminMessageById.onRequestPut,
    },
  },
  {
    pattern: /^\/api\/admin\/images\/([^/]+)$/,
    paramNames: ['id'],
    requiresAuth: true,
    handlers: {
      onRequestDelete: adminImageById.onRequestDelete,
    },
  },
]

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }
  return pathname
}

function getAllowedMethods(handlers: HandlerModule): string[] {
  const allowed: string[] = []
  for (const [method, key] of methodToHandler.entries()) {
    if (handlers[key]) {
      allowed.push(method)
    }
  }
  return allowed
}

async function dispatchApiRequest(
  request: Request,
  env: AppEnv,
  ctx: ExecutionContext,
  pathname: string,
): Promise<Response> {
  for (const route of routes) {
    const match = route.pattern.exec(pathname)
    if (!match) {
      continue
    }

    const key = methodToHandler.get(request.method)
    const handler = key ? route.handlers[key] : undefined
    if (!handler) {
      const allow = getAllowedMethods(route.handlers)
      return new Response('Method Not Allowed', {
        status: 405,
        headers: allow.length > 0 ? { Allow: allow.join(', ') } : undefined,
      })
    }

    if (route.requiresAuth) {
      const authenticated = await isAdminAuthenticated(request, env)
      if (!authenticated) {
        return new Response(
          JSON.stringify({ success: false, data: null, error: 'Unauthorized.' }),
          {
            status: 401,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
          },
        )
      }
    }

    const params: Record<string, string> = {}
    for (const [index, name] of route.paramNames.entries()) {
      params[name] = match[index + 1] ?? ''
    }

    return handler({
      request,
      env,
      params,
      data: {},
      next: async () => new Response('Not Found', { status: 404 }),
      waitUntil: (promise) => ctx.waitUntil(promise),
      passThroughOnException: () => {},
    })
  }

  return new Response(
    JSON.stringify({ success: false, data: null, error: 'Route not found.' }),
    {
      status: 404,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    },
  )
}

export async function serveStaticOrSpa(
  request: Request,
  env: Pick<WorkerEnv, 'ASSETS'>,
  pathname: string,
): Promise<Response> {
  const isGetLike = request.method === 'GET' || request.method === 'HEAD'
  if (isGetLike && isSitePath(pathname)) {
    const indexUrl = new URL(request.url)
    indexUrl.pathname = '/'
    return env.ASSETS.fetch(new Request(indexUrl.toString(), request))
  }

  return env.ASSETS.fetch(request)
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url)
    const pathname = normalizePathname(url.pathname)

    if (pathname.startsWith('/api/')) {
      return dispatchApiRequest(request, env, ctx, pathname)
    }

    return serveStaticOrSpa(request, env, pathname)
  },
} satisfies ExportedHandler<WorkerEnv>
