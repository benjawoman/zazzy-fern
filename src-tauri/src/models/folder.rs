use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub sort_order: f64,
    pub created_at: String,
    pub updated_at: String,
    #[sqlx(skip)]
    pub children: Vec<Folder>,
}
