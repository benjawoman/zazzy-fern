use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub item_id: String,
    pub item_type: String,
    pub title: String,
    pub snippet: Option<String>,
}
