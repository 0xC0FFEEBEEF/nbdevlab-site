import type { CSSProperties } from 'react'
import type { BuilderDocument, BuilderPresentation } from '../../shared/builder'
import { getBuilderNode } from './builderDocuments'

export const builderFontSizeOptions: Array<{
  value: NonNullable<BuilderPresentation['fontSize']>
  label: string
}> = [
  { value: 'xs', label: 'XS' },
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Medium' },
  { value: 'lg', label: 'Large' },
  { value: 'xl', label: 'XL' },
  { value: 'display', label: 'Display' },
]

export const builderFontWeightOptions: Array<{
  value: NonNullable<BuilderPresentation['fontWeight']>
  label: string
}> = [
  { value: 'regular', label: 'Regular' },
  { value: 'medium', label: 'Medium' },
  { value: 'semibold', label: 'Semibold' },
  { value: 'bold', label: 'Bold' },
]

export const builderLineHeightOptions: Array<{
  value: NonNullable<BuilderPresentation['lineHeight']>
  label: string
}> = [
  { value: 'tight', label: 'Tight' },
  { value: 'normal', label: 'Normal' },
  { value: 'relaxed', label: 'Relaxed' },
]

export const builderLetterSpacingOptions: Array<{
  value: NonNullable<BuilderPresentation['letterSpacing']>
  label: string
}> = [
  { value: 'tight', label: 'Tight' },
  { value: 'normal', label: 'Normal' },
  { value: 'wide', label: 'Wide' },
  { value: 'eyebrow', label: 'Eyebrow' },
]

export const builderTextTransformOptions: Array<{
  value: NonNullable<BuilderPresentation['textTransform']>
  label: string
}> = [
  { value: 'none', label: 'None' },
  { value: 'uppercase', label: 'Uppercase' },
]

const fontSizeMap: Record<NonNullable<BuilderPresentation['fontSize']>, string> = {
  xs: '0.78rem',
  sm: '0.95rem',
  md: '1.1rem',
  lg: '1.5rem',
  xl: '2rem',
  display: 'clamp(3rem, 7vw, 6rem)',
}

const fontWeightMap: Record<NonNullable<BuilderPresentation['fontWeight']>, string> = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
}

const lineHeightMap: Record<NonNullable<BuilderPresentation['lineHeight']>, string> = {
  tight: '1.05',
  normal: '1.35',
  relaxed: '1.6',
}

const letterSpacingMap: Record<NonNullable<BuilderPresentation['letterSpacing']>, string> = {
  tight: '-0.04em',
  normal: '0em',
  wide: '0.08em',
  eyebrow: '0.16em',
}

type BuilderStyleObject = CSSProperties & Record<string, string>

function readBuilderColor(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

function buildSurfaceBackground(
  surfaceColor?: string,
  surfaceColorSecondary?: string,
): string | undefined {
  const start = readBuilderColor(surfaceColor)
  const end = readBuilderColor(surfaceColorSecondary)

  if (!start && !end) {
    return undefined
  }

  const from = start ?? end ?? 'transparent'
  const to = end ?? start ?? from
  return `linear-gradient(180deg, ${from}, ${to})`
}

export function getBuilderPresentationTextStyle(
  presentation?: BuilderPresentation,
): CSSProperties {
  if (!presentation) {
    return {}
  }

  const style: CSSProperties = {}

  if (presentation.textAlign) {
    style.textAlign = presentation.textAlign
  }
  if (presentation.fontSize) {
    style.fontSize = fontSizeMap[presentation.fontSize]
  }
  if (presentation.fontWeight) {
    style.fontWeight = fontWeightMap[presentation.fontWeight]
  }
  if (presentation.lineHeight) {
    style.lineHeight = lineHeightMap[presentation.lineHeight]
  }
  if (presentation.letterSpacing) {
    style.letterSpacing = letterSpacingMap[presentation.letterSpacing]
  }
  if (presentation.textTransform) {
    style.textTransform = presentation.textTransform
  }

  return style
}

export function getBuilderPresentationSurfaceStyle(
  presentation?: BuilderPresentation,
): CSSProperties {
  if (!presentation) {
    return {}
  }

  const style: BuilderStyleObject = {}
  const background = buildSurfaceBackground(presentation.surfaceColor, presentation.surfaceColorSecondary)

  if (background) {
    style['--builder-surface-bg'] = background
  }

  if (presentation.borderColor) {
    style['--builder-surface-border-color'] = presentation.borderColor
  }

  if (presentation.shadowColor) {
    style['--builder-surface-shadow-color'] = presentation.shadowColor
  }

  if (presentation.textColor) {
    style.color = presentation.textColor
    style['--builder-surface-text-color'] = presentation.textColor
  }

  if (presentation.mutedTextColor) {
    style['--builder-surface-muted-color'] = presentation.mutedTextColor
  }

  return style
}

export function getBuilderNodeTextStyle(
  document: BuilderDocument | null | undefined,
  nodeId: string,
): CSSProperties {
  const node = getBuilderNode(document, nodeId)
  return getBuilderPresentationTextStyle(node?.presentation)
}

export function getBuilderNodeSurfaceStyle(
  document: BuilderDocument | null | undefined,
  nodeId: string,
): CSSProperties {
  const node = getBuilderNode(document, nodeId)
  return getBuilderPresentationSurfaceStyle(node?.presentation)
}

export function getBuilderNodePresentationStyle(
  document: BuilderDocument | null | undefined,
  nodeId: string,
): CSSProperties {
  return {
    ...getBuilderNodeSurfaceStyle(document, nodeId),
    ...getBuilderNodeTextStyle(document, nodeId),
  }
}

export function applyBuilderPresentationTextStyle(
  element: HTMLElement,
  presentation?: BuilderPresentation,
) {
  const textStyle = getBuilderPresentationTextStyle(presentation)

  element.style.textAlign = typeof textStyle.textAlign === 'string' ? textStyle.textAlign : ''
  element.style.fontSize = typeof textStyle.fontSize === 'string' ? textStyle.fontSize : ''
  element.style.fontWeight = typeof textStyle.fontWeight === 'string' ? textStyle.fontWeight : ''
  element.style.lineHeight = textStyle.lineHeight ? String(textStyle.lineHeight) : ''
  element.style.letterSpacing =
    typeof textStyle.letterSpacing === 'string' ? textStyle.letterSpacing : ''
  element.style.textTransform =
    typeof textStyle.textTransform === 'string' ? textStyle.textTransform : ''
}

export function applyBuilderPresentationSurfaceStyle(
  element: HTMLElement,
  presentation?: BuilderPresentation,
) {
  const surfaceStyle = getBuilderPresentationSurfaceStyle(presentation) as BuilderStyleObject
  const background = surfaceStyle['--builder-surface-bg']
  const borderColor = surfaceStyle['--builder-surface-border-color']
  const shadowColor = surfaceStyle['--builder-surface-shadow-color']
  const textColor = surfaceStyle['--builder-surface-text-color']
  const mutedColor = surfaceStyle['--builder-surface-muted-color']

  if (background) {
    element.style.setProperty('--builder-surface-bg', background)
  } else {
    element.style.removeProperty('--builder-surface-bg')
  }

  if (borderColor) {
    element.style.setProperty('--builder-surface-border-color', borderColor)
  } else {
    element.style.removeProperty('--builder-surface-border-color')
  }

  if (shadowColor) {
    element.style.setProperty('--builder-surface-shadow-color', shadowColor)
  } else {
    element.style.removeProperty('--builder-surface-shadow-color')
  }

  if (mutedColor) {
    element.style.setProperty('--builder-surface-muted-color', mutedColor)
  } else {
    element.style.removeProperty('--builder-surface-muted-color')
  }

  if (textColor) {
    element.style.setProperty('--builder-surface-text-color', textColor)
    element.style.color = textColor
  } else {
    element.style.removeProperty('--builder-surface-text-color')
    element.style.color = ''
  }
}
