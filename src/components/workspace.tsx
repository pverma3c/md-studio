import {
  DownloadIcon,
  FileCodeIcon,
  FileDownIcon,
  FileWarningIcon,
  LayoutDashboardIcon,
  RefreshCwIcon,
  TypeIcon,
  UnlinkIcon,
  LinkIcon,
} from "lucide-react"
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react"
import type {
  GroupImperativeHandle,
  Layout,
  LayoutChangedMeta,
} from "react-resizable-panels"

import { EditorToolbar } from "@/components/editor/editor-toolbar"
import { MarkdownEditor } from "@/components/editor/markdown-editor"
import { MarkdownPreview } from "@/components/preview/markdown-preview"
import { PreviewLayoutMenu } from "@/components/preview/preview-layout-menu"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Toggle } from "@/components/ui/toggle"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useScrollSync } from "@/hooks/use-scroll-sync"
import {
  exportActive,
  keepLocalVersion,
  reloadFromDisk,
  saveDocAs,
  setViewMode,
} from "@/lib/actions"
import { toggleTaskAtLine, toggleTaskInSource } from "@/lib/editor/commands"
import { editorRegistry } from "@/lib/editor/registry"
import { cn } from "@/lib/utils"
import {
  getActiveDoc,
  PREVIEW_WIDTHS,
  useActiveDoc,
  useAppStore,
  type ViewMode,
} from "@/store/app-store"

function layoutFor(mode: ViewMode, split: number): Layout {
  if (mode === "editor") return { editor: 100, preview: 0 }
  if (mode === "preview") return { editor: 0, preview: 100 }
  return { editor: split, preview: 100 - split }
}

function DiskNotice() {
  const doc = useActiveDoc()
  if (!doc) return null
  if (doc.diskConflict !== null) {
    return (
      <Alert className="mx-3 mt-3 w-auto">
        <FileWarningIcon />
        <AlertTitle>Changed on disk</AlertTitle>
        <AlertDescription>
          Another program modified this file while you had unsaved edits.
        </AlertDescription>
        <AlertAction className="flex gap-1.5">
          <Button
            size="xs"
            variant="outline"
            onClick={() => keepLocalVersion(doc.id)}
          >
            Keep mine
          </Button>
          <Button size="xs" onClick={() => reloadFromDisk(doc.id)}>
            <RefreshCwIcon data-icon="inline-start" />
            Reload
          </Button>
        </AlertAction>
      </Alert>
    )
  }
  if (doc.missing) {
    return (
      <Alert variant="destructive" className="mx-3 mt-3 w-auto">
        <FileWarningIcon />
        <AlertTitle>File not found on disk</AlertTitle>
        <AlertDescription>
          It was moved or deleted. Saving will recreate it.
        </AlertDescription>
        <AlertAction>
          <Button size="xs" variant="outline" onClick={() => saveDocAs(doc.id)}>
            Save As…
          </Button>
        </AlertAction>
      </Alert>
    )
  }
  return null
}

function PreviewHeader() {
  const syncScroll = useAppStore((s) => s.settings.syncScroll)
  const previewFont = useAppStore((s) => s.settings.previewFont)
  const previewStyle = useAppStore((s) => s.settings.previewStyle)
  const setSettings = useAppStore((s) => s.setSettings)
  return (
    <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b px-3">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Preview
      </span>
      <div className="flex items-center gap-0.5">
        <PreviewLayoutMenu />
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              aria-label="App UI style"
              pressed={previewStyle === "app"}
              onPressedChange={(on) =>
                setSettings({ previewStyle: on ? "app" : "document" })
              }
            >
              <LayoutDashboardIcon />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>
            {previewStyle === "app" ? "App UI style on" : "App UI style off"}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              aria-label="Serif reading font"
              pressed={previewFont === "serif"}
              onPressedChange={(on) =>
                setSettings({ previewFont: on ? "serif" : "sans" })
              }
            >
              <TypeIcon />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>Serif reading font</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              aria-label="Sync scrolling"
              pressed={syncScroll}
              onPressedChange={(on) => setSettings({ syncScroll: on })}
            >
              {syncScroll ? <LinkIcon /> : <UnlinkIcon />}
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>
            {syncScroll ? "Scroll sync on" : "Scroll sync off"}
          </TooltipContent>
        </Tooltip>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Export">
                  <DownloadIcon />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Export</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-auto">
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => exportActive("html")}>
                <FileCodeIcon />
                Export as HTML…
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportActive("pdf")}>
                <FileDownIcon />
                Export as PDF…
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

function PreviewPane({
  scrollRef,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>
}) {
  const doc = useActiveDoc()
  const folder = useAppStore((s) => s.folder)
  const font = useAppStore((s) => s.settings.previewFont)
  const density = useAppStore((s) => s.settings.previewDensity)
  const previewStyle = useAppStore((s) => s.settings.previewStyle)
  const padding = useAppStore((s) => s.settings.previewPadding)
  const maxWidth = PREVIEW_WIDTHS[useAppStore((s) => s.settings.previewWidth)]
  const source = useDeferredValue(doc?.content ?? "")

  const onToggleTask = useCallback((line: number) => {
    if (editorRegistry.view && toggleTaskAtLine(editorRegistry.view, line))
      return
    const active = getActiveDoc()
    const next = active && toggleTaskInSource(active.content, line)
    if (active && next !== null && next !== undefined) {
      useAppStore.getState().replaceContent(active.id, next)
    }
  }, [])

  return (
    <div className="flex h-full min-w-0 flex-col">
      <PreviewHeader />
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto"
        tabIndex={-1}
        data-slot="preview-scroll"
      >
        <div
          className="mx-auto pb-[40vh]"
          style={{
            maxWidth: maxWidth ? maxWidth + padding * 2 : undefined,
            paddingInline: padding,
            paddingTop: Math.max(12, padding),
          }}
        >
          <MarkdownPreview
            source={source}
            docPath={doc?.path ?? null}
            fallbackDir={folder}
            font={font}
            density={density}
            previewStyle={previewStyle}
            onToggleTask={onToggleTask}
          />
        </div>
      </div>
    </div>
  )
}

export function Workspace() {
  const viewMode = useAppStore((s) => s.settings.viewMode)
  const syncScroll = useAppStore((s) => s.settings.syncScroll)
  const groupRef = useRef<GroupImperativeHandle | null>(null)
  const splitRef = useRef(50)
  const previewScrollRef = useRef<HTMLDivElement | null>(null)
  const [initialLayout] = useState(() => layoutFor(viewMode, 50))

  useScrollSync(previewScrollRef, syncScroll && viewMode === "split")

  useEffect(() => {
    groupRef.current?.setLayout(layoutFor(viewMode, splitRef.current))
  }, [viewMode])

  const onLayoutChanged = (layout: Layout, meta: LayoutChangedMeta) => {
    if (!meta.isUserInteraction) return
    // Dragging the divider all the way over switches to a single pane.
    if (layout.editor < 1) setViewMode("preview")
    else if (layout.preview < 1) setViewMode("editor")
    else splitRef.current = layout.editor
  }

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      groupRef={groupRef}
      defaultLayout={initialLayout}
      onLayoutChanged={onLayoutChanged}
      className="min-h-0 flex-1"
    >
      <ResizablePanel
        id="editor"
        collapsible
        collapsedSize={0}
        minSize="22%"
        inert={viewMode === "preview"}
      >
        <div className="flex h-full min-w-0 flex-col">
          <div className="flex h-10 shrink-0 items-center border-b px-2">
            <EditorToolbar />
          </div>
          <DiskNotice />
          <div className="min-h-0 flex-1">
            <MarkdownEditor />
          </div>
        </div>
      </ResizablePanel>
      <ResizableHandle className={cn(viewMode !== "split" && "hidden")} />
      <ResizablePanel
        id="preview"
        collapsible
        collapsedSize={0}
        minSize="22%"
        inert={viewMode === "editor"}
        className="bg-[color-mix(in_oklch,var(--muted)_35%,var(--background))]"
      >
        <PreviewPane scrollRef={previewScrollRef} />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
