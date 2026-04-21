import { useEffect, useState, useRef, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import {
  LayoutDashboard,
  Calendar,
  Map,
  Settings,
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  GripVertical,
  ListChecks,
  FileText,
  Paperclip,
  File as FileIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore, useFolderStore } from "@/store";
import { reorderFolders, getNotesForFolder, getTaskListsForFolder, createTaskList, updateTaskList, deleteTaskList, getFilesForFolder, addFileToFolder, deleteFile, renameFile, openFile } from "@/lib/tauri";
import type { Folder as FolderType, Note, TaskList, FileEntry, ActiveView } from "@/types";

const FOLDER_COLORS = [
  { name: "Default", value: null },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#eab308" },
  { name: "Green", value: "#22c55e" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#a855f7" },
  { name: "Pink", value: "#ec4899" },
];

function findSiblings(tree: FolderType[], targetId: string): FolderType[] | null {
  if (tree.some((f) => f.id === targetId)) return tree;
  for (const f of tree) {
    if (f.children?.length) {
      const found = findSiblings(f.children, targetId);
      if (found) return found;
    }
  }
  return null;
}

// ── Sidebar ─────────────────────────────────────────────────────────────────

export function Sidebar() {
  const { activeView, setActiveView, setSearchOpen } = useUiStore();
  const {
    folders,
    expandedIds,
    loadFolders,
    toggleExpanded,
    createFolder,
    updateFolder,
    deleteFolder,
    setExpanded,
  } = useFolderStore();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<FolderType | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  const startRename = useCallback((folder: FolderType) => {
    setRenamingId(folder.id);
    setRenameValue(folder.name);
  }, []);

  const cancelRename = useCallback(() => {
    setRenamingId(null);
  }, []);

  const commitRename = useCallback(
    async (id: string, value: string) => {
      setRenamingId(null);
      const trimmed = value.trim();
      if (trimmed) await updateFolder({ id, name: trimmed });
    },
    [updateFolder]
  );

  const handleNewSubfolder = useCallback(
    async (parentId: string) => {
      setExpanded(parentId, true);
      const newFolder = await createFolder({ name: "New Folder", parentId });
      setRenamingId(newFolder.id);
      setRenameValue("New Folder");
    },
    [createFolder, setExpanded]
  );

  const handleNewRootFolder = useCallback(async () => {
    const newFolder = await createFolder({ name: "New Folder" });
    setRenamingId(newFolder.id);
    setRenameValue("New Folder");
  }, [createFolder]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteFolder(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, deleteFolder]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const siblings = findSiblings(folders, active.id as string);
    if (!siblings) return;

    const sibIds = siblings.map((f) => f.id);
    const oldIdx = sibIds.indexOf(active.id as string);
    const newIdx = sibIds.indexOf(over.id as string);
    if (oldIdx === -1 || newIdx === -1) return;

    const newOrder = arrayMove(sibIds, oldIdx, newIdx);
    reorderFolders(newOrder).then(() => loadFolders());
  }

  const activeFolderData = activeId
    ? (findSiblings(folders, activeId) ?? []).find((f) => f.id === activeId)
    : null;

  const navItems: { label: string; icon: React.ReactNode; view: ActiveView }[] = [
    { label: "Dashboard", icon: <LayoutDashboard size={15} />, view: { type: "dashboard" } },
    { label: "Calendar", icon: <Calendar size={15} />, view: { type: "calendar" } },
    { label: "Overview", icon: <Map size={15} />, view: { type: "overview" } },
  ];

  return (
    <aside className="flex flex-col w-60 shrink-0 bg-sidebar border-r border-sidebar-border h-full select-none">
      {/* App name */}
      <div className="flex items-center px-4 py-3 border-b border-sidebar-border">
        <span className="text-sm font-semibold text-sidebar-foreground tracking-tight">
          Zazzy Fern
        </span>
      </div>

      {/* Search */}
      <button
        onClick={() => setSearchOpen(true)}
        className="flex items-center gap-2 mx-3 my-2 px-3 py-1.5 rounded-md bg-sidebar-accent text-xs hover:bg-sidebar-accent/80 transition-colors"
      >
        <Search size={12} className="text-muted-foreground" />
        <span className="text-muted-foreground">Search...</span>
        <span className="ml-auto text-muted-foreground/50 text-[11px]">Ctrl+F</span>
      </button>

      {/* Main nav */}
      <nav className="px-2 space-y-px">
        {navItems.map((item) => (
          <NavItem
            key={item.label}
            label={item.label}
            icon={item.icon}
            active={activeView.type === item.view.type}
            onClick={() => setActiveView(item.view)}
          />
        ))}
      </nav>

      {/* Folders header */}
      <div className="px-3 pt-4 pb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
          Folders
        </span>
        <button
          onClick={handleNewRootFolder}
          className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-sidebar-accent"
          title="New folder"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Folder tree */}
      <div className="flex-1 overflow-y-auto pb-2 px-1">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={folders.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            {folders.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground/60">
                Click + to create a folder
              </p>
            ) : (
              folders.map((folder) => (
                <FolderNode
                  key={folder.id}
                  folder={folder}
                  depth={0}
                  expandedIds={expandedIds}
                  toggleExpanded={toggleExpanded}
                  activeView={activeView}
                  setActiveView={setActiveView}
                  renamingId={renamingId}
                  renameValue={renameValue}
                  setRenameValue={setRenameValue}
                  startRename={startRename}
                  cancelRename={cancelRename}
                  commitRename={commitRename}
                  onNewSubfolder={handleNewSubfolder}
                  onDelete={setDeleteTarget}
                  updateFolder={updateFolder}
                />
              ))
            )}
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {activeFolderData ? <FolderDragPreview folder={activeFolderData} /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Bottom nav */}
      <div className="border-t border-sidebar-border px-2 py-2">
        <NavItem
          label="Settings"
          icon={<Settings size={15} />}
          active={activeView.type === "settings"}
          onClick={() => setActiveView({ type: "settings" })}
        />
      </div>

      {/* Delete confirmation */}
      <AlertDialog.Root open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/70 z-50" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-80 rounded-lg border border-border bg-card text-card-foreground p-5 shadow-2xl">
            <AlertDialog.Title className="font-semibold text-sm mb-1">
              Delete "{deleteTarget?.name}"?
            </AlertDialog.Title>
            <AlertDialog.Description className="text-xs text-muted-foreground mb-4 leading-relaxed">
              All notes, tasks, and sub-folders inside will be permanently deleted. This cannot be undone.
            </AlertDialog.Description>
            <div className="flex gap-2 justify-end">
              <AlertDialog.Cancel asChild>
                <button className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-sidebar-accent transition-colors">
                  Cancel
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  onClick={handleDeleteConfirm}
                  className="px-3 py-1.5 text-xs rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors font-medium"
                >
                  Delete
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </aside>
  );
}

// ── NavItem ──────────────────────────────────────────────────────────────────

function NavItem({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 px-2 py-1.5 rounded-md text-xs transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-foreground font-medium"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

// ── FolderNode ───────────────────────────────────────────────────────────────

interface FolderNodeProps {
  folder: FolderType;
  depth: number;
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  renamingId: string | null;
  renameValue: string;
  setRenameValue: (v: string) => void;
  startRename: (folder: FolderType) => void;
  cancelRename: () => void;
  commitRename: (id: string, value: string) => Promise<void>;
  onNewSubfolder: (parentId: string) => void;
  onDelete: (folder: FolderType) => void;
  updateFolder: (args: { id: string; color?: string | null; name?: string }) => Promise<void>;
}

function FolderNode({
  folder,
  depth,
  expandedIds,
  toggleExpanded,
  activeView,
  setActiveView,
  renamingId,
  renameValue,
  setRenameValue,
  startRename,
  cancelRename,
  commitRename,
  onNewSubfolder,
  onDelete,
  updateFolder,
}: FolderNodeProps) {
  const isExpanded = expandedIds.has(folder.id);
  const hasChildren = (folder.children?.length ?? 0) > 0;
  const isActive = activeView.type === "folder" && activeView.folderId === folder.id;
  const isRenaming = renamingId === folder.id;

  const [notes, setNotes] = useState<Note[]>([]);
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [renamingTaskListId, setRenamingTaskListId] = useState<string | null>(null);
  const [taskListRenameValue, setTaskListRenameValue] = useState("");
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [fileRenameValue, setFileRenameValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const renameInputRef = useRef<HTMLInputElement>(null);
  const escapeRef = useRef(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: folder.id,
  });

  useEffect(() => {
    if (isRenaming) {
      escapeRef.current = false;
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    if (isExpanded) {
      Promise.all([
        getNotesForFolder(folder.id),
        getTaskListsForFolder(folder.id),
        getFilesForFolder(folder.id),
      ]).then(([loadedNotes, loadedTaskLists, loadedFiles]) => {
        setNotes(loadedNotes);
        setTaskLists(loadedTaskLists);
        setFiles(loadedFiles);
      });
    }
  }, [isExpanded, folder.id]);

  const handleNewTaskList = useCallback(async () => {
    const tl = await createTaskList({ folderId: folder.id, title: "New List" });
    const updated = await getTaskListsForFolder(folder.id);
    setTaskLists(updated);
    setRenamingTaskListId(tl.id);
    setTaskListRenameValue("New List");
    if (!isExpanded) toggleExpanded(folder.id);
  }, [folder.id, isExpanded, toggleExpanded]);

  const commitTaskListRename = useCallback(
    async (id: string, value: string) => {
      setRenamingTaskListId(null);
      const trimmed = value.trim();
      if (trimmed) {
        await updateTaskList({ id, title: trimmed });
        setTaskLists((prev) => prev.map((tl) => (tl.id === id ? { ...tl, title: trimmed } : tl)));
      }
    },
    []
  );

  const handleDeleteTaskList = useCallback(async (id: string) => {
    await deleteTaskList(id);
    setTaskLists((prev) => prev.filter((tl) => tl.id !== id));
  }, []);

  const handlePickFile = useCallback(() => {
    if (!isExpanded) toggleExpanded(folder.id);
    fileInputRef.current?.click();
  }, [folder.id, isExpanded, toggleExpanded]);

  const handleFileChosen = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const picked = e.target.files?.[0];
      e.target.value = "";
      if (!picked) return;
      const buf = await picked.arrayBuffer();
      const bytes = Array.from(new Uint8Array(buf));
      const added = await addFileToFolder({
        folderId: folder.id,
        fileName: picked.name,
        bytes,
        mimeType: picked.type || null,
      });
      setFiles((prev) => [...prev, added]);
    },
    [folder.id]
  );

  const handleDeleteFile = useCallback(async (id: string) => {
    await deleteFile(id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const commitFileRename = useCallback(async (id: string, value: string) => {
    setRenamingFileId(null);
    const trimmed = value.trim();
    if (!trimmed) return;
    await renameFile({ id, fileName: trimmed });
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, fileName: trimmed } : f)));
  }, []);

  const handleRowClick = () => {
    if (isRenaming) return;
    setActiveView({ type: "folder", folderId: folder.id });
    toggleExpanded(folder.id);
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleExpanded(folder.id);
  };

  const showExpanded = isExpanded && (hasChildren || notes.length > 0 || taskLists.length > 0);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
      }}
      {...attributes}
    >
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <div
            className={cn(
              "group flex items-center gap-0.5 py-[3px] rounded-md text-xs transition-colors cursor-pointer",
              isActive
                ? "bg-sidebar-accent text-sidebar-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
            style={{ paddingLeft: `${6 + depth * 14}px`, paddingRight: "4px" }}
            onClick={handleRowClick}
            onDoubleClick={() => !isRenaming && startRename(folder)}
          >
            {/* Drag grip */}
            <span
              {...listeners}
              className="shrink-0 opacity-0 group-hover:opacity-40 hover:!opacity-70 cursor-grab active:cursor-grabbing px-0.5 touch-none"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={10} />
            </span>

            {/* Expand chevron */}
            <span
              className="shrink-0 w-3.5 text-muted-foreground/40"
              onClick={handleChevronClick}
            >
              {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </span>

            {/* Folder icon */}
            {showExpanded ? (
              <FolderOpen
                size={13}
                className="shrink-0 mr-1"
                style={{ color: folder.color ?? "var(--muted-foreground)" }}
              />
            ) : (
              <Folder
                size={13}
                className="shrink-0 mr-1"
                style={{ color: folder.color ?? "var(--muted-foreground)" }}
              />
            )}

            {/* Name / rename input */}
            {isRenaming ? (
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitRename(folder.id, renameValue);
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    escapeRef.current = true;
                    cancelRename();
                  }
                }}
                onBlur={() => {
                  if (!escapeRef.current) {
                    commitRename(folder.id, renameValue);
                  }
                  escapeRef.current = false;
                }}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 min-w-0 bg-transparent border-none outline-none text-xs text-sidebar-foreground"
              />
            ) : (
              <span className="truncate flex-1">{folder.name}</span>
            )}

            {/* Hover + button */}
            {!isRenaming && (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 p-0.5 rounded hover:bg-sidebar-accent/80 text-muted-foreground transition-opacity"
                    title="Add to folder"
                  >
                    <Plus size={12} />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    side="right"
                    align="start"
                    className="z-50 min-w-36 rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-2xl text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu.Item
                      onSelect={() => onNewSubfolder(folder.id)}
                      className="flex items-center gap-2 px-3 py-1.5 cursor-pointer outline-none hover:bg-accent focus:bg-accent"
                    >
                      <Folder size={12} className="text-muted-foreground" />
                      New Subfolder
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={handleNewTaskList}
                      className="flex items-center gap-2 px-3 py-1.5 cursor-pointer outline-none hover:bg-accent focus:bg-accent"
                    >
                      <ListChecks size={12} className="text-muted-foreground" />
                      New Task List
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={handlePickFile}
                      className="flex items-center gap-2 px-3 py-1.5 cursor-pointer outline-none hover:bg-accent focus:bg-accent"
                    >
                      <Paperclip size={12} className="text-muted-foreground" />
                      Add File
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}
          </div>
        </ContextMenu.Trigger>

        <ContextMenu.Portal>
          <ContextMenu.Content className="z-50 min-w-40 rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-2xl text-xs">
            <ContextMenu.Item
              onSelect={() => onNewSubfolder(folder.id)}
              className="flex items-center gap-2 px-3 py-1.5 cursor-pointer outline-none hover:bg-accent focus:bg-accent"
            >
              <Plus size={12} className="text-muted-foreground" />
              New Subfolder
            </ContextMenu.Item>
            <ContextMenu.Item
              onSelect={handleNewTaskList}
              className="flex items-center gap-2 px-3 py-1.5 cursor-pointer outline-none hover:bg-accent focus:bg-accent"
            >
              <ListChecks size={12} className="text-muted-foreground" />
              New Task List
            </ContextMenu.Item>
            <ContextMenu.Item
              onSelect={handlePickFile}
              className="flex items-center gap-2 px-3 py-1.5 cursor-pointer outline-none hover:bg-accent focus:bg-accent"
            >
              <Paperclip size={12} className="text-muted-foreground" />
              Add File
            </ContextMenu.Item>
            <ContextMenu.Item
              onSelect={() => startRename(folder)}
              className="flex items-center px-3 py-1.5 cursor-pointer outline-none hover:bg-accent focus:bg-accent"
            >
              Rename
            </ContextMenu.Item>
            <ContextMenu.Sub>
              <ContextMenu.SubTrigger className="flex items-center justify-between px-3 py-1.5 cursor-pointer outline-none hover:bg-accent focus:bg-accent data-[state=open]:bg-accent">
                <span>Color</span>
                <ChevronRight size={11} className="text-muted-foreground" />
              </ContextMenu.SubTrigger>
              <ContextMenu.Portal>
                <ContextMenu.SubContent className="z-50 min-w-36 rounded-md border border-border bg-popover py-1 shadow-2xl text-xs">
                  {FOLDER_COLORS.map((c) => (
                    <ContextMenu.Item
                      key={c.name}
                      onSelect={() => updateFolder({ id: folder.id, color: c.value })}
                      className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer outline-none hover:bg-accent focus:bg-accent"
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-border/60 shrink-0"
                        style={{ backgroundColor: c.value ?? "transparent" }}
                      />
                      {c.name}
                      {folder.color === c.value && (
                        <span className="ml-auto text-primary">✓</span>
                      )}
                    </ContextMenu.Item>
                  ))}
                </ContextMenu.SubContent>
              </ContextMenu.Portal>
            </ContextMenu.Sub>
            <ContextMenu.Separator className="h-px bg-border my-1 mx-1" />
            <ContextMenu.Item
              onSelect={() => onDelete(folder)}
              className="flex items-center px-3 py-1.5 cursor-pointer outline-none hover:bg-red-500/15 focus:bg-red-500/15 text-red-400"
            >
              Delete
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChosen}
      />

      {/* Children */}
      {isExpanded && (
        <>
          {hasChildren && (
            <SortableContext
              items={folder.children!.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {folder.children!.map((child) => (
                <FolderNode
                  key={child.id}
                  folder={child}
                  depth={depth + 1}
                  expandedIds={expandedIds}
                  toggleExpanded={toggleExpanded}
                  activeView={activeView}
                  setActiveView={setActiveView}
                  renamingId={renamingId}
                  renameValue={renameValue}
                  setRenameValue={setRenameValue}
                  startRename={startRename}
                  cancelRename={cancelRename}
                  commitRename={commitRename}
                  onNewSubfolder={onNewSubfolder}
                  onDelete={onDelete}
                  updateFolder={updateFolder}
                />
              ))}
            </SortableContext>
          )}

          {[
            ...notes.map((n) => ({ kind: "note" as const, data: n, date: new Date(n.updatedAt) })),
            ...taskLists.map((tl) => ({ kind: "tasklist" as const, data: tl, date: new Date(tl.updatedAt) })),
            ...files.map((f) => ({ kind: "file" as const, data: f, date: new Date(f.updatedAt) })),
          ]
            .sort((a, b) => b.date.getTime() - a.date.getTime())
            .map((item) =>
              item.kind === "note" ? (
                <SidebarNoteItem
                  key={item.data.id}
                  note={item.data}
                  depth={depth + 1}
                  isActive={
                    activeView.type === "folder" &&
                    activeView.folderId === folder.id &&
                    activeView.initialNoteId === item.data.id
                  }
                  onSelect={() =>
                    setActiveView({
                      type: "folder",
                      folderId: folder.id,
                      initialNoteId: item.data.id,
                    })
                  }
                />
              ) : item.kind === "tasklist" ? (
                <TaskListItem
                  key={item.data.id}
                  taskList={item.data}
                  depth={depth + 1}
                  isActive={activeView.type === "tasklist" && activeView.taskListId === item.data.id}
                  isRenaming={renamingTaskListId === item.data.id}
                  renameValue={taskListRenameValue}
                  setRenameValue={setTaskListRenameValue}
                  onSelect={() =>
                    setActiveView({ type: "tasklist", taskListId: item.data.id, title: item.data.title, folderId: folder.id })
                  }
                  onStartRename={() => {
                    setRenamingTaskListId(item.data.id);
                    setTaskListRenameValue(item.data.title);
                  }}
                  onCommitRename={(v) => commitTaskListRename(item.data.id, v)}
                  onDelete={() => handleDeleteTaskList(item.data.id)}
                />
              ) : (
                <SidebarFileItem
                  key={item.data.id}
                  file={item.data}
                  depth={depth + 1}
                  isRenaming={renamingFileId === item.data.id}
                  renameValue={fileRenameValue}
                  setRenameValue={setFileRenameValue}
                  onOpen={() => openFile(item.data.id)}
                  onStartRename={() => {
                    setRenamingFileId(item.data.id);
                    setFileRenameValue(item.data.fileName);
                  }}
                  onCommitRename={(v) => commitFileRename(item.data.id, v)}
                  onDelete={() => handleDeleteFile(item.data.id)}
                />
              )
            )}
        </>
      )}
    </div>
  );
}

// ── SidebarFileItem ───────────────────────────────────────────────────────────

interface SidebarFileItemProps {
  file: FileEntry;
  depth: number;
  isRenaming: boolean;
  renameValue: string;
  setRenameValue: (v: string) => void;
  onOpen: () => void;
  onStartRename: () => void;
  onCommitRename: (value: string) => void;
  onDelete: () => void;
}

function SidebarFileItem({
  file,
  depth,
  isRenaming,
  renameValue,
  setRenameValue,
  onOpen,
  onStartRename,
  onCommitRename,
  onDelete,
}: SidebarFileItemProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const escapeRef = useRef(false);

  useEffect(() => {
    if (isRenaming) {
      escapeRef.current = false;
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming]);

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          className={cn(
            "flex items-center gap-1.5 py-[3px] rounded-md text-xs transition-colors cursor-pointer",
            "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          )}
          style={{ paddingLeft: `${6 + depth * 14 + 14}px`, paddingRight: "4px" }}
          onClick={!isRenaming ? onOpen : undefined}
          onDoubleClick={() => !isRenaming && onStartRename()}
        >
          <FileIcon size={12} className="shrink-0 mr-0.5" />
          {isRenaming ? (
            <input
              ref={inputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  e.preventDefault();
                  onCommitRename(renameValue);
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  escapeRef.current = true;
                  onCommitRename(file.fileName);
                }
              }}
              onBlur={() => {
                if (!escapeRef.current) onCommitRename(renameValue);
                escapeRef.current = false;
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 min-w-0 bg-transparent border-none outline-none text-xs text-sidebar-foreground"
            />
          ) : (
            <span className="truncate flex-1">{file.fileName}</span>
          )}
        </div>
      </ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Content className="z-50 min-w-36 rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-2xl text-xs">
          <ContextMenu.Item
            onSelect={onOpen}
            className="flex items-center px-3 py-1.5 cursor-pointer outline-none hover:bg-accent focus:bg-accent"
          >
            Open
          </ContextMenu.Item>
          <ContextMenu.Item
            onSelect={onStartRename}
            className="flex items-center px-3 py-1.5 cursor-pointer outline-none hover:bg-accent focus:bg-accent"
          >
            Rename
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

// ── SidebarNoteItem ───────────────────────────────────────────────────────────

function SidebarNoteItem({
  note,
  depth,
  isActive,
  onSelect,
}: {
  note: Note;
  depth: number;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 py-[3px] rounded-md text-xs transition-colors cursor-pointer",
        isActive
          ? "bg-sidebar-accent text-sidebar-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      )}
      style={{ paddingLeft: `${6 + depth * 14 + 14}px`, paddingRight: "4px" }}
      onClick={onSelect}
    >
      <FileText size={12} className="shrink-0 mr-0.5" />
      <span className="truncate flex-1">{note.title || "Untitled"}</span>
    </div>
  );
}

// ── TaskListItem ──────────────────────────────────────────────────────────────

interface TaskListItemProps {
  taskList: TaskList;
  depth: number;
  isActive: boolean;
  isRenaming: boolean;
  renameValue: string;
  setRenameValue: (v: string) => void;
  onSelect: () => void;
  onStartRename: () => void;
  onCommitRename: (value: string) => void;
  onDelete: () => void;
}

function TaskListItem({
  taskList,
  depth,
  isActive,
  isRenaming,
  renameValue,
  setRenameValue,
  onSelect,
  onStartRename,
  onCommitRename,
  onDelete,
}: TaskListItemProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const escapeRef = useRef(false);

  useEffect(() => {
    if (isRenaming) {
      escapeRef.current = false;
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming]);

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          className={cn(
            "flex items-center gap-1.5 py-[3px] rounded-md text-xs transition-colors cursor-pointer",
            isActive
              ? "bg-sidebar-accent text-sidebar-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          )}
          style={{ paddingLeft: `${6 + depth * 14 + 14}px`, paddingRight: "4px" }}
          onClick={!isRenaming ? onSelect : undefined}
          onDoubleClick={() => !isRenaming && onStartRename()}
        >
          <ListChecks size={12} className="shrink-0 mr-0.5" />
          {isRenaming ? (
            <input
              ref={inputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  e.preventDefault();
                  onCommitRename(renameValue);
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  escapeRef.current = true;
                  onCommitRename(taskList.title);
                }
              }}
              onBlur={() => {
                if (!escapeRef.current) onCommitRename(renameValue);
                escapeRef.current = false;
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 min-w-0 bg-transparent border-none outline-none text-xs text-sidebar-foreground"
            />
          ) : (
            <span className="truncate flex-1">{taskList.title}</span>
          )}
        </div>
      </ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Content className="z-50 min-w-36 rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-2xl text-xs">
          <ContextMenu.Item
            onSelect={onStartRename}
            className="flex items-center px-3 py-1.5 cursor-pointer outline-none hover:bg-accent focus:bg-accent"
          >
            Rename
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

// ── Drag overlay preview ─────────────────────────────────────────────────────

function FolderDragPreview({ folder }: { folder: FolderType }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-sidebar-accent border border-sidebar-border text-sidebar-foreground text-xs shadow-xl opacity-90 w-52">
      <GripVertical size={10} className="text-muted-foreground shrink-0" />
      <Folder
        size={13}
        className="shrink-0"
        style={{ color: folder.color ?? "var(--muted-foreground)" }}
      />
      <span className="truncate">{folder.name}</span>
    </div>
  );
}
