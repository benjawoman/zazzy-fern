use crate::models::{CalendarFeed, Event, FeedEvent};
use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

fn now() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEventOut {
    pub id: String,
    pub folder_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub location: Option<String>,
    pub start_at: String,
    pub end_at: String,
    pub all_day: bool,
    pub rrule: Option<String>,
    pub color: Option<String>,
    pub is_external: bool,
    pub feed_id: Option<String>,
}

#[tauri::command]
pub async fn get_calendar_feeds(state: State<'_, AppState>) -> Result<Vec<CalendarFeed>, String> {
    sqlx::query_as::<_, CalendarFeed>(
        "SELECT id, url, name, color, sync_interval, last_synced_at, enabled, created_at
         FROM calendar_feeds ORDER BY name",
    )
    .fetch_all(&*state.db)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_calendar_feed(
    state: State<'_, AppState>,
    url: String,
    name: String,
    color: Option<String>,
) -> Result<CalendarFeed, String> {
    let id = Uuid::new_v4().to_string();
    let ts = now();

    sqlx::query("INSERT INTO calendar_feeds (id, url, name, color, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(&id)
        .bind(&url)
        .bind(&name)
        .bind(&color)
        .bind(&ts)
        .execute(&*state.db)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query_as::<_, CalendarFeed>(
        "SELECT id, url, name, color, sync_interval, last_synced_at, enabled, created_at FROM calendar_feeds WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(&*state.db)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_calendar_feed(state: State<'_, AppState>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM calendar_feeds WHERE id = ?")
        .bind(id)
        .execute(&*state.db)
        .await
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_events_in_range(
    state: State<'_, AppState>,
    start_at: String,
    end_at: String,
) -> Result<Vec<CalendarEventOut>, String> {
    let internal = sqlx::query_as::<_, Event>(
        "SELECT id, folder_id, title, description, location, start_at, end_at, all_day, rrule, color, created_at, updated_at
         FROM events WHERE start_at < ? AND end_at > ? ORDER BY start_at",
    )
    .bind(&end_at)
    .bind(&start_at)
    .fetch_all(&*state.db)
    .await
    .map_err(|e| e.to_string())?;

    let external = sqlx::query_as::<_, FeedEvent>(
        "SELECT uid, feed_id, title, description, location, start_at, end_at, all_day, rrule
         FROM feed_events WHERE start_at < ? AND end_at > ? ORDER BY start_at",
    )
    .bind(&end_at)
    .bind(&start_at)
    .fetch_all(&*state.db)
    .await
    .map_err(|e| e.to_string())?;

    let mut result: Vec<CalendarEventOut> = internal
        .into_iter()
        .map(|e| CalendarEventOut {
            id: e.id,
            folder_id: e.folder_id,
            title: e.title,
            description: e.description,
            location: e.location,
            start_at: e.start_at,
            end_at: e.end_at,
            all_day: e.all_day,
            rrule: e.rrule,
            color: e.color,
            is_external: false,
            feed_id: None,
        })
        .collect();

    result.extend(external.into_iter().map(|e| CalendarEventOut {
        id: e.uid,
        folder_id: None,
        title: e.title,
        description: e.description,
        location: e.location,
        start_at: e.start_at,
        end_at: e.end_at,
        all_day: e.all_day,
        rrule: e.rrule,
        color: None,
        is_external: true,
        feed_id: Some(e.feed_id),
    }));

    result.sort_by(|a, b| a.start_at.cmp(&b.start_at));
    Ok(result)
}

#[tauri::command]
pub async fn create_event(
    state: State<'_, AppState>,
    title: String,
    start_at: String,
    end_at: String,
    all_day: Option<bool>,
    folder_id: Option<String>,
    description: Option<String>,
    location: Option<String>,
) -> Result<CalendarEventOut, String> {
    let id = Uuid::new_v4().to_string();
    let ts = now();
    let all_day = all_day.unwrap_or(false);

    sqlx::query(
        "INSERT INTO events (id, folder_id, title, description, location, start_at, end_at, all_day, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&folder_id)
    .bind(&title)
    .bind(&description)
    .bind(&location)
    .bind(&start_at)
    .bind(&end_at)
    .bind(all_day)
    .bind(&ts)
    .bind(&ts)
    .execute(&*state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(CalendarEventOut {
        id,
        folder_id,
        title,
        description,
        location,
        start_at,
        end_at,
        all_day,
        rrule: None,
        color: None,
        is_external: false,
        feed_id: None,
    })
}

#[tauri::command]
pub async fn open_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener().open_url(url, None::<String>).map_err(|e| e.to_string())
}
