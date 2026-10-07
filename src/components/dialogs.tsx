import { FileWarningIcon } from "lucide-react"
import { useState } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { ScrollArea } from "@/components/ui/scroll-area"
import { closeDocsNow, saveDoc } from "@/lib/actions"
import { api } from "@/lib/api"
import { COMMANDS, formatKeyParts, type CommandGroup } from "@/lib/commands"
import { docTitle, isDirty, useAppStore } from "@/store/app-store"

export function UnsavedChangesDialog() {
  const pending = useAppStore((s) => s.pendingClose)
  const docs = useAppStore((s) => s.docs)
  const setPendingClose = useAppStore((s) => s.setPendingClose)
  const [busy, setBusy] = useState(false)

  const targetIds =
    pending?.kind === "docs" ? pending.ids : docs.map((d) => d.id)
  const dirty = docs.filter((d) => targetIds.includes(d.id) && isDirty(d))
  const forWindow = pending?.kind === "window"
  const single = dirty.length === 1 ? dirty[0] : null

  const finish = () => {
    setPendingClose(null)
    if (forWindow) api.forceClose()
    else closeDocsNow(targetIds)
  }

  const saveThenFinish = async () => {
    setBusy(true)
    try {
      for (const doc of dirty) {
        if (!(await saveDoc(doc.id))) return // cancelled or failed: stay open
      }
      finish()
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog
      open={pending !== null && dirty.length > 0}
      onOpenChange={(open) => !open && setPendingClose(null)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <FileWarningIcon />
          </AlertDialogMedia>
          <AlertDialogTitle>
            {single
              ? `Save changes to “${docTitle(single)}”?`
              : `Save changes to ${dirty.length} documents?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {single
              ? "Your changes will be lost if you don't save them."
              : dirty.map((d) => docTitle(d)).join(", ")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={busy} onClick={finish}>
            Don't Save
          </Button>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              e.preventDefault()
              void saveThenFinish()
            }}
          >
            {single ? "Save" : "Save All"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

const SHORTCUT_GROUPS: CommandGroup[] = [
  "File",
  "View",
  "Format",
  "Edit",
  "Help",
]

export function ShortcutsDialog() {
  const open = useAppStore((s) => s.shortcutsOpen)
  const setOpen = useAppStore((s) => s.setShortcutsOpen)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Everything is also in the menus and the command palette.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-3">
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {SHORTCUT_GROUPS.map((group) => (
              <section key={group} className="flex flex-col gap-1">
                <h3 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {group}
                </h3>
                {COMMANDS.filter((c) => c.group === group && c.keys).map(
                  (cmd) => (
                    <div
                      key={cmd.id}
                      className="flex items-center justify-between gap-4 py-0.5 text-sm"
                    >
                      <span className="truncate">{cmd.label}</span>
                      <KbdGroup>
                        {formatKeyParts(cmd.keys!).map((part, i) => (
                          <Kbd key={i}>{part}</Kbd>
                        ))}
                      </KbdGroup>
                    </div>
                  )
                )}
              </section>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
