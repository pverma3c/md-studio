import type { EditorState } from "@codemirror/state"
import type { EditorView } from "@codemirror/view"

/**
 * One CodeMirror view is shared by every tab. Each document keeps its own
 * EditorState (undo history, selection) and scroll offset here while inactive.
 */
export const editorRegistry = {
  view: null as EditorView | null,
  docId: null as string | null,
  states: new Map<
    string,
    { state: EditorState; revision: number; scrollTop: number }
  >(),
}

/** Runs an editor command against the live view and returns focus to it. */
export function runInEditor(command: (view: EditorView) => unknown) {
  const view = editorRegistry.view
  if (!view) return false
  command(view)
  view.focus()
  return true
}

export function forgetEditorState(docId: string) {
  editorRegistry.states.delete(docId)
}
