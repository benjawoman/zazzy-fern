use crate::models::{Task, TaskList};
use crate::AppState;
use tauri::State;
use uuid::Uuid;

fn now() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

fn build_task_tree(mut rows: Vec<Task>) -> Vec<Task> {
    fn attach(items: &mut Vec<Task>, parent_id: Option<&str>) -> Vec<Task> {
        let (mut children, rest): (Vec<Task>, Vec<Task>) = items
            .drain(..)
            .partition(|t| t.parent_task_id.as_deref() == parent_id);
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
pub async fn get_task_lists_for_folder(
    state: State<'_, AppState>,
    folder_id: String,
) -> Result<Vec<TaskList>, String> {
    sqlx::query_as::<_, TaskList>(
        "SELECT id, folder_id, title, sort_order, created_at, updated_at
         FROM task_lists WHERE folder_id = ? ORDER BY sort_order, title",
    )
    .bind(folder_id)
    .fetch_all(&*state.db)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_task_list(
    state: State<'_, AppState>,
    folder_id: Option<String>,
    title: Option<String>,
) -> Result<TaskList, String> {
    let id = Uuid::new_v4().to_string();
    let ts = now();
    let title = title.unwrap_or_else(|| "Tasks".to_string());

    let sort_order: f64 = sqlx::query_scalar::<_, f64>(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM task_lists WHERE folder_id IS ?",
    )
    .bind(&folder_id)
    .fetch_one(&*state.db)
    .await
    .unwrap_or(1.0);

    sqlx::query(
        "INSERT INTO task_lists (id, folder_id, title, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
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

    sqlx::query_as::<_, TaskList>(
        "SELECT id, folder_id, title, sort_order, created_at, updated_at FROM task_lists WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(&*state.db)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_task_list(
    state: State<'_, AppState>,
    id: String,
    title: String,
) -> Result<(), String> {
    let ts = now();
    sqlx::query("UPDATE task_lists SET title = ?, updated_at = ? WHERE id = ?")
        .bind(title)
        .bind(ts)
        .bind(id)
        .execute(&*state.db)
        .await
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_task_list(state: State<'_, AppState>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM task_lists WHERE id = ?")
        .bind(id)
        .execute(&*state.db)
        .await
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_tasks_for_list(
    state: State<'_, AppState>,
    task_list_id: String,
) -> Result<Vec<Task>, String> {
    let rows = sqlx::query_as::<_, Task>(
        "SELECT id, task_list_id, parent_task_id, title, notes, status, priority,
                due_date, due_time, reminder_at, rrule, sort_order, completed_at, created_at, updated_at
         FROM tasks WHERE task_list_id = ? ORDER BY sort_order, created_at",
    )
    .bind(task_list_id)
    .fetch_all(&*state.db)
    .await
    .map_err(|e| e.to_string())?;
    Ok(build_task_tree(rows))
}

#[tauri::command]
pub async fn get_due_today_tasks(state: State<'_, AppState>) -> Result<Vec<Task>, String> {
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    sqlx::query_as::<_, Task>(
        "SELECT id, task_list_id, parent_task_id, title, notes, status, priority,
                due_date, due_time, reminder_at, rrule, sort_order, completed_at, created_at, updated_at
         FROM tasks WHERE due_date = ? AND status NOT IN ('done', 'cancelled')
         ORDER BY priority DESC, sort_order",
    )
    .bind(today)
    .fetch_all(&*state.db)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_task(
    state: State<'_, AppState>,
    task_list_id: String,
    title: String,
    parent_task_id: Option<String>,
) -> Result<Task, String> {
    let id = Uuid::new_v4().to_string();
    let ts = now();

    let sort_order: f64 = sqlx::query_scalar::<_, f64>(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM tasks WHERE task_list_id = ?",
    )
    .bind(&task_list_id)
    .fetch_one(&*state.db)
    .await
    .unwrap_or(1.0);

    sqlx::query(
        "INSERT INTO tasks (id, task_list_id, parent_task_id, title, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&task_list_id)
    .bind(&parent_task_id)
    .bind(&title)
    .bind(sort_order)
    .bind(&ts)
    .bind(&ts)
    .execute(&*state.db)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query_as::<_, Task>(
        "SELECT id, task_list_id, parent_task_id, title, notes, status, priority,
                due_date, due_time, reminder_at, rrule, sort_order, completed_at, created_at, updated_at
         FROM tasks WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(&*state.db)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_task(
    state: State<'_, AppState>,
    id: String,
    title: Option<String>,
    notes: Option<String>,
    status: Option<String>,
    priority: Option<String>,
    due_date: Option<String>,
    due_time: Option<String>,
    reminder_at: Option<String>,
    sort_order: Option<f64>,
) -> Result<(), String> {
    let ts = now();
    let completed_at = status.as_deref().map(|s| {
        if s == "done" { Some(ts.clone()) } else { None }
    }).flatten();

    sqlx::query(
        "UPDATE tasks SET
            title = COALESCE(?, title),
            notes = COALESCE(?, notes),
            status = COALESCE(?, status),
            priority = COALESCE(?, priority),
            due_date = COALESCE(?, due_date),
            due_time = COALESCE(?, due_time),
            reminder_at = COALESCE(?, reminder_at),
            sort_order = COALESCE(?, sort_order),
            completed_at = CASE WHEN ? IS NOT NULL THEN ? ELSE completed_at END,
            updated_at = ?
         WHERE id = ?",
    )
    .bind(title)
    .bind(notes)
    .bind(status)
    .bind(priority)
    .bind(due_date)
    .bind(due_time)
    .bind(reminder_at)
    .bind(sort_order)
    .bind(&completed_at)
    .bind(&completed_at)
    .bind(&ts)
    .bind(id)
    .execute(&*state.db)
    .await
    .map(|_| ())
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_task(state: State<'_, AppState>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM tasks WHERE id = ?")
        .bind(id)
        .execute(&*state.db)
        .await
        .map(|_| ())
        .map_err(|e| e.to_string())
}
