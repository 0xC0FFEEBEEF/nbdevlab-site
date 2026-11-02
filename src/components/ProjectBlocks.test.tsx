import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ProjectBlocksView, ProjectCardStages } from './ProjectBlocks'
import { findProjectStageMap, type ProjectBlock, type ProjectStagesBlock } from '../../shared/projectBlocks'
import type { ProjectImage } from '../types/models'

const images: ProjectImage[] = [
  { id: 7, projectId: 1, url: '/api/public/images/7', altText: 'cover.png', position: 0, createdAt: '' },
]

function renderPage(blocks: ProjectBlock[]) {
  return render(
    <MemoryRouter>
      <ProjectBlocksView
        blocks={blocks}
        title="AICMS"
        summary="The summary."
        tech={['Proxmox', 'LXC']}
        links={[{ id: 'l1', label: 'Repo', url: 'https://example.com/repo', kind: 'repo' }]}
        images={images}
      />
    </MemoryRouter>,
  )
}

describe('ProjectBlocksView', () => {
  it('renders the blocks in their order with their widths', () => {
    const { container } = renderPage([
      { id: 'h', type: 'heading', span: 12, text: 'How it works' },
      { id: 'i', type: 'image', span: 4, imageId: 7, alt: 'The dashboard', caption: 'Live view' },
      { id: 's', type: 'summary', span: 8 },
      { id: 't', type: 'text', span: 12, text: 'One.\n\nTwo.' },
      { id: 'g', type: 'tags', span: 6 },
      { id: 'l', type: 'links', span: 6 },
    ])

    const kinds = [...container.querySelectorAll('.project-blocks > *')].map((element) =>
      element.className.replace(/.*project-block--(\w+) project-block--span-(\d+).*/, '$1:$2'),
    )
    expect(kinds).toEqual(['heading:12', 'image:4', 'summary:8', 'text:12', 'tags:6', 'links:6'])
    expect(screen.getByRole('img', { name: 'The dashboard' })).toHaveAttribute('src', '/api/public/images/7')
    expect(screen.getByText('Live view')).toBeInTheDocument()
    expect(screen.getByText('The summary.')).toBeInTheDocument()
    expect(container.querySelectorAll('.project-block--text p')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Repo' })).toHaveAttribute('href', 'https://example.com/repo')
  })

  it('shows a stage map with the stages before the current one done', () => {
    const { container } = renderPage([
      {
        id: 'st',
        type: 'stages',
        span: 12,
        title: 'How I learned it',
        current: 1,
        stages: [
          { id: 'a', label: 'AI assistance', note: 'Claude drew the first map.' },
          { id: 'b', label: 'Learn how it works', note: '' },
          { id: 'c', label: 'Master it', note: '' },
        ],
      },
    ])

    expect(screen.getByRole('region', { name: 'How I learned it' })).toBeInTheDocument()
    const stages = [...container.querySelectorAll('.stage-map__stage')]
    expect(stages.map((stage) => stage.className.replace(/.*stage-map__stage--(\w+).*/, '$1'))).toEqual(['done', 'now', 'ahead'])
    expect(stages[1]).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('02 · Now')).toBeInTheDocument()
    expect(screen.getByText('Claude drew the first map.')).toBeInTheDocument()
  })

  it('leaves out a stage map with nothing typed in it', () => {
    const { container } = renderPage([
      { id: 'st', type: 'stages', span: 12, title: 'Empty', current: 0, stages: [{ id: 'a', label: ' ', note: '' }] },
    ])
    expect(container.querySelector('.project-block--stages')).toBeNull()
  })

  it('leaves out blocks with nothing to show', () => {
    const { container } = renderPage([
      { id: 'i', type: 'image', span: 6, imageId: 99, alt: '', caption: 'Picture that was deleted' },
      { id: 'e', type: 'image', span: 6, imageId: null, alt: '', caption: '' },
      { id: 't', type: 'text', span: 12, text: '   ' },
      { id: 'h', type: 'heading', span: 12, text: '' },
      { id: 'c', type: 'card', span: 6, title: '', text: '', linkLabel: 'Open', linkUrl: '/status' },
    ])

    expect(container.querySelector('.project-blocks')?.children).toHaveLength(0)
  })

  it('shows a card button only for a safe address', () => {
    renderPage([
      { id: 'a', type: 'card', span: 6, title: 'Safe', text: 'Body', linkLabel: 'Lab status', linkUrl: '/status' },
      { id: 'b', type: 'card', span: 6, title: 'Unsafe', text: 'Body', linkLabel: 'Click me', linkUrl: 'javascript:alert(1)' },
    ])

    expect(screen.getByRole('link', { name: 'Lab status' })).toHaveAttribute('href', '/status')
    expect(screen.queryByRole('link', { name: 'Click me' })).not.toBeInTheDocument()
  })
})

describe('ProjectCardStages', () => {
  const map: ProjectStagesBlock = {
    id: 'st',
    type: 'stages',
    span: 12,
    title: '',
    current: 2,
    stages: [
      { id: 'a', label: 'Research and Setup', note: '' },
      { id: 'b', label: ' ', note: 'unnamed, left off the card' },
      { id: 'c', label: 'Master it', note: '' },
      { id: 'd', label: 'Decommissioned', note: '' },
    ],
  }

  it('shows a dot per named stage and where the project is now', () => {
    const { container } = render(<ProjectCardStages block={map} />)
    const dots = [...container.querySelectorAll('.project-card__stage')].map((dot) =>
      dot.className.replace(/.*project-card__stage--(\w+).*/, '$1'),
    )
    expect(dots).toEqual(['done', 'now', 'ahead'])
    expect(container.querySelector('.project-card__stage-text')).toHaveTextContent('Stage 2/3 Master it')
  })

  it('finds the first stage map with a named stage on a page', () => {
    const empty: ProjectStagesBlock = { ...map, id: 'empty', stages: [{ id: 'x', label: '', note: '' }] }
    expect(findProjectStageMap([{ id: 't', type: 'text', span: 12, text: 'Hi' }, empty, map])).toBe(map)
    expect(findProjectStageMap([empty])).toBeNull()
    expect(findProjectStageMap(undefined)).toBeNull()
  })
})
