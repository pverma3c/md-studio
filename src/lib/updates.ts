import { toast } from "sonner"
import { create } from "zustand"

import { api } from "@/lib/api"
import type { UpdateInfo, UpdateProgress } from "@/lib/platform"
import { useAppStore } from "@/store/app-store"

export const RELEASES_URL = "https://github.com/pverma3c/md-studio/releases"

export type UpdateStatus =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "ready"
  | "error"

type UpdateState = {
  status: UpdateStatus
  currentVersion: string | null
  info: UpdateInfo | null
  progress: UpdateProgress | null
  error: string | null
  dialogOpen: boolean
  aboutOpen: boolean
}

export const useUpdateStore = create<UpdateState>()(() => ({
  status: "idle",
  currentVersion: null,
  info: null,
  progress: null,
  error: null,
  dialogOpen: false,
  aboutOpen: false,
}))

const set = useUpdateStore.setState

const message = (err: unknown) =>
  err instanceof Error ? err.message : String(err)

export const openUpdateDialog = () => set({ dialogOpen: true })
export const setUpdateDialogOpen = (dialogOpen: boolean) => set({ dialogOpen })
export const setAboutOpen = (aboutOpen: boolean) => set({ aboutOpen })

export async function loadCurrentVersion() {
  try {
    set({ currentVersion: await api.getVersion() })
  } catch {
    // only cosmetic
  }
}

/**
 * Looks for a newer release. Automatic checks stay quiet unless one is found;
 * a manual check always reports back.
 */
export async function checkForUpdates({ manual = false } = {}) {
  const { status } = useUpdateStore.getState()
  if (status === "checking" || status === "downloading") return
  if (status === "ready") {
    if (manual) openUpdateDialog()
    return
  }
  set({ status: "checking", error: null })
  try {
    const info = await api.checkForUpdate()
    if (!info) {
      set({ status: "up-to-date", info: null })
      if (manual) {
        const v = useUpdateStore.getState().currentVersion
        toast.success("MD Studio is up to date", {
          description: v ? `You have the latest version, ${v}.` : undefined,
        })
      }
      return
    }
    set({ status: "available", info })
    if (manual) {
      openUpdateDialog()
    } else {
      toast.message(`MD Studio ${info.version} is available`, {
        description: `You have ${info.currentVersion}.`,
        duration: 15000,
        action: { label: "View", onClick: openUpdateDialog },
      })
    }
  } catch (err) {
    set({ status: "error", error: message(err) })
    if (manual) {
      toast.error("Couldn't check for updates", { description: message(err) })
    }
  }
}

export async function installUpdate() {
  set({
    status: "downloading",
    progress: { downloaded: 0, total: null },
    error: null,
  })
  try {
    await api.installUpdate((progress) => set({ progress }))
    set({ status: "ready" })
  } catch (err) {
    set({ status: "error", error: message(err) })
  }
}

export function restartToUpdate() {
  void api.restartApp()
}

const RECHECK_MS = 6 * 60 * 60 * 1000

/** Startup check (after the window has settled) plus a periodic re-check. */
export function startAutomaticChecks() {
  void loadCurrentVersion()
  const run = () => {
    if (useAppStore.getState().settings.checkUpdates) void checkForUpdates()
  }
  const first = setTimeout(run, 4000)
  const every = setInterval(run, RECHECK_MS)
  return () => {
    clearTimeout(first)
    clearInterval(every)
  }
}
