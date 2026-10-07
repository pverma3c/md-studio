import katex from "katex"

import { api } from "@/lib/api"
import { renderMermaid } from "@/lib/mermaid"
import { dirname, stripExtension } from "@/lib/paths"
import markdownCss from "@/styles/markdown.css?raw"
import themeCss from "@/styles/markdown-theme.css?raw"
import { docTitle, useAppStore, type Doc } from "@/store/app-store"

/** The live preview <article>, registered by MarkdownPreview. */
export const previewRegistry = { element: null as HTMLElement | null }

function escapeHtml(text: string) {
  return text.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!
  )
}

/** Exported pages follow the reader's OS theme instead of a .dark class. */
function standaloneThemeCss() {
  return themeCss
    .replace(/:root,\s*#print-root/, ":root")
    .replace(
      /\.dark\s*\{([^}]*)\}/,
      "@media (prefers-color-scheme: dark) {\n  :root {$1}\n}"
    )
}

const DARK_QUERY = "@media (prefers-color-scheme: dark)"
const DARK_VARIANT = /:is\(\.dark\s+\*\)/g

function serializeRules(rules: CSSRuleList): string {
  return Array.from(rules, serializeRule).filter(Boolean).join("\n")
}

function serializeRule(rule: CSSRule): string {
  // Bundled font files can't be reached from a standalone page; the font
  // stacks fall back to system fonts (KaTeX's come from its CDN stylesheet).
  if (rule instanceof CSSFontFaceRule) return ""
  if (rule instanceof CSSImportRule)
    return rule.styleSheet ? serializeRules(rule.styleSheet.cssRules) : ""
  if (rule instanceof CSSStyleRule) {
    const { selectorText, style } = rule
    // Theme tokens and dark: utilities key off a .dark class the exported
    // page doesn't have; follow the reader's OS theme instead.
    if (selectorText === ".dark")
      return `${DARK_QUERY} {\n:root { ${style.cssText} }\n}`
    const selector = selectorText.replace(DARK_VARIANT, "")
    if (selector !== selectorText)
      return `${DARK_QUERY} {\n${selector} { ${style.cssText} }\n}`
    return rule.cssText
  }
  if (rule instanceof CSSGroupingRule) {
    // @layer / @media / @supports / @container: recurse so nested dark rules
    // are rewritten too.
    const text = rule.cssText
    const prelude = text.slice(0, text.indexOf("{"))
    return `${prelude}{\n${serializeRules(rule.cssRules)}\n}`
  }
  return rule.cssText
}

/**
 * The app's own stylesheets (Tailwind utilities, shadcn components and theme
 * tokens), for exports of the "App UI" preview style, which is styled by
 * classes rather than markdown.css.
 */
function appStylesheetCss() {
  return Array.from(document.styleSheets, (sheet) => {
    try {
      return serializeRules(sheet.cssRules)
    } catch {
      return "" // cross-origin sheets can't be read
    }
  }).join("\n")
}

async function snapshotPreview(forStandaloneHtml: boolean) {
  const source = previewRegistry.element
  if (!source) throw new Error("The preview isn't ready yet")
  const clone = source.cloneNode(true) as HTMLElement

  clone.querySelectorAll("[data-export-remove]").forEach((el) => el.remove())
  clone
    .querySelectorAll("[data-line]")
    .forEach((el) => el.removeAttribute("data-line"))
  clone
    .querySelectorAll("input[type=checkbox]")
    .forEach((el) => el.setAttribute("disabled", ""))
  // App-style task boxes are buttons; keep their look but take them out of
  // the tab order.
  clone.querySelectorAll("[role=checkbox]").forEach((el) => {
    el.setAttribute("tabindex", "-1")
    el.setAttribute("aria-disabled", "true")
  })
  if (forStandaloneHtml) {
    // Local images go back to their original relative paths.
    clone.querySelectorAll<HTMLImageElement>("img[data-src]").forEach((img) => {
      img.setAttribute("src", img.dataset.src!)
      img.removeAttribute("data-src")
    })
  }
  // Diagrams are re-rendered light: exported pages and PDFs sit on white.
  await Promise.all(
    Array.from(
      clone.querySelectorAll<HTMLElement>("[data-mermaid-source]")
    ).map(async (el) => {
      try {
        el.innerHTML = await renderMermaid(el.dataset.mermaidSource!, "light")
      } catch {
        // keep whatever the preview showed
      }
    })
  )
  return clone
}

function exportTarget(doc: Doc) {
  const folder = useAppStore.getState().folder
  return {
    suggestedName: stripExtension(docTitle(doc)),
    defaultDir: doc.path ? dirname(doc.path) : (folder ?? undefined),
  }
}

export async function exportDocHtml(doc: Doc) {
  const clone = await snapshotPreview(true)
  const { previewFont, previewDensity, previewStyle } =
    useAppStore.getState().settings
  if (previewStyle === "app") return exportAppHtml(doc, clone)
  const hasMath = clone.querySelector(".katex") !== null
  const title = stripExtension(docTitle(doc))
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="MD Studio">
<title>${escapeHtml(title)}</title>
${hasMath ? `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@${katex.version}/dist/katex.min.css">\n` : ""}<style>
${standaloneThemeCss()}
html { color-scheme: light dark; background: var(--md-bg); }
body { margin: 0; }
${markdownCss}
.markdown-body { box-sizing: border-box; max-width: 780px; margin: 0 auto; padding: 56px 28px 96px; }
</style>
</head>
<body>
<article class="markdown-body" data-font="${previewFont}" data-density="${previewDensity}">
${clone.innerHTML}
</article>
</body>
</html>
`
  return api.exportHtml(exportTarget(doc), html)
}

/** "App UI" style: the page carries the app's stylesheet instead of markdown.css. */
function exportAppHtml(doc: Doc, clone: HTMLElement) {
  const { previewFont, previewDensity } = useAppStore.getState().settings
  const hasMath = clone.querySelector(".katex") !== null
  const title = stripExtension(docTitle(doc))
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="MD Studio">
<title>${escapeHtml(title)}</title>
${hasMath ? `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@${katex.version}/dist/katex.min.css">\n` : ""}<style>
${appStylesheetCss()}
</style>
<style>
html { color-scheme: light dark; background: var(--background); }
html, body { height: auto; overflow: visible; }
body { margin: 0; user-select: text; }
.markdown-app { box-sizing: border-box; max-width: 780px; margin: 0 auto; padding: 56px 28px 96px; }
</style>
</head>
<body>
<article class="markdown-app" data-style="app" data-font="${previewFont}" data-density="${previewDensity}">
${clone.innerHTML}
</article>
</body>
</html>
`
  return api.exportHtml(exportTarget(doc), html)
}

export async function exportDocPdf(doc: Doc) {
  const clone = await snapshotPreview(false)
  const { previewFont, previewDensity, previewStyle } =
    useAppStore.getState().settings
  const root = document.getElementById("print-root")!
  const article = document.createElement("article")
  article.className = previewStyle === "app" ? "markdown-app" : "markdown-body"
  article.dataset.style = previewStyle
  article.dataset.font = previewFont
  article.dataset.density = previewDensity
  article.innerHTML = clone.innerHTML
  root.replaceChildren(article)
  try {
    return await api.exportPdf(exportTarget(doc))
  } finally {
    root.replaceChildren()
  }
}
