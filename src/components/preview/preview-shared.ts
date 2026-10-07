import type { Element } from "hast"
import { toString } from "hast-util-to-string"
import {
  InfoIcon,
  LightbulbIcon,
  MessageSquareWarningIcon,
  OctagonAlertIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react"
import { createContext, type MouseEvent } from "react"

import { openPath } from "@/lib/actions"
import { api } from "@/lib/api"
import {
  hasUrlScheme,
  isAbsolutePath,
  isMarkdownPath,
  resolvePath,
  toAssetUrl,
} from "@/lib/paths"

// Shared by the "document" and "app" component maps of the preview.

export type PreviewContextValue = {
  docPath: string | null
  baseDir: string | null
  onToggleTask: (line: number) => void
}

export const PreviewContext = createContext<PreviewContextValue>({
  docPath: null,
  baseDir: null,
  onToggleTask: () => {},
})

/** The rendered <article>, in either preview style. */
export const PREVIEW_ROOT_SELECTOR = ".markdown-body, .markdown-app"

export const ALERT_ICONS: Record<string, LucideIcon> = {
  note: InfoIcon,
  tip: LightbulbIcon,
  important: MessageSquareWarningIcon,
  warning: TriangleAlertIcon,
  caution: OctagonAlertIcon,
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function resolveLocal(src: string, baseDir: string | null) {
  const clean = safeDecode(src.split(/[?#]/)[0])
  if (isAbsolutePath(clean)) return clean
  return baseDir ? resolvePath(baseDir, clean) : null
}

function scrollToAnchor(from: HTMLElement, id: string) {
  const root = from.closest(PREVIEW_ROOT_SELECTOR)
  const target = root?.querySelector(
    `[id="${CSS.escape(id)}"], [name="${CSS.escape(id)}"]`
  )
  target?.scrollIntoView({ behavior: "smooth", block: "start" })
}

/** In-page anchors scroll, web links open externally, local files open or reveal. */
export function followLink(
  event: MouseEvent<HTMLAnchorElement>,
  href: string,
  baseDir: string | null
) {
  event.preventDefault()
  if (href.startsWith("#")) {
    scrollToAnchor(event.currentTarget, safeDecode(href.slice(1)))
  } else if (/^(https?|mailto):/i.test(href)) {
    api.openExternal(href)
  } else if (!hasUrlScheme(href)) {
    const target = resolveLocal(href, baseDir)
    if (!target) return
    if (isMarkdownPath(target)) openPath(target)
    else api.showInFolder(target)
  }
}

/** Local image paths become asset URLs the webview can load. */
export function resolveImageSrc(src: unknown, baseDir: string | null) {
  let resolved = typeof src === "string" ? src : undefined
  if (resolved && !hasUrlScheme(resolved) && !resolved.startsWith("//")) {
    const local = resolveLocal(resolved, baseDir)
    if (local) resolved = toAssetUrl(local)
  }
  return resolved
}

/** Language and plain text of a fenced block, from its <pre> node. */
export function codeBlockInfo(node: Element | undefined) {
  const code = node?.children.find(
    (child): child is Element =>
      child.type === "element" && child.tagName === "code"
  )
  const classes = (code?.properties.className as string[] | undefined) ?? []
  const lang = classes
    .find((c) => c.startsWith("language-"))
    ?.slice("language-".length)
  const text = code ? toString(code).replace(/\n$/, "") : ""
  return { lang, text }
}

/** The source line rehypeSourceLine stamped on a block element. */
export function sourceLine(props: object) {
  return (props as Record<string, unknown>)["data-line"] as number | undefined
}
