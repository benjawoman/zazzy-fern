-- File attachments (content lives in files/{id}{ext})
CREATE TABLE IF NOT EXISTS files (
    id          TEXT PRIMARY KEY,
    folder_id   TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    file_name   TEXT NOT NULL,
    file_path   TEXT NOT NULL,
    file_size   INTEGER NOT NULL DEFAULT 0,
    mime_type   TEXT,
    sort_order  REAL NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id);
