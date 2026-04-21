export interface Folder {
  id: string;
  parentId: string | null;
  name: string;
  color: string | null;
  icon: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  children?: Folder[];
}

export interface Note {
  id: string;
  folderId: string | null;
  title: string;
  sortOrder: number;
  pinned: boolean;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskList {
  id: string;
  folderId: string | null;
  title: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "none" | "low" | "medium" | "high" | "urgent";

export interface Task {
  id: string;
  taskListId: string;
  parentTaskId: string | null;
  title: string;
  notes: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  dueTime: string | null;
  reminderAt: string | null;
  rrule: string | null;
  sortOrder: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  children?: Task[];
}

export interface FileEntry {
  id: string;
  folderId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
}

export interface CalendarFeed {
  id: string;
  url: string;
  name: string;
  color: string | null;
  syncInterval: number;
  lastSyncedAt: string | null;
  enabled: boolean;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  folderId: string | null;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  rrule: string | null;
  color: string | null;
  isExternal: boolean;
  feedId?: string;
}

export type ActiveView =
  | { type: "dashboard" }
  | { type: "folder"; folderId: string; initialNoteId?: string }
  | { type: "note"; noteId: string }
  | { type: "tasklist"; taskListId: string; title?: string; folderId?: string }
  | { type: "calendar" }
  | { type: "overview" }
  | { type: "settings" };
