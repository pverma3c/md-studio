// The native platform interface. The UI only talks to the OS through this;
// src/lib/tauri-api.ts implements it on top of Tauri.

export type FileTreeNode = {
  name: string
  path: string
  kind: "file" | "dir"
  children?: FileTreeNode[]
}

export type OpenedFile = {
  path: string
  content: string
}

export type FileChangedEvent = {
  path: string
  content: string | null // null when the file was deleted or renamed away
}

export type ExportTarget = {
  suggestedName: string
  defaultDir?: string
}

/** Paths handed to the app from the command line, a second launch or Finder. */
export type OpenRequest = {
  files: string[]
  folder?: string
}

export type WindowState = {
  maximized: boolean
  fullScreen: boolean
  focused: boolean
}

export type FileDrop = {
  paths: string[]
  x: number
  y: number
}

export type UpdateInfo = {
  version: string
  currentVersion: string
  /** Release notes (Markdown), from the GitHub release body. */
  notes: string | null
  date: string | null
}

export type UpdateProgress = {
  downloaded: number
  /** Null when the server doesn't send a size. */
  total: number | null
}

export type MdStudioApi = {
  platform: string
  openFileDialog: () => Promise<OpenedFile[]>
  openFolderDialog: () => Promise<string | null>
  readFile: (path: string) => Promise<OpenedFile>
  writeFile: (path: string, content: string) => Promise<void>
  saveAsDialog: (
    suggestedName: string,
    defaultDir?: string
  ) => Promise<string | null>
  listFolder: (path: string) => Promise<FileTreeNode>
  watchFiles: (paths: string[]) => Promise<void>
  /** Saves `html` as a standalone page. Resolves to the written path, or null if cancelled. */
  exportHtml: (target: ExportTarget, html: string) => Promise<string | null>
  /** Prints the window's #print-root (see print CSS) to a PDF. */
  exportPdf: (target: ExportTarget) => Promise<string | null>
  takeLaunchRequest: () => Promise<OpenRequest>
  openExternal: (url: string) => Promise<void>
  showInFolder: (path: string) => Promise<void>
  getRecent: () => Promise<string[]>
  addRecent: (path: string) => Promise<string[]>
  clearRecent: () => Promise<void>
  getVersion: () => Promise<string>
  /** Resolves to the newer release, or null when this is the latest. */
  checkForUpdate: () => Promise<UpdateInfo | null>
  /** Downloads, verifies and installs the update found by the last check. */
  installUpdate: (
    onProgress: (progress: UpdateProgress) => void
  ) => Promise<void>
  restartApp: () => Promise<void>
  /** URL the webview can load a local file from (images in the preview). */
  toAssetUrl: (path: string) => string
  pathKind: (path: string) => Promise<"file" | "dir" | null>
  /** Files dropped from the OS; x/y are CSS pixels relative to the window. */
  onFileDrop: (cb: (drop: FileDrop) => void) => () => void
  setDirty: (dirty: boolean) => void
  setTitle: (title: string) => void
  forceClose: () => void
  toggleDevTools: () => void
  window: {
    getState: () => Promise<WindowState | null>
    minimize: () => void
    toggleMaximize: () => void
    close: () => void
    onState: (cb: (state: WindowState) => void) => () => void
  }
  onFileChanged: (cb: (e: FileChangedEvent) => void) => () => void
  onFolderChanged: (cb: () => void) => () => void
  onOpenRequest: (cb: (req: OpenRequest) => void) => () => void
  onCloseRequested: (cb: () => void) => () => void
}

export const MARKDOWN_EXTENSIONS = [
  "md",
  "markdown",
  "mdown",
  "mkd",
  "mdx",
  "txt",
]
