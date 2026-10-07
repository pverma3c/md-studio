import type { MdStudioApi } from "./platform"
import { tauriApi } from "./tauri-api"

export type {
  FileChangedEvent,
  FileDrop,
  FileTreeNode,
  OpenRequest,
  OpenedFile,
} from "./platform"
export { MARKDOWN_EXTENSIONS } from "./platform"

export const api: MdStudioApi = tauriApi

export const isMac = api.platform === "darwin"
