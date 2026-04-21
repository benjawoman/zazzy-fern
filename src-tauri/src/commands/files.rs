use crate::models::FileEntry;
use crate::AppState;
use std::path::PathBuf;
use tauri::State;
use uuid::Uuid;

fn now() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

fn file_storage_path(data_dir: &PathBuf, id: &str, ext: &str) -> PathBuf {
    let filename = if ext.is_empty() {
        id.to_string()
    } else {
        format!("{}.{}", id, ext)
    };
    data_dir.join("files").join(filename)
}

fn extract_extension(file_name: &str) -> String {
    std::path::Path::new(file_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_string()
}

#[tauri::command]
pub async fn get_files_for_folder(
    state: State<'_, AppState>,
    folder_id: String,
) -> Result<Vec<FileEntry>, String> {
    sqlx::query_as::<_, FileEntry>(
        "SELECT id, folder_id, file_name, file_path, file_size, mime_type, sort_order, created_at, updated_at
         FROM files WHERE folder_id = ? ORDER BY sort_order, file_name",
    )
    .bind(folder_id)
    .fetch_all(&*state.db)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_file_to_folder(
    state: State<'_, AppState>,
    folder_id: String,
    file_name: String,
    bytes: Vec<u8>,
    mime_type: Option<String>,
) -> Result<FileEntry, String> {
    let id = Uuid::new_v4().to_string();
    let ts = now();
    let ext = extract_extension(&file_name);
    let stored_path = file_storage_path(&state.data_dir, &id, &ext);
    let file_size = bytes.len() as i64;

    std::fs::write(&stored_path, &bytes).map_err(|e| e.to_string())?;

    let path_str = stored_path.to_string_lossy().to_string();

    let sort_order: f64 = sqlx::query_scalar::<_, f64>(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM files WHERE folder_id = ?",
    )
    .bind(&folder_id)
    .fetch_one(&*state.db)
    .await
    .unwrap_or(1.0);

    sqlx::query(
        "INSERT INTO files (id, folder_id, file_name, file_path, file_size, mime_type, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&folder_id)
    .bind(&file_name)
    .bind(&path_str)
    .bind(file_size)
    .bind(&mime_type)
    .bind(sort_order)
    .bind(&ts)
    .bind(&ts)
    .execute(&*state.db)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query_as::<_, FileEntry>(
        "SELECT id, folder_id, file_name, file_path, file_size, mime_type, sort_order, created_at, updated_at
         FROM files WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(&*state.db)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_file(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let path: Option<String> = sqlx::query_scalar("SELECT file_path FROM files WHERE id = ?")
        .bind(&id)
        .fetch_optional(&*state.db)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM files WHERE id = ?")
        .bind(&id)
        .execute(&*state.db)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(p) = path {
        let pb = PathBuf::from(p);
        if pb.exists() {
            let _ = std::fs::remove_file(&pb);
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn rename_file(
    state: State<'_, AppState>,
    id: String,
    file_name: String,
) -> Result<(), String> {
    let ts = now();
    sqlx::query("UPDATE files SET file_name = ?, updated_at = ? WHERE id = ?")
        .bind(file_name)
        .bind(ts)
        .bind(id)
        .execute(&*state.db)
        .await
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_file(app: tauri::AppHandle, state: State<'_, AppState>, id: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;

    let path: String = sqlx::query_scalar("SELECT file_path FROM files WHERE id = ?")
        .bind(&id)
        .fetch_one(&*state.db)
        .await
        .map_err(|e| e.to_string())?;

    app.opener().open_path(path, None::<String>).map_err(|e| e.to_string())
}
