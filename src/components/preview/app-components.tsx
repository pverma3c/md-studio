import type { Element } from "hast"
import { toString } from "hast-util-to-string"
import { ChevronRightIcon } from "lucide-react"
import {
  Children,
  createContext,
  Fragment,
  isValidElement,
  useContext,
  type ComponentProps,
  type ReactElement,
} from "react"
import type { Components, ExtraProps } from "react-markdown"

import { AppCodeBlock } from "@/components/preview/code-block"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Kbd } from "@/components/ui/kbd"
import { Separator } from "@/components/ui/separator"
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

/*
 * "App UI" preview style: Markdown elements render as shadcn/ui components.
 * Type follows the shadcn typography scale, in em so it tracks the preview
 * font size; vertical rhythm comes from the --app-* variables set per
 * density in markdown-app.css. Every block passes `data-line` through, which
 * scroll sync, the outline and task toggling rely on.
 */

type Props<T extends keyof React.JSX.IntrinsicElements> = ComponentProps<T> &
  ExtraProps

/** Set inside fenced blocks so <code> knows it isn't inline. */
const InCodeBlock = createContext(false)

/** Blocks after the first one in their container get the paragraph gap. */
const FLOW = "not-first:mt-(--app-flow)"

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6"

const HEADINGS: Record<HeadingTag, string> = {
  h1: "text-[2.25em] leading-[1.15] font-extrabold tracking-tight text-balance not-first:mt-(--app-heading-gap)",
  h2: "border-b pb-[0.3em] text-[1.875em] leading-[1.2] font-semibold tracking-tight not-first:mt-(--app-heading-gap)",
  h3: "text-[1.5em] leading-[1.35] font-semibold tracking-tight not-first:mt-[calc(var(--app-heading-gap)*0.8)]",
  h4: "text-[1.25em] leading-[1.4] font-semibold tracking-tight not-first:mt-[calc(var(--app-heading-gap)*0.7)]",
  h5: "text-[1.125em] font-semibold not-first:mt-[calc(var(--app-heading-gap)*0.6)]",
  h6: "font-semibold text-muted-foreground not-first:mt-[calc(var(--app-heading-gap)*0.6)]",
}

function heading(Tag: HeadingTag) {
  return function AppHeading({
    node: _node,
    className,
    ...props
  }: Props<"h1">) {
    // The footnotes heading is visually hidden; keep it that way.
    if (className?.includes("sr-only"))
      return <Tag className={className} {...props} />
    return (
      <Tag className={cn("scroll-m-20", HEADINGS[Tag], className)} {...props} />
    )
  }
}

function AppLink({ node: _node, href = "", className, ...props }: Props<"a">) {
  const { baseDir } = useContext(PreviewContext)
  const footnote =
    "data-footnote-ref" in props || "data-footnote-backref" in props
  return (
    <a
      {...props}
      href={href}
      title={props.title ?? href}
      className={cn(
        "font-medium text-primary underline-offset-4 hover:underline",
        !footnote && "underline",
        className
      )}
      onClick={(event) => followLink(event, href, baseDir)}
    />
  )
}

function AppImage({
  node: _node,
  src,
  alt,
  className,
  ...props
}: Props<"img">) {
  const { baseDir } = useContext(PreviewContext)
  const resolved = resolveImageSrc(src, baseDir)
  return (
    <img
      {...props}
      src={resolved}
      alt={alt ?? ""}
      loading="lazy"
      data-src={resolved !== src ? src : undefined}
      className={cn(
        "inline-block h-auto max-w-full rounded-lg border align-middle",
        className
      )}
    />
  )
}

function AppParagraph({ node: _node, className, ...props }: Props<"p">) {
  return <p className={cn(FLOW, className)} {...props} />
}

function AppCode({ node: _node, className, ...props }: Props<"code">) {
  const inBlock = useContext(InCodeBlock)
  if (inBlock) return <code className={className} {...props} />
  return (
    <code
      className={cn(
        "relative rounded-md bg-brand-muted px-[0.35em] py-[0.15em] font-mono text-[0.875em] font-medium text-brand",
        className
      )}
      {...props}
    />
  )
}

function AppPre({ node, children, ...props }: Props<"pre">) {
  const { lang, text } = codeBlockInfo(node)
  const line = sourceLine(props)
  if (lang === "mermaid")
    return <MermaidBlock code={text} line={line} variant="app" />
  return (
    <InCodeBlock.Provider value={true}>
      <AppCodeBlock lang={lang} text={text} line={line}>
        {children}
      </AppCodeBlock>
    </InCodeBlock.Provider>
  )
}

function isAlertTitle(child: unknown): child is ReactElement<Props<"p">> {
  return (
    isValidElement(child) &&
    (child.props as Record<string, unknown>)["data-alert-title"] !== undefined
  )
}

function AppBlockquote({
  node: _node,
  className,
  children,
  ...props
}: Props<"blockquote">) {
  const kind = (props as Record<string, unknown>)["data-alert"] as
    string | undefined
  if (!kind) {
    return (
      <blockquote
        className={cn(
          "border-l-2 pl-6 text-muted-foreground italic",
          FLOW,
          className
        )}
        {...props}
      >
        {children}
      </blockquote>
    )
  }
  // GitHub alert: rehypeAlerts put a title paragraph first.
  const items = Children.toArray(children)
  const title = items.find(isAlertTitle)
  const Icon = ALERT_ICONS[kind]
  return (
    <Alert
      role="note"
      variant={kind === "caution" ? "destructive" : "default"}
      className={FLOW}
      data-line={sourceLine(props)}
      data-alert={kind}
    >
      {Icon && <Icon />}
      <AlertTitle>{title?.props.children}</AlertTitle>
      {/* Tighter rhythm to suit the alert's smaller text. */}
      <AlertDescription className="[--app-flow:0.75em] [--app-item-gap:0.25em]">
        {items.filter((item) => item !== title)}
      </AlertDescription>
    </Alert>
  )
}

function list(Tag: "ul" | "ol") {
  return function AppListBlock({
    node: _node,
    ref: _ref,
    className,
    ...props
  }: Props<"ul">) {
    const tasks = className?.includes("contains-task-list")
    return (
      <Tag
        className={cn(
          "marker:text-muted-foreground [li>&]:mt-(--app-item-gap)",
          FLOW,
          tasks
            ? // Plain items mixed into a task list keep a bullet, text aligned.
              "list-none [&>li:not(.task-list-item)]:ml-6 [&>li:not(.task-list-item)]:list-disc"
            : Tag === "ul"
              ? "ml-6 list-disc [&_ul]:list-[circle]"
              : "ml-6 list-decimal [&_ol]:list-[lower-alpha]",
          className
        )}
        {...props}
      />
    )
  }
}

function AppListItem({ node: _node, className, ...props }: Props<"li">) {
  const task = className?.includes("task-list-item")
  return (
    <li
      className={cn(
        "mt-(--app-item-gap)",
        task &&
          "relative pl-6 has-[>[data-state=checked]]:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function AppInput({
  node: _node,
  type,
  checked,
  className: _className,
  disabled: _disabled,
  ...props
}: Props<"input">) {
  const { onToggleTask } = useContext(PreviewContext)
  if (type !== "checkbox") return <input type={type} {...props} />
  return (
    <Checkbox
      checked={Boolean(checked)}
      aria-label="Toggle task"
      // Centered on the item's first line (1lh: the inherited line height).
      className="absolute top-[calc((1lh-1rem)/2)] left-0"
      onClick={(event) => {
        const host = event.currentTarget.closest("[data-line]")
        const line = Number(host?.getAttribute("data-line"))
        if (line) onToggleTask(line)
      }}
    />
  )
}

/** Front matter (remarkFrontmatterTable) as a compact key/value list. */
function Frontmatter({ node, line }: { node?: Element; line?: number }) {
  const rows: { key: string; value: string; list: boolean }[] = []
  if (node) {
    for (const tr of node.children.flatMap((c) =>
      c.type === "element" ? c.children : []
    )) {
      if (tr.type !== "element") continue
      const [th, td] = tr.children.filter(
        (c): c is Element => c.type === "element"
      )
      if (!th || !td) continue
      rows.push({
        key: toString(th),
        value: toString(td),
        // Sanitizing turns the flag into an empty string; presence is what counts.
        list: td.properties.dataList != null,
      })
    }
  }
  return (
    <dl
      className="grid grid-cols-[max-content_1fr] items-baseline gap-x-6 gap-y-2 rounded-xl border bg-card px-4 py-3 text-sm text-card-foreground not-first:mt-(--app-flow)"
      data-line={line}
    >
      {rows.map(({ key, value, list }, i) => (
        <Fragment key={`${key}-${i}`}>
          <dt className="font-mono text-xs text-muted-foreground">{key}</dt>
          <dd className="min-w-0">
            {list ? (
              <span className="flex flex-wrap gap-1.5">
                {value
                  .split(/,\s*/)
                  .filter(Boolean)
                  .map((item, j) => (
                    <Badge key={`${item}-${j}`} variant="secondary">
                      {item}
                    </Badge>
                  ))}
              </span>
            ) : (
              value
            )}
          </dd>
        </Fragment>
      ))}
    </dl>
  )
}

function AppTable({ node, className, children, ...props }: Props<"table">) {
  const line = sourceLine(props)
  if (className?.includes("frontmatter"))
    return <Frontmatter node={node} line={line} />
  return (
    <TableBlock line={line} variant="app">
      {children}
    </TableBlock>
  )
}

function AppTableCell({ node, className, ...props }: Props<"td">) {
  // Short values (names, numbers, shortcuts) stay on one line, as in a data
  // table; prose wraps instead of stretching the table.
  const prose = node ? toString(node).length > 32 : false
  return (
    <TableCell
      className={cn(prose && "min-w-48 whitespace-normal", className)}
      {...props}
    />
  )
}

function AppDetails({ node: _node, className, ...props }: Props<"details">) {
  // Native <details> (styled like a Collapsible) so it also opens in exports.
  return (
    <details
      className={cn(
        "group/details rounded-xl border bg-card px-4 py-3 text-card-foreground",
        FLOW,
        className
      )}
      {...props}
    />
  )
}

function AppSummary({
  node: _node,
  className,
  children,
  ...props
}: Props<"summary">) {
  return (
    <summary
      className={cn(
        "flex cursor-pointer list-none items-center gap-2 font-medium select-none [&::-webkit-details-marker]:hidden",
        className
      )}
      {...props}
    >
      <ChevronRightIcon
        aria-hidden
        className="size-4 shrink-0 text-muted-foreground transition-transform group-open/details:rotate-90"
      />
      {children}
    </summary>
  )
}

function AppSection({ node: _node, className, ...props }: Props<"section">) {
  const footnotes = "data-footnotes" in props
  return (
    <section
      className={cn(
        footnotes &&
          "mt-(--app-heading-gap) border-t text-sm text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export const appComponents: Components = {
  h1: heading("h1"),
  h2: heading("h2"),
  h3: heading("h3"),
  h4: heading("h4"),
  h5: heading("h5"),
  h6: heading("h6"),
  p: AppParagraph,
  a: AppLink,
  img: AppImage,
  code: AppCode,
  pre: AppPre,
  blockquote: AppBlockquote,
  ul: list("ul"),
  ol: list("ol"),
  li: AppListItem,
  input: AppInput,
  table: AppTable,
  thead: ({ node: _node, ...props }) => <TableHeader {...props} />,
  tbody: ({ node: _node, ...props }) => <TableBody {...props} />,
  tr: ({ node: _node, ...props }) => <TableRow {...props} />,
  th: ({ node: _node, ...props }) => <TableHead {...props} />,
  td: AppTableCell,
  hr: ({ node: _node, className, ...props }) => (
    <Separator
      className={cn("my-[calc(var(--app-flow)*1.5)]", className)}
      {...props}
    />
  ),
  kbd: ({ node: _node, ...props }) => <Kbd {...props} />,
  details: AppDetails,
  summary: AppSummary,
  section: AppSection,
  dl: ({ node: _node, className, ...props }) => (
    <dl className={cn(FLOW, className)} {...props} />
  ),
  dt: ({ node: _node, className, ...props }) => (
    <dt
      className={cn("font-semibold not-first:mt-(--app-item-gap)", className)}
      {...props}
    />
  ),
  dd: ({ node: _node, className, ...props }) => (
    <dd className={cn("ml-6 text-muted-foreground", className)} {...props} />
  ),
}
