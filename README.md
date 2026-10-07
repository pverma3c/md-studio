# MD Studio

A desktop Markdown editor with live preview, built with Tauri, React, CodeMirror 6 and shadcn/ui. The native side is a small Rust backend, and pages render in the system webview (WebKitGTK on Linux, WebView2 on Windows, WKWebView on macOS). That keeps the app small: an 8 MB binary, a 5.4 MB `.deb`.

## Features

- **Split editor and preview** with scroll sync in both directions, keyed to source lines rather than scroll percentage. Editor-only, split and preview-only modes (<kbd>Ctrl</kbd>+<kbd>1</kbd>/<kbd>2</kbd>/<kbd>3</kbd>).
- **GitHub-flavoured rendering**: tables, task lists, footnotes, strikethrough, autolinks, sanitized raw HTML, GitHub alerts (`> [!NOTE]`), front matter shown as a properties table, KaTeX math, Mermaid diagrams, and highlighted code blocks with a copy button.
- **Clickable task lists**: ticking a box in the preview edits the source.
- **Tables** open fullscreen from a hover button, with a pinned header row.
- **Preview layout controls**: content width, padding and spacing density.
- **Tabs and folders**: multiple documents with drag-to-reorder tabs, a folder tree with filtering, and an outline that follows your scroll position. Recent files and the last session (open files, folder, active tab) are restored on launch.
- **Disk awareness**: files changed by other programs reload automatically. If you have unsaved edits, a banner lets you choose between keeping yours and reloading. You're asked before closing anything unsaved.
- **Drag and drop**: drop Markdown files or folders onto the window to open them, or drop images onto the editor to insert relative links.
- **Export** to standalone HTML, or to PDF. On Linux the PDF prints straight to a file; elsewhere it goes through the system print dialog.
- **Custom title bar** with the app menubar and window controls. Also a command palette, quick open, a formatting toolbar, light/dark/system themes, a serif reading font, zoom, line numbers, word wrap and spell check.

## Requirements (Linux)

```bash
# Rust (installs to ~/.cargo; the npm scripts add it to PATH themselves)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# WebKitGTK and build dependencies
sudo apt install libwebkit2gtk-4.1-dev libssl-dev libxdo-dev libayatana-appindicator3-dev librsvg2-dev
```

The `.deb` only needs `libwebkit2gtk-4.1-0` and `libgtk-3-0` at runtime. Both ship with standard Ubuntu desktops.

## Scripts

```bash
npm install
npm run app:dev     # Vite + the app window with hot reload
npm run app:build   # release binary + .deb in src-tauri/target/release/
npm run lint
```

The release binary is `src-tauri/target/release/md-studio`, and it accepts files or a folder:
`md-studio ~/notes ~/notes/todo.md`. A second launch forwards its arguments to the running window.

AppImage bundling is turned off. On this machine the bundler couldn't download its AppImage plugin, and the fallback produced an image that won't mount. Add `"appimage"` back to `bundle.targets` in `src-tauri/tauri.conf.json` to try again. Expect about 80 MB, because an AppImage has to bundle WebKitGTK.

## Releases and in-app updates

Installed copies update themselves from this repo's GitHub Releases:

```bash
npm run release -- 0.2.0 "What changed. Markdown is fine; it's shown in the update dialog."
```

This sets the version in `package.json`, `tauri.conf.json` and `Cargo.toml`, then commits, tags `v0.2.0` and pushes. Pushing the tag starts `.github/workflows/release.yml`, which:

- builds the `.deb` and AppImage on Ubuntu 22.04
- signs the update artifacts
- publishes a GitHub Release with `latest.json`

The app checks `latest.json` about 4 seconds after it starts, then every 6 hours. It also checks on demand from **Help → Check for Updates…** (and **Help → Check Automatically** turns the automatic checks off).

When a newer version exists, a toast and the status bar offer it. The update dialog shows the release notes, downloads with a progress bar, installs, and offers to restart. A `.deb` install asks for your password; an AppImage is replaced in place.

Updates must be signed. The private key is `~/.tauri/md-studio.key`, and the matching public key is in `tauri.conf.json`. CI reads the private key from the `TAURI_SIGNING_PRIVATE_KEY` repository secret. **Back up that key file:** without it, installed copies won't accept new releases. Local `npm run app:build` signs with it too.

A binary run straight from `src-tauri/target/` can check for updates but can't install them, because only packaged builds know how they were installed.

## Keyboard shortcuts

| | |
| --- | --- |
| New / Open / Open folder | <kbd>Ctrl</kbd>+<kbd>N</kbd> · <kbd>Ctrl</kbd>+<kbd>O</kbd> · <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd> |
| Save / Save as / Save all | <kbd>Ctrl</kbd>+<kbd>S</kbd> · <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> · <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>S</kbd> |
| Close tab / next / previous tab | <kbd>Ctrl</kbd>+<kbd>W</kbd> · <kbd>Ctrl</kbd>+<kbd>Tab</kbd> · <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Tab</kbd> |
| Quick open / command palette | <kbd>Ctrl</kbd>+<kbd>P</kbd> · <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> |
| Sidebar / outline | <kbd>Ctrl</kbd>+<kbd>B</kbd> · <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd> |
| Bold / italic / strike / code / link | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd> · <kbd>Ctrl</kbd>+<kbd>I</kbd> · <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd> · <kbd>Ctrl</kbd>+<kbd>E</kbd> · <kbd>Ctrl</kbd>+<kbd>K</kbd> |
| Heading 1–4 / paragraph | <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>1</kbd>–<kbd>4</kbd> · <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>0</kbd> |
| Find & replace | <kbd>Ctrl</kbd>+<kbd>F</kbd> |
| Zoom in / out / reset | <kbd>Ctrl</kbd>+<kbd>=</kbd> · <kbd>Ctrl</kbd>+<kbd>-</kbd> · <kbd>Ctrl</kbd>+<kbd>0</kbd> |
| All shortcuts | <kbd>Ctrl</kbd>+<kbd>/</kbd> |

## How it fits together

```
src/
  lib/platform.ts       the native API the interface talks to
  lib/tauri-api.ts      that API implemented with @tauri-apps/api and plugins
  lib/commands.ts       one registry for menus, palette, toolbar and shortcuts
  lib/actions.ts        open / save / close / export flows
  lib/editor/           CodeMirror setup, theme, formatting commands
  lib/markdown/         remark/rehype plugins (source lines, alerts, front matter)
  hooks/use-scroll-sync.ts   editor ⇄ preview sync and outline tracking
  store/app-store.ts    zustand store (documents, folder, settings)
  components/           shell, sidebar, tabs, workspace, preview, dialogs
  components/ui/        shadcn/ui components (radix-nova)
  styles/markdown*.css  preview styles, also embedded in HTML export
src-tauri/
  src/lib.rs            commands: files, folder tree, polling file watcher,
                        recent files, launch arguments, PDF printing, spellcheck
  tauri.conf.json       frameless window, CSP, asset protocol for local images
  capabilities/         which Tauri APIs the window may call
```

Notes:

- One CodeMirror view is shared by all tabs. Each document keeps its own `EditorState`, so undo history and selection survive tab switches.
- Rendering pipeline: `remark-gfm` → `remark-math` → front matter → `rehype-raw` → source-line tagging → `rehype-sanitize` → slugs → alerts → KaTeX → highlight.js. Raw HTML is sanitized before any trusted markup is added.
- Dropped files arrive as native Tauri events carrying real paths. That native handling swallows in-page HTML5 drag-and-drop, so tab reordering uses pointer events instead.
- The title bar's draggable areas are marked with `data-tauri-drag-region`. Only elements carrying the attribute themselves start a drag.
- Plugins: dialog, opener (links and "reveal in file manager"), single-instance, and window-state (remembers size and position).
