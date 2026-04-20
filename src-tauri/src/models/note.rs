use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub folder_id: Option<String>,
    pub title: String,
    pub sort_order: f64,
    pub pinned: bool,
    pub word_count: i64,
    pub created_at: String,
    pub updated_at: String,
}
