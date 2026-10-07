import { CheckIcon, CopyIcon } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type CodeBlockProps = {
  lang?: string
  text: string
  line?: number
  children: ReactNode
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1400)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={copied ? "Copied" : "Copy code"}
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => setCopied(true))
      }}
      data-export-remove
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  )
}

export function CodeBlock({ lang, text, line, children }: CodeBlockProps) {
  return (
    <div className="code-block" data-line={line}>
      {children}
      <div className="code-block-meta" data-export-remove>
        {lang && <span className="code-lang">{lang}</span>}
        <CopyButton text={text} />
      </div>
    </div>
  )
}

/** "App UI" preview style: a card with a language badge and copy button. */
export function AppCodeBlock({ lang, text, line, children }: CodeBlockProps) {
  return (
    <div
      className="overflow-hidden rounded-xl border bg-card text-card-foreground not-first:mt-(--app-flow)"
      data-line={line}
    >
      <div className="flex h-10 items-center justify-between gap-2 border-b bg-muted/50 pr-2 pl-3">
        <Badge variant="outline">{lang ?? "text"}</Badge>
        <CopyButton text={text} />
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[0.875em] leading-relaxed">
        {children}
      </pre>
    </div>
  )
}
