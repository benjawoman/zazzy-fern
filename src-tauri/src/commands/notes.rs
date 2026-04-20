use crate::models::Note;
use crate::AppState;
use std::path::PathBuf;
use tauri::State;
use uuid::Uuid;

fn now() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

fn note_path(data_dir: &PathBuf, id: &str) -> PathBuf {
    data_dir.join("notes").join(format!("{}.md", id))
}

#[tauri::command]
pub async fn get_notes_for_folder(
    state: State<'_, AppState>,
    folder_id: String,
) -> Result<Vec<Note>, String> {
    sqlx::query_as::<_, Note>(
        "SELECT id, folder_id, title, sort_order, pinned, word_count, created_at, updated_at
         FROM notes WHERE folder_id = ? ORDER BY pinned DESC, sort_order, title",
    )
    .bind(folder_id)
    .fetch_all(&*state.db)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_pinned_notes(state: State<'_, AppState>) -> Result<Vec<Note>, String> {
    sqlx::query_as::<_, Note>(
        "SELECT id, folder_id, title, sort_order, pinned, word_count, created_at, updated_at
         FROM notes WHERE pinned = 1 ORDER BY updated_at DESC LIMIT 10",
    )
    .fetch_all(&*state.db)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_note(
    state: State<'_, AppState>,
    folder_id: Option<String>,
    title: Option<String>,
) -> Result<Note, String> {
    let id = Uuid::new_v4().to_string();
    let ts = now();
    let title = title.unwrap_or_else(|| "Untitled".to_string());

    let sort_order: f64 = sqlx::query_scalar::<_, f64>(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM notes WHERE folder_id IS ?",
    )
    .bind(&folder_id)
    .fetch_one(&*state.db)
    .await
    .unwrap_or(1.0);

    sqlx::query(
        "INSERT INTO notes (id, folder_id, title, sort_order, pinned, word_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, 0, ?, ?)",
    )
    .bind(&id)
    .bind(&folder_id)
    .bind(&title)
    .bind(sort_order)
    .bind(&ts)
    .bind(&ts)
    .execute(&*state.db)
    .await
    .map_err(|e| e.to_string())?;

    // Create empty .md file
    let path = note_path(&state.data_dir, &id);
    std::fs::write(&path, "").map_err(|e| e.to_string())?;

    sqlx::query_as::<_, Note>(
        "SELECT id, folder_id, title, sort_order, pinned, word_count, created_at, updated_at FROM notes WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(&*state.db)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_note_title(
    state: State<'_, AppState>,
    id: String,
    title: String,
) -> Result<(), String> {
    let ts = now();
    sqlx::query("UPDATE notes SET title = ?, updated_at = ? WHERE id = ?")
        .bind(title)
        .bind(ts)
        .bind(id)
        .execute(&*state.db)
        .await
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_note_content(
    state: State<'_, AppState>,
    id: String,
) -> Result<String, String> {
    let path = note_path(&state.data_dir, &id);
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_note_content(
    state: State<'_, AppState>,
    id: String,
    content: String,
    word_count: i64,
) -> Result<(), String> {
    let path = note_path(&state.data_dir, &id);
    std::fs::write(&path, &content).map_err(|e| e.to_string())?;

    let ts = now();
    sqlx::query("UPDATE notes SET word_count = ?, updated_at = ? WHERE id = ?")
        .bind(word_count)
        .bind(&ts)
        .bind(&id)
        .execute(&*state.db)
        .await
        .map_err(|e| e.to_string())?;

    // Refresh FTS index
    sqlx::query("INSERT INTO fts_items(fts_items, item_id, item_type, title, body) VALUES ('delete', ?, 'note', '', '')")
        .bind(&id)
        .execute(&*state.db)
        .await
        .ok();

    let title: String = sqlx::query_scalar("SELECT title FROM notes WHERE id = ?")
        .bind(&id)
        .fetch_one(&*state.db)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("INSERT INTO fts_items(item_id, item_type, title, body) VALUES (?, 'note', ?, ?)")
        .bind(&id)
        .bind(title)
        .bind(content)
        .execute(&*state.db)
        .await
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_note(state: State<'_, AppState>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM notes WHERE id = ?")
        .bind(&id)
        .execute(&*state.db)
        .await
        .map_err(|e| e.to_string())?;

    let path = note_path(&state.data_dir, &id);
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn toggle_note_pin(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let ts = now();
    sqlx::query("UPDATE notes SET pinned = NOT pinned, updated_at = ? WHERE id = ?")
        .bind(ts)
        .bind(id)
        .execute(&*state.db)
        .await
        .map(|_| ())
        .map_err(|e| e.to_string())
}
