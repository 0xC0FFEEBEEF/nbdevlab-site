import { describe, expect, it, vi } from 'vitest'
import { sitePaths } from '../shared/siteRoutes'
import { serveStaticOrSpa } from './index'

function fixture() {
  const fetch = vi.fn<Fetcher['fetch']>(async (input) => {
    const request = input instanceof Request ? input : new Request(input)
    return new Response(new URL(request.url).pathname === '/' ? 'APP SHELL' : 'CINEMATIC 404', {
      status: new URL(request.url).pathname === '/' ? 200 : 404,
    })
  })
  const env: Parameters<typeof serveStaticOrSpa>[1] = {
    ASSETS: { fetch, connect: () => { throw new Error('Sockets are not used by asset routing') } },
  }
  return { fetch, env }
}

describe('document routing', () => {
  it.each(sitePaths)('preserves the SPA entry for %s', async (pathname) => {
    const { env, fetch } = fixture()
    const response = await serveStaticOrSpa(new Request(`https://www.nbdevlab.com${pathname}?preview=1`), env, pathname)
    expect(response.status).toBe(200)
    const request = fetch.mock.calls[0][0] as Request
    expect(new URL(request.url).pathname).toBe('/')
    expect(new URL(request.url).search).toBe('?preview=1')
  })

  it.each(['/missing', '/missing/deep/page', '/admin/missing', '/missing.js'])('keeps %s a real 404', async (pathname) => {
    const { env, fetch } = fixture()
    const response = await serveStaticOrSpa(new Request(`https://www.nbdevlab.com${pathname}`), env, pathname)
    expect(response.status).toBe(404)
    expect(await response.text()).toBe('CINEMATIC 404')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect((fetch.mock.calls[0][0] as Request).url).toBe(`https://www.nbdevlab.com${pathname}`)
  })

  it('does not turn an unknown POST into an HTML app entry', async () => {
    const { env, fetch } = fixture()
    await serveStaticOrSpa(new Request('https://www.nbdevlab.com/about', { method: 'POST' }), env, '/about')
    expect((fetch.mock.calls[0][0] as Request).url).toBe('https://www.nbdevlab.com/about')
  })

  it('preserves HEAD for known documents', async () => {
    const { env, fetch } = fixture()
    await serveStaticOrSpa(new Request('https://www.nbdevlab.com/about', { method: 'HEAD' }), env, '/about')
    expect((fetch.mock.calls[0][0] as Request).method).toBe('HEAD')
  })
})
