# Zazzy Fern

A personal productivity desktop app for organizing everyday thoughts, notes, and tasks. Built with Tauri (Rust backend) + React/TypeScript frontend.

**Current version: 0.1.4.1**

---

## Versioning rule

| Position | Meaning | Example |
|---|---|---|
| 3rd decimal | New feature shipped | `0.1.3` → `0.1.4` |
| 4th decimal | Bug fix / test build | `0.1.4` → `0.1.4.1` |

Update the version number in **all five places** on every change:

1. `CLAUDE.md` — the `Current version:` line above
2. `package.json` — `"version"` field (supports 4-part: `0.1.4.1`)
3. `package-lock.json` — `"version"` field at the top AND inside `"packages": { "": { ... } }` (supports 4-part)
4. `src-tauri/Cargo.toml` — `version` under `[package]` (**3-part semver only** — use base version e.g. `0.1.4`)
5. `src-tauri/tauri.conf.json` — `"version"` field (**3-part semver only** — use base version e.g. `0.1.4`)

---

## Tech stack

| Layer | Technology |
|---|---|
| Desktop framework | Tauri 2 (Rust) |
| Frontend | React 19 + TypeScript 5.8 |
| Build tool | Vite 7 |
| Styling | Tailwind CSS 4 + oklch color tokens |
| UI components | Radix UI (dialogs, context menus, dropdowns) |
| Rich text editor | TipTap 3 |
| Drag and drop | @dnd-kit |
| State management | Zustand |
| Database | SQLite via SQLx (Rust), WAL mode, FTS5 full-text search |
| Icons | Lucide React |
| Date utilities | date-fns |

---

## Project structure

```
src/                          # React frontend
  components/
    layout/
      AppShell.tsx            # Root layout (sidebar + main panel)
      Sidebar.tsx             # Navigation + folder tree with drag-and-drop
      MainPanel.tsx           # Switches between views based on activeView
    notes/
      FolderView.tsx          # Two-panel layout: note list + editor
      NoteEditor.tsx          # TipTap rich text editor with auto-save
      EditorToolbar.tsx       # Formatting toolbar (fonts, headings, marks, lists)
  pages/
    Dashboard.tsx             # Dashboard (placeholder widgets)
  store/
    uiStore.ts                # Active view, sidebar state, theme, search open
    folderStore.ts            # Folder tree CRUD + expand/collapse state
  lib/
    tauri.ts                  # All invoke() wrappers for Rust commands
    utils.ts                  # cn() and shared utilities
  types/index.ts              # Shared TypeScript interfaces + ActiveView union
  styles.css                  # Tailwind + theme tokens + TipTap prose styles

src-tauri/                    # Rust backend
  src/
    commands/                 # Tauri command handlers
      folders.rs              # Folder CRUD + tree building
      notes.rs                # Note CRUD + markdown file I/O
      tasks.rs                # Task/TaskList CRUD + subtasks
      calendar.rs             # Calendar feeds + events
      search.rs               # FTS5 full-text search
      settings.rs             # Key-value settings store
    models/                   # Rust structs (Folder, Note, Task, Event, …)
    db/
      connection.rs           # SQLite pool init + migrations
  migrations/
    001_initial.sql           # Schema: folders, notes, tasks, tags, events, settings
    002_fts.sql               # FTS5 virtual table + auto-sync triggers
```

---

## Database schema (key tables)

- **folders** — hierarchical (self-referential `parent_id`), color + icon support
- **notes** — metadata only; content stored as HTML in `notes/{id}.md` on disk
- **task_lists** — grouping container for tasks, belongs to a folder
- **tasks** — subtasks via `parent_task_id`, priority, due date, rrule recurrence
- **tags** — polymorphic (applies to notes, tasks, folders, events)
- **events** — internal calendar events
- **calendar_feeds** — external ICS feed subscriptions
- **settings** — key-value store
- **fts_items** — FTS5 virtual table with triggers for real-time indexing

---

## State management

`uiStore` drives what the main panel renders via the `ActiveView` union type:

```ts
type ActiveView =
  | { type: "dashboard" }
  | { type: "folder"; folderId: string }
  | { type: "note"; noteId: string }
  | { type: "tasklist"; taskListId: string; title?: string }
  | { type: "calendar" }
  | { type: "overview" }
  | { type: "settings" }
```

Clicking a folder in the sidebar sets `{ type: "folder", folderId }`, which renders `FolderView`.

---

## Note editor details

- **Content format**: HTML (stored in `notes/{id}.md` via Tauri backend)
- **Auto-save**: 800ms debounce on every keystroke; flushes immediately on note switch
- **Title save**: 600ms debounce, separate from body save
- **TipTap extensions in use**: StarterKit, Placeholder, Typography, Link, CharacterCount, TaskList, TaskItem, TextStyle, FontFamily
- **Toolbar**: font family, heading level, bold, italic, strikethrough, inline code, bullet list, ordered list, task list, blockquote, code block, horizontal rule

---

## What's implemented

| Feature | Status |
|---|---|
| Folder tree (sidebar, drag-and-drop, context menu) | Done |
| Note list + rich text editor | Done |
| Formatting toolbar (fonts, headings, marks) | Done |
| Task list view + sidebar navigation | Done |
| Calendar view | Backend done, UI pending |
| Dashboard (real data) | Placeholder only |
| Settings page | Placeholder only |
| Overview / map view | Not started |
| Full-text search UI | Backend done, UI pending |

---

## Dev commands

```bash
npm run dev          # Vite dev server (port 1420)
npm run build        # TypeScript check + Vite production build
npm run tauri dev    # Full Tauri app in development mode
npm run tauri build  # Package desktop app
```

---

## Design notes

- **Theme**: Dark by default. Color tokens use oklch color space. Fern green (`oklch(0.70 0.15 150)`) is the primary/accent color.
- **Typography**: System UI font for the app shell; TipTap editor supports per-note font selection.
- **No comments in code** unless the reason is non-obvious. Well-named identifiers do the documentation.
- **No premature abstraction** — build only what the current feature needs.
