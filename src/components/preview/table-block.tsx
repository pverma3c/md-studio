import { Maximize2Icon } from "lucide-react"
import { useRef, useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table } from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useAppStore, type PreviewStyle } from "@/store/app-store"

type TableInfo = { title: string; rows: number; columns: number }

/** Nearest heading above the table, used to title the fullscreen view. */
function describe(block: HTMLElement): TableInfo {
  let title = "Table"
  for (
    let el = block.previousElementSibling;
    el;
    el = el.previousElementSibling
  ) {
    if (/^H[1-6]$/.test(el.tagName)) {
      title = el.textContent?.trim() || title
      break
    }
  }
  const table = block.querySelector("table")
  return {
    title,
    rows: table?.querySelectorAll("tbody tr").length ?? 0,
    columns: table?.rows[0]?.cells.length ?? 0,
  }
}

/**
 * A rendered table with a fullscreen view. The "app" variant uses the shadcn
 * Table (its cells come from the app component map) in a bordered card.
 */
export function TableBlock({
  line,
  variant = "document",
  children,
}: {
  line?: number
  variant?: PreviewStyle
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [info, setInfo] = useState<TableInfo | null>(null)
  const font = useAppStore((s) => s.settings.previewFont)
  const density = useAppStore((s) => s.settings.previewDensity)
  const app = variant === "app"

  return (
    <div
      ref={ref}
      className={
        app
          ? "group/table relative overflow-hidden rounded-xl border bg-card text-card-foreground not-first:mt-(--app-flow)"
          : "table-block"
      }
      data-line={line}
    >
      {app ? (
        <Table className="tabular-nums">{children}</Table>
      ) : (
        <table>{children}</table>
      )}
      <div
        className={
          app
            ? "absolute top-2 right-2 opacity-0 transition-opacity group-hover/table:opacity-100 focus-within:opacity-100"
            : "table-block-actions"
        }
        data-export-remove
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon-xs"
              aria-label="View table fullscreen"
              onClick={() => ref.current && setInfo(describe(ref.current))}
            >
              <Maximize2Icon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Fullscreen</TooltipContent>
        </Tooltip>
      </div>
      <Dialog
        open={info !== null}
        onOpenChange={(open) => !open && setInfo(null)}
      >
        <DialogContent className="flex h-[calc(100vh-3rem)] w-[calc(100vw-3rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
          <DialogHeader className="border-b px-5 py-3.5 pr-12">
            <DialogTitle>{info?.title}</DialogTitle>
            <DialogDescription>
              {info?.rows} {info?.rows === 1 ? "row" : "rows"} · {info?.columns}{" "}
              {info?.columns === 1 ? "column" : "columns"}
            </DialogDescription>
          </DialogHeader>
          {/* This pane scrolls both ways, so the header row can stick to it;
              the table's own scroll container is unclipped for that. */}
          <div
            className={cn(
              "min-h-0 flex-1 overflow-auto",
              app && "[&_[data-slot=table-container]]:overflow-visible"
            )}
          >
            {app ? (
              <div
                className="markdown-app px-3 pb-3"
                data-style="app"
                data-font={font}
                data-density={density}
              >
                <Table className="tabular-nums [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-popover [&_th]:shadow-[inset_0_-1px_0_var(--border)]">
                  {children}
                </Table>
              </div>
            ) : (
              <div
                className="markdown-body px-5 pb-5"
                data-font={font}
                data-density={density}
              >
                <table className="table-fullscreen">{children}</table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
