import { useEffect } from "react"

import {
  handleDiskChange,
  openFolder,
  openPath,
  openWelcome,
  refreshFolder,
  refreshRecent,
  requestCloseWindow,
} from "@/lib/actions"
import { api } from "@/lib/api"
import { COMMANDS, matchesChord, runCommand } from "@/lib/commands"
import { docTitle, isDirty, useAppStore } from "@/store/app-store"

const SESSION_KEY = "md-studio:session"
const WELCOMED_KEY = "md-studio:welcomed"

type Session = { paths: string[]; active: string | null; folder: string | null }

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

function writeSession(session: Session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // storage unavailable — session restore is a convenience only
  }
}

function sessionFromState(s: ReturnType<typeof useAppStore.getState>): Session {
  const active = s.docs.find((d) => d.id === s.activeId)
  return {
    paths: s.docs.flatMap((d) => (d.path ? [d.path] : [])),
    active: active?.path ?? null,
    folder: s.folder,
  }
}

// StrictMode runs effects twice in development; startup must happen once.
let started = false
let restored = false

async function startup() {
  await refreshRecent()
  const launch = await api.takeLaunchRequest()
  const session = readSession()
  const store = useAppStore.getState()

  const folder = launch.folder ?? session?.folder
  if (folder) {
    const { sidebarOpen, sidebarTab } = store.settings
    await openFolder(folder)
    // Restoring a session shouldn't rearrange the sidebar.
    if (!launch.folder)
      useAppStore.getState().setSettings({ sidebarOpen, sidebarTab })
  }

  if (launch.files.length) {
    for (const path of launch.files) await openPath(path)
  } else if (session?.paths.length) {
    for (const path of session.paths) await openPath(path, { quiet: true })
    const active = useAppStore
      .getState()
      .docs.find((d) => d.path === session.active)
    if (active) useAppStore.getState().setActive(active.id)
  }

  let welcomed = true
  try {
    welcomed = localStorage.getItem(WELCOMED_KEY) !== null
    localStorage.setItem(WELCOMED_KEY, "1")
  } catch {
    // ignore
  }
  if (!welcomed && useAppStore.getState().docs.length === 0) openWelcome()
  restored = true
  // Save right away: later saves only happen when something changes, so a
  // session opened from the command line and never touched would be lost.
  writeSession(sessionFromState(useAppStore.getState()))
}

export function useAppLifecycle() {
  useEffect(() => {
    if (started) return
    started = true
    void startup()
  }, [])

  // Main-process events
  useEffect(() => {
    const offs = [
      api.onFileChanged(({ path, content }) => handleDiskChange(path, content)),
      api.onFolderChanged(() => void refreshFolder()),
      api.onCloseRequested(requestCloseWindow),
      api.onOpenRequest(async (req) => {
        if (req.folder) await openFolder(req.folder)
        for (const path of req.files) await openPath(path)
      }),
    ]
    return () => offs.forEach((off) => off())
  }, [])

  // Mirror document state to the main process and the saved session.
  useEffect(() => {
    let lastDirty: boolean | null = null
    let lastTitle = ""
    let lastWatched = ""
    let lastSession = ""

    const sync = (s: ReturnType<typeof useAppStore.getState>) => {
      const anyDirty = s.docs.some(isDirty)
      if (anyDirty !== lastDirty) {
        lastDirty = anyDirty
        api.setDirty(anyDirty)
      }

      const active = s.docs.find((d) => d.id === s.activeId)
      const title = active
        ? `${docTitle(active)}${isDirty(active) ? " •" : ""} — MD Studio`
        : "MD Studio"
      if (title !== lastTitle) {
        lastTitle = title
        api.setTitle(title)
        document.title = title
      }

      const paths = s.docs.flatMap((d) => (d.path ? [d.path] : []))
      const watched = paths.join("\n")
      if (watched !== lastWatched) {
        lastWatched = watched
        void api.watchFiles(paths)
      }

      if (restored) {
        const session = sessionFromState(s)
        const serialized = JSON.stringify(session)
        if (serialized !== lastSession) {
          lastSession = serialized
          writeSession(session)
        }
      }
    }

    sync(useAppStore.getState())
    return useAppStore.subscribe(sync)
  }, [])
}

/** App-level shortcuts. Capture phase, so they win over CodeMirror and inputs. */
export function useGlobalShortcuts() {
  useEffect(() => {
    const globals = COMMANDS.filter((c) => c.global && c.keys)
    const onKeyDown = (event: KeyboardEvent) => {
      for (const cmd of globals) {
        if (!matchesChord(event, cmd.keys!)) continue
        event.preventDefault()
        // Holding a key shouldn't open ten dialogs; zoom and tab cycling may repeat.
        if (
          event.repeat &&
          !cmd.id.startsWith("view.zoom") &&
          !cmd.id.endsWith("Tab")
        )
          return
        event.stopPropagation()
        runCommand(cmd.id)
        return
      }
    }
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [])
}
