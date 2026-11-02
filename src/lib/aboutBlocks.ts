import type { AboutBlock, AboutImageBlock, AboutParagraphBlock } from '../types/models'

export const defaultAboutBlocks: AboutBlock[] = [
  {
    id: 'about-paragraph-1',
    type: 'paragraph',
    showTopRule: false,
    content:
      "Hey, I'm Nathan. I'm someone who genuinely loves learning how systems work, building things from the ground up, and pushing myself into projects that force me to grow. A lot of that energy ends up in my homelab, where I experiment with virtualization, monitoring, security, automation, and self-hosted services.",
  },
  {
    id: 'about-paragraph-2',
    type: 'paragraph',
    showTopRule: false,
    content:
      "I work in IT, balance school alongside hands-on technical work, and spend a lot of my free time building systems that help me learn by doing. I'm especially drawn to infrastructure, Linux, virtualization, security tooling, automation, and the kind of work that turns a pile of hardware and ideas into something useful and reliable.",
  },
  {
    id: 'about-paragraph-3',
    type: 'paragraph',
    showTopRule: false,
    content:
      "nbdevlab is more than a portfolio site for me. It's a living record of the systems I build, the mistakes I learn from, and the ideas I keep expanding. Some projects are practical, some are experimental, and some are just here because I think they're fun, but all of them reflect how I learn best: by building real things.",
  },
  {
    id: 'about-paragraph-4',
    type: 'paragraph',
    showTopRule: false,
    content:
      "Long term, I want to keep growing into deeper infrastructure, systems, and engineering work. It's the kind of role where I can build, secure, automate, and improve real environments at scale. I care a lot about practical knowledge, doing things the right way, and becoming someone people can trust with important systems.",
  },
  {
    id: 'about-paragraph-5',
    type: 'paragraph',
    showTopRule: false,
    content:
      "Outside of work and lab projects, I also enjoy gaming, D&D, and spending time with friends and family. I like technology because it's useful, creative, and honestly just fun, and a lot of this site comes from that same mindset.",
  },
]

export function cloneAboutBlocks(blocks: AboutBlock[]): AboutBlock[] {
  return blocks.map((block) => ({ ...block }))
}

export function createAboutBlockId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `about-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function createParagraphBlock(content = ''): AboutParagraphBlock {
  return {
    id: createAboutBlockId(),
    type: 'paragraph',
    content,
    showTopRule: false,
  }
}

export function createImageBlock(
  values?: Partial<Pick<AboutImageBlock, 'src' | 'alt' | 'caption' | 'showTopRule'>>,
): AboutImageBlock {
  return {
    id: createAboutBlockId(),
    type: 'image',
    src: values?.src ?? '',
    alt: values?.alt ?? '',
    caption: values?.caption ?? '',
    showTopRule: values?.showTopRule ?? false,
  }
}

export function normalizeAboutBlocks(blocks: AboutBlock[] | null | undefined): AboutBlock[] {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return cloneAboutBlocks(defaultAboutBlocks)
  }

  return blocks.map((block) => {
    if (block.type === 'image') {
      return {
        id: block.id || createAboutBlockId(),
        type: 'image',
        src: block.src ?? '',
        alt: block.alt ?? '',
        caption: block.caption ?? '',
        showTopRule: Boolean(block.showTopRule),
      }
    }

    return {
      id: block.id || createAboutBlockId(),
      type: 'paragraph',
      content: block.content ?? '',
      showTopRule: Boolean(block.showTopRule),
    }
  })
}
