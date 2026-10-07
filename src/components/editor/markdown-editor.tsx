import type { EditorState } from "@codemirror/state"
import { EditorView, type ViewUpdate } from "@codemirror/view"
import { useEffect, useLayoutEffect, useRef } from "react"

import { scrollSync } from "@/hooks/use-scroll-sync"
import { openDroppedPaths } from "@/lib/actions"
import { insertBlockAt } from "@/lib/editor/commands"
import { editorRegistry } from "@/lib/editor/registry"
import {
  applySettings,
  createEditorState,
  type EditorHooks,
} from "@/lib/editor/setup"
import {
  basename,
  dirname,
  encodeLinkPath,
  extname,
  IMAGE_EXTENSIONS,
  relativePath,
  stripExtension,
} from "@/lib/paths"
import { getActiveDoc, useAppStore } from "@/store/app-store"

const store = useAppStore

function reportCursor(state: EditorState) {
  const head = state.selection.main.head
  const line = state.doc.lineAt(head)
  const selected = state.selection.ranges.reduce(
    (n, r) => n + (r.to - r.from),
    0
  )
  store
    .getState()
    .setCursor({ line: line.number, col: head - line.from + 1, selected })
}

const hooks: EditorHooks = {
  onDocChange(update: ViewUpdate) {
    const id = editorRegistry.docId
    if (id) store.getState().setContent(id, update.state.doc.toString())
  },
  onSelection(update: ViewUpdate) {
    reportCursor(update.state)
  },
}

/**
 * Handles paths dropped onto the editor: images become relative links at the
 * drop point (as their own paragraph); everything else opens as usual.
 */
export function dropPathsIntoEditor(
  view: EditorView,
  paths: string[],
  pos: number
) {
  const doc = getActiveDoc()
  const baseDir = doc?.path ? dirname(doc.path) : store.getState().folder
  const images = paths.filter((p) => IMAGE_EXTENSIONS.has(extname(p)))
  const others = paths.filter((p) => !images.includes(p))
  if (others.length) void openDroppedPaths(others)
  if (!images.length) return
  const text = images
    .map((p) => {
      const target = baseDir ? relativePath(baseDir, p) : p
      return `![${stripExtension(basename(p))}](${encodeLinkPath(target)})`
    })
    .join("\n\n")
  insertBlockAt(view, pos, text)
  view.focus()
}

/** Smallest single replacement turning `prev` into `next` (keeps the cursor stable on reloads). */
function minimalChange(prev: string, next: string) {
  let start = 0
  const max = Math.min(prev.length, next.length)
  while (start < max && prev.charCodeAt(start) === next.charCodeAt(start))
    start++
  let endPrev = prev.length
  let endNext = next.length
  while (
    endPrev > start &&
    endNext > start &&
    prev.charCodeAt(endPrev - 1) === next.charCodeAt(endNext - 1)
  ) {
    endPrev--
    endNext--
  }
  return { from: start, to: endPrev, insert: next.slice(start, endNext) }
}

export function MarkdownEditor() {
  const hostRef = useRef<HTMLDivElement>(null)
  const loadedRevision = useRef(0)
  const activeId = useAppStore((s) => s.activeId)
  const revision = useAppStore(
    (s) => s.docs.find((d) => d.id === s.activeId)?.revision
  )
  const lineNumbers = useAppStore((s) => s.settings.lineNumbers)
  const lineWrap = useAppStore((s) => s.settings.lineWrap)
  const spellcheck = useAppStore((s) => s.settings.spellcheck)
  const fontSize = useAppStore((s) => s.settings.fontSize)

  // One view for the lifetime of the workspace.
  useLayoutEffect(() => {
    const view = new EditorView({ parent: hostRef.current! })
    editorRegistry.view = view
    return () => {
      const id = editorRegistry.docId
      if (id) {
        editorRegistry.states.set(id, {
          state: view.state,
          revision: loadedRevision.current,
          scrollTop: view.scrollDOM.scrollTop,
        })
      }
      view.destroy()
      editorRegistry.view = null
      editorRegistry.docId = null
    }
  }, [])

  // Swap documents in and out of the shared view.
  useLayoutEffect(() => {
    const view = editorRegistry.view
    if (!view) return
    const prevId = editorRegistry.docId
    if (
      prevId &&
      prevId !== activeId &&
      store.getState().docs.some((d) => d.id === prevId)
    ) {
      editorRegistry.states.set(prevId, {
        state: view.state,
        revision: loadedRevision.current,
        scrollTop: view.scrollDOM.scrollTop,
      })
    }
    const doc = store.getState().docs.find((d) => d.id === activeId)
    if (!doc) {
      editorRegistry.docId = null
      return
    }
    if (prevId === doc.id) return

    const settings = store.getState().settings
    const saved = editorRegistry.states.get(doc.id)
    const reusable =
      saved &&
      saved.revision === doc.revision &&
      saved.state.doc.toString() === doc.content
    view.setState(
      reusable ? saved.state : createEditorState(doc.content, settings, hooks)
    )
    if (reusable) applySettings(view, settings)
    editorRegistry.docId = doc.id
    loadedRevision.current = doc.revision
    // A freshly shown document leads from the editor, so the preview and the
    // outline follow its restored scroll position.
    scrollSync.driver = "editor"
    reportCursor(view.state)
    const scrollTop = reusable ? saved.scrollTop : 0
    requestAnimationFrame(() => {
      view.scrollDOM.scrollTop = scrollTop
    })
    view.focus()
  }, [activeId])

  // Content replaced from outside the editor (reload from disk, task toggles without a view).
  useEffect(() => {
    const view = editorRegistry.view
    if (!view || revision === undefined || revision === loadedRevision.current)
      return
    loadedRevision.current = revision
    const doc = getActiveDoc()
    if (!doc) return
    const current = view.state.doc.toString()
    if (current === doc.content) return
    view.dispatch({
      changes: minimalChange(current, doc.content),
      userEvent: "reload",
    })
  }, [revision])

  useEffect(() => {
    const view = editorRegistry.view
    if (view) applySettings(view, store.getState().settings)
  }, [lineNumbers, lineWrap, spellcheck])

  useEffect(() => {
    editorRegistry.view?.requestMeasure()
  }, [fontSize])

  return (
    <div
      ref={hostRef}
      className="h-full min-h-0 overflow-hidden"
      data-slot="editor-host"
    />
  )
}
