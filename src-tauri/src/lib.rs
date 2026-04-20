mod commands;
mod db;
mod models;

use db::{get_data_dir, init_db};
use sqlx::SqlitePool;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;

pub struct AppState {
    pub db: Arc<SqlitePool>,
    pub data_dir: PathBuf,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle().clone();

            tauri::async_runtime::block_on(async move {
                let data_dir = get_data_dir(&handle);

                // Ensure required directories exist
                std::fs::create_dir_all(&data_dir)
                    .expect("failed to create app data dir");
                std::fs::create_dir_all(data_dir.join("notes"))
                    .expect("failed to create notes dir");
                std::fs::create_dir_all(data_dir.join("attachments"))
                    .expect("failed to create attachments dir");
                std::fs::create_dir_all(data_dir.join("calendars"))
                    .expect("failed to create calendars dir");

                let pool = init_db(&data_dir)
                    .await
                    .expect("failed to initialize database");

                handle.manage(AppState {
                    db: Arc::new(pool),
                    data_dir,
                });
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Folders
            commands::get_folder_tree,
            commands::create_folder,
            commands::update_folder,
            commands::delete_folder,
            commands::reorder_folders,
            // Notes
            commands::get_notes_for_folder,
            commands::get_pinned_notes,
            commands::create_note,
            commands::update_note_title,
            commands::get_note_content,
            commands::save_note_content,
            commands::delete_note,
            commands::toggle_note_pin,
            // Task lists
            commands::get_task_lists_for_folder,
            commands::create_task_list,
            commands::update_task_list,
            commands::delete_task_list,
            // Tasks
            commands::get_tasks_for_list,
            commands::get_due_today_tasks,
            commands::create_task,
            commands::update_task,
            commands::delete_task,
            // Search
            commands::search_all,
            // Settings
            commands::get_setting,
            commands::set_setting,
            // Calendar
            commands::get_calendar_feeds,
            commands::add_calendar_feed,
            commands::delete_calendar_feed,
            commands::get_events_in_range,
            commands::create_event,
            commands::open_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
