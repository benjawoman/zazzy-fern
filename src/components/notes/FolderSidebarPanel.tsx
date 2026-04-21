import { useState, useEffect } from "react";
import { FileText, ListChecks } from "lucide-react";
import { formatDistanceToNow, isToday, isYesterday, isAfter, subDays } from "date-fns";
import { getNotesForFolder, getTaskListsForFolder } from "@/lib/tauri";
import { useFolderStore, useUiStore } from "@/store";
import type { Note, TaskList, Folder } from "@/types";
import { cn } from "@/lib/utils";

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
  const [loading, setLoading] = useState(true);

  const folder = findFolder(folders, folderId);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getNotesForFolder(folderId),
      getTaskListsForFolder(folderId),
    ]).then(([loadedNotes, loadedTaskLists]) => {
      setNotes(loadedNotes);
      setTaskLists(loadedTaskLists);
      setLoading(false);
    });
  }, [folderId]);

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

  return (
    <div className="w-56 shrink-0 border-r border-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-3 py-3 shrink-0 border-b border-border">
        <span className="text-sm font-semibold text-foreground truncate">
          {folder?.name ?? "Folder"}
        </span>
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
                  item.kind === "note" ? (
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
