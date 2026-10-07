import {
  FilePlusIcon,
  FileTextIcon,
  FolderOpenIcon,
  SparklesIcon,
} from "lucide-react"

import { AppLogo } from "@/components/app-logo"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import {
  newDocument,
  openFileDialog,
  openFolder,
  openPath,
  openWelcome,
} from "@/lib/actions"
import { commandById, formatKeyParts } from "@/lib/commands"
import { basename, dirname } from "@/lib/paths"
import { useAppStore } from "@/store/app-store"

function Shortcut({ id }: { id: string }) {
  return (
    <KbdGroup className="justify-self-end">
      {formatKeyParts(commandById[id].keys!).map((k, i) => (
        <Kbd key={i}>{k}</Kbd>
      ))}
    </KbdGroup>
  )
}

export function EmptyWorkspace() {
  const recent = useAppStore((s) => s.recent)
  // The wrapper fills the panel and scrolls; Empty grows to fill it and
  // centres the group, but never shrinks below its content, so a short
  // window scrolls instead of clipping the top.
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <Empty className="gap-6 p-8">
        <EmptyHeader>
          <EmptyMedia className="mb-4">
            {/* A faded watermark. The reduced contrast keeps the white page
                from reading as a bright slab on dark backgrounds. */}
            <AppLogo className="h-28 opacity-20 contrast-50 grayscale" />
          </EmptyMedia>
          <EmptyTitle className="text-base">No document open</EmptyTitle>
          <EmptyDescription>
            Start a new note, open a markdown file, or browse a whole folder.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="gap-6">
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => newDocument()}>
              <FilePlusIcon data-icon="inline-start" />
              New File
            </Button>
            <Button variant="outline" onClick={() => openFileDialog()}>
              <FileTextIcon data-icon="inline-start" />
              Open File…
            </Button>
            <Button variant="outline" onClick={() => openFolder()}>
              <FolderOpenIcon data-icon="inline-start" />
              Open Folder…
            </Button>
          </div>

          {recent.length > 0 && (
            <div className="flex w-full flex-col gap-1 text-left">
              <div className="px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Recent
              </div>
              {recent.slice(0, 6).map((path) => (
                <button
                  key={path}
                  type="button"
                  onClick={() => openPath(path)}
                  title={path}
                  className="flex min-w-0 items-baseline gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <span className="max-w-2/3 shrink-0 truncate font-medium">
                    {basename(path)}
                  </span>
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    {dirname(path)}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="grid w-full grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2 px-2 text-sm text-muted-foreground">
            <span className="text-left">Go to file</span>
            <Shortcut id="view.quickOpen" />
            <span className="text-left">Command palette</span>
            <Shortcut id="view.palette" />
            <span className="text-left">All shortcuts</span>
            <Shortcut id="help.shortcuts" />
          </div>

          <Button variant="link" size="sm" onClick={openWelcome}>
            <SparklesIcon data-icon="inline-start" />
            Open the welcome guide
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}
