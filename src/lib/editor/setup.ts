import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands"
import { markdown, markdownLanguage } from "@codemirror/lang-markdown"
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language"
import { languages } from "@codemirror/language-data"
import { yamlFrontmatter } from "@codemirror/lang-yaml"
import {
  highlightSelectionMatches,
  search,
  searchKeymap,
} from "@codemirror/search"
import { Compartment, EditorState, type Extension } from "@codemirror/state"
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  placeholder,
  rectangularSelection,
  type ViewUpdate,
} from "@codemirror/view"
import { tags as t } from "@lezer/highlight"

import type { Settings } from "@/store/app-store"

import {
  insertLink,
  setHeading,
  toggleBold,
  toggleInlineCode,
  toggleItalic,
  toggleStrike,
} from "./commands"

export type EditorHooks = {
  onDocChange: (update: ViewUpdate) => void
  onSelection: (update: ViewUpdate) => void
}

const lineNumbersSlot = new Compartment()
const wrapSlot = new Compartment()
const spellcheckSlot = new Compartment()

function settingsExtensions(settings: Settings): Extension[] {
  return [
    lineNumbersSlot.of(
      settings.lineNumbers ? [lineNumbers(), highlightActiveLineGutter()] : []
    ),
    wrapSlot.of(settings.lineWrap ? EditorView.lineWrapping : []),
    spellcheckSlot.of(
      EditorView.contentAttributes.of({
        spellcheck: settings.spellcheck ? "true" : "false",
        autocorrect: "off",
        autocapitalize: "off",
      })
    ),
  ]
}

export function applySettings(view: EditorView, settings: Settings) {
  view.dispatch({
    effects: [
      lineNumbersSlot.reconfigure(
        settings.lineNumbers ? [lineNumbers(), highlightActiveLineGutter()] : []
      ),
      wrapSlot.reconfigure(settings.lineWrap ? EditorView.lineWrapping : []),
      spellcheckSlot.reconfigure(
        EditorView.contentAttributes.of({
          spellcheck: settings.spellcheck ? "true" : "false",
          autocorrect: "off",
          autocapitalize: "off",
        })
      ),
    ],
  })
}

// Colours come from CSS variables (see index.css) so the editor follows the
// light/dark theme without rebuilding extensions.
const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "var(--editor-font-size)",
    color: "var(--foreground)",
    backgroundColor: "transparent",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    lineHeight: "1.75",
    overflow: "auto",
  },
  ".cm-content": {
    padding: "28px 0 45vh",
    caretColor: "var(--foreground)",
  },
  ".cm-line": { padding: "0 32px" },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--foreground)",
    borderLeftWidth: "2px",
  },
  ".cm-selectionBackground": {
    backgroundColor: "var(--editor-selection) !important",
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "var(--editor-selection) !important",
  },
  ".cm-activeLine": { backgroundColor: "var(--editor-active-line)" },
  ".cm-gutters": {
    backgroundColor: "transparent",
    border: "none",
    color: "var(--muted-foreground)",
    opacity: "0.6",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 4px 0 16px",
    minWidth: "40px",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "var(--foreground)",
  },
  ".cm-placeholder": { color: "var(--muted-foreground)", fontStyle: "italic" },
  ".cm-matchingBracket": {
    backgroundColor: "var(--editor-match)",
    outline: "none",
  },
  ".cm-selectionMatch": { backgroundColor: "var(--editor-match)" },
  ".cm-searchMatch": {
    backgroundColor: "var(--editor-search)",
    borderRadius: "2px",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "var(--editor-search-active)",
  },
  ".cm-panels": {
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
    fontFamily: "var(--font-sans)",
  },
  ".cm-panels.cm-panels-top": { borderBottom: "1px solid var(--border)" },
  ".cm-panels.cm-panels-bottom": { borderTop: "1px solid var(--border)" },
  ".cm-panel.cm-search": {
    padding: "8px 12px",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
  },
  ".cm-panel.cm-search br": { flexBasis: "100%", height: 0 },
  ".cm-panel.cm-search label": {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    color: "var(--muted-foreground)",
    fontSize: "12px",
  },
  ".cm-panel.cm-search [name=close]": {
    position: "absolute",
    top: "6px",
    right: "10px",
    fontSize: "16px",
    color: "var(--muted-foreground)",
    background: "none",
    border: "none",
    cursor: "pointer",
  },
  ".cm-textfield": {
    height: "28px",
    padding: "0 8px",
    margin: 0,
    fontSize: "12px",
    borderRadius: "calc(var(--radius) * 0.8)",
    border: "1px solid var(--input)",
    backgroundColor: "transparent",
    color: "var(--foreground)",
    outline: "none",
  },
  ".cm-textfield:focus": {
    borderColor: "var(--ring)",
    boxShadow: "0 0 0 3px color-mix(in oklch, var(--ring) 40%, transparent)",
  },
  ".cm-button": {
    height: "28px",
    padding: "0 10px",
    margin: 0,
    fontSize: "12px",
    borderRadius: "calc(var(--radius) * 0.8)",
    border: "1px solid var(--border)",
    backgroundImage: "none",
    backgroundColor: "var(--background)",
    color: "var(--foreground)",
    cursor: "pointer",
    textTransform: "capitalize",
  },
  ".cm-button:hover": { backgroundColor: "var(--accent)" },
  ".cm-button:active": { backgroundImage: "none" },
})

const markdownHighlight = HighlightStyle.define([
  {
    tag: t.heading1,
    fontSize: "1.4em",
    fontWeight: "700",
    color: "var(--syntax-heading)",
  },
  {
    tag: t.heading2,
    fontSize: "1.22em",
    fontWeight: "700",
    color: "var(--syntax-heading)",
  },
  {
    tag: t.heading3,
    fontSize: "1.1em",
    fontWeight: "650",
    color: "var(--syntax-heading)",
  },
  {
    tag: [t.heading4, t.heading5, t.heading6],
    fontWeight: "650",
    color: "var(--syntax-heading)",
  },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  {
    tag: t.strikethrough,
    textDecoration: "line-through",
    color: "var(--muted-foreground)",
  },
  { tag: t.link, color: "var(--syntax-link)" },
  {
    tag: t.url,
    color: "var(--syntax-url)",
    textDecoration: "underline",
    textDecorationColor: "color-mix(in oklch, currentColor 40%, transparent)",
  },
  { tag: t.monospace, color: "var(--syntax-code)" },
  { tag: t.quote, color: "var(--muted-foreground)", fontStyle: "italic" },
  {
    tag: [t.processingInstruction, t.contentSeparator, t.labelName],
    color: "var(--syntax-mark)",
  },
  { tag: t.list, color: "var(--foreground)" },
  { tag: [t.comment, t.meta], color: "var(--syntax-comment)" },
  // Languages inside fenced code blocks
  {
    tag: [t.keyword, t.modifier, t.controlKeyword, t.operatorKeyword],
    color: "var(--syntax-keyword)",
  },
  {
    tag: [t.string, t.special(t.string), t.regexp],
    color: "var(--syntax-string)",
  },
  { tag: [t.number, t.bool, t.null, t.atom], color: "var(--syntax-number)" },
  {
    tag: [t.function(t.variableName), t.function(t.propertyName)],
    color: "var(--syntax-function)",
  },
  { tag: [t.typeName, t.className, t.namespace], color: "var(--syntax-type)" },
  { tag: [t.propertyName, t.attributeName], color: "var(--syntax-property)" },
  { tag: [t.tagName], color: "var(--syntax-keyword)" },
  { tag: t.invalid, color: "var(--destructive)" },
])

const formattingKeymap = keymap.of([
  { key: "Mod-Shift-b", run: toggleBold },
  { key: "Mod-i", run: toggleItalic },
  { key: "Mod-Shift-x", run: toggleStrike },
  { key: "Mod-e", run: toggleInlineCode },
  { key: "Mod-k", run: insertLink },
  { key: "Mod-Alt-0", run: setHeading(0) },
  { key: "Mod-Alt-1", run: setHeading(1) },
  { key: "Mod-Alt-2", run: setHeading(2) },
  { key: "Mod-Alt-3", run: setHeading(3) },
  { key: "Mod-Alt-4", run: setHeading(4) },
])

export function createEditorState(
  doc: string,
  settings: Settings,
  hooks: EditorHooks
) {
  return EditorState.create({
    doc,
    extensions: [
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      bracketMatching(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      search({ top: true }),
      yamlFrontmatter({
        content: markdown({
          base: markdownLanguage,
          codeLanguages: languages,
          addKeymap: true,
        }),
      }),
      syntaxHighlighting(markdownHighlight),
      editorTheme,
      placeholder("Start writing…"),
      formattingKeymap,
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        indentWithTab,
      ]),
      settingsExtensions(settings),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) hooks.onDocChange(update)
        if (update.docChanged || update.selectionSet) hooks.onSelection(update)
      }),
    ],
  })
}
