import { ClockIcon, FileTextIcon } from "lucide-react"
import { useMemo } from "react"

import { flattenFiles } from "@/components/sidebar/file-tree"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { openPath } from "@/lib/actions"
import {
  COMMANDS,
  formatKeys,
  runCommand,
  type CommandGroup as Group,
} from "@/lib/commands"
import { basename, dirname, relativeTo } from "@/lib/paths"
import { docTitle, isDirty, useAppStore } from "@/store/app-store"

const MAX_FILES = 1500
const GROUP_ORDER: Group[] = ["File", "Edit", "View", "Format", "Help"]

export function CommandPalette() {
  const palette = useAppStore((s) => s.palette)
  const setPalette = useAppStore((s) => s.setPalette)
  const docs = useAppStore((s) => s.docs)
  const folder = useAppStore((s) => s.folder)
  const tree = useAppStore((s) => s.tree)
  const recent = useAppStore((s) => s.recent)
  const hasDoc = useAppStore((s) => s.activeId !== null)

  const files = useMemo(() => flattenFiles(tree).slice(0, MAX_FILES), [tree])
  const openPaths = new Set(docs.map((d) => d.path))
  const recentOutsideFolder = recent.filter(
    (p) => !openPaths.has(p) && !(folder && p.startsWith(folder))
  )

  const close = () => setPalette(null)
  const run = (fn: () => void) => {
    close()
    // Let the dialog hand focus back before the command moves it again.
    requestAnimationFrame(fn)
  }

  return (
    <CommandDialog
      open={palette !== null}
      onOpenChange={(open) => !open && close()}
      title={palette === "commands" ? "Command Palette" : "Go to File"}
      description={palette === "commands" ? "Run a command" : "Open a document"}
      className="sm:max-w-xl"
    >
      <Command>
        <CommandInput
          placeholder={
            palette === "commands"
              ? "Type a command…"
              : "Search open, folder and recent files…"
          }
        />
        <CommandList className="max-h-[min(60vh,28rem)]">
          <CommandEmpty>No results.</CommandEmpty>
          {palette === "files" && (
            <>
              {docs.length > 0 && (
                <CommandGroup heading="Open">
                  {docs.map((doc) => (
                    <CommandItem
                      key={doc.id}
                      value={`open ${docTitle(doc)} ${doc.path ?? ""}`}
                      onSelect={() =>
                        run(() => useAppStore.getState().setActive(doc.id))
                      }
                    >
                      <FileTextIcon />
                      <span className="truncate">{docTitle(doc)}</span>
                      {isDirty(doc) && (
                        <span className="text-xs text-muted-foreground">
                          Edited
                        </span>
                      )}
                      {doc.path && (
                        <span className="ml-auto max-w-[45%] truncate text-xs text-muted-foreground">
                          {relativeTo(folder, dirname(doc.path))}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {files.length > 0 && (
                <CommandGroup heading={folder ? basename(folder) : "Folder"}>
                  {files
                    .filter((f) => !openPaths.has(f.path))
                    .map((file) => {
                      const rel = relativeTo(folder, file.path)
                      return (
                        <CommandItem
                          key={file.path}
                          value={`file ${rel}`}
                          onSelect={() => run(() => openPath(file.path))}
                        >
                          <FileTextIcon />
                          <span className="truncate">{file.name}</span>
                          <span className="ml-auto max-w-[50%] truncate text-xs text-muted-foreground">
                            {rel.slice(
                              0,
                              Math.max(0, rel.length - file.name.length - 1)
                            )}
                          </span>
                        </CommandItem>
                      )
                    })}
                </CommandGroup>
              )}
              {recentOutsideFolder.length > 0 && (
                <CommandGroup heading="Recent">
                  {recentOutsideFolder.map((path) => (
                    <CommandItem
                      key={path}
                      value={`recent ${path}`}
                      onSelect={() => run(() => openPath(path))}
                    >
                      <ClockIcon />
                      <span className="truncate">{basename(path)}</span>
                      <span className="ml-auto max-w-[50%] truncate text-xs text-muted-foreground">
                        {dirname(path)}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </>
          )}
          {palette === "commands" &&
            GROUP_ORDER.map((group) => (
              <CommandGroup key={group} heading={group}>
                {COMMANDS.filter(
                  (c) => c.group === group && (!c.needsDoc || hasDoc)
                ).map((cmd) => {
                  const Icon = cmd.icon
                  return (
                    <CommandItem
                      key={cmd.id}
                      value={`${cmd.group} ${cmd.label}`}
                      onSelect={() => run(() => runCommand(cmd.id))}
                    >
                      {Icon ? (
                        <Icon />
                      ) : (
                        <span className="size-4" aria-hidden />
                      )}
                      {cmd.label}
                      {cmd.keys && (
                        <CommandShortcut>
                          {formatKeys(cmd.keys)}
                        </CommandShortcut>
                      )}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ))}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
