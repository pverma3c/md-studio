import { useEffect, useState } from "react"

import { api } from "@/lib/api"
import type { WindowState } from "@/lib/platform"

const INITIAL: WindowState = {
  maximized: false,
  fullScreen: false,
  focused: true,
}

export function useWindowState() {
  const [state, setState] = useState<WindowState>(INITIAL)
  useEffect(() => {
    let alive = true
    api.window.getState().then((s) => alive && s && setState(s))
    const off = api.window.onState(setState)
    return () => {
      alive = false
      off()
    }
  }, [])
  return state
}
