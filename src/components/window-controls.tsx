import { CopyIcon, MinusIcon, SquareIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useWindowState } from "@/hooks/use-window-state"
import { api, isMac } from "@/lib/api"

/** Minimise / maximise / close for the frameless window (macOS keeps its traffic lights). */
export function WindowControls() {
  const { maximized, fullScreen } = useWindowState()
  if (isMac) return null
  const restored = maximized || fullScreen
  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Minimize"
        onClick={() => api.window.minimize()}
      >
        <MinusIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={restored ? "Restore" : "Maximize"}
        onClick={() => api.window.toggleMaximize()}
      >
        {restored ? <CopyIcon className="-scale-x-100" /> : <SquareIcon />}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Close"
        className="hover:bg-destructive hover:text-white dark:hover:bg-destructive"
        onClick={() => api.window.close()}
      >
        <XIcon />
      </Button>
    </div>
  )
}
