import { describe, expect, it } from 'vitest'
import type { BuilderDocument, BuilderNode } from '../../shared/builder'
import { getBuilderNodeText } from './builderDocuments'

function createDocument(node: BuilderNode): BuilderDocument {
  return {
    docKey: 'page.home',
    schemaVersion: 1,
    title: 'Home',
    updatedAt: '2026-04-09T00:00:00.000Z',
    root: {
      id: 'home-root',
      type: 'section',
      children: [node],
    },
  }
}

describe('builderDocuments', () => {
  it('prefers the live site-settings fallback for bound text nodes', () => {
    const document = createDocument({
      id: 'home-hero-tagline',
      type: 'text',
      binding: {
        kind: 'site-settings',
        field: 'homeTagline',
        key: 'home.hero',
      },
      content: {
        text: 'Stale builder document text',
      },
    })

    expect(
      getBuilderNodeText(
        document,
        'home-hero-tagline',
        'I build and document homelab infrastructure, self-hosted services, and hands-on systems projects.',
      ),
    ).toBe('I build and document homelab infrastructure, self-hosted services, and hands-on systems projects.')
  })

  it('keeps using stored document text for unbound nodes', () => {
    const document = createDocument({
      id: 'status-hero-title',
      type: 'text',
      content: {
        text: 'Custom Status Title',
      },
    })

    expect(getBuilderNodeText(document, 'status-hero-title', 'Lab Status')).toBe('Custom Status Title')
  })

  it('keeps using stored document text for site-setting bindings without a concrete field', () => {
    const document = createDocument({
      id: 'skills-title',
      type: 'text',
      binding: {
        kind: 'site-settings',
        key: 'skills.title',
      },
      content: {
        text: 'Infrastructure Focus',
      },
    })

    expect(getBuilderNodeText(document, 'skills-title', 'Technical Focus')).toBe('Infrastructure Focus')
  })
})
