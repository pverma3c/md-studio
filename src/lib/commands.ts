import { redo, selectAll, undo } from "@codemirror/commands"
import { openSearchPanel } from "@codemirror/search"
import type { EditorView } from "@codemirror/view"
import {
  BoldIcon,
  CodeIcon,
  CopyIcon,
  EyeIcon,
  FileCodeIcon,
  FileDownIcon,
  FilePlusIcon,
  FileTextIcon,
  FolderOpenIcon,
  FolderSearchIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  InfoIcon,
  ItalicIcon,
  KeyboardIcon,
  LinkIcon,
  ListChecksIcon,
  ListIcon,
  ListOrderedIcon,
  ListTreeIcon,
  MinusIcon,
  MoonIcon,
  PanelLeftIcon,
  PenLineIcon,
  PilcrowIcon,
  QuoteIcon,
  RefreshCwIcon,
  SaveIcon,
  SearchIcon,
  SquareSplitHorizontalIcon,
  StrikethroughIcon,
  SunIcon,
  TableIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
  type LucideIcon,
} from "lucide-react"

import * as actions from "@/lib/actions"
import { api, isMac } from "@/lib/api"
import * as fmt from "@/lib/editor/commands"
import { runInEditor } from "@/lib/editor/registry"
import { checkForUpdates, setAboutOpen } from "@/lib/updates"
import { getActiveDoc, useAppStore } from "@/store/app-store"

export type CommandGroup = "File" | "Edit" | "View" | "Format" | "Help"

export type AppCommand = {
  id: string
  label: string
  group: CommandGroup
  /** e.g. "Mod+Shift+P". "Mod" is ⌘ on macOS and Ctrl elsewhere. */
  keys?: string
  /** Handled by the window-level key listener (otherwise CodeMirror owns the key). */
  global?: boolean
  icon?: LucideIcon
  needsDoc?: boolean
  run: () => void
}

/** Set by the app root so commands can reach the ThemeProvider. */
export const themeBridge = {
  setTheme: (_theme: "light" | "dark" | "system") => {},
}

const edit = (command: (view: EditorView) => unknown) => () => {
  runInEditor(command)
}

const settings = () => useAppStore.getState().settings
const toggleSetting =
  (key: "lineNumbers" | "lineWrap" | "syncScroll" | "spellcheck") => () =>
    useAppStore.getState().setSettings({ [key]: !settings()[key] })

export const COMMANDS: AppCommand[] = [
  // File
  {
    id: "file.new",
    label: "New File",
    group: "File",
    keys: "Mod+N",
    global: true,
    icon: FilePlusIcon,
    run: () => actions.newDocument(),
  },
  {
    id: "file.open",
    label: "Open File…",
    group: "File",
    keys: "Mod+O",
    global: true,
    icon: FileTextIcon,
    run: () => void actions.openFileDialog(),
  },
  {
    id: "file.openFolder",
    label: "Open Folder…",
    group: "File",
    keys: "Mod+Shift+O",
    global: true,
    icon: FolderOpenIcon,
    run: () => void actions.openFolder(),
  },
  {
    id: "file.save",
    label: "Save",
    group: "File",
    keys: "Mod+S",
    global: true,
    icon: SaveIcon,
    needsDoc: true,
    run: () => void actions.saveDoc(),
  },
  {
    id: "file.saveAs",
    label: "Save As…",
    group: "File",
    keys: "Mod+Shift+S",
    global: true,
    needsDoc: true,
    run: () => void actions.saveDocAs(),
  },
  {
    id: "file.saveAll",
    label: "Save All",
    group: "File",
    keys: "Mod+Alt+S",
    global: true,
    run: () => void actions.saveAll(),
  },
  {
    id: "file.exportHtml",
    label: "Export as HTML…",
    group: "File",
    icon: FileCodeIcon,
    needsDoc: true,
    run: () => void actions.exportActive("html"),
  },
  {
    id: "file.exportPdf",
    label: "Export as PDF…",
    group: "File",
    icon: FileDownIcon,
    needsDoc: true,
    run: () => void actions.exportActive("pdf"),
  },
  {
    id: "file.reveal",
    label: "Reveal in File Manager",
    group: "File",
    icon: FolderSearchIcon,
    needsDoc: true,
    run: actions.revealActiveInFolder,
  },
  {
    id: "file.copyPath",
    label: "Copy File Path",
    group: "File",
    icon: CopyIcon,
    needsDoc: true,
    run: () => void actions.copyActivePath(),
  },
  {
    id: "file.close",
    label: "Close Tab",
    group: "File",
    keys: "Mod+W",
    global: true,
    icon: XIcon,
    needsDoc: true,
    run: actions.closeActiveDoc,
  },
  {
    id: "file.closeOthers",
    label: "Close Other Tabs",
    group: "File",
    needsDoc: true,
    run: () => {
      const d = getActiveDoc()
      if (d) actions.closeOtherDocs(d.id)
    },
  },
  {
    id: "file.closeFolder",
    label: "Close Folder",
    group: "File",
    run: actions.closeFolder,
  },
  {
    id: "file.quit",
    label: "Quit",
    group: "File",
    keys: "Mod+Q",
    global: true,
    run: actions.requestCloseWindow,
  },

  // Edit
  {
    id: "edit.undo",
    label: "Undo",
    group: "Edit",
    keys: "Mod+Z",
    needsDoc: true,
    run: edit(undo),
  },
  {
    id: "edit.redo",
    label: "Redo",
    group: "Edit",
    keys: "Mod+Shift+Z",
    needsDoc: true,
    run: edit(redo),
  },
  {
    id: "edit.find",
    label: "Find & Replace",
    group: "Edit",
    keys: "Mod+F",
    icon: SearchIcon,
    needsDoc: true,
    run: edit(openSearchPanel),
  },
  {
    id: "edit.selectAll",
    label: "Select All",
    group: "Edit",
    keys: "Mod+A",
    needsDoc: true,
    run: edit(selectAll),
  },

  // View
  {
    id: "view.editor",
    label: "Editor Only",
    group: "View",
    keys: "Mod+1",
    global: true,
    icon: PenLineIcon,
    run: () => actions.setViewMode("editor"),
  },
  {
    id: "view.split",
    label: "Split View",
    group: "View",
    keys: "Mod+2",
    global: true,
    icon: SquareSplitHorizontalIcon,
    run: () => actions.setViewMode("split"),
  },
  {
    id: "view.preview",
    label: "Preview Only",
    group: "View",
    keys: "Mod+3",
    global: true,
    icon: EyeIcon,
    run: () => actions.setViewMode("preview"),
  },
  {
    id: "view.sidebar",
    label: "Toggle Sidebar",
    group: "View",
    keys: "Mod+B",
    global: true,
    icon: PanelLeftIcon,
    run: () => actions.toggleSidebar(),
  },
  {
    id: "view.outline",
    label: "Show Outline",
    group: "View",
    keys: "Mod+Shift+L",
    global: true,
    icon: ListTreeIcon,
    run: () => actions.toggleSidebar("outline"),
  },
  {
    id: "view.quickOpen",
    label: "Go to File…",
    group: "View",
    keys: "Mod+P",
    global: true,
    icon: SearchIcon,
    run: () => useAppStore.getState().setPalette("files"),
  },
  {
    id: "view.palette",
    label: "Command Palette…",
    group: "View",
    keys: "Mod+Shift+P",
    global: true,
    run: () => useAppStore.getState().setPalette("commands"),
  },
  {
    id: "view.zoomIn",
    label: "Zoom In",
    group: "View",
    keys: "Mod+=",
    global: true,
    icon: ZoomInIcon,
    run: () => actions.zoom(1),
  },
  {
    id: "view.zoomOut",
    label: "Zoom Out",
    group: "View",
    keys: "Mod+-",
    global: true,
    icon: ZoomOutIcon,
    run: () => actions.zoom(-1),
  },
  {
    id: "view.zoomReset",
    label: "Reset Zoom",
    group: "View",
    keys: "Mod+0",
    global: true,
    run: () => actions.zoom(0),
  },
  {
    id: "view.nextTab",
    label: "Next Tab",
    group: "View",
    keys: "Ctrl+Tab",
    global: true,
    run: () => actions.cycleDoc(1),
  },
  {
    id: "view.prevTab",
    label: "Previous Tab",
    group: "View",
    keys: "Ctrl+Shift+Tab",
    global: true,
    run: () => actions.cycleDoc(-1),
  },
  {
    id: "view.lineNumbers",
    label: "Toggle Line Numbers",
    group: "View",
    run: toggleSetting("lineNumbers"),
  },
  {
    id: "view.wrap",
    label: "Toggle Word Wrap",
    group: "View",
    keys: "Alt+Z",
    global: true,
    run: toggleSetting("lineWrap"),
  },
  {
    id: "view.syncScroll",
    label: "Toggle Scroll Sync",
    group: "View",
    run: toggleSetting("syncScroll"),
  },
  {
    id: "view.spellcheck",
    label: "Toggle Spell Check",
    group: "View",
    run: toggleSetting("spellcheck"),
  },
  {
    id: "view.serif",
    label: "Toggle Serif Preview Font",
    group: "View",
    run: () =>
      useAppStore.getState().setSettings({
        previewFont: settings().previewFont === "serif" ? "sans" : "serif",
      }),
  },
  {
    id: "view.appStyle",
    label: "Toggle App UI Preview Style",
    group: "View",
    run: () =>
      useAppStore.getState().setSettings({
        previewStyle: settings().previewStyle === "app" ? "document" : "app",
      }),
  },
  {
    id: "view.themeLight",
    label: "Theme: Light",
    group: "View",
    icon: SunIcon,
    run: () => themeBridge.setTheme("light"),
  },
  {
    id: "view.themeDark",
    label: "Theme: Dark",
    group: "View",
    icon: MoonIcon,
    run: () => themeBridge.setTheme("dark"),
  },
  {
    id: "view.themeSystem",
    label: "Theme: System",
    group: "View",
    run: () => themeBridge.setTheme("system"),
  },
  {
    id: "view.devtools",
    label: "Toggle Developer Tools",
    group: "View",
    keys: "Mod+Shift+I",
    global: true,
    run: () => api.toggleDevTools(),
  },

  // Format
  {
    id: "format.bold",
    label: "Bold",
    group: "Format",
    keys: "Mod+Shift+B",
    icon: BoldIcon,
    needsDoc: true,
    run: edit(fmt.toggleBold),
  },
  {
    id: "format.italic",
    label: "Italic",
    group: "Format",
    keys: "Mod+I",
    icon: ItalicIcon,
    needsDoc: true,
    run: edit(fmt.toggleItalic),
  },
  {
    id: "format.strike",
    label: "Strikethrough",
    group: "Format",
    keys: "Mod+Shift+X",
    icon: StrikethroughIcon,
    needsDoc: true,
    run: edit(fmt.toggleStrike),
  },
  {
    id: "format.code",
    label: "Inline Code",
    group: "Format",
    keys: "Mod+E",
    icon: CodeIcon,
    needsDoc: true,
    run: edit(fmt.toggleInlineCode),
  },
  {
    id: "format.link",
    label: "Link",
    group: "Format",
    keys: "Mod+K",
    icon: LinkIcon,
    needsDoc: true,
    run: edit(fmt.insertLink),
  },
  {
    id: "format.h1",
    label: "Heading 1",
    group: "Format",
    keys: "Mod+Alt+1",
    icon: Heading1Icon,
    needsDoc: true,
    run: edit(fmt.setHeading(1)),
  },
  {
    id: "format.h2",
    label: "Heading 2",
    group: "Format",
    keys: "Mod+Alt+2",
    icon: Heading2Icon,
    needsDoc: true,
    run: edit(fmt.setHeading(2)),
  },
  {
    id: "format.h3",
    label: "Heading 3",
    group: "Format",
    keys: "Mod+Alt+3",
    icon: Heading3Icon,
    needsDoc: true,
    run: edit(fmt.setHeading(3)),
  },
  {
    id: "format.paragraph",
    label: "Plain Paragraph",
    group: "Format",
    keys: "Mod+Alt+0",
    icon: PilcrowIcon,
    needsDoc: true,
    run: edit(fmt.setHeading(0)),
  },
  {
    id: "format.quote",
    label: "Quote",
    group: "Format",
    icon: QuoteIcon,
    needsDoc: true,
    run: edit(fmt.toggleQuote),
  },
  {
    id: "format.bullet",
    label: "Bulleted List",
    group: "Format",
    icon: ListIcon,
    needsDoc: true,
    run: edit(fmt.toggleBulletList),
  },
  {
    id: "format.ordered",
    label: "Numbered List",
    group: "Format",
    icon: ListOrderedIcon,
    needsDoc: true,
    run: edit(fmt.toggleOrderedList),
  },
  {
    id: "format.task",
    label: "Task List",
    group: "Format",
    icon: ListChecksIcon,
    needsDoc: true,
    run: edit(fmt.toggleTaskList),
  },
  {
    id: "format.codeBlock",
    label: "Code Block",
    group: "Format",
    icon: FileCodeIcon,
    needsDoc: true,
    run: edit(fmt.insertCodeBlock),
  },
  {
    id: "format.table",
    label: "Table",
    group: "Format",
    icon: TableIcon,
    needsDoc: true,
    run: edit(fmt.insertTable),
  },
  {
    id: "format.hr",
    label: "Horizontal Rule",
    group: "Format",
    icon: MinusIcon,
    needsDoc: true,
    run: edit(fmt.insertHorizontalRule),
  },
  {
    id: "format.image",
    label: "Image",
    group: "Format",
    icon: ImageIcon,
    needsDoc: true,
    run: edit(fmt.insertImage),
  },

  // Help
  {
    id: "help.welcome",
    label: "Welcome Guide",
    group: "Help",
    icon: FileTextIcon,
    run: actions.openWelcome,
  },
  {
    id: "help.shortcuts",
    label: "Keyboard Shortcuts",
    group: "Help",
    keys: "Mod+/",
    global: true,
    icon: KeyboardIcon,
    run: () => useAppStore.getState().setShortcutsOpen(true),
  },
  {
    id: "help.checkUpdates",
    label: "Check for Updates…",
    group: "Help",
    icon: RefreshCwIcon,
    run: () => void checkForUpdates({ manual: true }),
  },
  {
    id: "help.about",
    label: "About MD Studio",
    group: "Help",
    icon: InfoIcon,
    run: () => setAboutOpen(true),
  },
]

export const commandById = Object.fromEntries(
  COMMANDS.map((c) => [c.id, c])
) as Record<string, AppCommand>

export function runCommand(id: string) {
  const cmd = commandById[id]
  if (!cmd) return
  if (cmd.needsDoc && !getActiveDoc()) return
  cmd.run()
}

// ---------------------------------------------------------------------------
// Key handling

type Chord = {
  mod: boolean
  ctrl: boolean
  shift: boolean
  alt: boolean
  key: string
}

function parseChord(keys: string): Chord {
  const parts = keys.split("+")
  // "Mod+=" / "Mod+-" — the final part is the key even if it's a symbol.
  const key = parts.pop()!.toLowerCase()
  return {
    mod: parts.includes("Mod"),
    ctrl: parts.includes("Ctrl"),
    shift: parts.includes("Shift"),
    alt: parts.includes("Alt"),
    key,
  }
}

const KEY_ALIASES: Record<string, string[]> = {
  "=": ["=", "+"],
  "-": ["-", "_"],
  "/": ["/", "?"],
}

function eventKey(e: KeyboardEvent) {
  if (/^Digit\d$/.test(e.code)) return e.code.slice(5)
  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3).toLowerCase()
  return e.key.toLowerCase()
}

export function matchesChord(e: KeyboardEvent, keys: string) {
  const chord = parseChord(keys)
  const wantCtrl = chord.ctrl || (chord.mod && !isMac)
  const wantMeta = chord.mod && isMac
  if (
    e.ctrlKey !== wantCtrl ||
    e.metaKey !== wantMeta ||
    e.altKey !== chord.alt
  )
    return false
  const key = eventKey(e)
  const accepted = KEY_ALIASES[chord.key] ?? [chord.key]
  if (!accepted.includes(key)) return false
  // Symbol keys often need Shift on some layouts ("+" on US), so only enforce
  // Shift for letters, digits and named keys.
  if (KEY_ALIASES[chord.key]) return true
  return e.shiftKey === chord.shift
}

export function formatKeys(keys: string) {
  const parts = keys.split("+")
  const key = parts.pop()!
  const label = key.length === 1 ? key.toUpperCase() : key
  if (isMac) {
    const symbols: Record<string, string> = {
      Mod: "⌘",
      Ctrl: "⌃",
      Shift: "⇧",
      Alt: "⌥",
    }
    return parts.map((p) => symbols[p] ?? p).join("") + label
  }
  return [...parts.map((p) => (p === "Mod" ? "Ctrl" : p)), label].join("+")
}

export function formatKeyParts(keys: string) {
  const parts = keys.split("+")
  const key = parts.pop()!
  const label = key.length === 1 ? key.toUpperCase() : key
  const mods = parts.map((p) =>
    isMac
      ? ((
          { Mod: "⌘", Ctrl: "⌃", Shift: "⇧", Alt: "⌥" } as Record<
            string,
            string
          >
        )[p] ?? p)
      : p === "Mod"
        ? "Ctrl"
        : p
  )
  return [...mods, label]
}
