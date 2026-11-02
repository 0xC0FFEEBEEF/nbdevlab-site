import type { CSSProperties } from 'react'
import type { BuilderNode } from '../../shared/builder'
import { builderDataAttrs, type PublicBuilderContext } from '../lib/publicBuilder'
import {
  getBuilderPresentationSurfaceStyle,
  getBuilderPresentationTextStyle,
} from '../lib/builderPresentation'

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function renderEmbed(node: BuilderNode) {
  const provider = readString(node.content?.provider) || 'embed'
  const title = readString(node.content?.title) || node.title || 'Embedded content'
  const url = readString(node.content?.url)

  return (
    <article className="builder-block builder-block--embed">
      <p className="eyebrow">{provider}</p>
      <h3>{title}</h3>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          {url}
        </a>
      ) : (
        <p>No embed URL configured yet.</p>
      )}
    </article>
  )
}

export function BuilderNodeContent({
  node,
  builder,
}: {
  node: BuilderNode
  builder?: PublicBuilderContext
}) {
  const attrs = builderDataAttrs({
    docKey: builder?.meta?.docKey,
    nodeId: node.id,
    nodeType: node.type,
    region: builder?.meta?.region,
  })

  const style: CSSProperties = {
    ...getBuilderPresentationSurfaceStyle(node.presentation),
    ...getBuilderPresentationTextStyle(node.presentation),
  }

  if (node.presentation?.visible === false) {
    return null
  }

  if (node.type === 'text') {
    return (
      <p className="builder-block builder-block--text" style={style} {...attrs}>
        {readString(node.content?.text) || node.title || 'Untitled text'}
      </p>
    )
  }

  if (node.type === 'image/media') {
    const src = readString(node.content?.src)
    const alt = readString(node.content?.alt)
    const caption = readString(node.content?.caption)
    return (
      <figure className="builder-block builder-block--media" style={style} {...attrs}>
        {src ? (
          <img
            src={src}
            alt={alt}
            style={{ objectFit: node.presentation?.imageFit ?? 'cover' }}
          />
        ) : (
          <div className="builder-block__empty">No image selected</div>
        )}
        {caption && <figcaption>{caption}</figcaption>}
      </figure>
    )
  }

  if (node.type === 'button/link') {
    const href = readString(node.content?.href)
    const label = readString(node.content?.label) || node.title || 'Open link'
    return (
      <div className="builder-block builder-block--link" style={style} {...attrs}>
        {builder?.onNavigate && href ? (
          <button type="button" className="button" onClick={() => builder.onNavigate?.(href)}>
            {label}
          </button>
        ) : href ? (
          <a className="button" href={href}>
            {label}
          </a>
        ) : (
          <span className="button">{label}</span>
        )}
      </div>
    )
  }

  if (node.type === 'spacer') {
    const height = readNumber(node.content?.height) ?? 24
    return <div className="builder-block builder-block--spacer" style={{ height }} {...attrs} />
  }

  if (node.type === 'embed') {
    return (
      <div style={style} {...attrs}>
        {renderEmbed(node)}
      </div>
    )
  }

  if (node.type === 'dynamicWidget') {
    return (
      <article className="builder-block builder-block--widget" style={style} {...attrs}>
        <p className="eyebrow">Dynamic Widget</p>
        <h3>{node.title || readString(node.content?.source) || 'Live widget'}</h3>
        <p>{readString(node.settings?.note) || 'This region is wired for live status or site data.'}</p>
      </article>
    )
  }

  if (node.type === 'navItem') {
    const label = readString(node.content?.label) || node.title || 'Nav item'
    return (
      <span className="builder-block builder-block--nav-item" style={style} {...attrs}>
        {label}
      </span>
    )
  }

  const childContent =
    node.children?.map((child) => <BuilderNodeContent key={child.id} node={child} builder={builder} />) ?? []

  if (node.type === 'collection') {
    return (
      <div className="builder-block builder-block--collection" style={style} {...attrs}>
        {node.title && <p className="builder-block__title">{node.title}</p>}
        <div className="builder-block__collection">{childContent}</div>
      </div>
    )
  }

  if (node.type === 'section') {
    return (
      <section className="builder-block builder-block--section" style={style} {...attrs}>
        {node.title && <h2>{node.title}</h2>}
        {childContent}
      </section>
    )
  }

  return (
    <article className="builder-block builder-block--box" style={style} {...attrs}>
      {node.title && <h3>{node.title}</h3>}
      {readString(node.content?.text) && <p>{readString(node.content?.text)}</p>}
      {childContent}
    </article>
  )
}
