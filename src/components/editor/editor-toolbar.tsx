import { ChevronDownIcon, HeadingIcon } from "lucide-react"
import { Fragment } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { commandById, formatKeys, runCommand } from "@/lib/commands"

const GROUPS = [
  ["format.bold", "format.italic", "format.strike", "format.code"],
  ["format.link", "format.image"],
  ["format.bullet", "format.ordered", "format.task", "format.quote"],
  ["format.codeBlock", "format.table", "format.hr"],
]

const HEADINGS = ["format.h1", "format.h2", "format.h3", "format.paragraph"]

function ToolbarButton({ id }: { id: string }) {
  const cmd = commandById[id]
  const Icon = cmd.icon!
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={cmd.label}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runCommand(id)}
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {cmd.label}
        {cmd.keys && (
          <span className="ml-2 opacity-60">{formatKeys(cmd.keys)}</span>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

export function EditorToolbar() {
  return (
    <div className="flex min-w-0 [scrollbar-width:none] items-center gap-0.5 overflow-x-auto">
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Heading"
                onMouseDown={(e) => e.preventDefault()}
              >
                <HeadingIcon data-icon="inline-start" />
                <ChevronDownIcon data-icon="inline-end" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Heading</TooltipContent>
        </Tooltip>
        <DropdownMenuContent
          align="start"
          className="w-auto min-w-60"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DropdownMenuGroup>
            {HEADINGS.map((id) => {
              const cmd = commandById[id]
              const Icon = cmd.icon
              return (
                <DropdownMenuItem key={id} onSelect={() => runCommand(id)}>
                  {Icon && <Icon />}
                  {cmd.label}
                  {cmd.keys && (
                    <DropdownMenuShortcut>
                      {formatKeys(cmd.keys)}
                    </DropdownMenuShortcut>
                  )}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {GROUPS.map((group, i) => (
        <Fragment key={i}>
          <Separator
            orientation="vertical"
            className="mx-1 h-4 data-[orientation=vertical]:self-center"
          />
          {group.map((id) => (
            <ToolbarButton key={id} id={id} />
          ))}
        </Fragment>
      ))}
    </div>
  )
}
