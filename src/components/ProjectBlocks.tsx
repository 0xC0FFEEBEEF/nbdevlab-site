import { Link } from 'react-router-dom'
import type { CSSProperties } from 'react'
import {
  projectBlockClassName,
  projectCardLink,
  projectStageState,
  projectStageStateLabels,
  splitProjectParagraphs,
  type ProjectBlock,
  type ProjectStagesBlock,
} from '../../shared/projectBlocks'
import type { ProjectLink } from '../../shared/projectContent'
import type { ProjectImage } from '../types/models'

function BlockLink({ href, label, className }: { href: string; label: string; className?: string }) {
  if (href.startsWith('/')) {
    return (
      <Link className={className} to={href}>
        {label}
      </Link>
    )
  }

  const opensNewTab = /^https?:/i.test(href)

  return (
    <a
      className={className}
      href={href}
      target={opensNewTab ? '_blank' : undefined}
      rel={opensNewTab ? 'noreferrer' : undefined}
    >
      {label}
    </a>
  )
}

function StageMap({ block, className }: { block: ProjectStagesBlock; className: string }) {
  // A stage with nothing typed in it is left out, but every stage keeps its place against the current one.
  const shown = block.stages
    .map((stage, index) => ({ stage, index }))
    .filter(({ stage }) => stage.label.trim() || stage.note.trim())
  const title = block.title.trim()

  if (shown.length === 0) {
    return null
  }

  return (
    <section className={className} aria-label={title || 'Stage map'}>
      {title && <h3 className="stage-map__title">{title}</h3>}
      <ol className="stage-map" style={{ '--stage-count': shown.length } as CSSProperties}>
        {shown.map(({ stage, index }, position) => {
          const state = projectStageState(index, block.current)
          return (
            <li
              key={stage.id}
              className={`stage-map__stage stage-map__stage--${state}`}
              aria-current={state === 'now' ? 'step' : undefined}
            >
              <span className="stage-map__marker" aria-hidden="true" />
              <span className="stage-map__step">
                {String(position + 1).padStart(2, '0')} · {projectStageStateLabels[state]}
              </span>
              {stage.label.trim() && <strong className="stage-map__label">{stage.label.trim()}</strong>}
              {stage.note.trim() && <p className="stage-map__note">{stage.note.trim()}</p>}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** A project's stage map in one line, for its card: a dot per stage, then where it is now. */
export function ProjectCardStages({ block }: { block: ProjectStagesBlock }) {
  const shown = block.stages
    .map((stage, index) => ({ stage, index }))
    .filter(({ stage }) => stage.label.trim())
  const position = shown.findIndex(({ index }) => index === block.current)
  const now = block.stages[block.current]?.label.trim() || 'Not named yet'
  const count = position >= 0 ? `${position + 1}/${shown.length}` : ''

  return (
    <div className="project-card__stages">
      <span className="project-card__stage-rail" aria-hidden="true">
        {shown.map(({ stage, index }) => (
          <span key={stage.id} className={`project-card__stage project-card__stage--${projectStageState(index, block.current)}`} />
        ))}
      </span>
      <span className="project-card__stage-text">
        <span className="visually-hidden">Stage </span>
        {count && <span className="project-card__stage-count">{count}</span>} {now}
      </span>
    </div>
  )
}

interface ProjectBlocksViewProps {
  blocks: ProjectBlock[]
  title: string
  summary: string
  tech: string[]
  links: ProjectLink[]
  images: ProjectImage[]
}

/** A project page as visitors see it. Blocks with nothing to show are left out. */
export function ProjectBlocksView({ blocks, title, summary, tech, links, images }: ProjectBlocksViewProps) {
  return (
    <div className="project-blocks">
      {blocks.map((block) => {
        const className = projectBlockClassName(block)

        switch (block.type) {
          case 'summary':
            return summary.trim() ? (
              <p key={block.id} className={`${className} project-detail-modal__summary`}>
                {summary}
              </p>
            ) : null

          case 'text': {
            const paragraphs = splitProjectParagraphs(block.text)
            return paragraphs.length > 0 ? (
              <div key={block.id} className={className}>
                {paragraphs.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            ) : null
          }

          case 'heading':
            return block.text.trim() ? (
              <h3 key={block.id} className={className}>
                {block.text.trim()}
              </h3>
            ) : null

          case 'image': {
            const image = images.find((entry) => entry.id === block.imageId)
            return image ? (
              <figure key={block.id} className={className}>
                <img src={image.url} alt={block.alt || image.altText || title} loading="lazy" />
                {block.caption.trim() && <figcaption>{block.caption.trim()}</figcaption>}
              </figure>
            ) : null
          }

          case 'card': {
            const href = projectCardLink(block)
            const paragraphs = splitProjectParagraphs(block.text)
            return block.title.trim() || paragraphs.length > 0 ? (
              <article key={block.id} className={className}>
                {block.title.trim() && <h3>{block.title.trim()}</h3>}
                {paragraphs.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
                {href && block.linkLabel.trim() && (
                  <div className="project-links">
                    <BlockLink href={href} label={block.linkLabel.trim()} />
                  </div>
                )}
              </article>
            ) : null
          }

          case 'stages':
            return <StageMap key={block.id} block={block} className={className} />

          case 'tags':
            return tech.length > 0 ? (
              <div key={block.id} className={`${className} project-tags`}>
                {tech.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            ) : null

          case 'links':
            return links.length > 0 ? (
              <div key={block.id} className={`${className} project-links`}>
                {links.map((link) => (
                  <a key={link.id} href={link.url} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                ))}
              </div>
            ) : null

          case 'divider':
            return <hr key={block.id} className={className} />
        }
      })}
    </div>
  )
}
