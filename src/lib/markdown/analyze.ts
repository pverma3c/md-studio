export type OutlineItem = {
  level: number
  text: string
  /** 1-based source line */
  line: number
}

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/
const ATX_RE = /^ {0,3}(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/
const SETEXT_RE = /^ {0,3}(=+|-+)[ \t]*$/

/** Plain-text heading label: drops inline markdown syntax. */
function cleanHeading(text: string) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|\*|_|~~|`)/g, "")
    .trim()
}

export function extractOutline(source: string): OutlineItem[] {
  const lines = source.split(/\r?\n/)
  const items: OutlineItem[] = []
  let fence: string | null = null
  let inFrontmatter = lines[0] === "---"

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (inFrontmatter) {
      if (i > 0 && (line === "---" || line === "...")) inFrontmatter = false
      continue
    }
    const fenceMatch = FENCE_RE.exec(line)
    if (fenceMatch) {
      const marker = fenceMatch[1][0]
      if (fence === null) fence = marker
      else if (fence === marker) fence = null
      continue
    }
    if (fence !== null) continue

    const atx = ATX_RE.exec(line)
    if (atx) {
      items.push({
        level: atx[1].length,
        text: cleanHeading(atx[2]),
        line: i + 1,
      })
      continue
    }
    const next = lines[i + 1]
    if (
      next !== undefined &&
      line.trim() &&
      !/^ {0,3}([-*+]|\d+[.)]|>)\s/.test(line) &&
      SETEXT_RE.exec(next)
    ) {
      items.push({
        level: next.trim()[0] === "=" ? 1 : 2,
        text: cleanHeading(line),
        line: i + 1,
      })
      i++
    }
  }
  return items
}

export type DocStats = {
  words: number
  characters: number
  lines: number
  readingMinutes: number
}

export function computeStats(source: string): DocStats {
  const words = source.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu)?.length ?? 0
  return {
    words,
    characters: source.length,
    lines: source.split("\n").length,
    readingMinutes: Math.max(1, Math.round(words / 230)),
  }
}
