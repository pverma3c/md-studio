import {
  ChevronRightIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
} from "lucide-react"
import { memo, useState } from "react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { openPath } from "@/lib/actions"
import { api, type FileTreeNode } from "@/lib/api"
import { cn } from "@/lib/utils"
import { isDirty, useAppStore } from "@/store/app-store"

const INDENT = 12

function rowClass(active: boolean) {
  return cn(
    "flex h-7 w-full min-w-0 items-center gap-1.5 rounded-md pr-2 text-left text-[13px] outline-none",
    "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
    active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
  )
}

function PathMenu({
  path,
  children,
  isFile,
}: {
  path: string
  children: React.ReactNode
  isFile: boolean
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuGroup>
          {isFile && (
            <ContextMenuItem onSelect={() => openPath(path)}>
              Open
            </ContextMenuItem>
          )}
          <ContextMenuItem onSelect={() => api.showInFolder(path)}>
            Reveal in File Manager
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuItem onSelect={() => navigator.clipboard.writeText(path)}>
            Copy Path
          </ContextMenuItem>
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function FileRow({ node, depth }: { node: FileTreeNode; depth: number }) {
  const active = useAppStore(
    (s) => s.docs.find((d) => d.id === s.activeId)?.path === node.path
  )
  const dirty = useAppStore((s) => {
    const doc = s.docs.find((d) => d.path === node.path)
    return doc ? isDirty(doc) : false
  })
  return (
    <PathMenu path={node.path} isFile>
      <button
        type="button"
        className={rowClass(active)}
        style={{ paddingLeft: 8 + depth * INDENT + 14 }}
        onClick={() => openPath(node.path)}
        title={node.path}
      >
        <FileTextIcon className="size-3.5 shrink-0 opacity-60" />
        <span className="truncate">{node.name}</span>
        {dirty && (
          <span
            className="ml-auto size-1.5 shrink-0 rounded-full bg-foreground/60"
            aria-label="Unsaved"
          />
        )}
      </button>
    </PathMenu>
  )
}

function DirRow({
  node,
  depth,
  defaultOpen,
}: {
  node: FileTreeNode
  depth: number
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <PathMenu path={node.path} isFile={false}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={rowClass(false)}
            style={{ paddingLeft: 8 + depth * INDENT }}
            title={node.path}
          >
            <ChevronRightIcon
              className={cn(
                "size-3.5 shrink-0 opacity-50 transition-transform duration-150",
                open && "rotate-90"
              )}
            />
            {open ? (
              <FolderOpenIcon className="size-3.5 shrink-0 opacity-70" />
            ) : (
              <FolderIcon className="size-3.5 shrink-0 opacity-70" />
            )}
            <span className="truncate">{node.name}</span>
          </button>
        </CollapsibleTrigger>
      </PathMenu>
      <CollapsibleContent>
        <TreeChildren nodes={node.children ?? []} depth={depth + 1} />
      </CollapsibleContent>
    </Collapsible>
  )
}

const TreeChildren = memo(function TreeChildren({
  nodes,
  depth,
}: {
  nodes: FileTreeNode[]
  depth: number
}) {
  return (
    <div className="flex flex-col gap-px">
      {nodes.map((node) =>
        node.kind === "dir" ? (
          <DirRow
            key={node.path}
            node={node}
            depth={depth}
            defaultOpen={depth === 0 && nodes.length < 6}
          />
        ) : (
          <FileRow key={node.path} node={node} depth={depth} />
        )
      )}
    </div>
  )
})

export function FileTree({ root }: { root: FileTreeNode }) {
  return <TreeChildren nodes={root.children ?? []} depth={0} />
}

export function flattenFiles(
  node: FileTreeNode | null,
  out: FileTreeNode[] = []
) {
  if (!node) return out
  if (node.kind === "file") out.push(node)
  node.children?.forEach((c) => flattenFiles(c, out))
  return out
}

export function FlatFileList({
  files,
  root,
}: {
  files: FileTreeNode[]
  root: string
}) {
  const activePath = useAppStore(
    (s) => s.docs.find((d) => d.id === s.activeId)?.path
  )
  return (
    <div className="flex flex-col gap-px">
      {files.map((file) => {
        const rel = file.path.slice(root.length + 1)
        const dir = rel.slice(0, Math.max(0, rel.length - file.name.length - 1))
        return (
          <PathMenu key={file.path} path={file.path} isFile>
            <button
              type="button"
              className={cn(
                rowClass(activePath === file.path),
                "h-auto py-1 pl-2"
              )}
              onClick={() => openPath(file.path)}
              title={file.path}
            >
              <FileTextIcon className="mt-0.5 size-3.5 shrink-0 self-start opacity-60" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{file.name}</span>
                {dir && (
                  <span className="truncate text-xs text-muted-foreground">
                    {dir}
                  </span>
                )}
              </span>
            </button>
          </PathMenu>
        )
      })}
    </div>
  )
}
