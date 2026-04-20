-- Full-text search via FTS5
CREATE VIRTUAL TABLE IF NOT EXISTS fts_items USING fts5(
    item_id UNINDEXED,
    item_type UNINDEXED,
    title,
    body,
    content=''
);

-- Sync FTS when notes change
CREATE TRIGGER IF NOT EXISTS notes_fts_insert AFTER INSERT ON notes BEGIN
    INSERT INTO fts_items(item_id, item_type, title, body) VALUES (new.id, 'note', new.title, '');
END;

CREATE TRIGGER IF NOT EXISTS notes_fts_update AFTER UPDATE ON notes BEGIN
    INSERT INTO fts_items(fts_items, item_id, item_type, title, body) VALUES ('delete', old.id, 'note', old.title, '');
    INSERT INTO fts_items(item_id, item_type, title, body) VALUES (new.id, 'note', new.title, '');
END;

CREATE TRIGGER IF NOT EXISTS notes_fts_delete AFTER DELETE ON notes BEGIN
    INSERT INTO fts_items(fts_items, item_id, item_type, title, body) VALUES ('delete', old.id, 'note', old.title, '');
END;

-- Sync FTS when tasks change
CREATE TRIGGER IF NOT EXISTS tasks_fts_insert AFTER INSERT ON tasks BEGIN
    INSERT INTO fts_items(item_id, item_type, title, body) VALUES (new.id, 'task', new.title, COALESCE(new.notes, ''));
END;

CREATE TRIGGER IF NOT EXISTS tasks_fts_update AFTER UPDATE ON tasks BEGIN
    INSERT INTO fts_items(fts_items, item_id, item_type, title, body) VALUES ('delete', old.id, 'task', old.title, '');
    INSERT INTO fts_items(item_id, item_type, title, body) VALUES (new.id, 'task', new.title, COALESCE(new.notes, ''));
END;

CREATE TRIGGER IF NOT EXISTS tasks_fts_delete AFTER DELETE ON tasks BEGIN
    INSERT INTO fts_items(fts_items, item_id, item_type, title, body) VALUES ('delete', old.id, 'task', old.title, '');
END;

-- Sync FTS when folders change
CREATE TRIGGER IF NOT EXISTS folders_fts_insert AFTER INSERT ON folders BEGIN
    INSERT INTO fts_items(item_id, item_type, title, body) VALUES (new.id, 'folder', new.name, '');
END;

CREATE TRIGGER IF NOT EXISTS folders_fts_update AFTER UPDATE ON folders BEGIN
    INSERT INTO fts_items(fts_items, item_id, item_type, title, body) VALUES ('delete', old.id, 'folder', old.name, '');
    INSERT INTO fts_items(item_id, item_type, title, body) VALUES (new.id, 'folder', new.name, '');
END;

CREATE TRIGGER IF NOT EXISTS folders_fts_delete AFTER DELETE ON folders BEGIN
    INSERT INTO fts_items(fts_items, item_id, item_type, title, body) VALUES ('delete', old.id, 'folder', old.name, '');
END;
