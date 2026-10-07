import type { Element, ElementContent, Root as HastRoot } from "hast"
import type { Root as MdastRoot, RootContent } from "mdast"
import { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize"
import { visit } from "unist-util-visit"

// ---------------------------------------------------------------------------
// remark: render YAML front matter as a compact properties table

type FrontmatterRow = { key: string; value: string; list: boolean }

function parseSimpleYaml(source: string): FrontmatterRow[] {
  const rows: FrontmatterRow[] = []
  for (const raw of source.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue
    const top = /^([^\s:][^:]*):\s*(.*)$/.exec(raw)
    if (top) {
      const value = top[2].trim()
      rows.push({
        key: top[1].trim(),
        value: unquote(value),
        list: /^\[.*\]$/.test(value),
      })
    } else if (rows.length) {
      // Continuation lines (lists, nested maps) are folded into the previous value.
      const last = rows[rows.length - 1]
      const isItem = /^-(\s|$)/.test(raw.trim())
      if (isItem && (last.list || !last.value)) last.list = true
      const item = unquote(raw.trim().replace(/^-\s*/, ""))
      last.value = last.value ? `${last.value}, ${item}` : item
    }
  }
  return rows
}

function unquote(v: string) {
  // Flow sequences ("[a, b]") read better without the brackets.
  return v.replace(/^(['"])(.*)\1$/, "$2").replace(/^\[(.*)\]$/, "$1")
}

export function remarkFrontmatterTable() {
  return (tree: MdastRoot) => {
    const first = tree.children[0]
    if (!first || first.type !== "yaml") return
    const rows = parseSimpleYaml(first.value)
    if (!rows.length) {
      tree.children.shift()
      return
    }
    const tr = ({ key, value, list }: FrontmatterRow): Element => ({
      type: "element",
      tagName: "tr",
      properties: {},
      children: [
        {
          type: "element",
          tagName: "th",
          properties: {},
          children: [{ type: "text", value: key }],
        },
        {
          type: "element",
          tagName: "td",
          // Sequences ("[a, b]" or "- a" lines) are flagged so they can render as tags.
          properties: list ? { dataList: true } : {},
          children: [{ type: "text", value }],
        },
      ],
    })
    const replacement = {
      type: "frontmatter",
      position: first.position,
      data: {
        hName: "table",
        hProperties: { className: ["frontmatter"] },
        hChildren: [
          {
            type: "element",
            tagName: "tbody",
            properties: {},
            children: rows.map(tr),
          },
        ],
      },
    } as unknown as RootContent
    tree.children[0] = replacement
  }
}

// ---------------------------------------------------------------------------
// rehype: tag block elements with their source line (drives scroll sync,
// outline navigation and clickable task lists)

const LINE_TAGS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "table",
  "tr",
  "hr",
  "div",
  "details",
  "dl",
  "img",
  "section",
])

export function rehypeSourceLine() {
  return (tree: HastRoot) => {
    visit(tree, "element", (node: Element) => {
      if (!LINE_TAGS.has(node.tagName)) return
      const line = node.position?.start.line
      if (line) node.properties.dataLine = line
    })
  }
}

// ---------------------------------------------------------------------------
// rehype: GitHub alerts — "> [!NOTE]" blockquotes become callouts

const ALERT_RE = /^\[!(note|tip|important|warning|caution)\][ \t]*\r?\n?/i
const ALERT_TITLES: Record<string, string> = {
  note: "Note",
  tip: "Tip",
  important: "Important",
  warning: "Warning",
  caution: "Caution",
}

export function rehypeAlerts() {
  return (tree: HastRoot) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "blockquote") return
      const para = node.children.find((c): c is Element => c.type === "element")
      if (!para || para.tagName !== "p") return
      const first = para.children[0]
      if (!first || first.type !== "text") return
      const match = ALERT_RE.exec(first.value)
      if (!match) return

      const kind = match[1].toLowerCase()
      first.value = first.value.slice(match[0].length)
      if (!first.value) para.children.shift()
      if (para.children.every((c) => c.type === "text" && !c.value.trim())) {
        node.children = node.children.filter((c) => c !== para)
      }

      node.properties.className = ["markdown-alert", `markdown-alert-${kind}`]
      node.properties.dataAlert = kind
      const title: ElementContent = {
        type: "element",
        tagName: "p",
        properties: {
          className: ["markdown-alert-title"],
          dataAlertTitle: kind,
        },
        children: [{ type: "text", value: ALERT_TITLES[kind] }],
      }
      node.children.unshift(title)
    })
  }
}

// ---------------------------------------------------------------------------
// Sanitize: GitHub-like defaults plus what our own plugins emit

const defaultAttributes = defaultSchema.attributes ?? {}

export const sanitizeSchema: SanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultAttributes,
    "*": [...(defaultAttributes["*"] ?? []), "dataLine"],
    code: [
      ...(defaultAttributes.code ?? []),
      ["className", /^language-./, "math-inline", "math-display"],
    ],
    table: [...(defaultAttributes.table ?? []), ["className", "frontmatter"]],
    td: [...(defaultAttributes.td ?? []), "dataList"],
    img: [...(defaultAttributes.img ?? []), "loading"],
  },
}
