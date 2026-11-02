import { describe, expect, it } from 'vitest'
import {
  getLegacyProjectUrls,
  normalizeProjectDetailCards,
  normalizeProjectLinks,
} from '../../shared/projectContent'

describe('projectContent', () => {
  it('builds fallback links from legacy demo and repo urls', () => {
    const links = normalizeProjectLinks(undefined, {
      demoUrl: 'https://demo.example.com',
      repoUrl: 'https://github.com/example/repo',
    })

    expect(links).toHaveLength(2)
    expect(links[0]?.label).toBe('Demo')
    expect(links[1]?.label).toBe('Repo')
    expect(getLegacyProjectUrls(links)).toEqual({
      demoUrl: 'https://demo.example.com',
      repoUrl: 'https://github.com/example/repo',
    })
  })

  it('keeps multiple explicit links intact', () => {
    const links = normalizeProjectLinks([
      { id: 'primary', label: 'Live Dashboard', url: 'https://demo.example.com', kind: 'demo' },
      { id: 'docs', label: 'Docs', url: 'https://docs.example.com', kind: 'docs' },
      { id: 'repo', label: 'Source', url: 'https://github.com/example/repo', kind: 'repo' },
    ])

    expect(links.map((link) => link.label)).toEqual(['Live Dashboard', 'Docs', 'Source'])
  })

  it('clamps embedded detail card geometry into the editable board', () => {
    const cards = normalizeProjectDetailCards([
      {
        id: 'card-1',
        title: 'Inner Card',
        body: 'Nested content',
        x: -12,
        y: 96,
        width: 120,
        height: 4,
      },
    ])

    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({
      x: 0,
      y: 82,
      width: 100,
      height: 18,
    })
  })
})
