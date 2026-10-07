import { getVersion } from "@tauri-apps/api/app"
import { convertFileSrc, invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { documentDir, homeDir, join } from "@tauri-apps/api/path"
import { getCurrentWebview } from "@tauri-apps/api/webview"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { open, save } from "@tauri-apps/plugin-dialog"
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener"
import { relaunch } from "@tauri-apps/plugin-process"
import { check, type Update } from "@tauri-apps/plugin-updater"

import {
  MARKDOWN_EXTENSIONS,
  type ExportTarget,
  type FileChangedEvent,
  type FileTreeNode,
  type MdStudioApi,
  type OpenRequest,
  type OpenedFile,
  type UpdateInfo,
  type WindowState,
} from "./platform"

const appWindow = getCurrentWindow()

function detectPlatform() {
  const ua = navigator.userAgent
  if (/Mac OS X|Macintosh/.test(ua)) return "darwin"
  if (/Windows/.test(ua)) return "win32"
  return "linux"
}

/** Wraps Tauri's async listen() in the synchronous unsubscribe the UI expects. */
function subscribe<T>(event: string, cb: (payload: T) => void) {
  const unlisten = listen<T>(event, (e) => cb(e.payload))
  return () => {
    void unlisten.then((off) => off())
  }
}

function unlistenAll(pending: Promise<() => void>[]) {
  return () => pending.forEach((p) => void p.then((off) => off()))
}

/** Starting location for save dialogs: the given folder, else Documents, else home. */
async function defaultPath(name: string, dir?: string) {
  if (dir) return join(dir, name)
  for (const base of [documentDir, homeDir]) {
    try {
      return await join(await base(), name)
    } catch {
      // not configured on this system; try the next one
    }
  }
  return name
}

const readFile = (path: string) => invoke<OpenedFile>("read_file", { path })

async function readWindowState(): Promise<WindowState> {
  const [maximized, fullScreen, focused] = await Promise.all([
    appWindow.isMaximized(),
    appWindow.isFullscreen(),
    appWindow.isFocused(),
  ])
  return { maximized, fullScreen, focused }
}

// Unsaved-changes guard: the close is held back while the UI has dirty
// documents and the UI is asked instead (it calls forceClose() when done).
let dirty = false
let allowClose = false
const closeListeners = new Set<() => void>()
void appWindow.onCloseRequested((event) => {
  if (dirty && !allowClose) {
    event.preventDefault()
    closeListeners.forEach((cb) => cb())
  }
})

// The window (dock/taskbar) icon follows the system light/dark setting, not
// the in-app theme toggle: the dock belongs to the OS.
let iconIsDark: boolean | null = null
function setWindowIcon(dark: boolean) {
  if (dark === iconIsDark) return
  iconIsDark = dark
  invoke("set_window_icon", { dark }).catch(() => {
    iconIsDark = null
  })
}
void appWindow.theme().then((theme) => setWindowIcon(theme === "dark"))
void appWindow.onThemeChanged(({ payload }) =>
  setWindowIcon(payload === "dark")
)
// On Linux, Tauri 2.12 neither emits theme-changed nor updates theme() when
// the system switches while the app runs, but WebKitGTK's prefers-color-scheme
// does follow it (and, unlike the <html> class, ignores the in-app toggle).
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", (e) => setWindowIcon(e.matches))

/** The update found by the last check, kept for installUpdate(). */
let pendingUpdate: Update | null = null

export const tauriApi: MdStudioApi = {
  platform: detectPlatform(),

  async openFileDialog() {
    const selected = await open({
      title: "Open Markdown",
      multiple: true,
      filters: [
        { name: "Markdown", extensions: MARKDOWN_EXTENSIONS },
        { name: "All files", extensions: ["*"] },
      ],
    })
    if (!selected) return []
    const paths = Array.isArray(selected) ? selected : [selected]
    return Promise.all(paths.map(readFile))
  },
  async openFolderDialog() {
    const selected = await open({ title: "Open Folder", directory: true })
    return typeof selected === "string" ? selected : null
  },
  readFile,
  writeFile: (path, content) => invoke("write_file", { path, content }),
  async saveAsDialog(suggestedName, defaultDir) {
    return save({
      title: "Save Markdown",
      defaultPath: await defaultPath(suggestedName, defaultDir),
      filters: [{ name: "Markdown", extensions: ["md", "markdown", "txt"] }],
    })
  },
  listFolder: (root) => invoke<FileTreeNode>("list_folder", { root }),
  watchFiles: (paths) => invoke("watch_files", { paths }),

  async exportHtml(target: ExportTarget, html: string) {
    const path = await save({
      title: "Export HTML",
      defaultPath: await defaultPath(
        `${target.suggestedName}.html`,
        target.defaultDir
      ),
      filters: [{ name: "HTML", extensions: ["html"] }],
    })
    if (!path) return null
    await invoke("write_file", { path, content: html })
    return path
  },
  async exportPdf(target: ExportTarget) {
    const path = await save({
      title: "Export PDF",
      defaultPath: await defaultPath(
        `${target.suggestedName}.pdf`,
        target.defaultDir
      ),
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    })
    if (!path) return null
    try {
      await invoke("export_pdf", { path })
      return path
    } catch (err) {
      // No direct PDF printing on this platform: hand over to the print dialog.
      if (String(err).includes("unsupported")) {
        window.print()
        return null
      }
      throw err
    }
  },

  takeLaunchRequest: () => invoke<OpenRequest>("take_launch_request"),
  openExternal: (url) => openUrl(url),
  showInFolder: (path) => revealItemInDir(path),
  getRecent: () => invoke<string[]>("get_recent"),
  addRecent: (path) => invoke<string[]>("add_recent", { path }),
  clearRecent: () => invoke("clear_recent"),

  getVersion,
  async checkForUpdate(): Promise<UpdateInfo | null> {
    pendingUpdate = await check()
    if (!pendingUpdate) return null
    const installKind = await invoke<string | null>("install_kind")
    return {
      canInstall: installKind !== null,
      version: pendingUpdate.version,
      currentVersion: pendingUpdate.currentVersion,
      notes: pendingUpdate.body ?? null,
      date: pendingUpdate.date ?? null,
    }
  },
  async installUpdate(onProgress) {
    if (!pendingUpdate) throw new Error("No update to install. Check again.")
    let downloaded = 0
    let total: number | null = null
    // On Linux a .deb install asks for the user's password (pkexec);
    // an AppImage is replaced in place.
    await pendingUpdate.downloadAndInstall((event) => {
      if (event.event === "Started") total = event.data.contentLength ?? null
      else if (event.event === "Progress") downloaded += event.data.chunkLength
      onProgress({ downloaded, total })
    })
  },
  restartApp: () => relaunch(),

  toAssetUrl: (path) => convertFileSrc(path),
  pathKind: (path) => invoke<"file" | "dir" | null>("path_kind", { path }),
  onFileDrop(cb) {
    const ratio = () => window.devicePixelRatio || 1
    return unlistenAll([
      getCurrentWebview().onDragDropEvent((event) => {
        if (event.payload.type !== "drop") return
        const { paths, position } = event.payload
        cb({ paths, x: position.x / ratio(), y: position.y / ratio() })
      }),
    ])
  },

  setDirty: (value) => {
    dirty = value
  },
  setTitle: (title) => void appWindow.setTitle(title),
  forceClose: () => {
    allowClose = true
    void appWindow.destroy()
  },
  toggleDevTools: () => void invoke("toggle_devtools"),

  window: {
    getState: readWindowState,
    minimize: () => void appWindow.minimize(),
    toggleMaximize: () => void appWindow.toggleMaximize(),
    close: () => void appWindow.close(),
    onState: (cb) =>
      unlistenAll([
        appWindow.onResized(() => void readWindowState().then(cb)),
        appWindow.onFocusChanged(() => void readWindowState().then(cb)),
      ]),
  },

  onFileChanged: (cb) => subscribe<FileChangedEvent>("file:changed", cb),
  // Refresh the folder tree whenever the window regains focus.
  onFolderChanged: (cb) =>
    unlistenAll([appWindow.onFocusChanged(({ payload }) => payload && cb())]),
  onOpenRequest: (cb) => subscribe<OpenRequest>("app:open-request", cb),
  onCloseRequested: (cb) => {
    closeListeners.add(cb)
    return () => {
      closeListeners.delete(cb)
    }
  },
}
