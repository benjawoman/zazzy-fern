use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct TaskList {
    pub id: String,
    pub folder_id: Option<String>,
    pub title: String,
    pub sort_order: f64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub task_list_id: String,
    pub parent_task_id: Option<String>,
    pub title: String,
    pub notes: Option<String>,
    pub status: String,
    pub priority: String,
    pub due_date: Option<String>,
    pub due_time: Option<String>,
    pub reminder_at: Option<String>,
    pub rrule: Option<String>,
    pub sort_order: f64,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    #[sqlx(skip)]
    pub children: Vec<Task>,
}
