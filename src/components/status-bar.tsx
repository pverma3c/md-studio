import { CircleArrowUpIcon, CircleDotIcon, FileWarningIcon } from "lucide-react"
import { useDeferredValue, useMemo } from "react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { computeStats } from "@/lib/markdown/analyze"
import { relativeTo } from "@/lib/paths"
import { openUpdateDialog, useUpdateStore } from "@/lib/updates"
import { isDirty, useActiveDoc, useAppStore } from "@/store/app-store"

const nf = new Intl.NumberFormat()

/** Shown while a newer release is waiting, until it's installed. */
function UpdateIndicator() {
  const status = useUpdateStore((s) => s.status)
  const version = useUpdateStore((s) => s.info?.version)
  if (status !== "available" && status !== "ready" && status !== "downloading")
    return null
  return (
    <Button
      variant="ghost"
      size="xs"
      className="-my-1 shrink-0 text-brand"
      onClick={openUpdateDialog}
    >
      <CircleArrowUpIcon data-icon="inline-start" />
      {status === "ready" ? "Restart to update" : `Update ${version} available`}
    </Button>
  )
}

function Divider() {
  return (
    <Separator
      orientation="vertical"
      className="h-3 data-[orientation=vertical]:self-center"
    />
  )
}

export function StatusBar() {
  const doc = useActiveDoc()
  const folder = useAppStore((s) => s.folder)
  const cursor = useAppStore((s) => s.cursor)
  const fontSize = useAppStore((s) => s.settings.fontSize)
  const content = useDeferredValue(doc?.content ?? "")
  const stats = useMemo(() => computeStats(content), [content])

  return (
    <footer className="flex h-7 shrink-0 items-center gap-3 border-t bg-sidebar px-3 text-xs text-muted-foreground tabular-nums">
      {doc ? (
        <>
          <span className="min-w-0 truncate" title={doc.path ?? undefined}>
            {doc.path ? relativeTo(folder, doc.path) : "Not saved yet"}
          </span>
          {doc.missing ? (
            <span className="flex shrink-0 items-center gap-1 text-destructive">
              <FileWarningIcon className="size-3" />
              Missing on disk
            </span>
          ) : isDirty(doc) ? (
            <span className="flex shrink-0 items-center gap-1 text-foreground">
              <CircleDotIcon className="size-3" />
              Unsaved
            </span>
          ) : doc.path ? (
            <span className="shrink-0">Saved</span>
          ) : null}
          <span className="ml-auto flex shrink-0 items-center gap-3">
            <span>
              Ln {cursor.line}, Col {cursor.col}
              {cursor.selected > 0 &&
                ` (${nf.format(cursor.selected)} selected)`}
            </span>
            <Divider />
            <span>{nf.format(stats.words)} words</span>
            <span className="hidden sm:inline">
              {nf.format(stats.characters)} chars
            </span>
            <span className="hidden md:inline">
              {stats.readingMinutes} min read
            </span>
            <Divider />
            {fontSize !== 15 && (
              <>
                <span>{Math.round((fontSize / 15) * 100)}%</span>
                <Divider />
              </>
            )}
            <span>Markdown</span>
          </span>
        </>
      ) : (
        <span className="mr-auto">Ready</span>
      )}
      <UpdateIndicator />
    </footer>
  )
}
