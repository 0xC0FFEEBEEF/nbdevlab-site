import type { ReactNode } from 'react'

export type PublicRenderMode = 'public' | 'builder'

export interface BuilderMetadata {
  docKey?: string
  nodeId?: string
  nodeType?: string
  region?: string
  label?: string
  bindingKind?: string
  bindingId?: string
}

export interface PublicBuilderContext {
  mode?: PublicRenderMode
  onNavigate?: (target: string) => void
  onAction?: (action: string, payload?: unknown) => void
  meta?: BuilderMetadata
  wrapRegion?: (meta: BuilderMetadata, content: ReactNode) => ReactNode
}

export function builderDataAttrs(meta?: BuilderMetadata): Record<string, string> {
  if (!meta) {
    return {}
  }

  const attrs: Record<string, string> = {}

  if (meta.nodeId) {
    attrs['data-builder-node-id'] = meta.nodeId
  }
  if (meta.docKey) {
    attrs['data-builder-doc-key'] = meta.docKey
  }
  if (meta.nodeType) {
    attrs['data-builder-node-type'] = meta.nodeType
  }
  if (meta.region) {
    attrs['data-builder-region'] = meta.region
  }
  if (meta.label) {
    attrs['data-builder-label'] = meta.label
  }
  if (meta.bindingKind) {
    attrs['data-builder-binding-kind'] = meta.bindingKind
  }
  if (meta.bindingId) {
    attrs['data-builder-binding-id'] = meta.bindingId
  }

  return attrs
}
