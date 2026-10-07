import { useEffect, useRef } from "react"
import type { PanelImperativeHandle } from "react-resizable-panels"

import { AppHeader } from "@/components/app-header"
import { CommandPalette } from "@/components/command-palette"
import { ShortcutsDialog, UnsavedChangesDialog } from "@/components/dialogs"
import { AboutDialog, UpdateDialog } from "@/components/update-dialog"
import { DocTabs } from "@/components/doc-tabs"
import { EmptyWorkspace } from "@/components/empty-workspace"
import { AppSidebar } from "@/components/sidebar/app-sidebar"
import { StatusBar } from "@/components/status-bar"
import { useTheme } from "@/components/theme-provider"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Workspace } from "@/components/workspace"
import { dropPathsIntoEditor } from "@/components/editor/markdown-editor"
import { useAppLifecycle, useGlobalShortcuts } from "@/hooks/use-app-lifecycle"
import { useWindowState } from "@/hooks/use-window-state"
import { openDroppedPaths } from "@/lib/actions"
import { api, isMac } from "@/lib/api"
import { themeBridge } from "@/lib/commands"
import { editorRegistry } from "@/lib/editor/registry"
import { startAutomaticChecks } from "@/lib/updates"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/app-store"

function MainArea() {
  const hasDocs = useAppStore((s) => s.docs.length > 0)
  if (!hasDocs) return <EmptyWorkspace />
  return (
    <div className="flex h-full min-h-0 flex-col">
      <DocTabs />
      <Workspace />
    </div>
  )
}

export function App() {
  useAppLifecycle()
  useGlobalShortcuts()
  useEffect(() => startAutomaticChecks(), [])

  const { setTheme } = useTheme()
  useEffect(() => {
    themeBridge.setTheme = setTheme
  }, [setTheme])

  const fontSize = useAppStore((s) => s.settings.fontSize)
  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty("--editor-font-size", `${fontSize}px`)
    root.setProperty("--preview-font-size", `${fontSize + 1}px`)
  }, [fontSize])

  // Files dropped from the OS arrive as native events with real paths. Images
  // over the editor become links; anything else opens.
  useEffect(
    () =>
      api.onFileDrop(({ paths, x, y }) => {
        const view = editorRegistry.view
        const target = document.elementFromPoint(x, y)
        if (view && target?.closest(".cm-editor")) {
          const pos =
            view.posAtCoords({ x, y }) ?? view.state.selection.main.head
          dropPathsIntoEditor(view, paths, pos)
        } else {
          void openDroppedPaths(paths)
        }
      }),
    []
  )

  const { maximized, fullScreen } = useWindowState()
  const framed = !isMac && !maximized && !fullScreen

  const sidebarOpen = useAppStore((s) => s.settings.sidebarOpen)
  const sidebarRef = useRef<PanelImperativeHandle | null>(null)
  const sidebarWidth = useRef(264)
  useEffect(() => {
    const panel = sidebarRef.current
    if (!panel) return
    // expand() falls back to minSize, so restore the last width explicitly.
    if (sidebarOpen && panel.isCollapsed()) panel.resize(sidebarWidth.current)
    if (!sidebarOpen && !panel.isCollapsed()) panel.collapse()
  }, [sidebarOpen])

  return (
    <TooltipProvider delayDuration={500}>
      <div className={cn("flex h-full flex-col", framed && "border")}>
        <AppHeader />
        <ResizablePanelGroup
          orientation="horizontal"
          className="min-h-0 flex-1"
        >
          <ResizablePanel
            id="sidebar"
            panelRef={sidebarRef}
            defaultSize={sidebarOpen ? 264 : 0}
            minSize={190}
            maxSize={480}
            collapsible
            collapsedSize={0}
            groupResizeBehavior="preserve-pixel-size"
            inert={!sidebarOpen}
            onResize={(size) => {
              const open = size.inPixels > 0
              if (open) sidebarWidth.current = size.inPixels
              if (open !== useAppStore.getState().settings.sidebarOpen) {
                useAppStore.getState().setSettings({ sidebarOpen: open })
              }
            }}
          >
            <AppSidebar />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel id="main" minSize={360}>
            <MainArea />
          </ResizablePanel>
        </ResizablePanelGroup>
        <StatusBar />
      </div>
      <CommandPalette />
      <ShortcutsDialog />
      <UnsavedChangesDialog />
      <UpdateDialog />
      <AboutDialog />
      <Toaster position="bottom-right" offset={{ bottom: 40, right: 16 }} />
    </TooltipProvider>
  )
}

export default App
