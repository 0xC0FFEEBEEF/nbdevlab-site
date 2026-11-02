export type AboutParagraphBlock = {
  id: string
  type: 'paragraph'
  content: string
  showTopRule: boolean
}

export type AboutImageBlock = {
  id: string
  type: 'image'
  src: string
  alt: string
  caption: string
  showTopRule: boolean
}

export type AboutBlock = AboutParagraphBlock | AboutImageBlock

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asBoolean(value: unknown): boolean {
  return value === true
}

function normalizeId(value: string, fallbackPrefix: string, index: number): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || `${fallbackPrefix}-${index + 1}`
}

export const defaultAboutBlocks: readonly AboutBlock[] = [
  {
    id: 'about-intro',
    type: 'paragraph',
    showTopRule: false,
    content:
      "Hey, I'm Nathan. I'm someone who genuinely loves learning how systems work, building things from the ground up, and pushing myself into projects that force me to grow. A lot of that energy ends up in my homelab, where I experiment with virtualization, monitoring, security, automation, and self-hosted services.",
  },
  {
    id: 'about-it',
    type: 'paragraph',
    showTopRule: false,
    content:
      "I work in IT, balance school alongside hands-on technical work, and spend a lot of my free time building systems that help me learn by doing. I'm especially drawn to infrastructure, Linux, virtualization, security tooling, automation, and the kind of work that turns a pile of hardware and ideas into something useful and reliable.",
  },
  {
    id: 'about-record',
    type: 'paragraph',
    showTopRule: false,
    content:
      "nbdevlab is more than a portfolio site for me. It's a living record of the systems I build, the mistakes I learn from, and the ideas I keep expanding. Some projects are practical, some are experimental, and some are just here because I think they're fun, but all of them reflect how I learn best: by building real things.",
  },
  {
    id: 'about-growth',
    type: 'paragraph',
    showTopRule: false,
    content:
      "Long term, I want to keep growing into deeper infrastructure, systems, and engineering work. It's the kind of role where I can build, secure, automate, and improve real environments at scale. I care a lot about practical knowledge, doing things the right way, and becoming someone people can trust with important systems.",
  },
  {
    id: 'about-outside-work',
    type: 'paragraph',
    showTopRule: false,
    content:
      "Outside of work and lab projects, I also enjoy gaming, D&D, and spending time with friends and family. I like technology because it's useful, creative, and honestly just fun, and a lot of this site comes from that same mindset.",
  },
]

export function normalizeAboutBlocks(input: unknown): AboutBlock[] {
  if (!Array.isArray(input)) {
    return []
  }

  const blocks: AboutBlock[] = []

  input.forEach((item, index) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return
    }

    const type = asTrimmedString((item as { type?: unknown }).type)
    if (type === 'paragraph') {
      const content = asTrimmedString((item as { content?: unknown }).content)
      if (!content) {
        return
      }

      blocks.push({
        id: normalizeId(asTrimmedString((item as { id?: unknown }).id), 'about-paragraph', index),
        type: 'paragraph',
        content,
        showTopRule: asBoolean((item as { showTopRule?: unknown }).showTopRule),
      })
      return
    }

    if (type === 'image') {
      const src = asTrimmedString((item as { src?: unknown }).src)
      const alt = asTrimmedString((item as { alt?: unknown }).alt)
      const caption = asTrimmedString((item as { caption?: unknown }).caption)

      if (!src) {
        return
      }

      blocks.push({
        id: normalizeId(asTrimmedString((item as { id?: unknown }).id), 'about-image', index),
        type: 'image',
        src,
        alt,
        caption,
        showTopRule: asBoolean((item as { showTopRule?: unknown }).showTopRule),
      })
    }
  })

  return blocks
}

export function parseAboutBlocks(raw: string | null): AboutBlock[] {
  const trimmed = raw?.trim() ?? ''
  if (!trimmed) {
    return defaultAboutBlocks.map((block) => ({ ...block }))
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown
    const blocks = normalizeAboutBlocks(parsed)
    return blocks.length > 0 ? blocks : defaultAboutBlocks.map((block) => ({ ...block }))
  } catch {
    return defaultAboutBlocks.map((block) => ({ ...block }))
  }
}

export function serializeAboutBlocks(blocks: unknown): string {
  const normalized = normalizeAboutBlocks(blocks)
  return JSON.stringify(normalized.length > 0 ? normalized : defaultAboutBlocks)
}
