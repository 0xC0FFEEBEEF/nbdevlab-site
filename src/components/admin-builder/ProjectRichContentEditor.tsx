import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  createProjectDetailCard,
  createProjectLink,
  projectLinkKinds,
  type ProjectDetailCard,
  type ProjectLink,
} from '../../../shared/projectContent'

interface ProjectRichContentEditorProps {
  links: ProjectLink[]
  detailCards: ProjectDetailCard[]
  onLinksChange: (links: ProjectLink[]) => void
  onDetailCardsChange: (cards: ProjectDetailCard[]) => void
}

type DragMode = 'move' | 'resize'

interface DragState {
  cardId: string
  pointerId: number
  mode: DragMode
  originX: number
  originY: number
  startX: number
  startY: number
  startWidth: number
  startHeight: number
  boardWidth: number
  boardHeight: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function sanitizeNumberInput(value: string, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function formatLinkKind(kind: ProjectLink['kind']): string {
  if (kind === 'repo') {
    return 'Repository'
  }

  if (kind === 'docs') {
    return 'Docs'
  }

  return `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`
}

export function ProjectRichContentEditor({
  links,
  detailCards,
  onLinksChange,
  onDetailCardsChange,
}: ProjectRichContentEditorProps) {
  const boardRef = useRef<HTMLDivElement | null>(null)
  const detailCardsRef = useRef(detailCards)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(detailCards[0]?.id ?? null)
  const [dragState, setDragState] = useState<DragState | null>(null)

  useEffect(() => {
    detailCardsRef.current = detailCards
  }, [detailCards])

  useEffect(() => {
    if (detailCards.length === 0) {
      setSelectedCardId(null)
      return
    }

    if (!selectedCardId || !detailCards.some((card) => card.id === selectedCardId)) {
      setSelectedCardId(detailCards[0]?.id ?? null)
    }
  }, [detailCards, selectedCardId])

  useEffect(() => {
    if (!dragState) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) {
        return
      }

      const deltaXPercent = ((event.clientX - dragState.originX) / dragState.boardWidth) * 100
      const deltaYPercent = ((event.clientY - dragState.originY) / dragState.boardHeight) * 100

      onDetailCardsChange(
        detailCardsRef.current.map((card) => {
          if (card.id !== dragState.cardId) {
            return card
          }

          if (dragState.mode === 'move') {
            return {
              ...card,
              x: clamp(dragState.startX + deltaXPercent, 0, 100 - card.width),
              y: clamp(dragState.startY + deltaYPercent, 0, 100 - card.height),
            }
          }

          return {
            ...card,
            width: clamp(dragState.startWidth + deltaXPercent, 18, 100 - dragState.startX),
            height: clamp(dragState.startHeight + deltaYPercent, 18, 100 - dragState.startY),
          }
        }),
      )
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId === dragState.pointerId) {
        setDragState(null)
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [dragState, onDetailCardsChange])

  const selectedCard = useMemo(
    () => detailCards.find((card) => card.id === selectedCardId) ?? null,
    [detailCards, selectedCardId],
  )

  const boardHeight = useMemo(() => {
    const maxBottom = detailCards.reduce((max, card) => Math.max(max, card.y + card.height), 74)
    return `${clamp(maxBottom * 4.3, 320, 540)}px`
  }, [detailCards])

  const updateSelectedCard = (updater: (card: ProjectDetailCard) => ProjectDetailCard) => {
    if (!selectedCardId) {
      return
    }

    onDetailCardsChange(detailCards.map((card) => (card.id === selectedCardId ? updater(card) : card)))
  }

  const startDrag = (
    event: ReactPointerEvent<HTMLElement>,
    card: ProjectDetailCard,
    mode: DragMode,
  ) => {
    const board = boardRef.current
    if (!board) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    setSelectedCardId(card.id)

    const rect = board.getBoundingClientRect()
    setDragState({
      cardId: card.id,
      pointerId: event.pointerId,
      mode,
      originX: event.clientX,
      originY: event.clientY,
      startX: card.x,
      startY: card.y,
      startWidth: card.width,
      startHeight: card.height,
      boardWidth: Math.max(rect.width, 1),
      boardHeight: Math.max(rect.height, 1),
    })
  }

  const addLink = () => {
    onLinksChange([...links, createProjectLink()])
  }

  const updateLink = (linkId: string, updater: (link: ProjectLink) => ProjectLink) => {
    onLinksChange(links.map((link) => (link.id === linkId ? updater(link) : link)))
  }

  const removeLink = (linkId: string) => {
    onLinksChange(links.filter((link) => link.id !== linkId))
  }

  const addDetailCard = () => {
    const nextCard = createProjectDetailCard()
    onDetailCardsChange([...detailCards, nextCard])
    setSelectedCardId(nextCard.id)
  }

  const duplicateSelectedCard = () => {
    if (!selectedCard) {
      return
    }

    const nextCard = createProjectDetailCard({
      ...selectedCard,
      x: clamp(selectedCard.x + 4, 0, 100 - selectedCard.width),
      y: clamp(selectedCard.y + 4, 0, 100 - selectedCard.height),
    })
    onDetailCardsChange([...detailCards, nextCard])
    setSelectedCardId(nextCard.id)
  }

  const removeSelectedCard = () => {
    if (!selectedCard) {
      return
    }

    onDetailCardsChange(detailCards.filter((card) => card.id !== selectedCard.id))
  }

  return (
    <div className="project-rich-editor">
      <section className="project-rich-editor__section">
        <div className="admin-builder__section-head">
          <strong>Links</strong>
          <p>Add as many destination URLs as you want for this project.</p>
        </div>

        <div className="project-rich-editor__links">
          {links.length === 0 && <p className="admin-builder__empty">No project links yet.</p>}
          {links.map((link) => (
            <div key={link.id} className="project-rich-editor__link-row">
              <label>
                Label
                <input
                  type="text"
                  value={link.label}
                  onChange={(event) =>
                    updateLink(link.id, (current) => ({ ...current, label: event.target.value }))
                  }
                />
              </label>
              <label>
                URL
                <input
                  type="url"
                  value={link.url}
                  onChange={(event) =>
                    updateLink(link.id, (current) => ({ ...current, url: event.target.value }))
                  }
                />
              </label>
              <label>
                Type
                <select
                  value={link.kind}
                  onChange={(event) =>
                    updateLink(link.id, (current) => ({
                      ...current,
                      kind: event.target.value as ProjectLink['kind'],
                    }))
                  }
                >
                  {projectLinkKinds.map((kind) => (
                    <option key={kind} value={kind}>
                      {formatLinkKind(kind)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="button" onClick={() => removeLink(link.id)}>
                Remove Link
              </button>
            </div>
          ))}
          <button type="button" className="button" onClick={addLink}>
            Add Link
          </button>
        </div>
      </section>

      <section className="project-rich-editor__section">
        <div className="project-rich-editor__toolbar">
          <div className="admin-builder__section-head">
            <strong>Embedded Detail Cards</strong>
            <p>These appear inside the project pop-out and can be dragged and resized freely.</p>
          </div>
          <div className="project-rich-editor__toolbar-actions">
            <button type="button" className="button" onClick={addDetailCard}>
              Add Card
            </button>
            <button type="button" className="button" onClick={duplicateSelectedCard} disabled={!selectedCard}>
              Duplicate
            </button>
            <button type="button" className="button" onClick={removeSelectedCard} disabled={!selectedCard}>
              Delete
            </button>
          </div>
        </div>

        <div className="project-rich-editor__layout">
          <div
            ref={boardRef}
            className="project-rich-editor__board"
            style={{ minHeight: boardHeight }}
          >
            {detailCards.length === 0 && (
              <div className="project-rich-editor__board-empty">
                <p className="admin-builder__empty">Add a detail card to start laying out the project pop-out.</p>
              </div>
            )}

            {detailCards.map((card) => (
              <button
                key={card.id}
                type="button"
                className={[
                  'project-rich-editor__board-card',
                  selectedCardId === card.id ? 'is-selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{
                  left: `${card.x}%`,
                  top: `${card.y}%`,
                  width: `${card.width}%`,
                  height: `${card.height}%`,
                }}
                onClick={() => setSelectedCardId(card.id)}
                onPointerDown={(event) => startDrag(event, card, 'move')}
              >
                <span className="eyebrow">Detail Card</span>
                <strong>{card.title || 'Untitled card'}</strong>
                <p>{card.body || 'Add content for this embedded card.'}</p>
                {card.linkLabel && card.linkUrl && <em>{card.linkLabel}</em>}
                <span
                  className="project-rich-editor__resize-handle"
                  onPointerDown={(event) => startDrag(event, card, 'resize')}
                />
              </button>
            ))}
          </div>

          {selectedCard && (
            <div className="project-rich-editor__card-fields">
              <label>
                Card Title
                <input
                  type="text"
                  value={selectedCard.title}
                  onChange={(event) =>
                    updateSelectedCard((card) => ({ ...card, title: event.target.value }))
                  }
                />
              </label>
              <label>
                Card Body
                <textarea
                  rows={5}
                  value={selectedCard.body}
                  onChange={(event) =>
                    updateSelectedCard((card) => ({ ...card, body: event.target.value }))
                  }
                />
              </label>
              <div className="admin-builder__field-grid">
                <label>
                  Link Label
                  <input
                    type="text"
                    value={selectedCard.linkLabel}
                    onChange={(event) =>
                      updateSelectedCard((card) => ({ ...card, linkLabel: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Link URL
                  <input
                    type="url"
                    value={selectedCard.linkUrl}
                    onChange={(event) =>
                      updateSelectedCard((card) => ({ ...card, linkUrl: event.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="admin-builder__field-grid">
                <label>
                  X
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={Math.round(selectedCard.x)}
                    onChange={(event) =>
                      updateSelectedCard((card) => ({
                        ...card,
                        x: clamp(
                          sanitizeNumberInput(event.target.value, card.x),
                          0,
                          100 - card.width,
                        ),
                      }))
                    }
                  />
                </label>
                <label>
                  Y
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={Math.round(selectedCard.y)}
                    onChange={(event) =>
                      updateSelectedCard((card) => ({
                        ...card,
                        y: clamp(
                          sanitizeNumberInput(event.target.value, card.y),
                          0,
                          100 - card.height,
                        ),
                      }))
                    }
                  />
                </label>
                <label>
                  Width
                  <input
                    type="number"
                    min="18"
                    max="100"
                    step="1"
                    value={Math.round(selectedCard.width)}
                    onChange={(event) =>
                      updateSelectedCard((card) => ({
                        ...card,
                        width: clamp(
                          sanitizeNumberInput(event.target.value, card.width),
                          18,
                          100 - card.x,
                        ),
                      }))
                    }
                  />
                </label>
                <label>
                  Height
                  <input
                    type="number"
                    min="18"
                    max="100"
                    step="1"
                    value={Math.round(selectedCard.height)}
                    onChange={(event) =>
                      updateSelectedCard((card) => ({
                        ...card,
                        height: clamp(
                          sanitizeNumberInput(event.target.value, card.height),
                          18,
                          100 - card.y,
                        ),
                      }))
                    }
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
