import { useState, useEffect, useCallback } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { Plus, FileText, Pin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getNotesForFolder, createNote, deleteNote, toggleNotePin } from "@/lib/tauri";
import { useFolderStore } from "@/store";
import type { Note, Folder } from "@/types";
import { cn } from "@/lib/utils";
import { NoteEditor } from "./NoteEditor";

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

interface FolderViewProps {
  folderId: string;
}

export function FolderView({ folderId }: FolderViewProps) {
  const { folders } = useFolderStore();
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const folder = findFolder(folders, folderId);

  const sortedNotes = [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  useEffect(() => {
    setLoading(true);
    setSelectedId(null);
    getNotesForFolder(folderId).then((loaded) => {
      setNotes(loaded);
      setLoading(false);
      if (loaded.length > 0) {
        const pinned = loaded.find((n) => n.pinned);
        setSelectedId(pinned?.id ?? loaded[0].id);
      }
    });
  }, [folderId]);

  const handleNewNote = useCallback(async () => {
    const note = await createNote({ folderId, title: "Untitled" });
    setNotes((prev) => [note, ...prev]);
    setSelectedId(note.id);
  }, [folderId]);

  const handleDelete = useCallback(async (noteId: string) => {
    await deleteNote(noteId);
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== noteId);
      if (selectedId === noteId) {
        setSelectedId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
  }, [selectedId]);

  const handleTogglePin = useCallback(async (noteId: string) => {
    await toggleNotePin(noteId);
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, pinned: !n.pinned } : n))
    );
  }, []);

  const handleNoteUpdated = useCallback((updated: Partial<Note> & { id: string }) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n))
    );
  }, []);

  const selectedNote = notes.find((n) => n.id === selectedId) ?? null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Note list panel */}
      <div className="w-56 shrink-0 border-r border-border flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-3 shrink-0 border-b border-border">
          <span className="text-sm font-semibold text-foreground truncate">
            {folder?.name ?? "Notes"}
          </span>
          <button
            onClick={handleNewNote}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title="New note"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Note list */}
        <div className="flex-1 overflow-y-auto py-1">
          {loading ? (
            <div className="px-3 py-4 text-xs text-muted-foreground/50">Loading…</div>
          ) : sortedNotes.length === 0 ? (
            <div className="px-3 py-4 text-xs text-muted-foreground/50">
              No notes yet.{" "}
              <button
                onClick={handleNewNote}
                className="text-primary hover:underline"
              >
                Create one
              </button>
            </div>
          ) : (
            sortedNotes.map((note) => (
              <NoteListItem
                key={note.id}
                note={note}
                selected={note.id === selectedId}
                onSelect={() => setSelectedId(note.id)}
                onDelete={() => handleDelete(note.id)}
                onTogglePin={() => handleTogglePin(note.id)}
              />
            ))
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
            "w-full text-left px-3 py-2.5 transition-colors group",
            selected
              ? "bg-accent text-foreground"
              : "hover:bg-accent/50 text-foreground"
          )}
        >
          <div className="flex items-start gap-1.5">
            <FileText size={12} className="text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium truncate flex-1">
                  {note.title || "Untitled"}
                </span>
                {note.pinned && (
                  <Pin size={10} className="text-primary shrink-0" />
                )}
              </div>
              <span className="text-[10px] text-muted-foreground/60 mt-0.5 block">
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

// ── EmptyEditorState ─────────────────────────────────────────────────────────

function EmptyEditorState({ onNewNote }: { onNewNote: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
      <FileText size={32} className="text-muted-foreground/20" />
      <div>
        <p className="text-sm text-muted-foreground/50">No note selected</p>
        <button
          onClick={onNewNote}
          className="mt-2 text-xs text-primary hover:underline"
        >
          Create a new note
        </button>
      </div>
    </div>
  );
}
