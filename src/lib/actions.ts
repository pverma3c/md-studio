import { toast } from "sonner"

import { api } from "@/lib/api"
import { forgetEditorState } from "@/lib/editor/registry"
import { exportDocHtml, exportDocPdf } from "@/lib/export"
import { extractOutline } from "@/lib/markdown/analyze"
import { basename, dirname, isMarkdownPath } from "@/lib/paths"
import { WELCOME_DOC } from "@/lib/welcome"
import {
  docTitle,
  getActiveDoc,
  isDirty,
  useAppStore,
  type Doc,
  type ViewMode,
} from "@/store/app-store"

const store = useAppStore

const errorMessage = (err: unknown) =>
  err instanceof Error
    ? err.message.replace(
        /^Error invoking remote method '[^']+': (Error: )?/,
        ""
      )
    : String(err)

// ---------------------------------------------------------------------------
// Opening

export function newDocument(content = "", untitledName?: string) {
  return store
    .getState()
    .addDoc({ path: null, content, savedContent: content, untitledName })
}

export function openWelcome() {
  const existing = store
    .getState()
    .docs.find((d) => !d.path && d.untitledName === "Welcome.md")
  if (existing) {
    store.getState().setActive(existing.id)
    return
  }
  newDocument(WELCOME_DOC, "Welcome.md")
}

export async function refreshRecent() {
  store.getState().setRecent(await api.getRecent())
}

export async function openPath(path: string, { quiet = false } = {}) {
  const existing = store.getState().docs.find((d) => d.path === path)
  if (existing) {
    store.getState().setActive(existing.id)
    return existing.id
  }
  try {
    const file = await api.readFile(path)
    // Replace a pristine, empty untitled tab instead of stacking another one.
    const active = getActiveDoc()
    const id = store.getState().addDoc({
      path: file.path,
      content: file.content,
      savedContent: file.content,
    })
    if (active && !active.path && !active.content && !isDirty(active))
      closeDocsNow([active.id])
    store.getState().setRecent(await api.addRecent(file.path))
    return id
  } catch (err) {
    if (!quiet)
      toast.error(`Couldn't open ${basename(path)}`, {
        description: errorMessage(err),
      })
    return null
  }
}

export async function openFileDialog() {
  const files = await api.openFileDialog()
  for (const file of files) await openPath(file.path)
}

export async function openFolder(path?: string) {
  const folder = path ?? (await api.openFolderDialog())
  if (!folder) return
  try {
    const tree = await api.listFolder(folder)
    store.getState().setFolder(folder, tree)
    store.getState().setSettings({ sidebarOpen: true, sidebarTab: "files" })
  } catch (err) {
    toast.error("Couldn't open folder", { description: errorMessage(err) })
  }
}

export async function refreshFolder() {
  const { folder } = store.getState()
  if (!folder) return
  try {
    const tree = await api.listFolder(folder)
    if (store.getState().folder === folder) store.getState().setTree(tree)
  } catch {
    // folder vanished; keep the stale tree
  }
}

export function closeFolder() {
  store.getState().setFolder(null, null)
}

/** Files or folders dropped onto the window (outside the editor). */
export async function openDroppedPaths(paths: string[]) {
  for (const path of paths) {
    const kind = await api.pathKind(path)
    if (kind === "dir") await openFolder(path)
    else if (kind === "file" && isMarkdownPath(path)) await openPath(path)
    else if (kind === "file")
      toast.message(`${basename(path)} isn't a markdown file`)
  }
}

// ---------------------------------------------------------------------------
// Saving

function suggestedFileName(doc: Doc) {
  if (doc.path) return basename(doc.path)
  const heading = extractOutline(doc.content).find((h) => h.level === 1)?.text
  const base = (heading ?? doc.untitledName.replace(/\.md$/, ""))
    .replace(/[\\/:*?"<>|]+/g, "")
    .trim()
    .slice(0, 80)
  return `${base || "Untitled"}.md`
}

async function writeDoc(doc: Doc, path: string) {
  const content = doc.content
  await api.writeFile(path, content)
  const latest = store.getState().docs.find((d) => d.id === doc.id)
  store.getState().updateDoc(doc.id, {
    path,
    savedContent: content,
    // Edits typed while the write was in flight stay dirty.
    content: latest?.content ?? content,
    diskConflict: null,
    missing: false,
  })
  store.getState().setRecent(await api.addRecent(path))
  const { folder } = store.getState()
  if (folder && path.startsWith(folder)) refreshFolder()
}

export async function saveDoc(id?: string): Promise<boolean> {
  const doc = id
    ? store.getState().docs.find((d) => d.id === id)
    : getActiveDoc()
  if (!doc) return false
  if (!doc.path) return saveDocAs(doc.id)
  try {
    await writeDoc(doc, doc.path)
    return true
  } catch (err) {
    toast.error(`Couldn't save ${docTitle(doc)}`, {
      description: errorMessage(err),
    })
    return false
  }
}

export async function saveDocAs(id?: string): Promise<boolean> {
  const doc = id
    ? store.getState().docs.find((d) => d.id === id)
    : getActiveDoc()
  if (!doc) return false
  const { folder } = store.getState()
  const dir = doc.path ? dirname(doc.path) : (folder ?? undefined)
  const path = await api.saveAsDialog(suggestedFileName(doc), dir)
  if (!path) return false
  try {
    const other = store
      .getState()
      .docs.find((d) => d.path === path && d.id !== doc.id)
    if (other) closeDocsNow([other.id])
    await writeDoc(doc, path)
    toast.success(`Saved ${basename(path)}`)
    return true
  } catch (err) {
    toast.error(`Couldn't save ${basename(path)}`, {
      description: errorMessage(err),
    })
    return false
  }
}

export async function saveAll() {
  for (const doc of store.getState().docs.filter(isDirty)) {
    if (!(await saveDoc(doc.id))) return false
  }
  return true
}

// ---------------------------------------------------------------------------
// Closing

export function closeDocsNow(ids: string[]) {
  ids.forEach(forgetEditorState)
  store.getState().removeDocs(ids)
}

export function requestCloseDocs(ids: string[]) {
  const dirty = store
    .getState()
    .docs.filter((d) => ids.includes(d.id) && isDirty(d))
  if (dirty.length) store.getState().setPendingClose({ kind: "docs", ids })
  else closeDocsNow(ids)
}

export function closeActiveDoc() {
  const doc = getActiveDoc()
  if (doc) requestCloseDocs([doc.id])
}

export function closeOtherDocs(keepId: string) {
  requestCloseDocs(
    store
      .getState()
      .docs.filter((d) => d.id !== keepId)
      .map((d) => d.id)
  )
}

export function requestCloseWindow() {
  if (store.getState().docs.some(isDirty))
    store.getState().setPendingClose({ kind: "window" })
  else api.forceClose()
}

// ---------------------------------------------------------------------------
// Disk sync

export async function reloadFromDisk(id: string) {
  const doc = store.getState().docs.find((d) => d.id === id)
  if (!doc?.path) return
  try {
    const file = await api.readFile(doc.path)
    store.getState().replaceContent(id, file.content, true)
  } catch (err) {
    toast.error(`Couldn't reload ${docTitle(doc)}`, {
      description: errorMessage(err),
    })
  }
}

export function keepLocalVersion(id: string) {
  store.getState().updateDoc(id, { diskConflict: null })
}

export function handleDiskChange(path: string, content: string | null) {
  for (const doc of store.getState().docs.filter((d) => d.path === path)) {
    if (content === null) {
      store.getState().updateDoc(doc.id, { missing: true })
    } else if (content === doc.savedContent) {
      // Our own save echoing back, or a no-op touch.
      if (doc.missing) store.getState().updateDoc(doc.id, { missing: false })
    } else if (!isDirty(doc)) {
      store.getState().replaceContent(doc.id, content, true)
    } else {
      store
        .getState()
        .updateDoc(doc.id, { diskConflict: content, missing: false })
    }
  }
}

// ---------------------------------------------------------------------------
// View

export function setViewMode(viewMode: ViewMode) {
  store.getState().setSettings({ viewMode })
}

export function toggleSidebar(tab?: "files" | "outline") {
  const { sidebarOpen, sidebarTab } = store.getState().settings
  if (tab && sidebarOpen && sidebarTab !== tab)
    store.getState().setSettings({ sidebarTab: tab })
  else
    store.getState().setSettings({
      sidebarOpen: !sidebarOpen,
      ...(tab ? { sidebarTab: tab } : {}),
    })
}

export function zoom(direction: 1 | -1 | 0) {
  const { fontSize } = store.getState().settings
  const next =
    direction === 0 ? 15 : Math.min(26, Math.max(11, fontSize + direction))
  store.getState().setSettings({ fontSize: next })
}

export function cycleDoc(delta: 1 | -1) {
  const { docs, activeId } = store.getState()
  if (docs.length < 2) return
  const i = docs.findIndex((d) => d.id === activeId)
  store.getState().setActive(docs[(i + delta + docs.length) % docs.length].id)
}

export function revealActiveInFolder() {
  const doc = getActiveDoc()
  if (doc?.path) api.showInFolder(doc.path)
}

export async function copyActivePath() {
  const doc = getActiveDoc()
  if (!doc?.path) return
  await navigator.clipboard.writeText(doc.path)
  toast.success("Path copied")
}

// ---------------------------------------------------------------------------
// Export

export async function exportActive(format: "html" | "pdf") {
  const doc = getActiveDoc()
  if (!doc) return
  const id = toast.loading(`Exporting ${format.toUpperCase()}…`)
  try {
    const written =
      format === "html" ? await exportDocHtml(doc) : await exportDocPdf(doc)
    if (written) {
      toast.success(`Exported ${basename(written)}`, {
        id,
        action: { label: "Show", onClick: () => api.showInFolder(written) },
      })
    } else {
      toast.dismiss(id)
    }
  } catch (err) {
    toast.error("Export failed", { id, description: errorMessage(err) })
  }
}
