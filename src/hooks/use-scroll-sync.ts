import type { EditorView } from "@codemirror/view"
import { useEffect, type RefObject } from "react"

import { editorRegistry } from "@/lib/editor/registry"
import { useAppStore } from "@/store/app-store"

type Anchor = { line: number; el: HTMLElement }

/** Pixels of breathing room kept above the synced position. */
const MARGIN = 12

export const scrollSync = {
  driver: "editor" as "editor" | "preview",
  /** Scrolls the preview so the block for `line` sits at the top. */
  previewToLine: (_line: number) => {},
}

function collectAnchors(root: HTMLElement): Anchor[] {
  const anchors: Anchor[] = []
  let lastLine = 0
  for (const el of root.querySelectorAll<HTMLElement>("[data-line]")) {
    const line = Number(el.dataset.line)
    // Nested blocks share lines with their parents; keep the outermost, and
    // skip anything not laid out (e.g. inside a closed <details>).
    if (!line || line <= lastLine || el.getClientRects().length === 0) continue
    anchors.push({ line, el })
    lastLine = line
  }
  return anchors
}

function topWithin(el: HTMLElement, container: HTMLElement) {
  return (
    el.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop
  )
}

/** Fractional source line at the top of the editor viewport. */
function editorTopLine(view: EditorView) {
  const scroller = view.scrollDOM
  const height =
    scroller.getBoundingClientRect().top - view.documentTop + MARGIN
  const block = view.lineBlockAtHeight(Math.max(0, height))
  const line = view.state.doc.lineAt(block.from).number
  return (
    line +
    Math.min(1, Math.max(0, (height - block.top) / Math.max(1, block.height)))
  )
}

function scrollEditorToLine(view: EditorView, fractionalLine: number) {
  const doc = view.state.doc
  const lineNo = Math.min(doc.lines, Math.max(1, Math.floor(fractionalLine)))
  const block = view.lineBlockAt(doc.line(lineNo).from)
  const scroller = view.scrollDOM
  const docOffset =
    view.documentTop - scroller.getBoundingClientRect().top + scroller.scrollTop
  const target =
    docOffset + block.top + block.height * (fractionalLine - lineNo) - MARGIN
  scroller.scrollTop = Math.max(0, target)
}

function syncPreviewFromEditor(
  view: EditorView,
  preview: HTMLElement,
  anchors: Anchor[]
) {
  const scroller = view.scrollDOM
  const maxEditor = scroller.scrollHeight - scroller.clientHeight
  const maxPreview = preview.scrollHeight - preview.clientHeight
  if (scroller.scrollTop <= 0) return void (preview.scrollTop = 0)
  if (scroller.scrollTop >= maxEditor - 1)
    return void (preview.scrollTop = maxPreview)
  if (!anchors.length)
    return void (preview.scrollTop =
      (scroller.scrollTop / Math.max(1, maxEditor)) * maxPreview)

  const line = editorTopLine(view)
  let i = -1
  let lo = 0
  let hi = anchors.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (anchors[mid].line <= line) {
      i = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  const prev = i >= 0 ? anchors[i] : null
  const next = anchors[i + 1] ?? null
  const prevLine = prev?.line ?? 1
  const prevTop = prev ? topWithin(prev.el, preview) : 0
  const nextLine = next?.line ?? view.state.doc.lines + 1
  const nextTop = next ? topWithin(next.el, preview) : preview.scrollHeight
  const t = Math.min(
    1,
    Math.max(0, (line - prevLine) / Math.max(1, nextLine - prevLine))
  )
  preview.scrollTop = prevTop + (nextTop - prevTop) * t - MARGIN
}

function syncEditorFromPreview(
  view: EditorView,
  preview: HTMLElement,
  anchors: Anchor[]
) {
  const scroller = view.scrollDOM
  const maxPreview = preview.scrollHeight - preview.clientHeight
  if (preview.scrollTop <= 0) return void (scroller.scrollTop = 0)
  if (preview.scrollTop >= maxPreview - 1)
    return void (scroller.scrollTop = scroller.scrollHeight)
  if (!anchors.length) return

  const y = preview.scrollTop + MARGIN
  // Anchors are in document order, so their tops are (nearly) monotonic.
  let lo = 0
  let hi = anchors.length - 1
  let i = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (topWithin(anchors[mid].el, preview) <= y) {
      i = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  const prev = i >= 0 ? anchors[i] : null
  const next = anchors[i + 1] ?? null
  const prevTop = prev ? topWithin(prev.el, preview) : 0
  const nextTop = next ? topWithin(next.el, preview) : preview.scrollHeight
  const prevLine = prev?.line ?? 1
  const nextLine = next?.line ?? view.state.doc.lines + 1
  const t = Math.min(
    1,
    Math.max(0, (y - prevTop) / Math.max(1, nextTop - prevTop))
  )
  scrollEditorToLine(view, prevLine + (nextLine - prevLine) * t)
}

// ---------------------------------------------------------------------------
// Reading position (drives the outline highlight)

/** How far down the viewport counts as "where you're reading". */
function readingOffset(el: HTMLElement) {
  return Math.min(160, el.clientHeight * 0.25)
}

function scrolledToEnd(el: HTMLElement) {
  return (
    el.scrollTop > 0 && el.scrollHeight - el.clientHeight - el.scrollTop < 2
  )
}

function editorReadingLine(view: EditorView) {
  const scroller = view.scrollDOM
  if (scrolledToEnd(scroller)) return view.state.doc.lines
  const height =
    scroller.getBoundingClientRect().top -
    view.documentTop +
    readingOffset(scroller)
  return view.state.doc.lineAt(view.lineBlockAtHeight(Math.max(0, height)).from)
    .number
}

function previewReadingLine(
  preview: HTMLElement,
  anchors: Anchor[],
  totalLines: number
) {
  if (scrolledToEnd(preview)) return totalLines
  const y = preview.scrollTop + readingOffset(preview)
  let lo = 0
  let hi = anchors.length - 1
  let line = 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (topWithin(anchors[mid].el, preview) <= y) {
      line = anchors[mid].line
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return line
}

/**
 * Keeps the editor and preview scrolled to the same place. Whichever pane the
 * user last touched drives; the other follows. Also publishes the reading
 * position to the store (even with sync off) so the outline can follow along.
 */
export function useScrollSync(
  previewRef: RefObject<HTMLElement | null>,
  enabled: boolean
) {
  useEffect(() => {
    const view = editorRegistry.view
    const preview = previewRef.current
    // Either preview style's root; it stays mounted when the style changes.
    const article = preview?.querySelector<HTMLElement>(
      ".markdown-body, .markdown-app"
    )
    if (!view || !preview || !article) return

    let anchors: Anchor[] | null = null
    const getAnchors = () => (anchors ??= collectAnchors(article))
    let frame = 0
    const schedule = (fn: () => void) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(fn)
    }

    scrollSync.previewToLine = (line: number) => {
      const target = getAnchors().find((a) => a.line >= line)
      if (!target) return
      scrollSync.driver = "preview"
      preview.scrollTo({
        top: topWithin(target.el, preview) - MARGIN,
        behavior: "smooth",
      })
    }

    const editorEl = view.scrollDOM
    const driveEditor = () => (scrollSync.driver = "editor")
    const drivePreview = () => (scrollSync.driver = "preview")

    // The pane whose scrolling counts: the visible one, or in split view the
    // one being driven. Scroll events from the following pane are ignored.
    const sourcePane = () => {
      const mode = useAppStore.getState().settings.viewMode
      return mode === "split" ? scrollSync.driver : mode
    }
    const track = () => {
      const line =
        sourcePane() === "editor"
          ? editorReadingLine(view)
          : previewReadingLine(preview, getAnchors(), view.state.doc.lines)
      if (useAppStore.getState().readingLine !== line) {
        useAppStore.getState().setReadingLine(line)
      }
    }

    const onEditorScroll = () => {
      if (sourcePane() !== "editor") return
      schedule(() => {
        if (enabled) syncPreviewFromEditor(view, preview, getAnchors())
        track()
      })
    }
    const onPreviewScroll = () => {
      if (sourcePane() !== "preview") return
      schedule(() => {
        if (enabled) syncEditorFromPreview(view, preview, getAnchors())
        track()
      })
    }

    // Re-render or late layout (images, diagrams) invalidates anchor positions.
    const mutations = new MutationObserver(() => {
      anchors = null
    })
    mutations.observe(article, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-line", "open"],
    })
    const resizes = new ResizeObserver(() => {
      anchors = null
      schedule(() => {
        if (enabled && sourcePane() === "editor")
          syncPreviewFromEditor(view, preview, getAnchors())
        track()
      })
    })
    resizes.observe(article)

    // Switching tabs or view modes changes what's on screen without a scroll
    // event in the tracked pane. Two frames lets the editor restore its scroll.
    let trackFrame = 0
    const unsubscribe = useAppStore.subscribe((state, prev) => {
      if (
        state.activeId === prev.activeId &&
        state.settings.viewMode === prev.settings.viewMode
      )
        return
      cancelAnimationFrame(trackFrame)
      trackFrame = requestAnimationFrame(() => {
        trackFrame = requestAnimationFrame(() => track())
      })
    })
    trackFrame = requestAnimationFrame(() => track())

    const opts = { passive: true } as const
    editorEl.addEventListener("wheel", driveEditor, opts)
    editorEl.addEventListener("pointerdown", driveEditor, opts)
    view.contentDOM.addEventListener("keydown", driveEditor, opts)
    editorEl.addEventListener("scroll", onEditorScroll, opts)
    preview.addEventListener("wheel", drivePreview, opts)
    preview.addEventListener("pointerdown", drivePreview, opts)
    preview.addEventListener("keydown", drivePreview, opts)
    preview.addEventListener("scroll", onPreviewScroll, opts)

    return () => {
      cancelAnimationFrame(frame)
      cancelAnimationFrame(trackFrame)
      unsubscribe()
      mutations.disconnect()
      resizes.disconnect()
      editorEl.removeEventListener("wheel", driveEditor)
      editorEl.removeEventListener("pointerdown", driveEditor)
      view.contentDOM.removeEventListener("keydown", driveEditor)
      editorEl.removeEventListener("scroll", onEditorScroll)
      preview.removeEventListener("wheel", drivePreview)
      preview.removeEventListener("pointerdown", drivePreview)
      preview.removeEventListener("keydown", drivePreview)
      preview.removeEventListener("scroll", onPreviewScroll)
    }
  }, [previewRef, enabled])
}
