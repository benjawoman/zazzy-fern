-- Folders (self-referential for nesting)
CREATE TABLE IF NOT EXISTS folders (
    id          TEXT PRIMARY KEY,
    parent_id   TEXT REFERENCES folders(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    color       TEXT,
    icon        TEXT,
    sort_order  REAL NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Notes (content lives in notes/{id}.md)
CREATE TABLE IF NOT EXISTS notes (
    id          TEXT PRIMARY KEY,
    folder_id   TEXT REFERENCES folders(id) ON DELETE SET NULL,
    title       TEXT NOT NULL DEFAULT 'Untitled',
    sort_order  REAL NOT NULL DEFAULT 0,
    pinned      INTEGER NOT NULL DEFAULT 0,
    word_count  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Task lists
CREATE TABLE IF NOT EXISTS task_lists (
    id          TEXT PRIMARY KEY,
    folder_id   TEXT REFERENCES folders(id) ON DELETE CASCADE,
    title       TEXT NOT NULL DEFAULT 'Tasks',
    sort_order  REAL NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tasks (self-referential for sub-tasks)
CREATE TABLE IF NOT EXISTS tasks (
    id              TEXT PRIMARY KEY,
    task_list_id    TEXT REFERENCES task_lists(id) ON DELETE CASCADE,
    parent_task_id  TEXT REFERENCES tasks(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    notes           TEXT,
    status          TEXT NOT NULL DEFAULT 'todo'
                        CHECK(status IN ('todo','in_progress','done','cancelled')),
    priority        TEXT NOT NULL DEFAULT 'none'
                        CHECK(priority IN ('none','low','medium','high','urgent')),
    due_date        TEXT,
    due_time        TEXT,
    reminder_at     TEXT,
    reminder_sent   INTEGER NOT NULL DEFAULT 0,
    rrule           TEXT,
    recurrence_end  TEXT,
    sort_order      REAL NOT NULL DEFAULT 0,
    completed_at    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
    id      TEXT PRIMARY KEY,
    name    TEXT NOT NULL UNIQUE,
    color   TEXT
);

-- Tag assignments (polymorphic)
CREATE TABLE IF NOT EXISTS tag_items (
    tag_id      TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    item_id     TEXT NOT NULL,
    item_type   TEXT NOT NULL CHECK(item_type IN ('note','task','folder','event')),
    PRIMARY KEY (tag_id, item_id, item_type)
);

-- Backlinks between notes
CREATE TABLE IF NOT EXISTS note_backlinks (
    source_note_id  TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    target_note_id  TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    PRIMARY KEY (source_note_id, target_note_id)
);

-- Internal calendar events
CREATE TABLE IF NOT EXISTS events (
    id          TEXT PRIMARY KEY,
    folder_id   TEXT REFERENCES folders(id) ON DELETE SET NULL,
    title       TEXT NOT NULL,
    description TEXT,
    location    TEXT,
    start_at    TEXT NOT NULL,
    end_at      TEXT NOT NULL,
    all_day     INTEGER NOT NULL DEFAULT 0,
    rrule       TEXT,
    color       TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- External ICS calendar feeds
CREATE TABLE IF NOT EXISTS calendar_feeds (
    id              TEXT PRIMARY KEY,
    url             TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    color           TEXT,
    sync_interval   INTEGER NOT NULL DEFAULT 3600,
    last_synced_at  TEXT,
    enabled         INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cached events from external feeds
CREATE TABLE IF NOT EXISTS feed_events (
    uid         TEXT NOT NULL,
    feed_id     TEXT NOT NULL REFERENCES calendar_feeds(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT,
    location    TEXT,
    start_at    TEXT NOT NULL,
    end_at      TEXT NOT NULL,
    all_day     INTEGER NOT NULL DEFAULT 0,
    rrule       TEXT,
    raw_ical    TEXT,
    PRIMARY KEY (uid, feed_id)
);

-- App settings (key-value)
CREATE TABLE IF NOT EXISTS settings (
    key     TEXT PRIMARY KEY,
    value   TEXT NOT NULL
);

-- Templates
CREATE TABLE IF NOT EXISTS templates (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL CHECK(type IN ('note','task_list')),
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder_id);
CREATE INDEX IF NOT EXISTS idx_tasks_list ON tasks(task_list_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date) WHERE status NOT IN ('done','cancelled');
CREATE INDEX IF NOT EXISTS idx_tag_items_item ON tag_items(item_id, item_type);
CREATE INDEX IF NOT EXISTS idx_feed_events_feed ON feed_events(feed_id);
CREATE INDEX IF NOT EXISTS idx_feed_events_start ON feed_events(start_at);
CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_at);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_task_lists_folder ON task_lists(folder_id);
