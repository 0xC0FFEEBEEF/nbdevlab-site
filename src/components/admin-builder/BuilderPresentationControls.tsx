import type { BuilderNode, BuilderPresentation } from '../../../shared/builder'
import {
  builderFontSizeOptions,
  builderFontWeightOptions,
  builderLetterSpacingOptions,
  builderLineHeightOptions,
  builderTextTransformOptions,
} from '../../lib/builderPresentation'

function toColorInputValue(value: string | undefined, fallback: string): string {
  const normalized = value?.trim() ?? ''

  if (/^#([\da-f]{6})$/i.test(normalized)) {
    return normalized
  }

  if (/^#([\da-f]{3})$/i.test(normalized)) {
    const [, shortHex = ''] = normalized.match(/^#([\da-f]{3})$/i) ?? []
    return `#${shortHex
      .split('')
      .map((part) => `${part}${part}`)
      .join('')}`
  }

  return fallback
}

function ColorField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value?: string
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <label className="admin-builder__color-field">
      <span>{label}</span>
      <div className="admin-builder__color-row">
        <input
          className="admin-builder__color-swatch"
          type="color"
          value={toColorInputValue(value, placeholder)}
          onChange={(event) => onChange(event.target.value)}
        />
        <input
          type="text"
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </label>
  )
}

interface BuilderPresentationControlsProps {
  presentation?: BuilderPresentation
  nodeType?: BuilderNode['type']
  bindingKind?: NonNullable<BuilderNode['binding']>['kind']
  onChange: <K extends keyof BuilderPresentation>(field: K, value: BuilderPresentation[K]) => void
}

export function BuilderPresentationControls({
  presentation,
  nodeType,
  bindingKind,
  onChange,
}: BuilderPresentationControlsProps) {
  const canSpan =
    nodeType === 'section' ||
    nodeType === 'container/box' ||
    nodeType === 'collection' ||
    bindingKind === 'project' ||
    bindingKind === 'home-card' ||
    bindingKind === 'skill-group'
  const canStyleSurface = nodeType !== 'spacer' && nodeType !== 'navItem'

  return (
    <div className="admin-builder__field-stack">
      <section className="admin-builder__inspector-section">
        <div className="admin-builder__section-head">
          <p className="eyebrow">Typography</p>
          <h3>Text tools</h3>
        </div>
        <div className="admin-builder__field-grid">
          <label>
            Font Size
            <select
              value={presentation?.fontSize ?? 'md'}
              onChange={(event) => onChange('fontSize', event.target.value as BuilderPresentation['fontSize'])}
            >
              {builderFontSizeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Weight
            <select
              value={presentation?.fontWeight ?? 'regular'}
              onChange={(event) =>
                onChange('fontWeight', event.target.value as BuilderPresentation['fontWeight'])
              }
            >
              {builderFontWeightOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Line Height
            <select
              value={presentation?.lineHeight ?? 'normal'}
              onChange={(event) =>
                onChange('lineHeight', event.target.value as BuilderPresentation['lineHeight'])
              }
            >
              {builderLineHeightOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Letter Spacing
            <select
              value={presentation?.letterSpacing ?? 'normal'}
              onChange={(event) =>
                onChange(
                  'letterSpacing',
                  event.target.value as BuilderPresentation['letterSpacing'],
                )
              }
            >
              {builderLetterSpacingOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Text Case
            <select
              value={presentation?.textTransform ?? 'none'}
              onChange={(event) =>
                onChange(
                  'textTransform',
                  event.target.value as BuilderPresentation['textTransform'],
                )
              }
            >
              {builderTextTransformOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Text Align
            <select
              value={presentation?.textAlign ?? 'left'}
              onChange={(event) => onChange('textAlign', event.target.value as BuilderPresentation['textAlign'])}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
        </div>
      </section>

      {canStyleSurface && (
        <section className="admin-builder__inspector-section">
          <div className="admin-builder__section-head">
            <p className="eyebrow">Color</p>
            <h3>Card surface</h3>
          </div>
          <div className="admin-builder__field-grid admin-builder__field-grid--single">
            <ColorField
              label="Surface Start"
              value={presentation?.surfaceColor}
              placeholder="#111215"
              onChange={(value) => onChange('surfaceColor', value)}
            />
            <ColorField
              label="Surface End"
              value={presentation?.surfaceColorSecondary}
              placeholder="#09090b"
              onChange={(value) => onChange('surfaceColorSecondary', value)}
            />
            <ColorField
              label="Border"
              value={presentation?.borderColor}
              placeholder="#ffffff17"
              onChange={(value) => onChange('borderColor', value)}
            />
            <ColorField
              label="Text"
              value={presentation?.textColor}
              placeholder="#f5f5f5"
              onChange={(value) => onChange('textColor', value)}
            />
            <ColorField
              label="Muted Text"
              value={presentation?.mutedTextColor}
              placeholder="#b3b3b3"
              onChange={(value) => onChange('mutedTextColor', value)}
            />
            <ColorField
              label="Shadow"
              value={presentation?.shadowColor}
              placeholder="#00000033"
              onChange={(value) => onChange('shadowColor', value)}
            />
          </div>
        </section>
      )}

      <section className="admin-builder__inspector-section">
        <div className="admin-builder__section-head">
          <p className="eyebrow">Presentation</p>
          <h3>Layout and surface</h3>
        </div>
        <div className="admin-builder__field-grid">
          <label>
            Variant
            <input
              type="text"
              value={presentation?.variant ?? ''}
              onChange={(event) => onChange('variant', event.target.value)}
            />
          </label>
          <label>
            Emphasis
            <select
              value={presentation?.emphasis ?? 'normal'}
              onChange={(event) => onChange('emphasis', event.target.value as BuilderPresentation['emphasis'])}
            >
              <option value="subtle">Subtle</option>
              <option value="normal">Normal</option>
              <option value="strong">Strong</option>
            </select>
          </label>
          <label>
            Spacing
            <select
              value={presentation?.spacing ?? 'cozy'}
              onChange={(event) => onChange('spacing', event.target.value as BuilderPresentation['spacing'])}
            >
              <option value="compact">Compact</option>
              <option value="cozy">Cozy</option>
              <option value="loose">Loose</option>
            </select>
          </label>
          <label>
            Layout
            <select
              value={presentation?.layout ?? 'stack'}
              onChange={(event) => onChange('layout', event.target.value as BuilderPresentation['layout'])}
            >
              <option value="stack">Stack</option>
              <option value="row">Row</option>
              <option value="grid">Grid</option>
              <option value="flow">Flow</option>
            </select>
          </label>
          <label>
            Width
            <select
              value={presentation?.width ?? 'auto'}
              onChange={(event) => onChange('width', event.target.value as BuilderPresentation['width'])}
            >
              <option value="auto">Auto</option>
              <option value="content">Content Width</option>
              <option value="full">Full Width</option>
            </select>
          </label>
          {canSpan && (
            <label>
              Grid Span
              <select
                value={String(presentation?.span ?? 1)}
                onChange={(event) => onChange('span', Number(event.target.value))}
              >
                <option value="1">1 Column</option>
                <option value="2">2 Columns</option>
                <option value="3">3 Columns</option>
                <option value="4">4 Columns</option>
              </select>
            </label>
          )}
          {nodeType === 'image/media' && (
            <label>
              Image Fit
              <select
                value={presentation?.imageFit ?? 'cover'}
                onChange={(event) =>
                  onChange('imageFit', event.target.value as BuilderPresentation['imageFit'])
                }
              >
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
                <option value="fill">Fill</option>
              </select>
            </label>
          )}
        </div>
        <label className="admin-inline-checkbox">
          <input
            type="checkbox"
            checked={presentation?.visible !== false}
            onChange={(event) => onChange('visible', event.target.checked)}
          />
          Visible
        </label>
      </section>
    </div>
  )
}
