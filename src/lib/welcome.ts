export const WELCOME_DOC = `---
title: Welcome to MD Studio
tags: [guide, markdown]
---

# Welcome to MD Studio

A focused place to write Markdown and see it rendered as you type. Edit on the left, read on the right — the two panes **scroll together**, so the preview always shows what you're working on.

> [!TIP]
> Press <kbd>Ctrl</kbd> <kbd>P</kbd> to jump to any file in the open folder, or <kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>P</kbd> for every command.

## Getting around

| Action | Shortcut |
| --- | --- |
| New / open / save | <kbd>Ctrl</kbd> <kbd>N</kbd> · <kbd>Ctrl</kbd> <kbd>O</kbd> · <kbd>Ctrl</kbd> <kbd>S</kbd> |
| Open a folder | <kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>O</kbd> |
| Editor · Split · Preview | <kbd>Ctrl</kbd> <kbd>1</kbd> · <kbd>2</kbd> · <kbd>3</kbd> |
| Toggle sidebar | <kbd>Ctrl</kbd> <kbd>B</kbd> |
| Bold · italic · link | <kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>B</kbd> · <kbd>Ctrl</kbd> <kbd>I</kbd> · <kbd>Ctrl</kbd> <kbd>K</kbd> |
| All shortcuts | <kbd>Ctrl</kbd> <kbd>/</kbd> |

You can also drag \`.md\` files or a folder onto the window, and drop images straight into the editor to link them.

## Things that render

### Task lists you can tick in the preview

- [x] Write the first draft
- [ ] Click this box in the preview — the source updates too
- [ ] Export to PDF from **File → Export**

### Code with highlighting

\`\`\`ts
type Note = { title: string; tags: string[] }

export function byTag(notes: Note[], tag: string) {
  return notes.filter((n) => n.tags.includes(tag))
}
\`\`\`

### Math

Inline math like $e^{i\\pi} + 1 = 0$ and display blocks:

$$
\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}
$$

### Diagrams

\`\`\`mermaid
flowchart LR
  Draft --> Review --> Publish
  Review -- changes --> Draft
\`\`\`

### Callouts

> [!NOTE]
> GitHub-style alerts: \`NOTE\`, \`TIP\`, \`IMPORTANT\`, \`WARNING\` and \`CAUTION\`.

> [!WARNING]
> Unsaved changes are flagged with a dot on the tab, and the app asks before closing them.

### Footnotes and more

Markdown here follows GitHub's flavour[^gfm] — tables, ~~strikethrough~~, autolinks like https://commonmark.org and raw HTML such as <mark>highlights</mark>.

<details>
<summary>Collapsible sections work too</summary>

Hidden until you open it.

</details>

[^gfm]: GitHub Flavored Markdown, a superset of CommonMark.

---

This guide is an untitled document — edit it freely, or close it. Reopen it any time from **Help → Welcome Guide**.
`
