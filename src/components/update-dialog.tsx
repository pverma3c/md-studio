import {
  DownloadIcon,
  ExternalLinkIcon,
  InfoIcon,
  Loader2Icon,
  RefreshCwIcon,
  RotateCwIcon,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { AppLogo } from "@/components/app-logo"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { api } from "@/lib/api"
import {
  checkForUpdates,
  installUpdate,
  RELEASES_URL,
  restartToUpdate,
  setAboutOpen,
  setUpdateDialogOpen,
  useUpdateStore,
} from "@/lib/updates"

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

/** The updater reports dates like "2026-10-08 10:23:44.0 +00:00:00". */
function releaseDate(raw: string | null) {
  if (!raw) return null
  const parsed = new Date(
    raw
      .replace(" ", "T")
      .replace(/\.\d+ /, "Z ")
      .split(" ")[0]
  )
  const date = Number.isNaN(parsed.getTime())
    ? new Date(raw.slice(0, 10))
    : parsed
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString(undefined, { dateStyle: "medium" })
}

export function UpdateDialog() {
  const { dialogOpen, status, info, progress, error } = useUpdateStore()
  const busy = status === "downloading"
  const date = releaseDate(info?.date ?? null)
  const percent = progress?.total
    ? Math.min(100, (progress.downloaded / progress.total) * 100)
    : null

  const title =
    status === "ready"
      ? "Update ready to install"
      : status === "error"
        ? "Update failed"
        : info
          ? `MD Studio ${info.version} is available`
          : "Software update"

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(open) => !busy && setUpdateDialogOpen(open)}
    >
      <DialogContent className="sm:max-w-lg" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {status === "ready"
              ? `Restart MD Studio to finish updating to ${info?.version}.`
              : info
                ? `You have ${info.currentVersion}.${date ? ` Released ${date}.` : ""}`
                : "Something went wrong while updating."}
          </DialogDescription>
        </DialogHeader>

        {info?.notes && status !== "error" && (
          <ScrollArea className="max-h-64 rounded-lg border">
            <article
              className="markdown-body px-4 py-3"
              style={{ fontSize: 14 }}
              data-density="compact"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {info.notes}
              </ReactMarkdown>
            </article>
          </ScrollArea>
        )}

        {status === "available" && info && !info.canInstall && (
          <Alert>
            <InfoIcon />
            <AlertTitle>This copy can't update itself</AlertTitle>
            <AlertDescription>
              It wasn't installed from a package (it's a local build), so get
              the new version from the releases page.
            </AlertDescription>
          </Alert>
        )}

        {status === "downloading" && (
          <div className="flex flex-col gap-2">
            <Progress value={percent ?? 0} />
            <p className="text-xs text-muted-foreground tabular-nums">
              {progress && progress.downloaded > 0
                ? `Downloading… ${mb(progress.downloaded)}${progress.total ? ` of ${mb(progress.total)}` : ""}`
                : "Starting download…"}{" "}
              Linux may ask for your password to install.
            </p>
          </div>
        )}

        {status === "error" && (
          <Alert variant="destructive">
            <AlertTitle>The update couldn't be installed</AlertTitle>
            <AlertDescription>
              {error}. You can download the new version from the releases page
              instead.
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          {status === "available" && (
            <>
              <Button
                variant="outline"
                onClick={() => setUpdateDialogOpen(false)}
              >
                Later
              </Button>
              {info?.canInstall ? (
                <Button onClick={() => void installUpdate()}>
                  <DownloadIcon data-icon="inline-start" />
                  Download & Install
                </Button>
              ) : (
                <Button onClick={() => api.openExternal(RELEASES_URL)}>
                  <ExternalLinkIcon data-icon="inline-start" />
                  Releases Page
                </Button>
              )}
            </>
          )}
          {status === "downloading" && (
            <Button disabled>
              <Loader2Icon data-icon="inline-start" className="animate-spin" />
              Installing…
            </Button>
          )}
          {status === "ready" && (
            <>
              <Button
                variant="outline"
                onClick={() => setUpdateDialogOpen(false)}
              >
                Later
              </Button>
              <Button onClick={restartToUpdate}>
                <RotateCwIcon data-icon="inline-start" />
                Restart Now
              </Button>
            </>
          )}
          {status === "error" && (
            <>
              <Button
                variant="outline"
                onClick={() => api.openExternal(RELEASES_URL)}
              >
                <ExternalLinkIcon data-icon="inline-start" />
                Releases Page
              </Button>
              <Button onClick={() => void checkForUpdates({ manual: true })}>
                <RefreshCwIcon data-icon="inline-start" />
                Try Again
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AboutDialog() {
  const { aboutOpen, currentVersion, status } = useUpdateStore()
  return (
    <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
      <DialogContent className="sm:max-w-sm">
        <div className="flex flex-col items-center gap-4 pt-2 text-center">
          <AppLogo className="h-16" />
          <DialogHeader className="items-center text-center">
            <DialogTitle>MD Studio</DialogTitle>
            <DialogDescription>
              {currentVersion ? `Version ${currentVersion}` : "Markdown editor"}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            A Markdown editor with live preview.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="outline"
              disabled={status === "checking"}
              onClick={() => void checkForUpdates({ manual: true })}
            >
              {status === "checking" ? (
                <Loader2Icon
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : (
                <RefreshCwIcon data-icon="inline-start" />
              )}
              Check for Updates
            </Button>
            <Button
              variant="ghost"
              onClick={() => api.openExternal(RELEASES_URL)}
            >
              <ExternalLinkIcon data-icon="inline-start" />
              Releases
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
