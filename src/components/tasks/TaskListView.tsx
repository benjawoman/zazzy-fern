import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { Plus, Circle, CheckCircle2, ChevronRight, ChevronDown, GripVertical, X } from "lucide-react";
import {
  DndContext, DragOverlay, closestCenter,
  PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable,
  verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getTasksForList, createTask, updateTask, deleteTask, updateTaskList } from "@/lib/tauri";
import type { Task } from "@/types";
import { cn } from "@/lib/utils";

function computeMidpointSortOrder(before?: number, after?: number): number {
  if (before == null && after == null) return 1;
  if (before == null) return (after ?? 1) - 1;
  if (after == null) return before + 1;
  return (before + after) / 2;
}

function updateInTree(tasks: Task[], id: string, patch: Partial<Task>): Task[] {
  return tasks.map((t) => {
    if (t.id === id) return { ...t, ...patch };
    if (t.children?.length) return { ...t, children: updateInTree(t.children, id, patch) };
    return t;
  });
}

function removeFromTree(tasks: Task[], id: string): Task[] {
  return tasks
    .filter((t) => t.id !== id)
    .map((t) => ({ ...t, children: t.children ? removeFromTree(t.children, id) : undefined }));
}

// ── TaskListView ──────────────────────────────────────────────────────────────

interface TaskListViewProps {
  taskListId: string;
  title?: string;
}

export function TaskListView({ taskListId, title = "Tasks" }: TaskListViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [localTitle, setLocalTitle] = useState(title);
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleEscapeRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const reload = useCallback(async () => {
    const loaded = await getTasksForList(taskListId);
    setTasks(loaded);
  }, [taskListId]);

  useEffect(() => {
    setLoading(true);
    setFocusId(null);
    reload().then(() => setLoading(false));
  }, [reload]);

  const handleAddTask = useCallback(
    async (parentTaskId: string | null = null) => {
      const task = await createTask({ taskListId, title: "", parentTaskId });
      await reload();
      setFocusId(task.id);
    },
    [taskListId, reload]
  );

  const handleToggleDone = useCallback(async (task: Task) => {
    const newStatus = task.status === "done" ? "todo" : "done";
    setTasks((prev) => updateInTree(prev, task.id, { status: newStatus }));
    await updateTask({ id: task.id, status: newStatus });
  }, []);

  const handleCommitTitle = useCallback(async (taskId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) {
      await deleteTask(taskId);
      setTasks((prev) => removeFromTree(prev, taskId));
    } else {
      await updateTask({ id: taskId, title: trimmed });
      setTasks((prev) => updateInTree(prev, taskId, { title: trimmed }));
    }
  }, []);

  const handleEnterKey = useCallback(
    async (task: Task, editedTitle: string) => {
      const trimmed = editedTitle.trim();
      if (!trimmed && !task.title) {
        await deleteTask(task.id);
        setTasks((prev) => removeFromTree(prev, task.id));
        return;
      }
      if (trimmed && trimmed !== task.title) {
        await updateTask({ id: task.id, title: trimmed });
        setTasks((prev) => updateInTree(prev, task.id, { title: trimmed }));
      }
      if (trimmed) {
        const sibling = await createTask({ taskListId, title: "", parentTaskId: task.parentTaskId });
        await reload();
        setFocusId(sibling.id);
      }
    },
    [taskListId, reload]
  );

  const handleDelete = useCallback(async (taskId: string) => {
    await deleteTask(taskId);
    setTasks((prev) => removeFromTree(prev, taskId));
  }, []);

  const handlePatchTask = useCallback(async (taskId: string, patch: Partial<Task>) => {
    await updateTask({ id: taskId, ...patch });
    setTasks((prev) => updateInTree(prev, taskId, patch));
  }, []);

  const clearFocus = useCallback(() => setFocusId(null), []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    setTasks((prev) => {
      const oldIdx = prev.findIndex((t) => t.id === active.id);
      const newIdx = prev.findIndex((t) => t.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      const reordered = arrayMove(prev, oldIdx, newIdx);
      const newSortOrder = computeMidpointSortOrder(
        reordered[newIdx - 1]?.sortOrder,
        reordered[newIdx + 1]?.sortOrder,
      );
      updateTask({ id: active.id as string, sortOrder: newSortOrder });
      return reordered.map((t) =>
        t.id === active.id ? { ...t, sortOrder: newSortOrder } : t
      );
    });
  }, []);

  useEffect(() => {
    if (isTitleEditing) {
      titleEscapeRef.current = false;
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isTitleEditing]);

  const commitListTitle = useCallback(
    async (value: string) => {
      const trimmed = value.trim() || localTitle;
      setLocalTitle(trimmed);
      setIsTitleEditing(false);
      await updateTaskList({ id: taskListId, title: trimmed });
    },
    [taskListId, localTitle]
  );

  const activeTasks = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const doneTasks = tasks.filter((t) => t.status === "done");
  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  const sharedRowProps = {
    focusId,
    onClearFocus: clearFocus,
    onToggleDone: handleToggleDone,
    onCommitTitle: handleCommitTitle,
    onEnterKey: handleEnterKey,
    onDelete: handleDelete,
    onAddSubtask: handleAddTask,
    onPatchTask: handlePatchTask,
  };

  if (loading) {
    return <div className="p-6 text-xs text-muted-foreground/50">Loading…</div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        {isTitleEditing ? (
          <input
            ref={titleInputRef}
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); titleEscapeRef.current = true; commitListTitle(localTitle); }
              if (e.key === "Escape") { e.preventDefault(); titleEscapeRef.current = true; setLocalTitle(title); setIsTitleEditing(false); }
            }}
            onBlur={() => { if (!titleEscapeRef.current) commitListTitle(localTitle); titleEscapeRef.current = false; }}
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-base font-semibold text-foreground"
          />
        ) : (
          <span className="text-base font-semibold text-foreground cursor-text" onClick={() => setIsTitleEditing(true)}>
            {localTitle}
          </span>
        )}
        <button
          onClick={() => handleAddTask(null)}
          className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0 text-xs cursor-pointer"
        >
          <Plus size={14} />
          Add task
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-2">
        {tasks.length === 0 ? (
          <div className="px-4 py-4 text-xs text-muted-foreground/50">
            No tasks yet.{" "}
            <button onClick={() => handleAddTask(null)} className="text-primary hover:underline cursor-pointer">
              Add one
            </button>
          </div>
        ) : (
          <>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={activeTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {activeTasks.map((task) => (
                  <TaskRow key={task.id} task={task} depth={0} isDraggable {...sharedRowProps} />
                ))}
              </SortableContext>
              <DragOverlay dropAnimation={null}>
                {activeTask && (
                  <div className="flex items-center gap-1.5 py-[3px] px-4 rounded-md bg-accent/80 shadow-lg text-sm opacity-90">
                    {activeTask.title || "Untitled"}
                  </div>
                )}
              </DragOverlay>
            </DndContext>
            {doneTasks.length > 0 && (
              <CompletedSection tasks={doneTasks} sharedRowProps={sharedRowProps} />
            )}
          </>
        )}
        <button
          onClick={() => handleAddTask(null)}
          className="flex items-center gap-2 w-full px-4 py-2 mt-1 text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors rounded-md hover:bg-accent/40 cursor-pointer"
        >
          <Plus size={11} />
          Add a task
        </button>
      </div>
    </div>
  );
}

// ── CompletedSection ──────────────────────────────────────────────────────────

function CompletedSection({
  tasks,
  sharedRowProps,
}: {
  tasks: Task[];
  sharedRowProps: Omit<TaskRowProps, "task" | "depth">;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-4 py-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors w-full cursor-pointer"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        Completed ({tasks.length})
      </button>
      {open && tasks.map((task) => (
        <TaskRow key={task.id} task={task} depth={0} {...sharedRowProps} />
      ))}
    </div>
  );
}

// ── TaskRow ───────────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: Task;
  depth: number;
  isDraggable?: boolean;
  focusId: string | null;
  onClearFocus: () => void;
  onToggleDone: (task: Task) => void;
  onCommitTitle: (taskId: string, title: string) => Promise<void>;
  onEnterKey: (task: Task, editedTitle: string) => Promise<void>;
  onDelete: (taskId: string) => void;
  onAddSubtask: (parentId: string) => void;
  onPatchTask: (taskId: string, patch: Partial<Task>) => Promise<void>;
}

function TaskRow({
  task,
  depth,
  isDraggable = false,
  focusId,
  onClearFocus,
  onToggleDone,
  onCommitTitle,
  onEnterKey,
  onDelete,
  onAddSubtask,
  onPatchTask,
}: TaskRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);
  const [childrenExpanded, setChildrenExpanded] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const suppressBlurRef = useRef(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, disabled: !isDraggable });

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const hasChildren = (task.children?.length ?? 0) > 0;
  const isDone = task.status === "done";

  useEffect(() => {
    if (focusId === task.id) {
      setEditValue(task.title);
      setIsEditing(true);
      onClearFocus();
    }
  }, [focusId, task.id, task.title, onClearFocus]);

  useEffect(() => {
    if (isEditing) {
      suppressBlurRef.current = false;
      inputRef.current?.focus();
      if (task.title) inputRef.current?.select();
    }
  }, [isEditing, task.title]);

  const handleBlur = () => {
    if (suppressBlurRef.current) { suppressBlurRef.current = false; return; }
    setIsEditing(false);
    onCommitTitle(task.id, editValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault(); suppressBlurRef.current = true; setIsEditing(false); onEnterKey(task, editValue);
    }
    if (e.key === "Escape") {
      e.preventDefault(); suppressBlurRef.current = true; setIsEditing(false); if (!task.title) onDelete(task.id);
    }
    if (e.key === "Backspace" && editValue === "") {
      e.preventDefault(); suppressBlurRef.current = true; setIsEditing(false); onDelete(task.id);
    }
  };

  const sharedChildProps = { focusId, onClearFocus, onToggleDone, onCommitTitle, onEnterKey, onDelete, onAddSubtask, onPatchTask };

  return (
    <div ref={setNodeRef} style={dragStyle}>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <div
            ref={rowRef}
            className="group flex items-center gap-1.5 py-[3px] rounded-md hover:bg-accent/40 transition-colors cursor-default"
            style={{ paddingLeft: `${16 + depth * 20}px`, paddingRight: "8px" }}
          >
            {isDraggable && (
              <span
                {...attributes}
                {...listeners}
                style={{ touchAction: "none" }}
                className="shrink-0 w-3 flex items-center justify-center text-muted-foreground/20 hover:text-muted-foreground/50 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <GripVertical size={11} />
              </span>
            )}
            <span
              className={cn(
                "shrink-0 w-3.5 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground/70 cursor-pointer transition-colors",
                !hasChildren && "invisible pointer-events-none"
              )}
              onClick={() => setChildrenExpanded((e) => !e)}
            >
              {childrenExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </span>

            <button
              className="shrink-0 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
              onClick={() => onToggleDone(task)}
            >
              {isDone ? <CheckCircle2 size={15} className="text-primary" /> : <Circle size={15} />}
            </button>

            {isEditing ? (
              <input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                className={cn(
                  "flex-1 min-w-0 bg-transparent border-none outline-none text-sm py-1",
                  isDone && "line-through text-muted-foreground"
                )}
              />
            ) : (
              <div
                className="flex-1 min-w-0 py-1 cursor-pointer"
                onClick={() => setDetailOpen(true)}
              >
                <span
                  className={cn(
                    "block text-sm truncate select-none hover:underline underline-offset-2",
                    isDone ? "line-through text-muted-foreground/60" : "text-foreground",
                    !task.title && "text-muted-foreground/40 italic"
                  )}
                >
                  {task.title || "Untitled"}
                </span>
                {task.notes && (
                  <span className="block text-[11px] text-muted-foreground/45 truncate leading-snug mt-0.5 select-none">
                    {task.notes}
                  </span>
                )}
              </div>
            )}
          </div>
        </ContextMenu.Trigger>

        <ContextMenu.Portal>
          <ContextMenu.Content className="z-50 min-w-36 rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-2xl text-xs">
            <ContextMenu.Item
              onSelect={() => setDetailOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 cursor-pointer outline-none hover:bg-accent focus:bg-accent"
            >
              Details
            </ContextMenu.Item>
            <ContextMenu.Separator className="h-px bg-border my-1 mx-1" />
            <ContextMenu.Item
              onSelect={() => onAddSubtask(task.id)}
              className="flex items-center gap-2 px-3 py-1.5 cursor-pointer outline-none hover:bg-accent focus:bg-accent"
            >
              <Plus size={12} className="text-muted-foreground" />
              Add Subtask
            </ContextMenu.Item>
            <ContextMenu.Separator className="h-px bg-border my-1 mx-1" />
            <ContextMenu.Item
              onSelect={() => onDelete(task.id)}
              className="flex items-center px-3 py-1.5 cursor-pointer outline-none hover:bg-red-500/15 focus:bg-red-500/15 text-red-400"
            >
              Delete
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      {detailOpen && (
        <TaskDetailPanel
          task={task}
          anchorRef={rowRef}
          onClose={() => setDetailOpen(false)}
          onPatchTask={onPatchTask}
        />
      )}

      {childrenExpanded && hasChildren && (
        <div>
          {task.children!.map((child) => (
            <TaskRow key={child.id} task={child} depth={depth + 1} {...sharedChildProps} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── TaskDetailPanel ───────────────────────────────────────────────────────────

function TaskDetailPanel({
  task,
  anchorRef,
  onClose,
  onPatchTask,
}: {
  task: Task;
  anchorRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onPatchTask: (taskId: string, patch: Partial<Task>) => Promise<void>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const panelWidth = 288;
    const margin = 16;
    const left = Math.min(rect.right + margin, window.innerWidth - panelWidth - margin);
    const top = Math.min(rect.top, window.innerHeight - 320);
    setPos({ top: Math.max(margin, top), left });
  }, [anchorRef]);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", handlePointerDown);
      document.addEventListener("keydown", handleKeyDown);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, anchorRef]);

  if (!pos) return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{ position: "fixed", top: pos.top, left: pos.left, width: 288 }}
      className="z-50 rounded-xl border border-border bg-card shadow-xl p-4"
    >
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-pointer"
        aria-label="Close"
      >
        <X size={14} />
      </button>
      <TaskDetailContent task={task} onPatchTask={onPatchTask} />
    </div>,
    document.body
  );
}

// ── TaskDetailContent ─────────────────────────────────────────────────────────

function TaskDetailContent({
  task,
  onPatchTask,
}: {
  task: Task;
  onPatchTask: (taskId: string, patch: Partial<Task>) => Promise<void>;
}) {
  const [titleValue, setTitleValue] = useState(task.title);
  const [notesValue, setNotesValue] = useState(task.notes ?? "");
  const [dueDateValue, setDueDateValue] = useState(task.dueDate ?? "");
  const [dueTimeValue, setDueTimeValue] = useState(task.dueTime ?? "");

  return (
    <div className="flex flex-col gap-3">
      {/* Title */}
      <input
        value={titleValue}
        onChange={(e) => setTitleValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        onBlur={() => {
          const trimmed = titleValue.trim();
          if (trimmed && trimmed !== task.title) onPatchTask(task.id, { title: trimmed });
        }}
        className="w-full bg-transparent text-sm font-semibold text-foreground outline-none border-none placeholder:text-muted-foreground/30"
        placeholder="Task title"
      />

      <div className="h-px bg-border/60" />

      {/* Date and time */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-widest mb-1">
            Date
          </p>
          <input
            type="date"
            value={dueDateValue}
            onChange={(e) => {
              setDueDateValue(e.target.value);
              onPatchTask(task.id, { dueDate: e.target.value || null });
            }}
            style={{ colorScheme: "dark" }}
            className="w-full bg-muted/40 rounded-md px-2 py-1.5 text-xs text-foreground outline-none border border-border/50 focus:border-border transition-colors cursor-pointer"
          />
        </div>
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-widest mb-1">
            Time
          </p>
          <input
            type="time"
            value={dueTimeValue}
            onChange={(e) => {
              setDueTimeValue(e.target.value);
              onPatchTask(task.id, { dueTime: e.target.value || null });
            }}
            style={{ colorScheme: "dark" }}
            className="w-full bg-muted/40 rounded-md px-2 py-1.5 text-xs text-foreground outline-none border border-border/50 focus:border-border transition-colors cursor-pointer"
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-widest mb-1">
          Notes
        </p>
        <textarea
          value={notesValue}
          onChange={(e) => setNotesValue(e.target.value)}
          onBlur={() => {
            if (notesValue !== (task.notes ?? "")) onPatchTask(task.id, { notes: notesValue });
          }}
          placeholder="Add notes…"
          rows={2}
          className="w-full bg-muted/40 rounded-lg px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/30 outline-none border border-border/50 focus:border-border resize-none transition-colors leading-relaxed"
        />
      </div>
    </div>
  );
}
