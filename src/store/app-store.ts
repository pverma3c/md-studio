import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { FileTreeNode } from "@/lib/api"
import { basename } from "@/lib/paths"

export type ViewMode = "editor" | "split" | "preview"
export type SidebarTab = "files" | "outline"
export type PreviewWidth = "narrow" | "medium" | "wide" | "full"
export type PreviewDensity = "compact" | "comfortable" | "spacious"
/** "document" is the GitHub-like page; "app" renders elements as shadcn/ui components. */
export type PreviewStyle = "document" | "app"

export type Doc = {
  id: string
  /** null for untitled documents that have never been saved */
  path: string | null
  untitledName: string
  content: string
  savedContent: string
  /** Bumped whenever content is replaced from outside the editor (e.g. reload from disk). */
  revision: number
  /** Disk content that arrived while the document had unsaved edits. */
  diskConflict: string | null
  /** The file disappeared from disk. */
  missing: boolean
}

export type Settings = {
  viewMode: ViewMode
  sidebarOpen: boolean
  sidebarTab: SidebarTab
  fontSize: number
  lineWrap: boolean
  lineNumbers: boolean
  syncScroll: boolean
  spellcheck: boolean
  previewFont: "sans" | "serif"
  previewWidth: PreviewWidth
  /** Space around the preview content, in px. */
  previewPadding: number
  previewDensity: PreviewDensity
  previewStyle: PreviewStyle
  /** Look for a new release on startup and every few hours. */
  checkUpdates: boolean
}

export type PendingClose =
  { kind: "docs"; ids: string[] } | { kind: "window" } | null

type AppState = {
  docs: Doc[]
  activeId: string | null
  folder: string | null
  tree: FileTreeNode | null
  recent: string[]
  settings: Settings
  cursor: { line: number; col: number; selected: number }
  /** Source line at the reading position of whichever pane is being scrolled. */
  readingLine: number
  palette: "files" | "commands" | null
  shortcutsOpen: boolean
  pendingClose: PendingClose

  addDoc: (
    doc: Omit<
      Doc,
      "id" | "revision" | "diskConflict" | "missing" | "untitledName"
    > & { untitledName?: string }
  ) => string
  updateDoc: (id: string, patch: Partial<Doc>) => void
  setContent: (id: string, content: string) => void
  replaceContent: (id: string, content: string, markSaved?: boolean) => void
  removeDocs: (ids: string[]) => void
  setActive: (id: string | null) => void
  moveDoc: (from: number, to: number) => void
  setFolder: (folder: string | null, tree?: FileTreeNode | null) => void
  setTree: (tree: FileTreeNode | null) => void
  setRecent: (recent: string[]) => void
  setSettings: (patch: Partial<Settings>) => void
  setCursor: (cursor: AppState["cursor"]) => void
  setReadingLine: (line: number) => void
  setPalette: (palette: AppState["palette"]) => void
  setShortcutsOpen: (open: boolean) => void
  setPendingClose: (pending: PendingClose) => void
}

let docCounter = 0
let untitledCounter = 0

export const DEFAULT_SETTINGS: Settings = {
  viewMode: "split",
  sidebarOpen: true,
  sidebarTab: "files",
  fontSize: 15,
  lineWrap: true,
  lineNumbers: false,
  syncScroll: true,
  spellcheck: false,
  previewFont: "sans",
  previewWidth: "full",
  previewPadding: 24,
  previewDensity: "comfortable",
  checkUpdates: true,
  previewStyle: "document",
}

/** Max content width for each preview width option (null = no limit). */
export const PREVIEW_WIDTHS: Record<PreviewWidth, number | null> = {
  narrow: 680,
  medium: 860,
  wide: 1120,
  full: null,
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      docs: [],
      activeId: null,
      folder: null,
      tree: null,
      recent: [],
      settings: DEFAULT_SETTINGS,
      cursor: { line: 1, col: 1, selected: 0 },
      readingLine: 1,
      palette: null,
      shortcutsOpen: false,
      pendingClose: null,

      addDoc: (input) => {
        const id = `doc-${++docCounter}`
        const untitledName =
          input.untitledName ??
          (input.path ? "" : `Untitled-${++untitledCounter}`)
        const doc: Doc = {
          ...input,
          id,
          untitledName,
          revision: 0,
          diskConflict: null,
          missing: false,
        }
        set((s) => {
          const at = s.docs.findIndex((d) => d.id === s.activeId)
          const docs = [...s.docs]
          docs.splice(at < 0 ? docs.length : at + 1, 0, doc)
          return { docs, activeId: id }
        })
        return id
      },
      updateDoc: (id, patch) =>
        set((s) => ({
          docs: s.docs.map((d) => (d.id === id ? { ...d, ...patch } : d)),
        })),
      setContent: (id, content) =>
        set((s) => ({
          docs: s.docs.map((d) => (d.id === id ? { ...d, content } : d)),
        })),
      replaceContent: (id, content, markSaved = false) =>
        set((s) => ({
          docs: s.docs.map((d) =>
            d.id === id
              ? {
                  ...d,
                  content,
                  savedContent: markSaved ? content : d.savedContent,
                  revision: d.revision + 1,
                  diskConflict: null,
                  missing: false,
                }
              : d
          ),
        })),
      removeDocs: (ids) =>
        set((s) => {
          const remaining = s.docs.filter((d) => !ids.includes(d.id))
          let activeId = s.activeId
          if (activeId && ids.includes(activeId)) {
            // Prefer the tab to the right of the closed one, like most editors.
            const oldIndex = s.docs.findIndex((d) => d.id === activeId)
            const candidates = s.docs
              .slice(oldIndex + 1)
              .concat(s.docs.slice(0, oldIndex).reverse())
            activeId = candidates.find((d) => !ids.includes(d.id))?.id ?? null
          }
          return { docs: remaining, activeId }
        }),
      setActive: (activeId) => set({ activeId }),
      moveDoc: (from, to) =>
        set((s) => {
          const docs = [...s.docs]
          const [moved] = docs.splice(from, 1)
          docs.splice(to, 0, moved)
          return { docs }
        }),
      setFolder: (folder, tree = null) => set({ folder, tree }),
      setTree: (tree) => set({ tree }),
      setRecent: (recent) => set({ recent }),
      setSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
      setCursor: (cursor) => set({ cursor }),
      setReadingLine: (readingLine) => set({ readingLine }),
      setPalette: (palette) => set({ palette }),
      setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
      setPendingClose: (pendingClose) => set({ pendingClose }),
    }),
    {
      name: "md-studio:settings",
      partialize: (s) => ({ settings: s.settings }),
      merge: (persisted, current) => ({
        ...current,
        settings: {
          ...DEFAULT_SETTINGS,
          ...(persisted as Partial<AppState>)?.settings,
        },
      }),
    }
  )
)

export const isDirty = (doc: Doc) => doc.content !== doc.savedContent

export const docTitle = (doc: Doc) =>
  doc.path ? basename(doc.path) : doc.untitledName

export const useActiveDoc = () =>
  useAppStore((s) => s.docs.find((d) => d.id === s.activeId) ?? null)

export const getActiveDoc = () => {
  const s = useAppStore.getState()
  return s.docs.find((d) => d.id === s.activeId) ?? null
}
