import {
  EyeIcon,
  MonitorIcon,
  MoonIcon,
  PenLineIcon,
  SquareSplitHorizontalIcon,
  SunIcon,
} from "lucide-react"

import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { AppLogo } from "@/components/app-logo"
import { WindowControls } from "@/components/window-controls"
import { useWindowState } from "@/hooks/use-window-state"
import { openPath, setViewMode } from "@/lib/actions"
import { api, isMac } from "@/lib/api"
import { commandById, formatKeys, runCommand } from "@/lib/commands"
import { basename, dirname } from "@/lib/paths"
import { cn } from "@/lib/utils"
import {
  docTitle,
  isDirty,
  useActiveDoc,
  useAppStore,
  type ViewMode,
} from "@/store/app-store"

function Item({ id, label }: { id: string; label?: string }) {
  const cmd = commandById[id]
  const hasDoc = useAppStore((s) => s.activeId !== null)
  const Icon = cmd.icon
  return (
    <MenubarItem
      disabled={cmd.needsDoc && !hasDoc}
      onSelect={() => runCommand(id)}
      inset={!Icon}
    >
      {Icon && <Icon />}
      {label ?? cmd.label}
      {cmd.keys && <MenubarShortcut>{formatKeys(cmd.keys)}</MenubarShortcut>}
    </MenubarItem>
  )
}

function SettingCheckbox({
  setting,
  label,
}: {
  setting: "lineNumbers" | "lineWrap" | "syncScroll" | "spellcheck"
  label: string
}) {
  const checked = useAppStore((s) => s.settings[setting])
  const setSettings = useAppStore((s) => s.setSettings)
  const keys =
    setting === "lineWrap" ? commandById["view.wrap"].keys : undefined
  return (
    <MenubarCheckboxItem
      checked={checked}
      onCheckedChange={(v) => setSettings({ [setting]: v === true })}
      onSelect={(e) => e.preventDefault()}
    >
      {label}
      {keys && <MenubarShortcut>{formatKeys(keys)}</MenubarShortcut>}
    </MenubarCheckboxItem>
  )
}

function UpdateCheckSetting() {
  const checked = useAppStore((s) => s.settings.checkUpdates)
  const setSettings = useAppStore((s) => s.setSettings)
  return (
    <MenubarCheckboxItem
      checked={checked}
      onCheckedChange={(v) => setSettings({ checkUpdates: v === true })}
      onSelect={(e) => e.preventDefault()}
    >
      Check Automatically
    </MenubarCheckboxItem>
  )
}

function RecentSubmenu() {
  const recent = useAppStore((s) => s.recent)
  const setRecent = useAppStore((s) => s.setRecent)
  return (
    <MenubarSub>
      <MenubarSubTrigger inset>Open Recent</MenubarSubTrigger>
      <MenubarSubContent className="max-w-96">
        {recent.length === 0 ? (
          <MenubarItem disabled>No recent files</MenubarItem>
        ) : (
          <>
            <MenubarGroup>
              {recent.map((path) => (
                <MenubarItem
                  key={path}
                  onSelect={() => openPath(path)}
                  title={path}
                >
                  <span className="truncate">{basename(path)}</span>
                  <span className="ml-auto max-w-48 truncate pl-4 text-xs text-muted-foreground">
                    {dirname(path)}
                  </span>
                </MenubarItem>
              ))}
            </MenubarGroup>
            <MenubarSeparator />
            <MenubarItem
              onSelect={() => {
                api.clearRecent()
                setRecent([])
              }}
            >
              Clear Recent
            </MenubarItem>
          </>
        )}
      </MenubarSubContent>
    </MenubarSub>
  )
}

function AppMenubar() {
  const viewMode = useAppStore((s) => s.settings.viewMode)
  const previewFont = useAppStore((s) => s.settings.previewFont)
  const previewStyle = useAppStore((s) => s.settings.previewStyle)
  const setSettings = useAppStore((s) => s.setSettings)
  const { theme, setTheme } = useTheme()

  return (
    <Menubar className="h-8 border-none bg-transparent p-0 shadow-none">
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent className="w-64">
          <MenubarGroup>
            <Item id="file.new" />
            <Item id="file.open" />
            <Item id="file.openFolder" />
            <RecentSubmenu />
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <Item id="file.save" />
            <Item id="file.saveAs" />
            <Item id="file.saveAll" />
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <Item id="file.exportHtml" />
            <Item id="file.exportPdf" />
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <Item id="file.reveal" />
            <Item id="file.copyPath" />
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <Item id="file.close" />
            <Item id="file.closeOthers" />
            <Item id="file.closeFolder" />
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <Item id="file.quit" />
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger>Edit</MenubarTrigger>
        <MenubarContent className="w-56">
          <MenubarGroup>
            <Item id="edit.undo" />
            <Item id="edit.redo" />
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <Item id="edit.find" />
            <Item id="edit.selectAll" />
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger>View</MenubarTrigger>
        <MenubarContent className="w-64">
          <MenubarRadioGroup
            value={viewMode}
            onValueChange={(v) => setViewMode(v as ViewMode)}
          >
            {(["editor", "split", "preview"] as const).map((mode) => {
              const cmd = commandById[`view.${mode}`]
              return (
                <MenubarRadioItem key={mode} value={mode}>
                  {cmd.label}
                  <MenubarShortcut>{formatKeys(cmd.keys!)}</MenubarShortcut>
                </MenubarRadioItem>
              )
            })}
          </MenubarRadioGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <Item id="view.sidebar" />
            <Item id="view.outline" />
            <Item id="view.quickOpen" />
            <Item id="view.palette" />
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <SettingCheckbox setting="lineNumbers" label="Line Numbers" />
            <SettingCheckbox setting="lineWrap" label="Word Wrap" />
            <SettingCheckbox setting="syncScroll" label="Sync Scrolling" />
            <SettingCheckbox setting="spellcheck" label="Spell Check" />
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarCheckboxItem
            checked={previewStyle === "app"}
            onCheckedChange={(v) =>
              setSettings({ previewStyle: v === true ? "app" : "document" })
            }
            onSelect={(e) => e.preventDefault()}
          >
            App UI Preview Style
          </MenubarCheckboxItem>
          <MenubarSub>
            <MenubarSubTrigger inset>Preview Font</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarRadioGroup
                value={previewFont}
                onValueChange={(v) =>
                  setSettings({ previewFont: v as "sans" | "serif" })
                }
              >
                <MenubarRadioItem value="sans">Sans</MenubarRadioItem>
                <MenubarRadioItem value="serif">Serif</MenubarRadioItem>
              </MenubarRadioGroup>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSub>
            <MenubarSubTrigger inset>Theme</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarRadioGroup
                value={theme}
                onValueChange={(v) =>
                  setTheme(v as "light" | "dark" | "system")
                }
              >
                <MenubarRadioItem value="light">Light</MenubarRadioItem>
                <MenubarRadioItem value="dark">Dark</MenubarRadioItem>
                <MenubarRadioItem value="system">System</MenubarRadioItem>
              </MenubarRadioGroup>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSeparator />
          <MenubarGroup>
            <Item id="view.zoomIn" />
            <Item id="view.zoomOut" />
            <Item id="view.zoomReset" />
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <Item id="view.devtools" />
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger>Format</MenubarTrigger>
        <MenubarContent className="w-60">
          <MenubarGroup>
            <Item id="format.bold" />
            <Item id="format.italic" />
            <Item id="format.strike" />
            <Item id="format.code" />
            <Item id="format.link" />
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <Item id="format.h1" />
            <Item id="format.h2" />
            <Item id="format.h3" />
            <Item id="format.paragraph" />
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <Item id="format.bullet" />
            <Item id="format.ordered" />
            <Item id="format.task" />
            <Item id="format.quote" />
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <Item id="format.codeBlock" />
            <Item id="format.table" />
            <Item id="format.image" />
            <Item id="format.hr" />
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger>Help</MenubarTrigger>
        <MenubarContent className="w-60">
          <MenubarGroup>
            <Item id="help.welcome" />
            <Item id="help.shortcuts" />
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <Item id="help.checkUpdates" />
            <UpdateCheckSetting />
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <Item id="help.about" />
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  )
}

const VIEW_MODES: { value: ViewMode; label: string; icon: typeof EyeIcon }[] = [
  { value: "editor", label: "Editor", icon: PenLineIcon },
  { value: "split", label: "Split", icon: SquareSplitHorizontalIcon },
  { value: "preview", label: "Preview", icon: EyeIcon },
]

function ViewModeToggle() {
  const viewMode = useAppStore((s) => s.settings.viewMode)
  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      spacing={0}
      value={viewMode}
      onValueChange={(v) => v && setViewMode(v as ViewMode)}
      aria-label="View mode"
    >
      {VIEW_MODES.map(({ value, label, icon: Icon }) => (
        <Tooltip key={value}>
          <TooltipTrigger asChild>
            <ToggleGroupItem value={value} aria-label={label}>
              <Icon />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>
            {label}
            <span className="ml-2 opacity-60">
              {formatKeys(commandById[`view.${value}`].keys!)}
            </span>
          </TooltipContent>
        </Tooltip>
      ))}
    </ToggleGroup>
  )
}

function ThemeMenu() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Theme">
              {resolvedTheme === "dark" ? <MoonIcon /> : <SunIcon />}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Theme</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-auto">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(v) => setTheme(v as "light" | "dark" | "system")}
        >
          <DropdownMenuRadioItem value="light">
            <SunIcon />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <MoonIcon />
            Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <MonitorIcon />
            System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DocumentTitle() {
  const doc = useActiveDoc()
  const folder = useAppStore((s) => s.folder)
  if (!doc)
    return (
      <span data-tauri-drag-region className="text-sm text-muted-foreground">
        MD Studio
      </span>
    )
  const where = doc.path ? dirname(doc.path) : null
  const shownWhere =
    where && folder && where.startsWith(folder)
      ? where.slice(dirname(folder).length + 1)
      : where
  return (
    <span
      data-tauri-drag-region
      className="flex min-w-0 items-baseline justify-center gap-2 text-sm"
      title={doc.path ?? undefined}
    >
      <span data-tauri-drag-region className="truncate font-medium">
        {docTitle(doc)}
      </span>
      {isDirty(doc) && (
        <span data-tauri-drag-region className="text-muted-foreground">
          Edited
        </span>
      )}
      {shownWhere && (
        <span
          data-tauri-drag-region
          className="hidden truncate text-xs text-muted-foreground lg:inline"
        >
          {shownWhere}
        </span>
      )}
    </span>
  )
}

export function AppHeader() {
  const { focused, fullScreen } = useWindowState()
  return (
    // The header doubles as the window's title bar. Tauri only drags (and
    // double-click maximizes) from elements that carry data-tauri-drag-region
    // themselves, so every empty area is marked; controls are not.
    <header
      data-tauri-drag-region
      data-focused={focused}
      className={cn(
        "grid h-11 shrink-0 grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-3 border-b bg-sidebar px-2 select-none",
        isMac && !fullScreen && "pl-[78px]"
      )}
    >
      <div data-tauri-drag-region className="flex min-w-0 items-center gap-1.5">
        {/* pointer-events-none lets clicks reach the drag region underneath */}
        <div data-tauri-drag-region className="mr-0.5 ml-1.5 flex shrink-0">
          <AppLogo className="pointer-events-none" />
        </div>
        <AppMenubar />
      </div>
      <div
        data-tauri-drag-region
        className={cn(
          "flex min-w-0 justify-center transition-opacity",
          !focused && "opacity-60"
        )}
      >
        <DocumentTitle />
      </div>
      <div
        data-tauri-drag-region
        className="flex items-center justify-end gap-1.5"
      >
        <div className="flex items-center gap-1.5">
          <ViewModeToggle />
          <ThemeMenu />
        </div>
        {!isMac && (
          <>
            <Separator
              orientation="vertical"
              className="mx-1 h-5 data-[orientation=vertical]:self-center"
            />
            <WindowControls />
          </>
        )}
      </div>
    </header>
  )
}
