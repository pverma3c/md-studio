import { useEffect, useState } from "react"

import { useTheme } from "@/components/theme-provider"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { renderMermaid } from "@/lib/mermaid"
import type { PreviewStyle } from "@/store/app-store"

type RenderState = { svg: string | null; error: string | null }

export function MermaidBlock({
  code,
  line,
  variant = "document",
}: {
  code: string
  line?: number
  variant?: PreviewStyle
}) {
  const { resolvedTheme } = useTheme()
  const [state, setState] = useState<RenderState>({ svg: null, error: null })

  useEffect(() => {
    let cancelled = false
    // Debounce while the diagram is being typed; keep the last good render meanwhile.
    const timer = setTimeout(() => {
      renderMermaid(code, resolvedTheme).then(
        (svg) => !cancelled && setState({ svg, error: null }),
        (err: unknown) =>
          !cancelled &&
          setState((prev) => ({
            svg: prev.svg,
            error: err instanceof Error ? err.message : String(err),
          }))
      )
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [code, resolvedTheme])

  const diagram = (
    <>
      {state.svg ? (
        <div
          className="contents"
          dangerouslySetInnerHTML={{ __html: state.svg }}
        />
      ) : !state.error ? (
        <Skeleton className="h-40 w-full max-w-md" />
      ) : null}
      {state.error && (
        <pre
          className={
            variant === "app"
              ? "w-full text-xs whitespace-pre-wrap text-destructive"
              : "mermaid-error"
          }
        >
          {state.error}
        </pre>
      )}
    </>
  )

  if (variant === "app") {
    // Export re-renders the diagram into the element carrying the source.
    return (
      <Card className="not-first:mt-(--app-flow)" data-line={line}>
        <CardContent
          className="flex flex-col items-center gap-3 overflow-x-auto [&_svg]:h-auto [&_svg]:max-w-full"
          data-mermaid-source={code}
        >
          {diagram}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mermaid-block" data-line={line} data-mermaid-source={code}>
      {diagram}
    </div>
  )
}
