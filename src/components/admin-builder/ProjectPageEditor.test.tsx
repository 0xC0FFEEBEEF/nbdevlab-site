import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProjectPageEditor, type ProjectPagePatch } from './ProjectPageEditor'
import type { ProjectBlock } from '../../../shared/projectBlocks'
import type { ProjectImage } from '../../types/models'

const images: ProjectImage[] = [
  { id: 7, projectId: 1, url: '/api/public/images/7', altText: 'cover.png', position: 0, createdAt: '' },
  { id: 9, projectId: 1, url: '/api/public/images/9', altText: 'demo.gif', position: 1, createdAt: '' },
]

const blocks: ProjectBlock[] = [
  { id: 'img', type: 'image', span: 6, imageId: 7, alt: 'cover.png', caption: '' },
  { id: 'sum', type: 'summary', span: 6 },
  { id: 'txt', type: 'text', span: 12, text: 'Body text.' },
]

function renderEditor(overrides: Partial<Parameters<typeof ProjectPageEditor>[0]> = {}) {
  const onChange = vi.fn<(patch: ProjectPagePatch, editKey: string) => void>()
  render(
    <ProjectPageEditor
      title="AICMS"
      eyebrow="Project Detail"
      summary="The summary."
      tech={['Proxmox']}
      links={[]}
      blocks={blocks}
      isArranged
      images={images}
      uploadBlockedReason=""
      onChange={onChange}
      onUploadImages={() => Promise.resolve([])}
      {...overrides}
    />,
  )
  return onChange
}

const lastPatch = (onChange: ReturnType<typeof renderEditor>) => onChange.mock.calls.at(-1)?.[0] as ProjectPagePatch

describe('ProjectPageEditor', () => {
  it('edits text where it stands on the page', () => {
    const onChange = renderEditor()
    fireEvent.change(screen.getByRole('textbox', { name: 'Text' }), { target: { value: 'Body text, edited.' } })

    expect(lastPatch(onChange).contentBlocks?.[2]).toMatchObject({ id: 'txt', text: 'Body text, edited.' })
    expect(onChange.mock.calls.at(-1)?.[1]).toBe('block:txt:text')
  })

  it('edits the title and the summary as the project fields they are', () => {
    const onChange = renderEditor()
    fireEvent.change(screen.getByRole('textbox', { name: 'Project title' }), { target: { value: 'AICMS 2' } })
    expect(lastPatch(onChange)).toEqual({ title: 'AICMS 2' })

    fireEvent.change(screen.getByRole('textbox', { name: 'Summary' }), { target: { value: 'New summary.' } })
    expect(lastPatch(onChange)).toEqual({ summary: 'New summary.' })
  })

  it('saves the default arrangement with the first edit to a page nobody has arranged', () => {
    const onChange = renderEditor({ isArranged: false })
    fireEvent.change(screen.getByRole('textbox', { name: 'Project title' }), { target: { value: 'AICMS 2' } })

    expect(lastPatch(onChange)).toEqual({ title: 'AICMS 2', contentBlocks: blocks })
  })

  it('adds a block at the end, or after the selected block', () => {
    const onChange = renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Heading' }))
    expect(lastPatch(onChange).contentBlocks?.map((block) => block.type)).toEqual(['image', 'summary', 'text', 'heading'])

    fireEvent.focus(screen.getByRole('textbox', { name: 'Summary' }))
    fireEvent.click(screen.getByRole('button', { name: 'Divider' }))
    expect(lastPatch(onChange).contentBlocks?.map((block) => block.type)).toEqual(['image', 'summary', 'divider', 'text'])
  })

  it('offers the summary, tags and links blocks only while they are not on the page', () => {
    renderEditor()
    expect(screen.getByRole('button', { name: 'Summary' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Tags' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Links' })).toBeEnabled()
  })

  it('shows the selected block a toolbar for width, order and removal', () => {
    const onChange = renderEditor()
    expect(screen.queryByRole('toolbar', { name: 'Text block' })).not.toBeInTheDocument()

    fireEvent.focus(screen.getByRole('textbox', { name: 'Text' }))
    expect(screen.getByRole('toolbar', { name: 'Text block' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Half the page width' }))
    expect(lastPatch(onChange).contentBlocks?.[2]).toMatchObject({ id: 'txt', span: 6 })

    fireEvent.click(screen.getByRole('button', { name: 'Move earlier on the page' }))
    expect(lastPatch(onChange).contentBlocks?.map((block) => block.id)).toEqual(['img', 'txt', 'sum'])
    expect(screen.getByRole('button', { name: 'Move later on the page' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(lastPatch(onChange).contentBlocks?.map((block) => block.id)).toEqual(['img', 'sum'])
  })

  it('adds a stage map and edits it in place', () => {
    const onChange = renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Stage map' }))
    const added = lastPatch(onChange).contentBlocks?.at(-1)
    expect(added).toMatchObject({ type: 'stages', current: 0 })
    expect(added?.type === 'stages' && added.stages.map((stage) => stage.label)).toEqual([
      'AI assistance',
      'Soak in the information, learn how it works',
      'Master it',
    ])
  })

  it('marks the stage whose dot is clicked as now, and keeps the mark when a stage before it goes', () => {
    const stages: ProjectBlock = {
      id: 'map',
      type: 'stages',
      span: 12,
      title: '',
      current: 0,
      stages: [
        { id: 'a', label: 'AI assistance', note: '' },
        { id: 'b', label: 'Learn it', note: '' },
        { id: 'c', label: 'Master it', note: '' },
      ],
    }
    const onChange = renderEditor({ blocks: [stages] })

    fireEvent.click(screen.getByRole('button', { name: 'Mark Master it as where the project is now' }))
    expect(lastPatch(onChange).contentBlocks?.[0]).toMatchObject({ current: 2 })

    fireEvent.change(screen.getByRole('textbox', { name: 'Name of stage 2' }), { target: { value: 'Soak it in' } })
    expect(lastPatch(onChange).contentBlocks?.[0]).toMatchObject({ stages: [{ id: 'a' }, { id: 'b', label: 'Soak it in' }, { id: 'c' }] })
    expect(onChange.mock.calls.at(-1)?.[1]).toBe('block:map:stage:b:label')
  })

  it('removes a stage and moves the now mark with it', () => {
    const stages: ProjectBlock = {
      id: 'map',
      type: 'stages',
      span: 12,
      title: '',
      current: 2,
      stages: [
        { id: 'a', label: 'One', note: '' },
        { id: 'b', label: 'Two', note: '' },
        { id: 'c', label: 'Three', note: '' },
      ],
    }
    const onChange = renderEditor({ blocks: [stages] })
    fireEvent.focus(screen.getByRole('textbox', { name: 'Name of stage 1' }))

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove stage' })[0])
    expect(lastPatch(onChange).contentBlocks?.[0]).toMatchObject({ current: 1, stages: [{ id: 'b' }, { id: 'c' }] })
  })

  it('puts a picture from the project on the page when it is clicked in the strip', () => {
    const onChange = renderEditor()
    fireEvent.click(screen.getByRole('button', { name: /demo\.gif/ }))

    expect(lastPatch(onChange).contentBlocks?.at(-1)).toMatchObject({ type: 'image', imageId: 9, alt: 'demo.gif' })
  })

  it('lets an empty picture block choose from the uploads, and says why uploading is off', () => {
    const onChange = renderEditor({
      blocks: [{ id: 'empty', type: 'image', span: 6, imageId: null, alt: '', caption: '' }],
      uploadBlockedReason: 'Save the project once, then you can add pictures to it.',
    })

    expect(screen.getAllByText('Save the project once, then you can add pictures to it.').length).toBeGreaterThan(0)
    const chooser = document.querySelector('.page-picker__grid')
    fireEvent.click(chooser!.querySelectorAll('button')[1])
    expect(lastPatch(onChange).contentBlocks).toEqual([
      { id: 'empty', type: 'image', span: 6, imageId: 9, alt: 'demo.gif', caption: '' },
    ])
  })

  it('edits tags in place', () => {
    const onChange = renderEditor({ blocks: [{ id: 'tags', type: 'tags', span: 12 }] })
    // The field for a new tag appears once the block is selected.
    expect(screen.queryByRole('textbox', { name: 'Add a tag' })).not.toBeInTheDocument()
    fireEvent.pointerDown(document.querySelector('[data-block-id="tags"]')!)
    const input = screen.getByRole('textbox', { name: 'Add a tag' })
    fireEvent.change(input, { target: { value: 'LXC, Proxmox, VM' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(lastPatch(onChange)).toEqual({ tech: ['Proxmox', 'LXC', 'VM'] })
  })
})
