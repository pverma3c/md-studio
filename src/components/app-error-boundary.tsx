import { Component, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"

/** Last-resort fallback so a render bug doesn't leave a blank window. */
export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyTitle>Something went wrong</EmptyTitle>
          <EmptyDescription className="font-mono text-xs">
            {error.message}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
        </EmptyContent>
      </Empty>
    )
  }
}
