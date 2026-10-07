import { EditorSelection, type EditorState, type Line } from "@codemirror/state"
import type { EditorView } from "@codemirror/view"

type Command = (view: EditorView) => boolean

function selectedLines(state: EditorState): Line[] {
  const seen = new Set<number>()
  const lines: Line[] = []
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number
    // A selection ending at column 0 doesn't really include that line.
    let last = state.doc.lineAt(range.to).number
    if (last > first && state.doc.lineAt(range.to).from === range.to) last--
    for (let n = first; n <= last; n++) {
      if (seen.has(n)) continue
      seen.add(n)
      lines.push(state.doc.line(n))
    }
  }
  return lines
}

// ---------------------------------------------------------------------------
// Inline wrappers: **bold**, *italic*, ~~strike~~, `code`

export function toggleWrap(marker: string, placeholder = "text"): Command {
  return (view) => {
    const { state } = view
    const len = marker.length
    const tr = state.changeByRange((range) => {
      const before = state.sliceDoc(range.from - len, range.from)
      const after = state.sliceDoc(range.to, range.to + len)
      // Already wrapped just outside the selection → unwrap.
      if (before === marker && after === marker) {
        return {
          changes: [
            { from: range.from - len, to: range.from },
            { from: range.to, to: range.to + len },
          ],
          range: EditorSelection.range(range.from - len, range.to - len),
        }
      }
      const text = state.sliceDoc(range.from, range.to)
      if (
        text.length >= len * 2 &&
        text.startsWith(marker) &&
        text.endsWith(marker)
      ) {
        const inner = text.slice(len, -len)
        return {
          changes: { from: range.from, to: range.to, insert: inner },
          range: EditorSelection.range(range.from, range.from + inner.length),
        }
      }
      if (range.empty) {
        const word = state.wordAt(range.head)
        if (word) {
          return {
            changes: [
              { from: word.from, insert: marker },
              { from: word.to, insert: marker },
            ],
            range: EditorSelection.cursor(range.head + len),
          }
        }
        return {
          changes: { from: range.from, insert: marker + placeholder + marker },
          range: EditorSelection.range(
            range.from + len,
            range.from + len + placeholder.length
          ),
        }
      }
      return {
        changes: [
          { from: range.from, insert: marker },
          { from: range.to, insert: marker },
        ],
        range: EditorSelection.range(range.from + len, range.to + len),
      }
    })
    view.dispatch(
      state.update(tr, { scrollIntoView: true, userEvent: "input.format" })
    )
    return true
  }
}

export const toggleBold = toggleWrap("**", "bold text")
export const toggleItalic = toggleWrap("*", "italic text")
export const toggleStrike = toggleWrap("~~", "struck text")
export const toggleInlineCode = toggleWrap("`", "code")

// ---------------------------------------------------------------------------
// Block prefixes: headings, quotes, lists

const HEADING_RE = /^( {0,3})(#{1,6})[ \t]+/
const LIST_RE = /^(\s*)(?:[-*+]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/

export function setHeading(level: number): Command {
  return (view) => {
    const { state } = view
    const lines = selectedLines(state)
    const allAtLevel = lines.every(
      (l) => HEADING_RE.exec(l.text)?.[2].length === level
    )
    const changes = lines.map((line) => {
      const m = HEADING_RE.exec(line.text)
      const insert = allAtLevel || level === 0 ? "" : "#".repeat(level) + " "
      return m
        ? { from: line.from + m[1].length, to: line.from + m[0].length, insert }
        : { from: line.from, insert }
    })
    view.dispatch({ changes, scrollIntoView: true, userEvent: "input.format" })
    return true
  }
}

type BlockKind = "quote" | "bullet" | "ordered" | "task"

const BLOCK_TEST: Record<BlockKind, RegExp> = {
  quote: /^\s*>/,
  bullet: /^\s*[-*+][ \t]+(?!\[[ xX]\])/,
  ordered: /^\s*\d+[.)][ \t]+/,
  task: /^\s*[-*+][ \t]+\[[ xX]\]/,
}

export function toggleBlock(kind: BlockKind): Command {
  return (view) => {
    const { state } = view
    const lines = selectedLines(state)
    const content = lines.filter((l) => l.text.trim() || lines.length === 1)
    const allHave = content.every((l) => BLOCK_TEST[kind].test(l.text))
    let n = 0
    const changes = content.map((line) => {
      if (kind === "quote") {
        const m = /^(\s*)> ?/.exec(line.text)
        if (allHave && m)
          return { from: line.from + m[1].length, to: line.from + m[0].length }
        return { from: line.from, insert: "> " }
      }
      const m = LIST_RE.exec(line.text)
      const indent = m?.[1] ?? /^\s*/.exec(line.text)![0]
      const to = line.from + (m ? m[0].length : indent.length)
      if (allHave) return { from: line.from + indent.length, to }
      const prefix =
        kind === "bullet" ? "- " : kind === "task" ? "- [ ] " : `${++n}. `
      return { from: line.from + indent.length, to, insert: prefix }
    })
    view.dispatch({ changes, scrollIntoView: true, userEvent: "input.format" })
    return true
  }
}

export const toggleQuote = toggleBlock("quote")
export const toggleBulletList = toggleBlock("bullet")
export const toggleOrderedList = toggleBlock("ordered")
export const toggleTaskList = toggleBlock("task")

// ---------------------------------------------------------------------------
// Inserts

/** Inserts a block on its own line(s), separated from surrounding text by blank lines. */
function insertBlock(
  view: EditorView,
  block: string,
  selectFrom: number,
  selectTo: number
) {
  const { state } = view
  const range = state.selection.main
  const line = state.doc.lineAt(range.from)
  let from = range.from
  let to = range.to
  let lead = ""
  if (line.text.trim() !== "") {
    if (range.empty) {
      // Cursor inside a paragraph: put the block after that line.
      from = to = line.to
      lead = "\n\n"
    } else if (range.from !== line.from) {
      lead = "\n\n"
    }
  }
  const after = state.sliceDoc(to, to + 2)
  const trail =
    to >= state.doc.length
      ? "\n"
      : after.startsWith("\n\n")
        ? ""
        : after.startsWith("\n")
          ? "\n"
          : "\n\n"
  const insert = lead + block + trail
  view.dispatch({
    changes: { from, to, insert },
    selection: EditorSelection.range(
      from + lead.length + selectFrom,
      from + lead.length + selectTo
    ),
    scrollIntoView: true,
    userEvent: "input.format",
  })
  return true
}

export const insertCodeBlock: Command = (view) => {
  const { state } = view
  const range = state.selection.main
  const selected = state.sliceDoc(range.from, range.to)
  if (selected) {
    const block = "```\n" + selected.replace(/\n$/, "") + "\n```"
    return insertBlock(view, block, 3, 3)
  }
  return insertBlock(view, "```\n\n```", 4, 4)
}

export const insertTable: Command = (view) => {
  const table = [
    "| Column 1 | Column 2 | Column 3 |",
    "| -------- | -------- | -------- |",
    "|          |          |          |",
  ].join("\n")
  return insertBlock(view, table, 2, 10)
}

export const insertHorizontalRule: Command = (view) =>
  insertBlock(view, "---", 3, 3)

export const insertLink: Command = (view) => {
  const { state } = view
  const range = state.selection.main
  const text = state.sliceDoc(range.from, range.to)
  if (/^(https?:\/\/|mailto:)\S+$/.test(text)) {
    view.dispatch({
      changes: { from: range.from, to: range.to, insert: `[](${text})` },
      selection: EditorSelection.cursor(range.from + 1),
      userEvent: "input.format",
    })
    return true
  }
  const label = text || "link text"
  const insert = `[${label}](https://)`
  const urlFrom = range.from + label.length + 3
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: text
      ? EditorSelection.range(urlFrom, urlFrom + 8)
      : EditorSelection.range(range.from + 1, range.from + 1 + label.length),
    userEvent: "input.format",
  })
  return true
}

export const insertImage: Command = (view) => {
  const range = view.state.selection.main
  const alt = view.state.sliceDoc(range.from, range.to) || "alt text"
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: `![${alt}](image.png)` },
    selection: EditorSelection.range(
      range.from + alt.length + 4,
      range.from + alt.length + 13
    ),
    userEvent: "input.format",
  })
  return true
}

/**
 * Inserts `text` as its own paragraph near `pos`: on the line itself when it's
 * blank, otherwise after the line, never splitting the text under the cursor.
 */
export function insertBlockAt(view: EditorView, pos: number, text: string) {
  const { doc } = view.state
  const line = doc.lineAt(pos)
  let from: number
  let insert: string
  if (!line.text.trim()) {
    from = line.from
    insert = text
  } else {
    from = line.to
    const nextBlank =
      line.number === doc.lines || !doc.line(line.number + 1).text.trim()
    insert = "\n\n" + text + (nextBlank ? "" : "\n")
  }
  view.dispatch({
    changes: { from, to: line.text.trim() ? from : line.to, insert },
    selection: EditorSelection.cursor(from + insert.trimEnd().length),
    scrollIntoView: true,
    userEvent: "input.drop",
  })
}

// ---------------------------------------------------------------------------
// Task checkboxes (clicked in the preview)

const TASK_RE = /^(\s*(?:[-*+]|\d+[.)])[ \t]+)\[([ xX])\]/

export function toggleTaskAtLine(view: EditorView, lineNumber: number) {
  if (lineNumber < 1 || lineNumber > view.state.doc.lines) return false
  const line = view.state.doc.line(lineNumber)
  const m = TASK_RE.exec(line.text)
  if (!m) return false
  const at = line.from + m[1].length + 1
  view.dispatch({
    changes: { from: at, to: at + 1, insert: m[2] === " " ? "x" : " " },
    userEvent: "input.toggle-task",
  })
  return true
}

/** Same edit as toggleTaskAtLine, for when no editor view is alive. */
export function toggleTaskInSource(source: string, lineNumber: number) {
  const lines = source.split("\n")
  const line = lines[lineNumber - 1]
  const m = line !== undefined ? TASK_RE.exec(line) : null
  if (!m) return null
  const at = m[1].length + 1
  lines[lineNumber - 1] =
    line.slice(0, at) + (m[2] === " " ? "x" : " ") + line.slice(at + 1)
  return lines.join("\n")
}

export function revealLine(
  view: EditorView,
  lineNumber: number,
  { scroll = true, focus = true } = {}
) {
  const line = view.state.doc.line(
    Math.min(Math.max(1, lineNumber), view.state.doc.lines)
  )
  view.dispatch({ selection: EditorSelection.cursor(line.from) })
  if (scroll) {
    const block = view.lineBlockAt(line.from)
    view.scrollDOM.scrollTo({
      top: Math.max(0, block.top - 24),
      behavior: "smooth",
    })
  }
  if (focus) view.focus()
}
