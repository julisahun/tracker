# Tracker — project guide

A **local-first, browser-only** app for tracking items. You point it at a folder on
disk; each Markdown file in that folder (recursively) is one tracked item. An item is a
set of **typed fields** (shared across all items via a schema) plus a **free-text body**.
Everything runs client-side — no backend, no server. Edits are written straight back to
the source files via the **File System Access API**.

> Requires a **Chromium browser** (Chrome/Edge/Brave). Firefox/Safari lack the File System
> Access API. A secure context is needed; `localhost` in dev is fine.

## Stack

- **React 18 + TypeScript + Vite 5**
- **Tailwind CSS v4** via `@tailwindcss/vite` (no `tailwind.config.js`, no PostCSS config)
- **TipTap 2** (`@tiptap/react` + `starter-kit`) + **tiptap-markdown** for the WYSIWYG body
- **zustand** for app state, **idb-keyval** for persisting the directory handle
- **js-yaml** for frontmatter, **fuse.js** for fuzzy search, **lucide-react** for icons
- **recharts** for the dashboard's bar/donut charts
- **vitest** (jsdom) for unit tests

Scripts: `npm run dev` · `npm run build` (`tsc -b && vite build`) · `npm test` · `npm run test:watch`

## Data model

Each item is a `.md` file:

```markdown
---
title: Calculus I        # ← typed fields (frontmatter)
status: in_progress
tags: [analysis, core]
---

Free-text notes in Markdown.   # ← the body
```

- **Frontmatter** = the fields, rendered as a typed form.
- **Body** = the free-text section, edited as WYSIWYG, saved back as Markdown.
- **All items share one schema**, stored at `<folder>/.tracker/schema.json` and edited
  in-app via **Manage fields** (a dedicated sidebar screen, also reachable as a quick
  modal from inside the item editor). Field types: `text`, `number`, `boolean`, `date`,
  `select` (options), `tags` (string list).
- **Dashboard metrics** are stored at `<folder>/.tracker/dashboard.json`. Each metric
  aggregates one schema field across all items: `count` (distribution, incl. per-tag),
  `aggregate` (sum/avg/min/max of a number), or `boolean` (true/false split). Edited
  in-app via **Configure** on the dashboard.
- On first open of a folder with no schema, one is **inferred** from existing files (or a
  default for an empty folder) and written. Schema changes apply lazily: an item picks up
  new fields (with defaults) when opened and persists them on save.
- Saving **overwrites** the file (no history). `normalizeFrontmatter` reorders/coerces to
  the schema and **preserves** any non-schema keys so hand-edited data is never lost.

## Architecture / where things live

```
src/
  fs/        File System Access layer
             - directory.ts    pick root, recurse tree, read/write/create/delete; isItemFile, findNode helpers
             - handleStore.ts  persist the root directory handle in IndexedDB
             - fs-access.d.ts  type augmentations for picker + permission + async iterators
  format/    frontmatter.ts    parse/stringify the YAML frontmatter envelope (pure, tested)
  schema/    schema.ts             FieldType/FieldDef/Schema, coerce/infer/normalize, config IO (pure helpers tested)
             SchemaFieldsEditor.tsx controlled field-list form + cleanFields() helper; shared by the two below
             SchemaEditor.tsx      modal wrapper (opened from the item editor)
             SchemaView.tsx        full-page "Manage fields" screen (sidebar nav)
  dashboard/ dashboard.ts          MetricDef/Dashboard types, computeMetric (pure, tested), config IO
             DashboardView.tsx     the home screen: metric grid + Configure button
             DashboardEditor.tsx   modal to add/remove/reorder metrics
             MetricCard.tsx        recharts bar/donut + scalar stat card
             useThemeColors.ts     reads CSS-var colors, re-reads on .dark class change (for recharts)
  editor/    ItemEditor.tsx    loads a file → DocEditor
             DocEditor.tsx     TipTap body + toolbar + save; owns frontmatter state & schema modal
             FieldsPanel.tsx   the typed fields form
  tree/      FileTree.tsx, Breadcrumbs.tsx   recursive sidebar + path
  search/    searchIndex.ts (Fuse over filename+frontmatter), SearchBox.tsx
  state/     store.ts          zustand store: folder/tree/selection/schema/dashboard + all actions
  components/ Sidebar, ThemeToggle, IconButton, Checkbox, Select   shared UI
  theme.ts   light/dark/system theme hook (+ no-flash script in index.html)
  index.css  Tailwind import, theme tokens, prose styles
```

State flows through the single zustand store (`src/state/store.ts`): open/reopen a folder,
build the tree, ensure the schema + dashboard, build the search index, then components read
via `useStore(selector)`.

**Main-pane routing** (`App.tsx`): when the folder is `ready`, a selected file shows the
`ItemEditor`; with no file selected, `homeView` (`"dashboard" | "schema"`, in the store)
picks between `DashboardView` and `SchemaView`. The sidebar's **Dashboard** / **Manage
fields** links call `showHome(view)`, which clears the selection and sets `homeView`.

## Conventions

- **Theming uses semantic tokens, not raw colors.** `index.css` defines CSS variables for
  light and `.dark`, mapped into Tailwind via `@theme inline`. **Always** use
  `bg-surface`, `bg-bg`, `text-fg`, `text-muted`, `bg-accent`, `text-accent-fg`,
  `bg-accent-soft`, `border-line`, `bg-danger-soft`, etc. — never hard-coded `slate-*`/
  `indigo-*`, so both themes keep working.
- **No native form chrome.** Use `components/Checkbox.tsx` and `components/Select.tsx`
  (portal-based dropdown) instead of `<input type="checkbox">` / `<select>`.
- Icons: `lucide-react`, size ~13–16.
- Pure logic (`format/`, `schema/`, `dashboard/dashboard.ts`) is unit-tested; keep it
  DOM-free and add tests there.
- File System Access calls live in `fs/`, `schema.ts`, and `dashboard/dashboard.ts`; UI
  shouldn't touch handles directly.
- **recharts needs concrete colors**, but the app themes via CSS variables. Chart
  components pull colors from `useThemeColors()` (never hard-code) so light/dark both work.

## Current stage

**Working and verified** (`tsc` + `vite build` clean, 23 unit tests passing, dev server
boots). Implemented: recursive folder open/reopen with remembered handle, file tree with
create/delete, fuzzy search, schema infer/edit/persist, typed fields form, WYSIWYG
free-text body with Markdown round-trip, save-to-disk, light/dark/system theming,
custom Checkbox/Select, a **reporting dashboard** (configurable count/aggregate/boolean
metrics with recharts) shown as the home screen, and a dedicated **Manage fields** screen.

History: the project initially supported **freeform per-item documents with inline typed
tables** (a custom TipTap table node). It was then refactored to the current
**shared-schema model** (fields + free text); the table feature was removed.

### Known gaps / not yet done

- No automated end-to-end test of the live File System Access flow (needs a real browser +
  user gesture); verify those paths manually in Chrome/Edge.
- Search index refreshes on folder open / the ⟳ button, not automatically after each save.
- No conflict handling or external-change watching — saving overwrites.
- `tags` is the only multi-value type; no rich validation/required fields.

## Verifying changes

1. `npm test` for the pure logic; `npm run build` for type/bundle health.
2. `npm run dev`, open in Chrome/Edge, pick `fixtures/` (sample nested items + a
   `.tracker/schema.json`). Check: fields form matches the schema, body edits, **Save**
   writes the `.md` correctly, **Manage fields** (sidebar screen) updates the schema across
   items, create/delete items & folders, search, and reopen-last-folder.
3. With no item selected, the **Dashboard** is the home screen. **Configure** → add
   count/aggregate/boolean metrics; they persist to `.tracker/dashboard.json` and survive
   a folder reload. Toggle light/dark and confirm chart colors follow the theme.
