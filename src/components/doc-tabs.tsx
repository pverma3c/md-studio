import { PlusIcon, XIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { closeOtherDocs, newDocument, requestCloseDocs } from "@/lib/actions"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { docTitle, isDirty, useAppStore, type Doc } from "@/store/app-store"

function DocTab({
  doc,
  active,
  dropBefore,
  dropAfter,
  onPointerDown,
}: {
  doc: Doc
  active: boolean
  dropBefore: boolean
  dropAfter: boolean
  onPointerDown: (e: React.PointerEvent) => void
}) {
  const setActive = useAppStore((s) => s.setActive)
  const docs = useAppStore((s) => s.docs)
  const ref = useRef<HTMLDivElement>(null)
  const dirty = isDirty(doc)

  useEffect(() => {
    if (active)
      ref.current?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [active])

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={ref}
          role="tab"
          aria-selected={active}
          tabIndex={active ? 0 : -1}
          title={doc.path ?? docTitle(doc)}
          onClick={() => setActive(doc.id)}
          onAuxClick={(e) => e.button === 1 && requestCloseDocs([doc.id])}
          onKeyDown={(e) =>
            (e.key === "Enter" || e.key === " ") && setActive(doc.id)
          }
          onPointerDown={onPointerDown}
          className={cn(
            "group/tab relative flex h-full max-w-56 min-w-28 shrink-0 cursor-default items-center gap-1 border-r pr-1.5 pl-3 text-[13px] select-none",
            "text-muted-foreground hover:bg-background/60 hover:text-foreground",
            active && "bg-background text-foreground hover:bg-background",
            dropBefore &&
              "before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:bg-ring",
            dropAfter &&
              "after:absolute after:inset-y-1 after:right-0 after:w-0.5 after:bg-ring"
          )}
        >
          {active && (
            <span
              className="absolute inset-x-0 top-0 h-0.5 bg-foreground/80"
              aria-hidden
            />
          )}
          <span className={cn("truncate", !doc.path && "italic")}>
            {docTitle(doc)}
          </span>
          <span className="relative ml-auto flex size-5 shrink-0 items-center justify-center">
            {dirty && (
              <span
                className="size-2 rounded-full bg-foreground/70 transition-opacity group-hover/tab:opacity-0"
                aria-label="Unsaved changes"
              />
            )}
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Close ${docTitle(doc)}`}
              className={cn(
                "absolute inset-0 size-5 opacity-0 group-hover/tab:opacity-100 focus-visible:opacity-100",
                active && !dirty && "opacity-60"
              )}
              onClick={(e) => {
                e.stopPropagation()
                requestCloseDocs([doc.id])
              }}
            >
              <XIcon />
            </Button>
          </span>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuGroup>
          <ContextMenuItem onSelect={() => requestCloseDocs([doc.id])}>
            Close
          </ContextMenuItem>
          <ContextMenuItem
            disabled={docs.length < 2}
            onSelect={() => closeOtherDocs(doc.id)}
          >
            Close Others
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => requestCloseDocs(docs.map((d) => d.id))}
          >
            Close All
          </ContextMenuItem>
        </ContextMenuGroup>
        {doc.path && (
          <>
            <ContextMenuSeparator />
            <ContextMenuGroup>
              <ContextMenuItem onSelect={() => api.showInFolder(doc.path!)}>
                Reveal in File Manager
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() => navigator.clipboard.writeText(doc.path!)}
              >
                Copy Path
              </ContextMenuItem>
            </ContextMenuGroup>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function DocTabs() {
  const docs = useAppStore((s) => s.docs)
  const activeId = useAppStore((s) => s.activeId)
  const listRef = useRef<HTMLDivElement>(null)
  /** Insertion index shown while a tab is being dragged. */
  const [dropAt, setDropAt] = useState<number | null>(null)

  // Reordering uses pointer events rather than HTML5 drag-and-drop: the
  // webview's native file-drop handling swallows in-page drag events.
  const startDrag = (from: number, e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return
    const startX = e.clientX
    let dragging = false
    let target: number | null = null
    const insertionIndex = (x: number) => {
      const tabs = [
        ...listRef.current!.querySelectorAll<HTMLElement>('[role="tab"]'),
      ]
      const i = tabs.findIndex((tab) => {
        const r = tab.getBoundingClientRect()
        return x < r.left + r.width / 2
      })
      return i === -1 ? tabs.length : i
    }
    const onMove = (ev: PointerEvent) => {
      if (!dragging && Math.abs(ev.clientX - startX) < 5) return
      dragging = true
      target = insertionIndex(ev.clientX)
      // Dropping right next to itself wouldn't move anything.
      setDropAt(target === from || target === from + 1 ? null : target)
    }
    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
      setDropAt(null)
      if (!dragging || target === null) return
      const to = from < target ? target - 1 : target
      if (from !== to) useAppStore.getState().moveDoc(from, to)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
  }

  return (
    <div className="flex h-9 shrink-0 items-stretch border-b bg-muted/40">
      <div
        ref={listRef}
        role="tablist"
        aria-label="Open documents"
        className="flex min-w-0 [scrollbar-width:none] items-stretch overflow-x-auto"
        onWheel={(e) => {
          if (e.deltaY) e.currentTarget.scrollLeft += e.deltaY
        }}
      >
        {docs.map((doc, i) => (
          <DocTab
            key={doc.id}
            doc={doc}
            active={doc.id === activeId}
            dropBefore={dropAt === i}
            dropAfter={dropAt === docs.length && i === docs.length - 1}
            onPointerDown={(e) => startDrag(i, e)}
          />
        ))}
      </div>
      <div className="flex items-center px-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="New file"
              onClick={() => newDocument()}
            >
              <PlusIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New file</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
