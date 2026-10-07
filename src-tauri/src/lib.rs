use std::{
    cmp::Ordering,
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{Duration, SystemTime},
};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};

const MARKDOWN_EXTENSIONS: &[&str] = &["md", "markdown", "mdown", "mkd", "mdx", "txt"];
const MAX_FILE_BYTES: u64 = 25 * 1024 * 1024;
const MAX_RECENT: usize = 12;
const TREE_MAX_DEPTH: usize = 8;
const TREE_MAX_ENTRIES: usize = 5000;
const TREE_SKIP_DIRS: &[&str] = &[
    "node_modules",
    "dist",
    "build",
    "out",
    "target",
    "venv",
    "__pycache__",
];
const WATCH_INTERVAL: Duration = Duration::from_millis(800);

// ---------------------------------------------------------------------------
// Types shared with the renderer (see src/lib/platform.ts)

#[derive(Serialize)]
struct OpenedFile {
    path: String,
    content: String,
}

#[derive(Serialize)]
struct FileTreeNode {
    name: String,
    path: String,
    kind: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    children: Option<Vec<FileTreeNode>>,
}

/// Paths handed to the app from the command line or a second launch.
#[derive(Serialize, Clone, Default)]
struct OpenRequest {
    files: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    folder: Option<String>,
}

#[derive(Serialize, Clone)]
struct FileChanged {
    path: String,
    /// None when the file was deleted or renamed away.
    content: Option<String>,
}

type Signature = Option<(SystemTime, u64)>;

#[derive(Default)]
struct AppState {
    pending: Mutex<OpenRequest>,
    /// Watched file -> last seen (modified time, size); None while missing.
    watched: Mutex<HashMap<PathBuf, Signature>>,
    recent: Mutex<()>,
}

// ---------------------------------------------------------------------------
// Helpers

fn to_err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

fn path_string(p: &Path) -> String {
    p.to_string_lossy().into_owned()
}

fn is_markdown(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| MARKDOWN_EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

fn read_text(path: &Path) -> Result<String, String> {
    let meta = fs::metadata(path).map_err(to_err)?;
    if meta.len() > MAX_FILE_BYTES {
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy())
            .unwrap_or_default();
        return Err(format!("{name} is larger than 25 MB"));
    }
    let bytes = fs::read(path).map_err(to_err)?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

fn signature(path: &Path) -> Signature {
    let meta = fs::metadata(path).ok()?;
    Some((meta.modified().ok()?, meta.len()))
}

/// Lets the preview load images that sit next to documents the user opened.
fn allow_assets(app: &AppHandle, dir: &Path) {
    let _ = app.asset_protocol_scope().allow_directory(dir, true);
}

/// Case-insensitive order that treats digit runs as numbers ("note 2" < "note 10").
fn natural_cmp(a: &str, b: &str) -> Ordering {
    let (a, b) = (a.to_lowercase(), b.to_lowercase());
    let (mut ai, mut bi) = (a.chars().peekable(), b.chars().peekable());
    loop {
        match (ai.peek().copied(), bi.peek().copied()) {
            (None, None) => return Ordering::Equal,
            (None, Some(_)) => return Ordering::Less,
            (Some(_), None) => return Ordering::Greater,
            (Some(x), Some(y)) if x.is_ascii_digit() && y.is_ascii_digit() => {
                let mut na = String::new();
                while let Some(&c) = ai.peek().filter(|c| c.is_ascii_digit()) {
                    na.push(c);
                    ai.next();
                }
                let mut nb = String::new();
                while let Some(&c) = bi.peek().filter(|c| c.is_ascii_digit()) {
                    nb.push(c);
                    bi.next();
                }
                let (na, nb) = (na.trim_start_matches('0'), nb.trim_start_matches('0'));
                let ord = na.len().cmp(&nb.len()).then_with(|| na.cmp(nb));
                if ord != Ordering::Equal {
                    return ord;
                }
            }
            (Some(x), Some(y)) => {
                if x != y {
                    return x.cmp(&y);
                }
                ai.next();
                bi.next();
            }
        }
    }
}

fn walk(dir: &Path, depth: usize, entries: &mut usize) -> Vec<FileTreeNode> {
    if depth > TREE_MAX_DEPTH || *entries > TREE_MAX_ENTRIES {
        return Vec::new();
    }
    let Ok(read) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut dirs = Vec::new();
    let mut files = Vec::new();
    for entry in read.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let Ok(kind) = entry.file_type() else {
            continue;
        };
        let path = entry.path();
        if kind.is_dir() {
            if TREE_SKIP_DIRS.contains(&name.as_str()) {
                continue;
            }
            let children = walk(&path, depth + 1, entries);
            // Only keep folders that (eventually) contain markdown.
            if !children.is_empty() {
                dirs.push(FileTreeNode {
                    name,
                    path: path_string(&path),
                    kind: "dir",
                    children: Some(children),
                });
            }
        } else if kind.is_file() && is_markdown(&path) {
            *entries += 1;
            files.push(FileTreeNode {
                name,
                path: path_string(&path),
                kind: "file",
                children: None,
            });
        }
    }
    dirs.sort_by(|a, b| natural_cmp(&a.name, &b.name));
    files.sort_by(|a, b| natural_cmp(&a.name, &b.name));
    dirs.extend(files);
    dirs
}

fn parse_open_args<S: AsRef<str>>(args: &[S], cwd: &Path) -> OpenRequest {
    let mut req = OpenRequest::default();
    for arg in args.iter().map(|a| a.as_ref()) {
        if arg.is_empty() || arg.starts_with('-') {
            continue;
        }
        let full = cwd.join(arg);
        let Ok(meta) = fs::metadata(&full) else {
            continue;
        };
        let full = fs::canonicalize(&full).unwrap_or(full);
        if meta.is_file() && is_markdown(&full) {
            req.files.push(path_string(&full));
        } else if meta.is_dir() && req.folder.is_none() {
            req.folder = Some(path_string(&full));
        }
    }
    req
}

fn recent_file(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|d| d.join("recent.json"))
}

fn load_recent(app: &AppHandle) -> Vec<String> {
    recent_file(app)
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn store_recent(app: &AppHandle, list: &[String]) {
    if let Some(path) = recent_file(app) {
        if let Some(dir) = path.parent() {
            let _ = fs::create_dir_all(dir);
        }
        let _ = fs::write(path, serde_json::to_string_pretty(list).unwrap_or_default());
    }
}

// Polling survives editors that save via rename (atomic writes), which break
// inode-based watchers.
fn spawn_file_watcher(app: AppHandle) {
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(WATCH_INTERVAL);
            let state = app.state::<AppState>();
            let mut changed = Vec::new();
            {
                let mut watched = state.watched.lock().unwrap();
                for (path, last) in watched.iter_mut() {
                    let now = signature(path);
                    if now != *last {
                        *last = now;
                        changed.push((path.clone(), now.is_some()));
                    }
                }
            }
            for (path, exists) in changed {
                let content = if exists { read_text(&path).ok() } else { None };
                let _ = app.emit(
                    "file:changed",
                    FileChanged {
                        path: path_string(&path),
                        content,
                    },
                );
            }
        }
    });
}

// ---------------------------------------------------------------------------
// Commands

#[tauri::command]
async fn read_file(app: AppHandle, path: String) -> Result<OpenedFile, String> {
    let p = PathBuf::from(&path);
    let content = read_text(&p)?;
    if let Some(parent) = p.parent() {
        allow_assets(&app, parent);
    }
    Ok(OpenedFile { path, content })
}

#[tauri::command]
async fn write_file(path: String, content: String) -> Result<(), String> {
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(to_err)?;
    }
    fs::write(p, content).map_err(to_err)
}

#[tauri::command]
async fn list_folder(app: AppHandle, root: String) -> Result<FileTreeNode, String> {
    let root_path = PathBuf::from(&root);
    if !root_path.is_dir() {
        return Err(format!("{root} is not a folder"));
    }
    allow_assets(&app, &root_path);
    let mut entries = 0;
    let children = walk(&root_path, 0, &mut entries);
    let name = root_path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or(root.clone());
    Ok(FileTreeNode {
        name,
        path: root,
        kind: "dir",
        children: Some(children),
    })
}

#[tauri::command]
fn path_kind(path: String) -> Option<&'static str> {
    let meta = fs::metadata(path).ok()?;
    Some(if meta.is_dir() { "dir" } else { "file" })
}

#[tauri::command]
fn watch_files(state: State<'_, AppState>, paths: Vec<String>) {
    let mut watched = state.watched.lock().unwrap();
    let next = paths
        .into_iter()
        .map(|p| {
            let path = PathBuf::from(p);
            let sig = watched.remove(&path).unwrap_or_else(|| signature(&path));
            (path, sig)
        })
        .collect();
    *watched = next;
}

#[tauri::command]
fn take_launch_request(state: State<'_, AppState>) -> OpenRequest {
    std::mem::take(&mut *state.pending.lock().unwrap())
}

#[tauri::command]
fn get_recent(app: AppHandle, state: State<'_, AppState>) -> Vec<String> {
    let _guard = state.recent.lock().unwrap();
    load_recent(&app)
        .into_iter()
        .filter(|p| Path::new(p).exists())
        .collect()
}

#[tauri::command]
fn add_recent(app: AppHandle, state: State<'_, AppState>, path: String) -> Vec<String> {
    let _guard = state.recent.lock().unwrap();
    let mut list = load_recent(&app);
    list.retain(|p| p != &path);
    list.insert(0, path);
    list.truncate(MAX_RECENT);
    store_recent(&app, &list);
    list
}

#[tauri::command]
fn clear_recent(app: AppHandle, state: State<'_, AppState>) {
    let _guard = state.recent.lock().unwrap();
    store_recent(&app, &[]);
}

/// How this copy was installed ("deb", "appimage", …), or None for a plain
/// binary (e.g. a local build), which can't update itself in place.
#[tauri::command]
fn install_kind() -> Option<String> {
    if let Some(kind) = tauri::utils::platform::bundle_type() {
        return Some(kind.to_string());
    }
    // The AppImage runtime always sets APPIMAGE to the file the updater replaces.
    std::env::var_os("APPIMAGE").map(|_| "appimage".to_string())
}

#[tauri::command]
fn toggle_devtools(window: WebviewWindow) {
    if window.is_devtools_open() {
        window.close_devtools();
    } else {
        window.open_devtools();
    }
}

/// Matches the window (dock/taskbar) icon to the system's light or dark
/// setting: the slate page on dark, the app's default white page otherwise.
#[tauri::command]
fn set_window_icon(window: WebviewWindow, dark: bool) -> Result<(), String> {
    let icon = if dark {
        tauri::image::Image::from_bytes(include_bytes!("../icons/dark/256x256.png"))
            .map_err(to_err)?
    } else {
        match window.app_handle().default_window_icon() {
            Some(icon) => icon.clone(),
            None => return Ok(()),
        }
    };
    window.set_icon(icon).map_err(to_err)
}

/// Prints the page (print CSS shows only #print-root) straight to a PDF file
/// through WebKitGTK, without a print dialog. Other platforms report
/// "unsupported" and the renderer falls back to window.print().
#[tauri::command]
async fn export_pdf(window: WebviewWindow, path: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        use std::{cell::RefCell, rc::Rc, sync::mpsc};
        use webkit2gtk::PrintOperationExt;

        let uri = gtk::glib::filename_to_uri(&path, None)
            .map_err(to_err)?
            .to_string();
        let (tx, rx) = mpsc::channel::<Result<(), String>>();
        window
            .with_webview(move |webview| {
                let settings = gtk::PrintSettings::new();
                settings.set_printer("Print to File");
                settings.set(gtk::PRINT_SETTINGS_OUTPUT_FILE_FORMAT, Some("pdf"));
                settings.set(gtk::PRINT_SETTINGS_OUTPUT_URI, Some(&uri));

                let setup = gtk::PageSetup::new();
                setup.set_paper_size(&gtk::PaperSize::new(Some("iso_a4")));
                setup.set_top_margin(18.0, gtk::Unit::Mm);
                setup.set_bottom_margin(18.0, gtk::Unit::Mm);
                setup.set_left_margin(19.0, gtk::Unit::Mm);
                setup.set_right_margin(19.0, gtk::Unit::Mm);

                let op = webkit2gtk::PrintOperation::new(&webview.inner());
                op.set_print_settings(&settings);
                op.set_page_setup(&setup);

                // Keep the operation alive until WebKit reports the outcome.
                let holder = Rc::new(RefCell::new(Some(op.clone())));
                let fail_tx = tx.clone();
                op.connect_failed(move |_, e| {
                    let _ = fail_tx.send(Err(e.to_string()));
                });
                op.connect_finished(move |_| {
                    holder.borrow_mut().take();
                    let _ = tx.send(Ok(()));
                });
                op.print();
            })
            .map_err(to_err)?;
        let outcome =
            tauri::async_runtime::spawn_blocking(move || rx.recv_timeout(Duration::from_secs(60)))
                .await
                .map_err(to_err)?
                .map_err(|_| "Timed out while printing".to_string())?;
        // "finished" also fires after "failed"; the first message wins.
        outcome
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (window, path);
        Err("unsupported".into())
    }
}

#[cfg(target_os = "linux")]
fn enable_spellcheck(window: &WebviewWindow) {
    let _ = window.with_webview(|webview| {
        use webkit2gtk::{WebContextExt, WebViewExt};
        if let Some(context) = webview.inner().context() {
            let lang = std::env::var("LANG")
                .ok()
                .and_then(|l| l.split('.').next().map(str::to_owned))
                .filter(|l| !l.is_empty() && l != "C" && l != "POSIX")
                .unwrap_or_else(|| "en_US".into());
            context.set_spell_checking_enabled(true);
            context.set_spell_checking_languages(&[lang.as_str()]);
        }
    });
}

// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // A second launch forwards its files/folder to the running window.
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            let req = parse_open_args(argv.get(1..).unwrap_or_default(), Path::new(&cwd));
            if !req.files.is_empty() || req.folder.is_some() {
                let _ = app.emit("app:open-request", req);
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::new().build())
        // In-app updates from GitHub Releases (see plugins.updater in tauri.conf.json).
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            list_folder,
            path_kind,
            watch_files,
            take_launch_request,
            get_recent,
            add_recent,
            clear_recent,
            toggle_devtools,
            install_kind,
            set_window_icon,
            export_pdf,
        ])
        .setup(|app| {
            let args: Vec<String> = std::env::args().skip(1).collect();
            let cwd = std::env::current_dir().unwrap_or_default();
            *app.state::<AppState>().pending.lock().unwrap() = parse_open_args(&args, &cwd);
            spawn_file_watcher(app.handle().clone());

            #[cfg(target_os = "linux")]
            if let Some(window) = app.get_webview_window("main") {
                enable_spellcheck(&window);
            }

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running MD Studio");
}
