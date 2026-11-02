import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type {
  CSSProperties,
  ChangeEvent,
  ClipboardEvent,
  DragEvent,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  createProjectBlock,
  createProjectStage,
  projectBlockClassName,
  projectBlockLimits,
  projectBlockSpans,
  projectCardLink,
  projectStageState,
  projectStageStateLabels,
  singletonProjectBlockTypes,
  type ProjectBlock,
  type ProjectBlockSpan,
  type ProjectBlockType,
  type ProjectCardBlock,
  type ProjectImageBlock,
  type ProjectStage,
  type ProjectStagesBlock,
} from '../../../shared/projectBlocks'
import { createProjectLink, type ProjectLink } from '../../../shared/projectContent'
import type { ProjectImage } from '../../types/models'

/** What the editor can change. Every edit arrives as one patch, so the owner applies it in one step. */
export interface ProjectPagePatch {
  title?: string
  summary?: string
  tech?: string[]
  links?: ProjectLink[]
  contentBlocks?: ProjectBlock[]
}

interface ProjectPageEditorProps {
  title: string
  eyebrow: string
  summary: string
  tech: string[]
  links: ProjectLink[]
  /** The blocks to show: the saved arrangement, or the default one for a page nobody has arranged yet. */
  blocks: ProjectBlock[]
  /** False while `blocks` is still the default arrangement. The first edit then saves it as the page's own. */
  isArranged: boolean
  images: ProjectImage[]
  /** Why pictures cannot be uploaded right now. Empty when they can. */
  uploadBlockedReason: string
  /** `editKey` names what was edited, so the owner can fold a run of keystrokes into one undo step. */
  onChange: (patch: ProjectPagePatch, editKey: string) => void
  /** Uploads the files and resolves with the pictures that were added. */
  onUploadImages: (files: File[]) => Promise<ProjectImage[]>
  onMakeCover?: (imageId: number) => void
}

const blockLabels: Record<ProjectBlockType, string> = {
  summary: 'Summary',
  text: 'Text',
  heading: 'Heading',
  image: 'Picture',
  card: 'Card',
  stages: 'Stage map',
  tags: 'Tags',
  links: 'Links',
  divider: 'Divider',
}

const addChoices: { type: ProjectBlockType; label: string }[] = [
  { type: 'text', label: 'Text' },
  { type: 'heading', label: 'Heading' },
  { type: 'image', label: 'Picture or GIF' },
  { type: 'card', label: 'Card' },
  { type: 'stages', label: 'Stage map' },
  { type: 'summary', label: 'Summary' },
  { type: 'tags', label: 'Tags' },
  { type: 'links', label: 'Links' },
  { type: 'divider', label: 'Divider' },
]

const spanLabels: Record<ProjectBlockSpan, { short: string; long: string }> = {
  4: { short: '⅓', long: 'One third of the page width' },
  6: { short: '½', long: 'Half the page width' },
  8: { short: '⅔', long: 'Two thirds of the page width' },
  12: { short: 'Full', long: 'Full page width' },
}

/** The block under the pointer, or the nearest one when the pointer is in a gap. */
const blockUnderPointer: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  return hits.length > 0 ? hits : closestCenter(args)
}

const noShuffle = () => null

function imageFiles(list: FileList | null | undefined): File[] {
  return Array.from(list ?? []).filter((file) => file.type.startsWith('image/'))
}

/** A textarea as tall as its text, so text on the page reads like the published page while it is edited. */
/** Fields that wrap like text but hold one line: Enter or a pasted line break becomes a space. */
const oneLine = (value: string) => value.replace(/[ \t]*\r?\n[ \t]*/g, ' ')

function GrowingTextarea({
  value,
  onChange,
  className,
  placeholder,
  label,
  maxLength,
}: {
  value: string
  onChange: (value: string) => void
  className: string
  placeholder: string
  label: string
  maxLength?: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }

    const fit = () => {
      element.style.height = 'auto'
      element.style.height = `${element.scrollHeight}px`
    }

    fit()

    // A width change (another block width, a narrower window) rewraps the text.
    if (typeof ResizeObserver === 'undefined') {
      return
    }

    let lastWidth = element.clientWidth
    const observer = new ResizeObserver(() => {
      if (element.clientWidth !== lastWidth) {
        lastWidth = element.clientWidth
        fit()
      }
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [value])

  return (
    <textarea
      ref={ref}
      className={`page-block__field ${className}`}
      rows={1}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      aria-label={label}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

function ImagePicker({
  images,
  isUploading,
  uploadBlockedReason,
  intro,
  onChoose,
  onUpload,
  onCancel,
}: {
  images: ProjectImage[]
  isUploading: boolean
  uploadBlockedReason: string
  intro: string
  onChoose: (imageId: number) => void
  onUpload: (files: File[]) => void
  onCancel?: () => void
}) {
  return (
    <div className="page-picker">
      <p className="page-picker__intro">{intro}</p>
      {images.length > 0 && (
        <div className="page-picker__grid">
          {images.map((image, index) => (
            <button key={image.id} type="button" onClick={() => onChoose(image.id)}>
              <img src={image.url} alt={image.altText || `Picture ${index + 1}`} loading="lazy" />
            </button>
          ))}
        </div>
      )}
      <div className="page-picker__actions">
        {uploadBlockedReason ? (
          <p className="page-editor__hint">{uploadBlockedReason}</p>
        ) : (
          <label className={`button page-editor__upload${isUploading ? ' button--disabled' : ''}`}>
            {isUploading ? 'Uploading…' : 'Upload from this computer'}
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={isUploading}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                onUpload(imageFiles(event.target.files))
                event.target.value = ''
              }}
            />
          </label>
        )}
        {onCancel && (
          <button className="button" type="button" onClick={onCancel}>
            Keep the current picture
          </button>
        )}
      </div>
    </div>
  )
}

function TagsEditor({ tech, isSelected, onChange }: { tech: string[]; isSelected: boolean; onChange: (tech: string[]) => void }) {
  const [draft, setDraft] = useState('')

  const addDraft = () => {
    const additions = draft
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag && !tech.includes(tag))
    setDraft('')
    if (additions.length > 0) {
      onChange([...tech, ...additions])
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addDraft()
    } else if (event.key === 'Backspace' && draft === '' && tech.length > 0) {
      onChange(tech.slice(0, -1))
    }
  }

  return (
    <div className="project-tags page-block__tags">
      {tech.map((tag) => (
        <span key={tag}>
          {tag}
          {isSelected && (
            <button type="button" aria-label={`Remove the tag ${tag}`} onClick={() => onChange(tech.filter((entry) => entry !== tag))}>
              ×
            </button>
          )}
        </span>
      ))}
      {(isSelected || tech.length === 0) && (
        <input
          type="text"
          className="page-block__tag-input"
          value={draft}
          placeholder={tech.length === 0 ? 'Add a tag, then press Enter' : 'Add a tag'}
          aria-label="Add a tag"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={addDraft}
        />
      )}
    </div>
  )
}

function LinksEditor({
  links,
  isSelected,
  onChange,
}: {
  links: ProjectLink[]
  isSelected: boolean
  onChange: (links: ProjectLink[]) => void
}) {
  const update = (id: string, changes: Partial<ProjectLink>) =>
    onChange(links.map((link) => (link.id === id ? { ...link, ...changes } : link)))

  return (
    <div className="page-block__links">
      {links.length > 0 ? (
        <div className="project-links">
          {links.map((link) => (
            <span key={link.id} className="page-block__link-preview">
              {link.label || 'Untitled link'}
            </span>
          ))}
        </div>
      ) : (
        <p className="page-editor__hint">No links yet.{!isSelected && ' Click here to add one.'}</p>
      )}
      {isSelected && (
        <div className="page-block__options">
          {links.map((link) => (
            <div key={link.id} className="page-block__link-row">
              <label>
                Button text
                <input type="text" value={link.label} onChange={(event) => update(link.id, { label: event.target.value })} />
              </label>
              <label>
                Address
                <input
                  type="text"
                  inputMode="url"
                  value={link.url}
                  placeholder="https://…"
                  onChange={(event) => update(link.id, { url: event.target.value })}
                />
              </label>
              <button
                className="button"
                type="button"
                aria-label={`Remove the link ${link.label}`}
                onClick={() => onChange(links.filter((entry) => entry.id !== link.id))}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            className="button"
            type="button"
            onClick={() => onChange([...links, { ...createProjectLink(), label: '', url: '' }])}
          >
            Add a link
          </button>
          <p className="page-editor__hint">A link with no address is left off the page.</p>
        </div>
      )}
    </div>
  )
}

interface EditableBlockProps {
  block: ProjectBlock
  index: number
  count: number
  isSelected: boolean
  dropSide: 'before' | 'after' | null
  children: ReactNode
  onSelect: () => void
  onSpan: (span: ProjectBlockSpan) => void
  onMove: (direction: -1 | 1) => void
  onDuplicate: (() => void) | null
  onRemove: () => void
  onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>) => void
}

function EditableBlock({
  block,
  index,
  count,
  isSelected,
  dropSide,
  children,
  onSelect,
  onSpan,
  onMove,
  onDuplicate,
  onRemove,
  onResizeStart,
}: EditableBlockProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useSortable({
    id: block.id,
  })
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [alignEnd, setAlignEnd] = useState(false)
  const label = blockLabels[block.type]

  // A toolbar wider than a narrow block would run off the right edge of the page, so it hangs from the right instead.
  useLayoutEffect(() => {
    const toolbar = toolbarRef.current
    const page = toolbar?.closest('.page-editor__blocks')
    const element = toolbar?.closest('.page-block')
    if (!isSelected || !toolbar || !page || !element) {
      return
    }

    const pageRect = page.getBoundingClientRect()
    setAlignEnd(element.getBoundingClientRect().left + toolbar.offsetWidth > pageRect.right)
  }, [isSelected, block.span, index])

  const className = [
    projectBlockClassName(block),
    'page-block',
    isSelected ? 'is-selected' : '',
    isDragging ? 'is-dragging' : '',
    dropSide ? `is-drop-${dropSide}` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={setNodeRef}
      className={className}
      style={{ transform: CSS.Translate.toString(transform) }}
      data-block-id={block.id}
      onPointerDownCapture={onSelect}
      onFocusCapture={onSelect}
    >
      {isSelected && (
        // The anchor sticks under the Add bar, so the toolbar stays in reach while a tall block is scrolled.
        <div className="page-block__toolbar-anchor">
          <div
            ref={toolbarRef}
            className={`page-block__toolbar${alignEnd ? ' page-block__toolbar--end' : ''}`}
            role="toolbar"
            aria-label={`${label} block`}
          >
            <button
              ref={setActivatorNodeRef}
              type="button"
              className="page-block__handle"
              aria-label={`Drag to move the ${label.toLowerCase()} block`}
              {...attributes}
              {...listeners}
            >
              <svg viewBox="0 0 10 16" aria-hidden="true">
                <circle cx="2" cy="2" r="1.4" />
                <circle cx="8" cy="2" r="1.4" />
                <circle cx="2" cy="8" r="1.4" />
                <circle cx="8" cy="8" r="1.4" />
                <circle cx="2" cy="14" r="1.4" />
                <circle cx="8" cy="14" r="1.4" />
              </svg>
              {label}
            </button>
            <span className="page-block__group" role="group" aria-label="Width">
              {projectBlockSpans.map((span) => (
                <button
                  key={span}
                  type="button"
                  aria-pressed={block.span === span}
                  title={spanLabels[span].long}
                  aria-label={spanLabels[span].long}
                  onClick={() => onSpan(span)}
                >
                  {spanLabels[span].short}
                </button>
              ))}
            </span>
            <span className="page-block__group">
              <button type="button" aria-label="Move earlier on the page" title="Move earlier" disabled={index === 0} onClick={() => onMove(-1)}>
                ↑
              </button>
              <button
                type="button"
                aria-label="Move later on the page"
                title="Move later"
                disabled={index === count - 1}
                onClick={() => onMove(1)}
              >
                ↓
              </button>
            </span>
            <span className="page-block__group">
              {onDuplicate && (
                <button type="button" onClick={onDuplicate}>
                  Duplicate
                </button>
              )}
              <button type="button" onClick={onRemove}>
                Remove
              </button>
            </span>
          </div>
        </div>
      )}
      <div className="page-block__body">{children}</div>
      {isSelected && (
        <button
          type="button"
          className="page-block__resize"
          tabIndex={-1}
          aria-hidden="true"
          title="Drag to change the width"
          onPointerDown={onResizeStart}
        />
      )}
    </div>
  )
}

export function ProjectPageEditor({
  title,
  eyebrow,
  summary,
  tech,
  links,
  blocks,
  isArranged,
  images,
  uploadBlockedReason,
  onChange,
  onUploadImages,
  onMakeCover,
}: ProjectPageEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pickerFor, setPickerFor] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [dragging, setDragging] = useState<{ activeId: string; overId: string | null } | null>(null)
  const [isFileOver, setIsFileOver] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const focusBlockRef = useRef<string | null>(null)
  // An upload takes a while, and the page can change meanwhile, so what happens after it reads the newest props here.
  const latest = useRef({ blocks, images, onChange })

  useLayoutEffect(() => {
    latest.current = { blocks, images, onChange }
  })
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // The Add bar wraps onto more lines in a narrow column. Block toolbars stick just below it, whatever its height.
  useLayoutEffect(() => {
    const root = rootRef.current
    const bar = barRef.current
    if (!root || !bar) {
      return
    }

    const publish = () => root.style.setProperty('--page-editor-bar-height', `${bar.offsetHeight}px`)
    publish()

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(publish)
    observer.observe(bar)
    return () => observer.disconnect()
  }, [])

  // Put the cursor in a block that was just added.
  useEffect(() => {
    const id = focusBlockRef.current
    if (!id) {
      return
    }

    focusBlockRef.current = null
    const element = [...(gridRef.current?.querySelectorAll<HTMLElement>('[data-block-id]') ?? [])].find(
      (entry) => entry.dataset.blockId === id,
    )
    element?.scrollIntoView({ block: 'nearest' })
    element
      ?.querySelector<HTMLElement>(
        '.page-block__body textarea, .page-block__heading, .page-block__card-title, .page-block__stages-title',
      )
      ?.focus()
  }, [blocks])

  /** The first edit to a page that still has the default arrangement saves that arrangement with it. */
  const emit = (patch: ProjectPagePatch, editKey: string) => {
    onChange(isArranged || patch.contentBlocks ? patch : { ...patch, contentBlocks: blocks }, editKey)
  }

  const setBlocks = (next: ProjectBlock[], editKey: string) => emit({ contentBlocks: next }, editKey)

  const updateBlock = (id: string, changes: Partial<ProjectBlock>, field: string) =>
    setBlocks(
      blocks.map((block) => (block.id === id ? ({ ...block, ...changes } as ProjectBlock) : block)),
      `block:${id}:${field}`,
    )

  const insertAfter = (anchorId: string | null, additions: ProjectBlock[]) => {
    const anchorIndex = anchorId ? blocks.findIndex((block) => block.id === anchorId) : -1
    const at = anchorIndex >= 0 ? anchorIndex + 1 : blocks.length
    return [...blocks.slice(0, at), ...additions, ...blocks.slice(at)]
  }

  const addBlock = (type: ProjectBlockType) => {
    const block = createProjectBlock(type)
    setBlocks(insertAfter(selectedId, [block]), `add:${block.id}`)
    setSelectedId(block.id)
    focusBlockRef.current = block.id
  }

  const moveBlock = (id: string, direction: -1 | 1) => {
    const from = blocks.findIndex((block) => block.id === id)
    const to = from + direction
    if (from >= 0 && to >= 0 && to < blocks.length) {
      setBlocks(arrayMove(blocks, from, to), `move:${id}:${to}`)
    }
  }

  const duplicateBlock = (id: string) => {
    const source = blocks.find((block) => block.id === id)
    if (!source) {
      return
    }

    const copy = { ...source, id: createProjectBlock(source.type).id }
    setBlocks(insertAfter(id, [copy]), `add:${copy.id}`)
    setSelectedId(copy.id)
  }

  const removeBlock = (id: string) => {
    setBlocks(
      blocks.filter((block) => block.id !== id),
      `remove:${id}`,
    )
    setSelectedId(null)
  }

  const imageBlockFor = (image: ProjectImage): ProjectImageBlock => ({
    ...(createProjectBlock('image') as ProjectImageBlock),
    imageId: image.id,
    alt: image.altText,
  })

  const upload = async (files: File[]): Promise<ProjectImage[]> => {
    if (files.length === 0) {
      return []
    }

    if (uploadBlockedReason) {
      setUploadError(uploadBlockedReason)
      return []
    }

    setIsUploading(true)
    setUploadError('')

    try {
      return await onUploadImages(files)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'The upload failed.')
      return []
    } finally {
      setIsUploading(false)
    }
  }

  /**
   * Uploads files and puts them on the page. With `fillBlockId` the first picture fills that picture block and the
   * others follow it. Otherwise they all become new blocks after `anchorId`, or at the end of the page.
   */
  const uploadOntoPage = async (files: File[], anchorId: string | null, fillBlockId: string | null = null) => {
    const added = await upload(files)
    if (added.length === 0) {
      return
    }

    // Wait until the owner has handed the new pictures back in `images`, so the blocks below can show them.
    const hasArrived = () => added.every((image) => latest.current.images.some((entry) => entry.id === image.id))
    for (let attempt = 0; attempt < 40 && !hasArrived(); attempt++) {
      await new Promise((resolve) => window.setTimeout(resolve, 50))
    }

    let next = latest.current.blocks
    let toInsert = added
    let anchor = anchorId

    if (fillBlockId && next.some((block) => block.id === fillBlockId && block.type === 'image')) {
      const [first, ...others] = added
      next = next.map((block) =>
        block.id === fillBlockId && block.type === 'image'
          ? { ...block, imageId: first.id, alt: block.alt || first.altText }
          : block,
      )
      toInsert = others
      anchor = fillBlockId
    }

    const additions = toInsert.map(imageBlockFor)
    const anchorIndex = anchor ? next.findIndex((block) => block.id === anchor) : -1
    const at = anchorIndex >= 0 ? anchorIndex + 1 : next.length
    latest.current.onChange(
      { contentBlocks: [...next.slice(0, at), ...additions, ...next.slice(at)] },
      `add:${additions[0]?.id ?? fillBlockId}`,
    )
    setSelectedId(fillBlockId ?? additions[0]?.id ?? null)
    setPickerFor(null)
  }

  const onResizeStart = (block: ProjectBlock) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    const grid = gridRef.current
    const element = event.currentTarget.parentElement
    if (!grid || !element) {
      return
    }

    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    const gap = Number.parseFloat(getComputedStyle(grid).columnGap) || 0
    const columnStep = (grid.getBoundingClientRect().width + gap) / 12
    const left = element.getBoundingClientRect().left
    let current = block.span

    const onMove = (moveEvent: PointerEvent) => {
      const columns = (moveEvent.clientX - left + gap) / columnStep
      const nearest = projectBlockSpans.reduce((best, span) =>
        Math.abs(span - columns) < Math.abs(best - columns) ? span : best,
      )
      if (nearest !== current) {
        current = nearest
        updateBlock(block.id, { span: nearest }, 'span')
      }
    }

    const onUp = () => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
    }

    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }

  const onDragStart = (event: DragStartEvent) => setDragging({ activeId: String(event.active.id), overId: null })
  const onDragOver = (event: DragOverEvent) =>
    setDragging({ activeId: String(event.active.id), overId: event.over ? String(event.over.id) : null })

  const onDragEnd = (event: DragEndEvent) => {
    setDragging(null)
    const from = blocks.findIndex((block) => block.id === event.active.id)
    const to = event.over ? blocks.findIndex((block) => block.id === event.over?.id) : -1
    if (from >= 0 && to >= 0 && from !== to) {
      setBlocks(arrayMove(blocks, from, to), `move:${String(event.active.id)}:${to}`)
    }
  }

  const draggingFrom = dragging ? blocks.findIndex((block) => block.id === dragging.activeId) : -1
  const dropSideFor = (blockId: string, index: number): 'before' | 'after' | null => {
    if (!dragging || dragging.overId !== blockId || dragging.activeId === blockId) {
      return null
    }
    return draggingFrom < index ? 'after' : 'before'
  }

  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer.types).includes('Files')

  const onFileDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(event)) {
      return
    }

    event.preventDefault()
    setIsFileOver(false)
    const under = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-block-id]')
    void uploadOntoPage(imageFiles(event.dataTransfer.files), under?.dataset.blockId ?? null)
  }

  const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const files = imageFiles(event.clipboardData.files)
    if (files.length > 0) {
      event.preventDefault()
      void uploadOntoPage(files, selectedId)
    }
  }

  const presentTypes = new Set(blocks.map((block) => block.type))
  const coverId = images[0]?.id ?? null

  const renderImage = (block: ProjectImageBlock, isSelected: boolean) => {
    const image = images.find((entry) => entry.id === block.imageId)

    if (!image || pickerFor === block.id) {
      return (
        <ImagePicker
          images={images}
          isUploading={isUploading}
          uploadBlockedReason={uploadBlockedReason}
          intro={
            image
              ? 'Choose the picture to show here.'
              : block.imageId !== null
                ? 'This picture is no longer among the project’s uploads. Choose another.'
                : images.length > 0
                  ? 'Choose a picture or GIF, or upload a new one.'
                  : 'Upload a picture or GIF. You can also drop a file onto the page.'
          }
          onChoose={(imageId) => {
            const chosen = images.find((entry) => entry.id === imageId)
            updateBlock(block.id, { imageId, alt: block.alt || chosen?.altText || '' }, 'image')
            setPickerFor(null)
          }}
          onUpload={(files) => void uploadOntoPage(files, block.id, block.id)}
          onCancel={image ? () => setPickerFor(null) : undefined}
        />
      )
    }

    return (
      <>
        <figure>
          <img src={image.url} alt={block.alt || image.altText || title} />
          {(isSelected || block.caption) && (
            <input
              type="text"
              className="page-block__field page-block__caption"
              value={block.caption}
              maxLength={projectBlockLimits.caption}
              placeholder="Add a caption (optional)"
              aria-label="Caption"
              onChange={(event) => updateBlock(block.id, { caption: event.target.value }, 'caption')}
            />
          )}
        </figure>
        {isSelected && (
          <div className="page-block__options">
            <label>
              Description for people who cannot see the picture
              <input
                type="text"
                value={block.alt}
                maxLength={projectBlockLimits.alt}
                placeholder="What the picture shows"
                onChange={(event) => updateBlock(block.id, { alt: event.target.value }, 'alt')}
              />
            </label>
            <div className="page-block__option-actions">
              <button className="button" type="button" onClick={() => setPickerFor(block.id)}>
                Change the picture
              </button>
              {onMakeCover && image.id !== coverId && (
                <button className="button" type="button" onClick={() => onMakeCover(image.id)}>
                  Use on the project card
                </button>
              )}
              {image.id === coverId && <span className="page-editor__hint">This is the picture on the project card.</span>}
            </div>
          </div>
        )}
      </>
    )
  }

  const renderCard = (block: ProjectCardBlock, isSelected: boolean) => {
    const typedAddress = block.linkUrl.trim()
    const hasLink = block.linkLabel.trim() !== '' && projectCardLink(block) !== ''

    return (
      <>
        <input
          type="text"
          className="page-block__field page-block__card-title"
          value={block.title}
          maxLength={projectBlockLimits.cardTitle}
          placeholder="Card title"
          aria-label="Card title"
          onChange={(event) => updateBlock(block.id, { title: event.target.value }, 'title')}
        />
        <GrowingTextarea
          className="page-block__card-text"
          value={block.text}
          maxLength={projectBlockLimits.cardText}
          placeholder="What this card says"
          label="Card text"
          onChange={(text) => updateBlock(block.id, { text }, 'text')}
        />
        {hasLink && !isSelected && (
          <div className="project-links">
            <span className="page-block__link-preview">{block.linkLabel.trim()}</span>
          </div>
        )}
        {isSelected && (
          <div className="page-block__options">
            <div className="page-block__link-row">
              <label>
                Button text (optional)
                <input
                  type="text"
                  value={block.linkLabel}
                  maxLength={projectBlockLimits.linkLabel}
                  onChange={(event) => updateBlock(block.id, { linkLabel: event.target.value }, 'linkLabel')}
                />
              </label>
              <label>
                Button address
                <input
                  type="text"
                  inputMode="url"
                  value={block.linkUrl}
                  maxLength={projectBlockLimits.linkUrl}
                  placeholder="/status or https://…"
                  onChange={(event) => updateBlock(block.id, { linkUrl: event.target.value }, 'linkUrl')}
                />
              </label>
            </div>
            {typedAddress !== '' && projectCardLink(block) === '' && (
              <p className="page-editor__hint">
                The address has to start with / for a page on this site, or with https://. Until then the button is left off.
              </p>
            )}
          </div>
        )}
      </>
    )
  }

  const renderStages = (block: ProjectStagesBlock, isSelected: boolean) => {
    const updateStage = (stageId: string, changes: Partial<ProjectStage>, field: string) =>
      updateBlock(
        block.id,
        { stages: block.stages.map((stage) => (stage.id === stageId ? { ...stage, ...changes } : stage)) },
        `stage:${stageId}:${field}`,
      )

    const removeStage = (index: number) => {
      const stages = block.stages.filter((_, at) => at !== index)
      // The stage marked as now keeps its mark when one before it goes.
      const current = index < block.current ? block.current - 1 : Math.min(block.current, stages.length - 1)
      updateBlock(block.id, { stages, current }, 'stages')
    }

    const canAdd = block.stages.length < projectBlockLimits.stages

    return (
      <>
        <GrowingTextarea
          className="stage-map__title page-block__stages-title"
          value={block.title}
          maxLength={projectBlockLimits.stagesTitle}
          placeholder="Title (optional)"
          label="Stage map title"
          onChange={(title) => updateBlock(block.id, { title: oneLine(title) }, 'title')}
        />
        <ol className="stage-map" style={{ '--stage-count': block.stages.length } as CSSProperties}>
          {block.stages.map((stage, index) => {
            const state = projectStageState(index, block.current)
            const name = stage.label.trim() || `stage ${index + 1}`
            return (
              <li key={stage.id} className={`stage-map__stage stage-map__stage--${state}`}>
                <button
                  type="button"
                  className="stage-map__marker page-block__stage-marker"
                  aria-pressed={state === 'now'}
                  aria-label={`Mark ${name} as where the project is now`}
                  title="Mark as where the project is now"
                  onClick={() => updateBlock(block.id, { current: index }, 'current')}
                />
                <span className="stage-map__step">
                  {String(index + 1).padStart(2, '0')} · {projectStageStateLabels[state]}
                </span>
                <GrowingTextarea
                  className="stage-map__label"
                  value={stage.label}
                  maxLength={projectBlockLimits.stageLabel}
                  placeholder="Stage name"
                  label={`Name of stage ${index + 1}`}
                  onChange={(label) => updateStage(stage.id, { label: oneLine(label) }, 'label')}
                />
                <GrowingTextarea
                  className="stage-map__note"
                  value={stage.note}
                  maxLength={projectBlockLimits.stageNote}
                  placeholder={isSelected ? 'A note (optional)' : ''}
                  label={`Note for stage ${index + 1}`}
                  onChange={(note) => updateStage(stage.id, { note }, 'note')}
                />
                {isSelected && block.stages.length > 2 && (
                  <button type="button" className="page-block__stage-remove" onClick={() => removeStage(index)}>
                    Remove stage
                  </button>
                )}
              </li>
            )
          })}
        </ol>
        {isSelected && (
          <div className="page-block__options">
            <p className="page-editor__hint">
              Click a stage's dot to mark where the project is now. The stages before it show as done.
            </p>
            <div className="page-block__option-actions">
              <button
                className="button"
                type="button"
                disabled={!canAdd}
                title={canAdd ? undefined : `A stage map holds up to ${projectBlockLimits.stages} stages`}
                onClick={() => updateBlock(block.id, { stages: [...block.stages, createProjectStage()] }, 'stages')}
              >
                Add a stage
              </button>
            </div>
          </div>
        )}
      </>
    )
  }

  const renderBody = (block: ProjectBlock, isSelected: boolean): ReactNode => {
    switch (block.type) {
      case 'summary':
        return (
          <>
            <GrowingTextarea
              className="project-detail-modal__summary"
              value={summary}
              maxLength={2000}
              placeholder="A short summary of the project"
              label="Summary"
              onChange={(value) => emit({ summary: value }, 'summary')}
            />
            {isSelected && <p className="page-editor__hint">The project card in the grid shows this same text.</p>}
          </>
        )
      case 'text':
        return (
          <GrowingTextarea
            className="page-block__text"
            value={block.text}
            maxLength={projectBlockLimits.text}
            placeholder="Write here. Leave an empty line between paragraphs."
            label="Text"
            onChange={(text) => updateBlock(block.id, { text }, 'text')}
          />
        )
      case 'heading':
        return (
          <input
            type="text"
            className="page-block__field page-block__heading"
            value={block.text}
            maxLength={projectBlockLimits.heading}
            placeholder="Heading"
            aria-label="Heading"
            onChange={(event) => updateBlock(block.id, { text: event.target.value }, 'text')}
          />
        )
      case 'image':
        return renderImage(block, isSelected)
      case 'card':
        return renderCard(block, isSelected)
      case 'stages':
        return renderStages(block, isSelected)
      case 'tags':
        return <TagsEditor tech={tech} isSelected={isSelected} onChange={(next) => emit({ tech: next }, 'tech')} />
      case 'links':
        return <LinksEditor links={links} isSelected={isSelected} onChange={(next) => emit({ links: next }, 'links')} />
      case 'divider':
        return <hr />
    }
  }

  return (
    <div ref={rootRef} className="page-editor" onPaste={onPaste}>
      <div ref={barRef} className="page-editor__bar" role="toolbar" aria-label="Add to the page">
        <span className="page-editor__bar-label">Add</span>
        {addChoices.map((choice) => {
          const isTaken = singletonProjectBlockTypes.includes(choice.type) && presentTypes.has(choice.type)
          return (
            <button
              key={choice.type}
              type="button"
              className="button"
              disabled={isTaken}
              title={isTaken ? 'Already on the page' : undefined}
              onClick={() => addBlock(choice.type)}
            >
              {choice.label}
            </button>
          )
        })}
        <span className="page-editor__bar-note">
          {selectedId ? 'New blocks go after the selected one.' : 'New blocks go at the end of the page.'}
        </span>
      </div>

      <div
        className={`page-editor__page${isFileOver ? ' is-file-over' : ''}`}
        onDragOver={(event) => {
          if (hasFiles(event)) {
            event.preventDefault()
            setIsFileOver(true)
          }
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setIsFileOver(false)
          }
        }}
        onDrop={onFileDrop}
        onPointerDown={(event) => {
          if (!(event.target as HTMLElement).closest('[data-block-id]')) {
            setSelectedId(null)
          }
        }}
      >
        <p className="eyebrow">{eyebrow}</p>
        <GrowingTextarea
          className="page-editor__title"
          value={title}
          placeholder="Project title"
          label="Project title"
          onChange={(value) => emit({ title: oneLine(value) }, 'title')}
        />

        <DndContext
          sensors={sensors}
          collisionDetection={blockUnderPointer}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDragging(null)}
        >
          <SortableContext items={blocks.map((block) => block.id)} strategy={noShuffle}>
            <div ref={gridRef} className="project-blocks page-editor__blocks">
              {blocks.map((block, index) => {
                const isSelected = selectedId === block.id
                return (
                  <EditableBlock
                    key={block.id}
                    block={block}
                    index={index}
                    count={blocks.length}
                    isSelected={isSelected}
                    dropSide={dropSideFor(block.id, index)}
                    onSelect={() => setSelectedId(block.id)}
                    onSpan={(span) => updateBlock(block.id, { span }, 'span')}
                    onMove={(direction) => moveBlock(block.id, direction)}
                    onDuplicate={singletonProjectBlockTypes.includes(block.type) ? null : () => duplicateBlock(block.id)}
                    onRemove={() => removeBlock(block.id)}
                    onResizeStart={onResizeStart(block)}
                  >
                    {renderBody(block, isSelected)}
                  </EditableBlock>
                )
              })}
            </div>
          </SortableContext>
        </DndContext>

        {blocks.length === 0 && (
          <p className="page-editor__empty">This page is empty. Use the Add buttons above to put something on it.</p>
        )}
      </div>

      <section className="page-editor__library" aria-label="Pictures and GIFs for this project">
        <div className="page-editor__library-head">
          <div>
            <h3>Pictures and GIFs for this project</h3>
            <p className="page-editor__hint">
              Click one to put it on the page, or drop files from your computer anywhere on the page.
            </p>
          </div>
          {!uploadBlockedReason && (
            <label className={`button page-editor__upload${isUploading ? ' button--disabled' : ''}`}>
              {isUploading ? 'Uploading…' : 'Upload'}
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={isUploading}
                onChange={(event) => {
                  void upload(imageFiles(event.target.files))
                  event.target.value = ''
                }}
              />
            </label>
          )}
        </div>
        {uploadBlockedReason && <p className="page-editor__hint">{uploadBlockedReason}</p>}
        {uploadError && (
          <p className="page-editor__error" role="alert">
            {uploadError}
          </p>
        )}
        {images.length > 0 ? (
          <div className="page-editor__thumbs">
            {images.map((image, index) => {
              const uses = blocks.filter((block) => block.type === 'image' && block.imageId === image.id).length
              return (
                <button
                  key={image.id}
                  type="button"
                  title="Put this picture on the page"
                  onClick={() => {
                    const block = imageBlockFor(image)
                    setBlocks(insertAfter(selectedId, [block]), `add:${block.id}`)
                    setSelectedId(block.id)
                    focusBlockRef.current = block.id
                  }}
                >
                  <img src={image.url} alt={image.altText || `Picture ${index + 1}`} loading="lazy" />
                  <span>
                    {index === 0 ? 'Card picture · ' : ''}
                    {uses === 0 ? 'not on the page' : uses === 1 ? 'on the page' : `on the page ${uses} times`}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          !uploadBlockedReason && <p className="page-editor__hint">No pictures uploaded yet.</p>
        )}
      </section>
    </div>
  )
}
