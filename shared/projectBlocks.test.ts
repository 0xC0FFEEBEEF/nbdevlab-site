import { describe, expect, it } from 'vitest'
import {
  buildDefaultProjectBlocks,
  createProjectBlock,
  normalizeProjectBlocks,
  projectBlockLimits,
  projectCardLink,
  resolveProjectBlocks,
  projectStageState,
  type ProjectCardBlock,
  type ProjectStagesBlock,
} from './projectBlocks'

const legacy = {
  details: 'First paragraph.\n\nSecond paragraph.',
  tech: ['Proxmox', 'LXC'],
  links: [{ id: 'l1', label: 'Repo', url: 'https://example.com/repo', kind: 'repo' as const }],
  detailCards: [
    { id: 'c1', title: 'Scanner', body: 'Walks the hosts.', linkLabel: '', linkUrl: '', x: 5, y: 8, width: 38, height: 34 },
  ],
  images: [
    { id: 7, altText: 'cover.png' },
    { id: 9, altText: 'demo.gif' },
  ],
}

describe('normalizeProjectBlocks', () => {
  it('returns nothing for anything that is not a list', () => {
    expect(normalizeProjectBlocks(undefined)).toEqual([])
    expect(normalizeProjectBlocks('text')).toEqual([])
  })

  it('drops unknown block types and repairs widths and picture ids', () => {
    const blocks = normalizeProjectBlocks([
      { id: 'a', type: 'video', span: 6 },
      { id: 'b', type: 'text', span: 5, text: 'Kept' },
      { id: 'c', type: 'image', span: 4, imageId: '12', alt: 3, caption: 'A caption' },
      null,
    ])

    expect(blocks).toEqual([
      { id: 'b', type: 'text', span: 12, text: 'Kept' },
      { id: 'c', type: 'image', span: 4, imageId: null, alt: '', caption: 'A caption' },
    ])
  })

  it('keeps one summary, one tags and one links block, and gives every block its own id', () => {
    const blocks = normalizeProjectBlocks([
      { id: 'same', type: 'summary', span: 6 },
      { id: 'same', type: 'summary', span: 12 },
      { id: 'same', type: 'text', span: 12, text: 'One' },
      { id: 'same', type: 'text', span: 12, text: 'Two' },
    ])

    expect(blocks.map((block) => block.type)).toEqual(['summary', 'text', 'text'])
    expect(new Set(blocks.map((block) => block.id)).size).toBe(3)
  })

  it('keeps text as typed and only caps how long it is', () => {
    const [text, heading] = normalizeProjectBlocks([
      { id: 't', type: 'text', span: 12, text: `  spaced out \n\n${'x'.repeat(9000)}` },
      { id: 'h', type: 'heading', span: 12, text: 'One\nline ' },
    ])

    expect(text.type === 'text' && text.text.startsWith('  spaced out \n\n')).toBe(true)
    expect(text.type === 'text' && text.text).toHaveLength(projectBlockLimits.text)
    expect(heading).toMatchObject({ text: 'One line ' })
  })

  it('stops at the block limit', () => {
    const many = Array.from({ length: 200 }, () => createProjectBlock('divider'))
    expect(normalizeProjectBlocks(many)).toHaveLength(projectBlockLimits.blocks)
  })
})

describe('buildDefaultProjectBlocks', () => {
  it('lays the old fixed page out as blocks, cover beside the summary', () => {
    const blocks = buildDefaultProjectBlocks(legacy)

    expect(blocks.map((block) => `${block.type}:${block.span}`)).toEqual([
      'image:6',
      'summary:6',
      'text:12',
      'image:6',
      'tags:12',
      'links:12',
      'card:6',
    ])
    expect(blocks[0]).toMatchObject({ imageId: 7, alt: 'cover.png' })
    expect(blocks[2]).toMatchObject({ text: 'First paragraph.\n\nSecond paragraph.' })
    expect(blocks[6]).toMatchObject({ title: 'Scanner', text: 'Walks the hosts.' })
  })

  it('gives the summary the full width when there is no picture, and leaves empty parts out', () => {
    const blocks = buildDefaultProjectBlocks({ details: ' ', tech: [], links: [], detailCards: [], images: [] })
    expect(blocks).toEqual([{ id: 'default-summary', type: 'summary', span: 12 }])
  })

  it('produces the same ids every time, so an untouched page is stable between renders', () => {
    expect(buildDefaultProjectBlocks(legacy)).toEqual(buildDefaultProjectBlocks(legacy))
  })
})

describe('resolveProjectBlocks', () => {
  it('uses the saved arrangement when there is one, and the default one otherwise', () => {
    const arranged = [createProjectBlock('heading', 'h1')]
    expect(resolveProjectBlocks({ ...legacy, contentBlocks: arranged })).toEqual(arranged)
    expect(resolveProjectBlocks({ ...legacy, contentBlocks: [] })).toEqual(buildDefaultProjectBlocks(legacy))
    expect(resolveProjectBlocks(legacy)).toEqual(buildDefaultProjectBlocks(legacy))
  })
})

describe('projectCardLink', () => {
  const card = (linkUrl: string): ProjectCardBlock => ({
    ...(createProjectBlock('card') as ProjectCardBlock),
    linkLabel: 'Open',
    linkUrl,
  })

  it('only gives back addresses that are safe to link to', () => {
    expect(projectCardLink(card('/status'))).toBe('/status')
    expect(projectCardLink(card(' https://example.com '))).toBe('https://example.com')
    expect(projectCardLink(card('javascript:alert(1)'))).toBe('')
    expect(projectCardLink(card('example.com'))).toBe('')
  })
})

describe('stage maps', () => {
  it('start with the three stages from AI assistance to mastering it, at the first one', () => {
    const block = createProjectBlock('stages') as ProjectStagesBlock
    expect(block.stages.map((stage) => stage.label)).toEqual([
      'AI assistance',
      'Soak in the information, learn how it works',
      'Master it',
    ])
    expect(block.current).toBe(0)
    expect(block.span).toBe(12)
  })

  it('are cleaned like the other blocks: stages capped, ids made unique, the current stage kept in range', () => {
    const [block] = normalizeProjectBlocks([
      {
        id: 's',
        type: 'stages',
        span: 8,
        title: 'How I learned it\n',
        current: 9,
        stages: [
          { id: 'a', label: 'One', note: 'First' },
          { id: 'a', label: 'Two' },
          'not a stage',
          ...Array.from({ length: 10 }, (_, index) => ({ id: `x${index}`, label: `Extra ${index}` })),
        ],
      },
    ]) as ProjectStagesBlock[]

    expect(block.title).toBe('How I learned it ')
    expect(block.stages).toHaveLength(projectBlockLimits.stages)
    expect(block.stages[0]).toEqual({ id: 'a', label: 'One', note: 'First' })
    expect(block.stages[1]).toMatchObject({ label: 'Two', note: '' })
    expect(block.stages[1].id).not.toBe('a')
    expect(block.current).toBe(projectBlockLimits.stages - 1)

    const [empty] = normalizeProjectBlocks([{ id: 'e', type: 'stages', span: 12, stages: 'none', current: -2 }]) as ProjectStagesBlock[]
    expect(empty).toMatchObject({ stages: [], current: 0, title: '' })
  })

  it('call the stages before the current one done and the ones after it ahead', () => {
    expect([0, 1, 2].map((index) => projectStageState(index, 1))).toEqual(['done', 'now', 'ahead'])
  })
})
