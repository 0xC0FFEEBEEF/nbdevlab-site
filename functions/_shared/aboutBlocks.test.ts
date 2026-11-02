import { describe, expect, it } from 'vitest'
import { normalizeAboutBlocks, parseAboutBlocks } from './aboutBlocks'

describe('aboutBlocks', () => {
  it('keeps image blocks when src is present even if alt is blank', () => {
    expect(
      normalizeAboutBlocks([
        {
          id: 'image-1',
          type: 'image',
          src: '/api/public/about-images/1',
          alt: '',
          caption: 'Lab rack',
          showTopRule: true,
        },
      ]),
    ).toEqual([
      {
        id: 'image-1',
        type: 'image',
        src: '/api/public/about-images/1',
        alt: '',
        caption: 'Lab rack',
        showTopRule: true,
      },
    ])
  })

  it('falls back to defaults when stored about blocks are empty', () => {
    const parsed = parseAboutBlocks('[]')

    expect(parsed.length).toBeGreaterThan(0)
    expect(parsed.every((block) => block.type === 'paragraph')).toBe(true)
  })

  it('defaults showTopRule to false when it is omitted', () => {
    expect(
      normalizeAboutBlocks([
        {
          id: 'paragraph-1',
          type: 'paragraph',
          content: 'Without divider',
        },
      ]),
    ).toEqual([
      {
        id: 'paragraph-1',
        type: 'paragraph',
        content: 'Without divider',
        showTopRule: false,
      },
    ])
  })
})
