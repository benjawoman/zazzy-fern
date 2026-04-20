use crate::models::Folder;
use crate::AppState;
use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

fn now() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

async fn fetch_all_folders(pool: &SqlitePool) -> Result<Vec<Folder>, String> {
    sqlx::query_as::<_, Folder>(
        "SELECT id, parent_id, name, color, icon, sort_order, created_at, updated_at
         FROM folders ORDER BY sort_order, name",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())
}

fn build_tree(mut rows: Vec<Folder>) -> Vec<Folder> {
    fn attach(items: &mut Vec<Folder>, parent_id: Option<&str>) -> Vec<Folder> {
        let (mut children, rest): (Vec<Folder>, Vec<Folder>) = items
            .drain(..)
            .partition(|f| f.parent_id.as_deref() == parent_id);
        *items = rest;
        for node in children.iter_mut() {
            let id = node.id.clone();
            node.children = attach(items, Some(&id));
        }
        children.sort_by(|a, b| {
            a.sort_order
                .partial_cmp(&b.sort_order)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        children
    }
    attach(&mut rows, None)
}

#[tauri::command]
pub async fn get_folder_tree(state: State<'_, AppState>) -> Result<Vec<Folder>, String> {
    let rows = fetch_all_folders(&state.db).await?;
    Ok(build_tree(rows))
}

#[tauri::command]
pub async fn create_folder(
    state: State<'_, AppState>,
    name: String,
    parent_id: Option<String>,
    color: Option<String>,
    icon: Option<String>,
) -> Result<Folder, String> {
    let id = Uuid::new_v4().to_string();
    let ts = now();

    // Compute next sort_order for this parent
    let sort_order: f64 = sqlx::query_scalar::<_, f64>(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM folders WHERE parent_id IS ?",
    )
    .bind(&parent_id)
    .fetch_one(&*state.db)
    .await
    .unwrap_or(1.0);

    sqlx::query(
        "INSERT INTO folders (id, parent_id, name, color, icon, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&parent_id)
    .bind(&name)
    .bind(&color)
    .bind(&icon)
    .bind(sort_order)
    .bind(&ts)
    .bind(&ts)
    .execute(&*state.db)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query_as::<_, Folder>(
        "SELECT id, parent_id, name, color, icon, sort_order, created_at, updated_at FROM folders WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(&*state.db)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_folder(
    state: State<'_, AppState>,
    id: String,
    name: Option<String>,
    color: Option<String>,
    icon: Option<String>,
    parent_id: Option<String>,
) -> Result<Folder, String> {
    let ts = now();
    if let Some(n) = name {
        sqlx::query("UPDATE folders SET name = ?, updated_at = ? WHERE id = ?")
            .bind(n)
            .bind(&ts)
            .bind(&id)
            .execute(&*state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(c) = color {
        sqlx::query("UPDATE folders SET color = ?, updated_at = ? WHERE id = ?")
            .bind(c)
            .bind(&ts)
            .bind(&id)
            .execute(&*state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(i) = icon {
        sqlx::query("UPDATE folders SET icon = ?, updated_at = ? WHERE id = ?")
            .bind(i)
            .bind(&ts)
            .bind(&id)
            .execute(&*state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(p) = parent_id {
        sqlx::query("UPDATE folders SET parent_id = ?, updated_at = ? WHERE id = ?")
            .bind(p)
            .bind(&ts)
            .bind(&id)
            .execute(&*state.db)
            .await
            .map_err(|e| e.to_string())?;
    }

    sqlx::query_as::<_, Folder>(
        "SELECT id, parent_id, name, color, icon, sort_order, created_at, updated_at FROM folders WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(&*state.db)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_folder(state: State<'_, AppState>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM folders WHERE id = ?")
        .bind(id)
        .execute(&*state.db)
        .await
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reorder_folders(state: State<'_, AppState>, ids: Vec<String>) -> Result<(), String> {
    for (i, id) in ids.iter().enumerate() {
        sqlx::query("UPDATE folders SET sort_order = ? WHERE id = ?")
            .bind(i as f64)
            .bind(id)
            .execute(&*state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
