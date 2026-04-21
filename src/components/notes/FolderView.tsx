import { useState, useEffect, useCallback } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Plus, FileText, Pin, ListChecks } from "lucide-react";
import { formatDistanceToNow, isToday, isYesterday, isAfter, subDays } from "date-fns";
import {
  getNotesForFolder,
  createNote,
  deleteNote,
  toggleNotePin,
  getTaskListsForFolder,
  createTaskList,
} from "@/lib/tauri";
import { useFolderStore, useUiStore } from "@/store";
import type { Note, TaskList, Folder } from "@/types";
import { cn } from "@/lib/utils";
import { NoteEditor } from "./NoteEditor";

// ── Time grouping ────────────────────────────────────────────────────────────

type TimeGroup = "today" | "yesterday" | "last7days" | "older";

type FolderItem =
  | { kind: "note"; data: Note }
  | { kind: "tasklist"; data: TaskList };

const GROUP_LABELS: Record<TimeGroup, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last7days: "Last 7 Days",
  older: "Older",
};

const GROUP_ORDER: TimeGroup[] = ["today", "yesterday", "last7days", "older"];

function getTimeGroup(dateStr: string): TimeGroup {
  const date = new Date(dateStr);
  if (isToday(date)) return "today";
  if (isYesterday(date)) return "yesterday";
  if (isAfter(date, subDays(new Date(), 7))) return "last7days";
  return "older";
}

function findFolder(tree: Folder[], id: string): Folder | null {
  for (const f of tree) {
    if (f.id === id) return f;
    if (f.children?.length) {
      const found = findFolder(f.children, id);
      if (found) return found;
    }
  }
  return null;
}

// ── FolderView ───────────────────────────────────────────────────────────────

interface FolderViewProps {
  folderId: string;
  initialNoteId?: string;
}

export function FolderView({ folderId, initialNoteId }: FolderViewProps) {
  const { folders } = useFolderStore();
  const { setActiveView } = useUiStore();
  const [notes, setNotes] = useState<Note[]>([]);
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const folder = findFolder(folders, folderId);

  useEffect(() => {
    setLoading(true);
    setSelectedNoteId(null);
    Promise.all([
      getNotesForFolder(folderId),
      getTaskListsForFolder(folderId),
    ]).then(([loadedNotes, loadedTaskLists]) => {
      setNotes(loadedNotes);
      setTaskLists(loadedTaskLists);
      setLoading(false);
      if (initialNoteId && loadedNotes.some((n) => n.id === initialNoteId)) {
        setSelectedNoteId(initialNoteId);
      } else if (loadedNotes.length > 0) {
        const pinned = loadedNotes.find((n) => n.pinned);
        setSelectedNoteId(pinned?.id ?? loadedNotes[0].id);
      }
    });
  }, [folderId]);

  useEffect(() => {
    if (initialNoteId) setSelectedNoteId(initialNoteId);
  }, [initialNoteId]);

  const allItems: FolderItem[] = [
    ...notes.map((n) => ({ kind: "note" as const, data: n })),
    ...taskLists.map((tl) => ({ kind: "tasklist" as const, data: tl })),
  ].sort(
    (a, b) =>
      new Date(b.data.updatedAt).getTime() - new Date(a.data.updatedAt).getTime()
  );

  const grouped: Record<TimeGroup, FolderItem[]> = {
    today: [],
    yesterday: [],
    last7days: [],
    older: [],
  };
  for (const item of allItems) {
    grouped[getTimeGroup(item.data.updatedAt)].push(item);
  }

  const handleNewNote = useCallback(async () => {
    const note = await createNote({ folderId, title: "Untitled" });
    setNotes((prev) => [note, ...prev]);
    setSelectedNoteId(note.id);
  }, [folderId]);

  const handleNewTaskList = useCallback(async () => {
    const tl = await createTaskList({ folderId, title: "New List" });
    setTaskLists((prev) => [...prev, tl]);
    setActiveView({ type: "tasklist", taskListId: tl.id, title: tl.title, folderId });
  }, [folderId, setActiveView]);

  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      await deleteNote(noteId);
      setNotes((prev) => {
        const next = prev.filter((n) => n.id !== noteId);
        if (selectedNoteId === noteId) {
          setSelectedNoteId(next.length > 0 ? next[0].id : null);
        }
        return next;
      });
    },
    [selectedNoteId]
  );

  const handleTogglePin = useCallback(async (noteId: string) => {
    await toggleNotePin(noteId);
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, pinned: !n.pinned } : n))
    );
  }, []);

  const handleNoteUpdated = useCallback(
    (updated: Partial<Note> & { id: string }) => {
      setNotes((prev) =>
        prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n))
      );
    },
    []
  );

  const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Item list panel */}
      <div className="w-56 shrink-0 border-r border-border flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-3 shrink-0 border-b border-border">
          <span className="text-sm font-semibold text-foreground truncate">
            {folder?.name ?? "Folder"}
          </span>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
                title="New item"
              >
                <Plus size={14} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                side="bottom"
                align="end"
                className="z-50 min-w-36 rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-2xl text-xs"
              >
                <DropdownMenu.Item
                  onSelect={handleNewNote}
                  className="flex items-center gap-2 px-3 py-1.5 cursor-pointer outline-none hover:bg-accent focus:bg-accent"
                >
                  <FileText size={12} className="text-muted-foreground" />
                  New Note
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={handleNewTaskList}
                  className="flex items-center gap-2 px-3 py-1.5 cursor-pointer outline-none hover:bg-accent focus:bg-accent"
                >
                  <ListChecks size={12} className="text-muted-foreground" />
                  New Task List
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto py-1">
          {loading ? (
            <div className="px-3 py-4 text-xs text-muted-foreground/50">Loading…</div>
          ) : allItems.length === 0 ? (
            <div className="px-3 py-4 text-xs text-muted-foreground/50">
              Nothing here yet.{" "}
              <button onClick={handleNewNote} className="text-primary hover:underline cursor-pointer">
                Create a note
              </button>
            </div>
          ) : (
            GROUP_ORDER.map((group) => {
              const items = grouped[group];
              if (items.length === 0) return null;
              return (
                <div key={group}>
                  <div className="px-3 pt-3 pb-1 text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
                    {GROUP_LABELS[group]}
                  </div>
                  {items.map((item) =>
                    item.kind === "note" ? (
                      <NoteListItem
                        key={item.data.id}
                        note={item.data}
                        selected={item.data.id === selectedNoteId}
                        onSelect={() => setSelectedNoteId(item.data.id)}
                        onDelete={() => handleDeleteNote(item.data.id)}
                        onTogglePin={() => handleTogglePin(item.data.id)}
                      />
                    ) : (
                      <TaskListItem
                        key={item.data.id}
                        taskList={item.data}
                        onSelect={() =>
                          setActiveView({
                            type: "tasklist",
                            taskListId: item.data.id,
                            title: item.data.title,
                            folderId,
                          })
                        }
                      />
                    )
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Editor panel */}
      <div className="flex-1 overflow-hidden">
        {selectedNote ? (
          <NoteEditor
            key={selectedNote.id}
            note={selectedNote}
            onNoteUpdated={handleNoteUpdated}
          />
        ) : (
          <EmptyEditorState onNewNote={handleNewNote} />
        )}
      </div>
    </div>
  );
}

// ── NoteListItem ─────────────────────────────────────────────────────────────

interface NoteListItemProps {
  note: Note;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}

function NoteListItem({ note, selected, onSelect, onDelete, onTogglePin }: NoteListItemProps) {
  const relativeTime = formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true });

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <button
          onClick={onSelect}
          className={cn(
            "w-full text-left px-3 py-2.5 transition-colors group cursor-pointer",
            selected ? "bg-accent text-foreground" : "hover:bg-accent/50 text-foreground"
          )}
        >
          <div className="flex items-start gap-1.5">
            <FileText size={12} className="text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium truncate flex-1">
                  {note.title || "Untitled"}
                </span>
                {note.pinned && <Pin size={10} className="text-primary shrink-0" />}
              </div>
              <span className="text-[11px] text-muted-foreground/60 mt-0.5 block">
                {relativeTime}
              </span>
            </div>
          </div>
        </button>
      </ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Content className="z-50 min-w-36 rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-2xl text-xs">
          <ContextMenu.Item
            onSelect={onTogglePin}
            className="flex items-center gap-2 px-3 py-1.5 cursor-pointer outline-none hover:bg-accent focus:bg-accent"
          >
            <Pin size={12} className="text-muted-foreground" />
            {note.pinned ? "Unpin" : "Pin to top"}
          </ContextMenu.Item>
          <ContextMenu.Separator className="h-px bg-border my-1 mx-1" />
          <ContextMenu.Item
            onSelect={onDelete}
            className="flex items-center px-3 py-1.5 cursor-pointer outline-none hover:bg-red-500/15 focus:bg-red-500/15 text-red-400"
          >
            Delete
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

// ── TaskListItem ─────────────────────────────────────────────────────────────

function TaskListItem({
  taskList,
  onSelect,
}: {
  taskList: TaskList;
  onSelect: () => void;
}) {
  const relativeTime = formatDistanceToNow(new Date(taskList.updatedAt), { addSuffix: true });

  return (
    <button
      onClick={onSelect}
      className="w-full text-left px-3 py-2.5 transition-colors hover:bg-accent/50 text-foreground cursor-pointer"
    >
      <div className="flex items-start gap-1.5">
        <ListChecks size={12} className="text-muted-foreground shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium truncate block">{taskList.title}</span>
          <span className="text-[11px] text-muted-foreground/60 mt-0.5 block">{relativeTime}</span>
        </div>
      </div>
    </button>
  );
}

// ── EmptyEditorState ─────────────────────────────────────────────────────────

function EmptyEditorState({ onNewNote }: { onNewNote: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
      <FileText size={32} className="text-muted-foreground/20" />
      <div>
        <p className="text-sm text-muted-foreground/50">No note selected</p>
        <button onClick={onNewNote} className="mt-2 text-xs text-primary hover:underline cursor-pointer">
          Create a new note
        </button>
      </div>
    </div>
  );
}
