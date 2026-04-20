use crate::models::SearchResult;
use crate::AppState;
use sqlx::FromRow;
use tauri::State;

#[derive(Debug, FromRow)]
struct FtsRow {
    item_id: String,
    item_type: String,
    title: String,
    snippet: Option<String>,
}

#[tauri::command]
pub async fn search_all(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<SearchResult>, String> {
    if query.trim().is_empty() {
        return Ok(vec![]);
    }

    let fts_query = format!("{}*", query.trim());

    let rows = sqlx::query_as::<_, FtsRow>(
        "SELECT item_id, item_type, title, snippet(fts_items, 3, '<b>', '</b>', '...', 20) as snippet
         FROM fts_items WHERE fts_items MATCH ? ORDER BY rank LIMIT 50",
    )
    .bind(fts_query)
    .fetch_all(&*state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r| SearchResult {
            item_id: r.item_id,
            item_type: r.item_type,
            title: r.title,
            snippet: r.snippet,
        })
        .collect())
}
