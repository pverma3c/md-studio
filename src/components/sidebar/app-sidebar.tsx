import {
  FilePlusIcon,
  FolderOpenIcon,
  FolderXIcon,
  HashIcon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react"
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"

import {
  FileTree,
  FlatFileList,
  flattenFiles,
} from "@/components/sidebar/file-tree"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { scrollSync } from "@/hooks/use-scroll-sync"
import {
  closeFolder,
  newDocument,
  openFolder,
  openPath,
  refreshFolder,
} from "@/lib/actions"
import { revealLine } from "@/lib/editor/commands"
import { editorRegistry } from "@/lib/editor/registry"
import { extractOutline } from "@/lib/markdown/analyze"
import { basename, dirname } from "@/lib/paths"
import { cn } from "@/lib/utils"
import { useActiveDoc, useAppStore, type SidebarTab } from "@/store/app-store"

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function RecentList() {
  const recent = useAppStore((s) => s.recent)
  if (!recent.length) return null
  return (
    <div className="flex flex-col gap-1 px-2 pb-3">
      <div className="px-2 pt-1 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        Recent
      </div>
      {recent.slice(0, 8).map((path) => (
        <button
          key={path}
          type="button"
          onClick={() => openPath(path)}
          title={path}
          className="flex min-w-0 flex-col rounded-md px-2 py-1 text-left hover:bg-sidebar-accent"
        >
          <span className="truncate text-[13px]">{basename(path)}</span>
          <span className="truncate text-xs text-muted-foreground">
            {dirname(path)}
          </span>
        </button>
      ))}
    </div>
  )
}

function FilesPanel() {
  const folder = useAppStore((s) => s.folder)
  const tree = useAppStore((s) => s.tree)
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())
  const allFiles = useMemo(() => flattenFiles(tree), [tree])
  const matches = useMemo(
    () =>
      deferredQuery
        ? allFiles.filter((f) =>
            f.path
              .slice((folder?.length ?? 0) + 1)
              .toLowerCase()
              .includes(deferredQuery)
          )
        : [],
    [allFiles, deferredQuery, folder]
  )

  if (!folder || !tree) {
    return (
      <ScrollArea className="min-h-0 flex-1">
        <Empty className="gap-4 px-4 py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderOpenIcon />
            </EmptyMedia>
            <EmptyTitle className="text-sm">No folder open</EmptyTitle>
            <EmptyDescription className="text-xs">
              Open a folder to browse its markdown files here.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" variant="outline" onClick={() => openFolder()}>
              Open Folder…
            </Button>
          </EmptyContent>
        </Empty>
        <RecentList />
      </ScrollArea>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-1 pr-1.5 pl-3">
        <span
          className="truncate text-xs font-semibold tracking-wide uppercase"
          title={folder}
        >
          {basename(folder)}
        </span>
        <span className="ml-auto flex items-center">
          <IconAction label="New file" onClick={() => newDocument()}>
            <FilePlusIcon />
          </IconAction>
          <IconAction label="Refresh" onClick={() => refreshFolder()}>
            <RefreshCwIcon />
          </IconAction>
          <IconAction label="Close folder" onClick={closeFolder}>
            <FolderXIcon />
          </IconAction>
        </span>
      </div>
      <div className="px-2 pb-2">
        <InputGroup className="h-7">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
            placeholder={`Filter ${allFiles.length} files`}
            className="text-xs"
          />
        </InputGroup>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-1.5 pb-4">
          {deferredQuery ? (
            matches.length ? (
              <FlatFileList files={matches} root={folder} />
            ) : (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                No matching files
              </p>
            )
          ) : tree.children?.length ? (
            <FileTree root={tree} />
          ) : (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No markdown files in this folder
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function OutlinePanel() {
  const doc = useActiveDoc()
  const source = useDeferredValue(doc?.content ?? "")
  const readingLine = useAppStore((s) => s.readingLine)
  const viewMode = useAppStore((s) => s.settings.viewMode)
  const syncScroll = useAppStore((s) => s.settings.syncScroll)
  const outline = useMemo(() => extractOutline(source), [source])
  const minLevel = outline.reduce((m, h) => Math.min(m, h.level), 6)
  // The section you're reading: last heading at or above the reading line.
  const activeIndex = Math.max(
    0,
    outline.reduce((acc, h, i) => (h.line <= readingLine ? i : acc), -1)
  )
  const navRef = useRef<HTMLElement>(null)

  // Keep the highlighted entry visible as the document scrolls. Only the
  // outline's own viewport moves (scrollIntoView would also nudge the panels).
  useEffect(() => {
    const item = navRef.current?.querySelector<HTMLElement>(
      '[data-active="true"]'
    )
    const viewport = item?.closest<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    if (!item || !viewport) return
    const itemTop = item.offsetTop
    const itemBottom = itemTop + item.offsetHeight
    const pad = 24
    if (itemTop - pad < viewport.scrollTop) {
      viewport.scrollTo({ top: Math.max(0, itemTop - pad), behavior: "smooth" })
    } else if (itemBottom + pad > viewport.scrollTop + viewport.clientHeight) {
      viewport.scrollTo({
        top: itemBottom + pad - viewport.clientHeight,
        behavior: "smooth",
      })
    }
  }, [activeIndex, outline.length])

  if (!outline.length) {
    return (
      <Empty className="gap-3 px-4 py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HashIcon />
          </EmptyMedia>
          <EmptyTitle className="text-sm">No headings</EmptyTitle>
          <EmptyDescription className="text-xs">
            {doc
              ? "Add # headings to build an outline."
              : "Open a document to see its outline."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <nav
        ref={navRef}
        className="relative flex flex-col gap-px px-1.5 py-2"
        aria-label="Document outline"
      >
        {outline.map((item, i) => (
          <button
            key={`${item.line}-${i}`}
            type="button"
            data-active={i === activeIndex}
            aria-current={i === activeIndex ? "location" : undefined}
            onClick={() => {
              const view = editorRegistry.view
              if (viewMode === "editor" || !syncScroll) {
                if (view) revealLine(view, item.line)
                if (viewMode !== "editor") scrollSync.previewToLine(item.line)
              } else {
                // Align the rendered heading exactly; the editor follows via scroll sync.
                if (view) revealLine(view, item.line, { scroll: false })
                scrollSync.previewToLine(item.line)
              }
            }}
            className={cn(
              "flex min-h-7 items-center rounded-md py-1 pr-2 text-left text-[13px] text-sidebar-foreground/75",
              "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              item.level === minLevel && "font-medium text-sidebar-foreground",
              i === activeIndex &&
                "relative bg-sidebar-accent font-medium text-sidebar-accent-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-sidebar-foreground"
            )}
            style={{ paddingLeft: 10 + (item.level - minLevel) * 12 }}
          >
            <span className="line-clamp-2">
              {item.text || "Untitled heading"}
            </span>
          </button>
        ))}
      </nav>
    </ScrollArea>
  )
}

export function AppSidebar() {
  const tab = useAppStore((s) => s.settings.sidebarTab)
  const setSettings = useAppStore((s) => s.setSettings)
  return (
    <aside className="flex h-full min-w-0 flex-col bg-sidebar text-sidebar-foreground">
      <Tabs
        value={tab}
        onValueChange={(v) => setSettings({ sidebarTab: v as SidebarTab })}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="flex h-10 shrink-0 items-center border-b px-2">
          <TabsList className="w-full">
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="outline">Outline</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="files" className="flex min-h-0 flex-col">
          <FilesPanel />
        </TabsContent>
        <TabsContent value="outline" className="flex min-h-0 flex-col">
          <OutlinePanel />
        </TabsContent>
      </Tabs>
    </aside>
  )
}
