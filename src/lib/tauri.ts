import { invoke } from "@tauri-apps/api/core";
import type { Folder, Note, TaskList, Task, Tag, CalendarFeed, CalendarEvent } from "@/types";

// ── Folders ─────────────────────────────────────────────────────────────────

export const getFolderTree = (): Promise<Folder[]> =>
  invoke("get_folder_tree");

export const createFolder = (args: {
  name: string;
  parentId?: string | null;
  color?: string | null;
  icon?: string | null;
}): Promise<Folder> => invoke("create_folder", args);

export const updateFolder = (args: {
  id: string;
  name?: string;
  color?: string | null;
  icon?: string | null;
  parentId?: string | null;
}): Promise<Folder> => invoke("update_folder", args);

export const deleteFolder = (id: string): Promise<void> =>
  invoke("delete_folder", { id });

export const reorderFolders = (ids: string[]): Promise<void> =>
  invoke("reorder_folders", { ids });

// ── Notes ────────────────────────────────────────────────────────────────────

export const getNotesForFolder = (folderId: string): Promise<Note[]> =>
  invoke("get_notes_for_folder", { folderId });

export const createNote = (args: {
  folderId?: string | null;
  title?: string;
}): Promise<Note> => invoke("create_note", args);

export const updateNoteTitle = (args: {
  id: string;
  title: string;
}): Promise<void> => invoke("update_note_title", args);

export const getNoteContent = (id: string): Promise<string> =>
  invoke("get_note_content", { id });

export const saveNoteContent = (args: {
  id: string;
  content: string;
  wordCount: number;
}): Promise<void> => invoke("save_note_content", args);

export const deleteNote = (id: string): Promise<void> =>
  invoke("delete_note", { id });

export const getPinnedNotes = (): Promise<Note[]> =>
  invoke("get_pinned_notes");

export const toggleNotePin = (id: string): Promise<void> =>
  invoke("toggle_note_pin", { id });

// ── Task Lists ───────────────────────────────────────────────────────────────

export const getTaskListsForFolder = (folderId: string): Promise<TaskList[]> =>
  invoke("get_task_lists_for_folder", { folderId });

export const createTaskList = (args: {
  folderId?: string | null;
  title?: string;
}): Promise<TaskList> => invoke("create_task_list", args);

export const updateTaskList = (args: {
  id: string;
  title: string;
}): Promise<void> => invoke("update_task_list", args);

export const deleteTaskList = (id: string): Promise<void> =>
  invoke("delete_task_list", { id });

// ── Tasks ────────────────────────────────────────────────────────────────────

export const getTasksForList = (taskListId: string): Promise<Task[]> =>
  invoke("get_tasks_for_list", { taskListId });

export const getDueTodayTasks = (): Promise<Task[]> =>
  invoke("get_due_today_tasks");

export const createTask = (args: {
  taskListId: string;
  title: string;
  parentTaskId?: string | null;
}): Promise<Task> => invoke("create_task", args);

export const updateTask = (args: Partial<Task> & { id: string }): Promise<void> =>
  invoke("update_task", args);

export const deleteTask = (id: string): Promise<void> =>
  invoke("delete_task", { id });

// ── Tags ─────────────────────────────────────────────────────────────────────

export const getAllTags = (): Promise<Tag[]> =>
  invoke("get_all_tags");

export const createTag = (args: {
  name: string;
  color?: string | null;
}): Promise<Tag> => invoke("create_tag", args);

export const assignTag = (args: {
  tagId: string;
  itemId: string;
  itemType: "note" | "task" | "folder" | "event";
}): Promise<void> => invoke("assign_tag", args);

export const removeTag = (args: {
  tagId: string;
  itemId: string;
  itemType: "note" | "task" | "folder" | "event";
}): Promise<void> => invoke("remove_tag", args);

// ── Search ───────────────────────────────────────────────────────────────────

export interface SearchResult {
  itemId: string;
  itemType: "note" | "task" | "folder";
  title: string;
  snippet: string | null;
}

export const searchAll = (query: string): Promise<SearchResult[]> =>
  invoke("search_all", { query });

// ── Settings ─────────────────────────────────────────────────────────────────

export const getSetting = (key: string): Promise<string | null> =>
  invoke("get_setting", { key });

export const setSetting = (args: {
  key: string;
  value: string;
}): Promise<void> => invoke("set_setting", args);

// ── Calendar ─────────────────────────────────────────────────────────────────

export const getCalendarFeeds = (): Promise<CalendarFeed[]> =>
  invoke("get_calendar_feeds");

export const addCalendarFeed = (args: {
  url: string;
  name: string;
  color?: string | null;
}): Promise<CalendarFeed> => invoke("add_calendar_feed", args);

export const deleteCalendarFeed = (id: string): Promise<void> =>
  invoke("delete_calendar_feed", { id });

export const getEventsInRange = (args: {
  startAt: string;
  endAt: string;
}): Promise<CalendarEvent[]> => invoke("get_events_in_range", args);

export const createEvent = (args: {
  title: string;
  startAt: string;
  endAt: string;
  allDay?: boolean;
  folderId?: string | null;
  description?: string | null;
  location?: string | null;
}): Promise<CalendarEvent> => invoke("create_event", args);

export const openUrlInBrowser = (url: string): Promise<void> =>
  invoke("open_url", { url });
