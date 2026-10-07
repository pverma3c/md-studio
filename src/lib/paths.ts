import { api, MARKDOWN_EXTENSIONS } from "@/lib/api"

// Minimal path helpers for the renderer (no Node `path` in a sandboxed page).

export function basename(p: string) {
  return p.split(/[\\/]/).filter(Boolean).pop() ?? p
}

export function dirname(p: string) {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"))
  if (i < 0) return "."
  if (i === 0) return p[0]
  return p.slice(0, i)
}

export function extname(p: string) {
  const name = basename(p)
  const i = name.lastIndexOf(".")
  return i > 0 ? name.slice(i + 1).toLowerCase() : ""
}

export function stripExtension(name: string) {
  const i = name.lastIndexOf(".")
  return i > 0 ? name.slice(0, i) : name
}

export function isAbsolutePath(p: string) {
  return p.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith("\\\\")
}

/** Resolves `rel` against directory `base`, normalising `.` and `..` segments. */
export function resolvePath(base: string, rel: string) {
  if (isAbsolutePath(rel)) return rel
  const windows = /^[a-zA-Z]:[\\/]/.test(base)
  const parts = base.split(/[\\/]/)
  for (const seg of rel.split(/[\\/]/)) {
    if (!seg || seg === ".") continue
    if (seg === "..") {
      if (parts.length > 1) parts.pop()
    } else {
      parts.push(seg)
    }
  }
  return parts.join(windows ? "\\" : "/") || "/"
}

/** Path of `p` relative to folder `root`, or `p` itself when outside it. */
export function relativeTo(root: string | null, p: string) {
  if (!root) return p
  const prefix = root.endsWith("/") || root.endsWith("\\") ? root : root + "/"
  return p.startsWith(prefix) ? p.slice(prefix.length) : p
}

export function isMarkdownPath(p: string) {
  return MARKDOWN_EXTENSIONS.includes(extname(p))
}

export function hasUrlScheme(src: string) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(src) && !/^[a-zA-Z]:[\\/]/.test(src)
}

/** URL the webview loads a local image from. */
export function toAssetUrl(absPath: string) {
  return api.toAssetUrl(absPath)
}

/** Relative path from directory `fromDir` to `to`, using forward slashes. */
export function relativePath(fromDir: string, to: string) {
  const a = fromDir.replace(/\\/g, "/").split("/").filter(Boolean)
  const b = to.replace(/\\/g, "/").split("/").filter(Boolean)
  // Different Windows drives can't be expressed relatively.
  if (
    /^[a-zA-Z]:$/.test(a[0] ?? "") &&
    a[0]?.toLowerCase() !== b[0]?.toLowerCase()
  )
    return to
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return [...a.slice(i).map(() => ".."), ...b.slice(i)].join("/") || "."
}

/** Percent-encodes a path for use as a markdown link target. */
export function encodeLinkPath(p: string) {
  return p
    .split("/")
    .map((seg) => (/^[a-zA-Z]:$/.test(seg) ? seg : encodeURIComponent(seg)))
    .join("/")
}

export const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "avif",
  "svg",
  "bmp",
])
