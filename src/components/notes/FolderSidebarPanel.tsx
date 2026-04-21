import { useState, useEffect, useRef, useCallback } from "react";
import { FileText, ListChecks, File as FileIcon, Plus, Paperclip } from "lucide-react";
import { formatDistanceToNow, isToday, isYesterday, isAfter, subDays } from "date-fns";
import { getNotesForFolder, getTaskListsForFolder, getFilesForFolder, openFile, addFileToFolder } from "@/lib/tauri";
import { useFolderStore, useUiStore } from "@/store";
import type { Note, TaskList, FileEntry, Folder } from "@/types";
import { cn } from "@/lib/utils";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

// ── Time grouping ────────────────────────────────────────────────────────────

type TimeGroup = "today" | "yesterday" | "last7days" | "older";

type FolderItem =
  | { kind: "note"; data: Note }
  | { kind: "tasklist"; data: TaskList }
  | { kind: "file"; data: FileEntry };

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

// ── FolderSidebarPanel ────────────────────────────────────────────────────────

interface FolderSidebarPanelProps {
  folderId: string;
  activeTaskListId: string;
}

export function FolderSidebarPanel({ folderId, activeTaskListId }: FolderSidebarPanelProps) {
  const { folders } = useFolderStore();
  const { setActiveView } = useUiStore();
  const [notes, setNotes] = useState<Note[]>([]);
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const folder = findFolder(folders, folderId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChosen = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const picked = e.target.files?.[0];
      e.target.value = "";
      if (!picked) return;
      const buf = await picked.arrayBuffer();
      const bytes = Array.from(new Uint8Array(buf));
      const added = await addFileToFolder({
        folderId,
        fileName: picked.name,
        bytes,
        mimeType: picked.type || null,
      });
      setFiles((prev) => [...prev, added]);
    },
    [folderId]
  );

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getNotesForFolder(folderId),
      getTaskListsForFolder(folderId),
      getFilesForFolder(folderId),
    ]).then(([loadedNotes, loadedTaskLists, loadedFiles]) => {
      setNotes(loadedNotes);
      setTaskLists(loadedTaskLists);
      setFiles(loadedFiles);
      setLoading(false);
    });
  }, [folderId]);

  const allItems: FolderItem[] = [
    ...notes.map((n) => ({ kind: "note" as const, data: n })),
    ...taskLists.map((tl) => ({ kind: "tasklist" as const, data: tl })),
    ...files.map((f) => ({ kind: "file" as const, data: f })),
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

  return (
    <div className="w-56 shrink-0 border-r border-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-3 py-3 shrink-0 border-b border-border gap-1">
        <span className="text-sm font-semibold text-foreground truncate flex-1">
          {folder?.name ?? "Folder"}
        </span>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-accent"
              title="Add to folder"
            >
              <Plus size={13} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              side="bottom"
              align="end"
              className="z-50 min-w-36 rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-2xl text-xs"
            >
              <DropdownMenu.Item
                onSelect={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-1.5 cursor-pointer outline-none hover:bg-accent focus:bg-accent"
              >
                <Paperclip size={12} className="text-muted-foreground" />
                Add File
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChosen}
        />
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <div className="px-3 py-4 text-xs text-muted-foreground/50">Loading…</div>
        ) : allItems.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground/50">Empty folder.</div>
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
                  item.kind === "file" ? (
                    <button
                      key={item.data.id}
                      onClick={() => openFile(item.data.id)}
                      className="w-full text-left px-3 py-2.5 transition-colors hover:bg-accent/50 text-foreground cursor-pointer"
                    >
                      <div className="flex items-start gap-1.5">
                        <FileIcon size={12} className="text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium truncate block">
                            {item.data.fileName}
                          </span>
                          <span className="text-[11px] text-muted-foreground/60 mt-0.5 block">
                            {formatDistanceToNow(new Date(item.data.updatedAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </button>
                  ) : item.kind === "note" ? (
                    <button
                      key={item.data.id}
                      onClick={() =>
                        setActiveView({
                          type: "folder",
                          folderId,
                          initialNoteId: item.data.id,
                        })
                      }
                      className="w-full text-left px-3 py-2.5 transition-colors hover:bg-accent/50 text-foreground cursor-pointer"
                    >
                      <div className="flex items-start gap-1.5">
                        <FileText size={12} className="text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium truncate block">
                            {item.data.title || "Untitled"}
                          </span>
                          <span className="text-[11px] text-muted-foreground/60 mt-0.5 block">
                            {formatDistanceToNow(new Date(item.data.updatedAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </button>
                  ) : (
                    <button
                      key={item.data.id}
                      onClick={() =>
                        setActiveView({
                          type: "tasklist",
                          taskListId: item.data.id,
                          title: item.data.title,
                          folderId,
                        })
                      }
                      className={cn(
                        "w-full text-left px-3 py-2.5 transition-colors cursor-pointer",
                        item.data.id === activeTaskListId
                          ? "bg-accent text-foreground"
                          : "hover:bg-accent/50 text-foreground"
                      )}
                    >
                      <div className="flex items-start gap-1.5">
                        <ListChecks size={12} className="text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium truncate block">{item.data.title}</span>
                          <span className="text-[11px] text-muted-foreground/60 mt-0.5 block">
                            {formatDistanceToNow(new Date(item.data.updatedAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
