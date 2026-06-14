# Tracker

A local-first, browser-only app for tracking items. Point it at a folder on
your disk and each Markdown file becomes one tracked item — a set of **typed
fields** (shared by every item) plus a **free-text section**. Everything runs in
the browser; edits are written straight back to your files.

## Requirements

- A **Chromium browser** (Chrome, Edge, Brave). The app uses the
  [File System Access API](https://developer.mozilla.org/docs/Web/API/File_System_API)
  to read and write your folder; Firefox and Safari don't support it.

## Run

```bash
npm install
npm run dev      # open the printed localhost URL in Chrome/Edge
```

Click **Open folder**, choose a directory (try the included `fixtures/`), and
grant read/write permission. The app remembers the folder and offers to reopen
it next time.

Other scripts:

```bash
npm run build    # type-check + production build
npm test         # unit tests (frontmatter round-trip + schema helpers)
```

## How items are stored

Each item is a Markdown file: YAML frontmatter for the fields, body for the free
text.

```markdown
---
title: Calculus I
status: in_progress
credits: 6
professor: Dr. Vega
tags:
  - analysis
  - core
---

Free-text notes in **Markdown** — limits, derivatives, intro to integration.
```

- **Frontmatter** → the typed *Fields* form at the top of an item.
- **Body** → a WYSIWYG editor for the free-text section, saved back as Markdown.

### Shared schema

All items in a folder share the same field set, defined once in
`<folder>/.tracker/schema.json` and edited in-app via **Manage fields**. Each
field has a type that picks the right widget:

| Type | Widget |
| --- | --- |
| `text` | text input |
| `number` | number input |
| `boolean` | checkbox |
| `date` | date picker |
| `select` | dropdown (with options) |
| `tags` | tag/chip input (list of strings) |

When you first open a folder, the schema is **inferred** from the existing files
(or seeded with sensible defaults for an empty folder) and written to
`.tracker/schema.json`. Editing the schema applies to every item; an item picks
up new fields (with their defaults) when you open it, and persists them on save.

## Project layout

```
src/
  fs/        File System Access layer (recurse, read/write, create/delete) + handle persistence
  format/    Markdown frontmatter envelope (pure, unit-tested)
  schema/    Shared schema: types, coercion/inference, config IO, and the schema editor
  editor/    TipTap free-text editor + the typed Fields form
  tree/      Recursive file-tree sidebar + breadcrumbs
  search/    In-memory fuzzy search (filename + frontmatter values)
  state/     App state (zustand store)
```

## Notes

- **Theme**: light / dark / system toggle in the top-left of the sidebar
  (defaults to following your OS; the choice is remembered).
- Saving overwrites the source file directly (no history). Use git in the folder
  if you want versioning.
- The search index is built when a folder is opened; use the **⟳** button to
  rebuild it after external changes.
