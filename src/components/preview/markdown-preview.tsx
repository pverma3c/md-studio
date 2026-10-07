import {
  Component,
  memo,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react"
import ReactMarkdown, { type Components, type Options } from "react-markdown"
import rehypeHighlight from "rehype-highlight"
import rehypeKatex from "rehype-katex"
import rehypeRaw from "rehype-raw"
import rehypeSanitize from "rehype-sanitize"
import rehypeSlug from "rehype-slug"
import remarkFrontmatter from "remark-frontmatter"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"

import { appComponents } from "@/components/preview/app-components"
import { CodeBlock } from "@/components/preview/code-block"
import { MermaidBlock } from "@/components/preview/mermaid-block"
import {
  ALERT_ICONS,
  codeBlockInfo,
  followLink,
  PreviewContext,
  resolveImageSrc,
  sourceLine,
} from "@/components/preview/preview-shared"
import { TableBlock } from "@/components/preview/table-block"
import { previewRegistry } from "@/lib/export"
import {
  rehypeAlerts,
  rehypeSourceLine,
  remarkFrontmatterTable,
  sanitizeSchema,
} from "@/lib/markdown/plugins"
import { dirname } from "@/lib/paths"
import type { PreviewDensity, PreviewStyle } from "@/store/app-store"

const remarkPlugins: Options["remarkPlugins"] = [
  remarkGfm,
  remarkMath,
  [remarkFrontmatter, ["yaml"]],
  remarkFrontmatterTable,
]

const rehypePlugins: Options["rehypePlugins"] = [
  rehypeRaw,
  rehypeSourceLine,
  [rehypeSanitize, sanitizeSchema],
  rehypeSlug,
  rehypeAlerts,
  [rehypeKatex, { throwOnError: false, strict: "ignore" }],
  [
    rehypeHighlight,
    { detect: false, plainText: ["mermaid", "math", "text", "txt", "plain"] },
  ],
]

/** GitHub-like document styling; the elements are styled by markdown.css. */
const documentComponents: Components = {
  a({ node: _node, href = "", children, ...props }) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { baseDir } = useContext(PreviewContext)
    return (
      <a
        {...props}
        href={href}
        title={props.title ?? href}
        onClick={(event) => followLink(event, href, baseDir)}
      >
        {children}
      </a>
    )
  },

  img({ node: _node, src, alt, ...props }) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { baseDir } = useContext(PreviewContext)
    const resolved = resolveImageSrc(src, baseDir)
    return (
      <img
        {...props}
        src={resolved}
        alt={alt ?? ""}
        loading="lazy"
        data-src={resolved !== src ? (src as string) : undefined}
      />
    )
  },

  pre({ node, children, ...props }) {
    const { lang, text } = codeBlockInfo(node)
    const line = sourceLine(props)
    if (lang === "mermaid") return <MermaidBlock code={text} line={line} />
    return (
      <CodeBlock lang={lang} text={text} line={line}>
        <pre>{children}</pre>
      </CodeBlock>
    )
  },

  table({ node: _node, children, className, ...props }) {
    // Front matter renders as a small properties table; leave it plain.
    if (className?.includes("frontmatter")) {
      return (
        <table className={className} {...props}>
          {children}
        </table>
      )
    }
    return <TableBlock line={sourceLine(props)}>{children}</TableBlock>
  },

  input({ node: _node, type, checked, ...props }) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { onToggleTask } = useContext(PreviewContext)
    if (type !== "checkbox") return <input type={type} {...props} />
    return (
      <input
        type="checkbox"
        checked={Boolean(checked)}
        aria-label="Toggle task"
        onChange={(event) => {
          const host = event.currentTarget.closest("[data-line]")
          const line = Number(host?.getAttribute("data-line"))
          if (line) onToggleTask(line)
        }}
      />
    )
  },

  p({ node: _node, children, ...props }) {
    const kind = (props as Record<string, unknown>)["data-alert-title"] as
      string | undefined
    const Icon = kind ? ALERT_ICONS[kind] : undefined
    return (
      <p {...props}>
        {Icon && <Icon aria-hidden />}
        {children}
      </p>
    )
  },
}

class RenderBoundary extends Component<
  { resetKey: string; app: boolean; children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error)
      this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      return (
        <pre
          className={
            this.props.app
              ? "text-sm whitespace-pre-wrap text-destructive"
              : "mermaid-error"
          }
        >
          Couldn't render this document: {this.state.error.message}
        </pre>
      )
    }
    return this.props.children
  }
}

type MarkdownPreviewProps = {
  source: string
  docPath: string | null
  fallbackDir: string | null
  font: "sans" | "serif"
  density: PreviewDensity
  previewStyle: PreviewStyle
  onToggleTask: (line: number) => void
}

export const MarkdownPreview = memo(function MarkdownPreview({
  source,
  docPath,
  fallbackDir,
  font,
  density,
  previewStyle,
  onToggleTask,
}: MarkdownPreviewProps) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    previewRegistry.element = el
    return () => {
      if (previewRegistry.element === el) previewRegistry.element = null
    }
  }, [])

  const baseDir = docPath ? dirname(docPath) : fallbackDir
  const app = previewStyle === "app"

  return (
    <PreviewContext.Provider value={{ docPath, baseDir, onToggleTask }}>
      {/* The "app" style swaps the root class so markdown.css stays out of
          the way of the shadcn components (see markdown-app.css). */}
      <article
        ref={ref}
        className={app ? "markdown-app" : "markdown-body"}
        data-style={previewStyle}
        data-font={font}
        data-density={density}
      >
        <RenderBoundary resetKey={source} app={app}>
          <ReactMarkdown
            remarkPlugins={remarkPlugins}
            rehypePlugins={rehypePlugins}
            components={app ? appComponents : documentComponents}
          >
            {source}
          </ReactMarkdown>
        </RenderBoundary>
      </article>
    </PreviewContext.Provider>
  )
})
