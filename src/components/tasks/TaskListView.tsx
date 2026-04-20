import { useState, useEffect, useCallback, useRef } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { Plus, Circle, CheckCircle2, ChevronRight, ChevronDown } from "lucide-react";
import { getTasksForList, createTask, updateTask, deleteTask } from "@/lib/tauri";
import type { Task } from "@/types";
import { cn } from "@/lib/utils";

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
        const sibling = await createTask({
          taskListId,
          title: "",
          parentTaskId: task.parentTaskId,
        });
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

  const clearFocus = useCallback(() => setFocusId(null), []);

  const activeTasks = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const doneTasks = tasks.filter((t) => t.status === "done");

  const sharedRowProps = {
    focusId,
    onClearFocus: clearFocus,
    onToggleDone: handleToggleDone,
    onCommitTitle: handleCommitTitle,
    onEnterKey: handleEnterKey,
    onDelete: handleDelete,
    onAddSubtask: handleAddTask,
  };

  if (loading) {
    return <div className="p-6 text-xs text-muted-foreground/50">Loading…</div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <span className="text-base font-semibold text-foreground">{title}</span>
        <button
          onClick={() => handleAddTask(null)}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="New task"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-2">
        {tasks.length === 0 ? (
          <div className="px-4 py-4 text-xs text-muted-foreground/50">
            No tasks yet.{" "}
            <button onClick={() => handleAddTask(null)} className="text-primary hover:underline">
              Add one
            </button>
          </div>
        ) : (
          <>
            {activeTasks.map((task) => (
              <TaskRow key={task.id} task={task} depth={0} {...sharedRowProps} />
            ))}

            {doneTasks.length > 0 && (
              <CompletedSection tasks={doneTasks} sharedRowProps={sharedRowProps} />
            )}
          </>
        )}

        <button
          onClick={() => handleAddTask(null)}
          className="flex items-center gap-2 w-full px-4 py-2 mt-1 text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors rounded-md hover:bg-accent/40"
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
        className="flex items-center gap-1.5 px-4 py-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors w-full"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        Completed ({tasks.length})
      </button>
      {open &&
        tasks.map((task) => (
          <TaskRow key={task.id} task={task} depth={0} {...sharedRowProps} />
        ))}
    </div>
  );
}

// ── TaskRow ───────────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: Task;
  depth: number;
  focusId: string | null;
  onClearFocus: () => void;
  onToggleDone: (task: Task) => void;
  onCommitTitle: (taskId: string, title: string) => Promise<void>;
  onEnterKey: (task: Task, editedTitle: string) => Promise<void>;
  onDelete: (taskId: string) => void;
  onAddSubtask: (parentId: string) => void;
}

function TaskRow({
  task,
  depth,
  focusId,
  onClearFocus,
  onToggleDone,
  onCommitTitle,
  onEnterKey,
  onDelete,
  onAddSubtask,
}: TaskRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);
  const [expanded, setExpanded] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const suppressBlurRef = useRef(false);

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

  const startEdit = () => {
    if (!isEditing) {
      setEditValue(task.title);
      setIsEditing(true);
    }
  };

  const handleBlur = () => {
    if (suppressBlurRef.current) {
      suppressBlurRef.current = false;
      return;
    }
    setIsEditing(false);
    onCommitTitle(task.id, editValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      suppressBlurRef.current = true;
      setIsEditing(false);
      onEnterKey(task, editValue);
    }
    if (e.key === "Escape") {
      e.preventDefault();
      suppressBlurRef.current = true;
      setIsEditing(false);
      if (!task.title) {
        onDelete(task.id);
      }
    }
    if (e.key === "Backspace" && editValue === "") {
      e.preventDefault();
      suppressBlurRef.current = true;
      setIsEditing(false);
      onDelete(task.id);
    }
  };

  const sharedChildProps = {
    focusId,
    onClearFocus,
    onToggleDone,
    onCommitTitle,
    onEnterKey,
    onDelete,
    onAddSubtask,
  };

  return (
    <div>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <div
            className="group flex items-center gap-1.5 py-[3px] rounded-md hover:bg-accent/40 transition-colors cursor-default"
            style={{ paddingLeft: `${16 + depth * 20}px`, paddingRight: "8px" }}
          >
            <span
              className={cn(
                "shrink-0 w-3.5 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground/70 cursor-pointer transition-colors",
                !hasChildren && "invisible pointer-events-none"
              )}
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </span>

            <button
              className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
              onClick={() => onToggleDone(task)}
            >
              {isDone ? (
                <CheckCircle2 size={15} className="text-primary" />
              ) : (
                <Circle size={15} />
              )}
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
              <span
                className={cn(
                  "flex-1 min-w-0 text-sm py-1 truncate cursor-text select-none",
                  isDone ? "line-through text-muted-foreground/60" : "text-foreground",
                  !task.title && "text-muted-foreground/40 italic"
                )}
                onClick={startEdit}
                onDoubleClick={startEdit}
              >
                {task.title || "Untitled"}
              </span>
            )}
          </div>
        </ContextMenu.Trigger>

        <ContextMenu.Portal>
          <ContextMenu.Content className="z-50 min-w-36 rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-2xl text-xs">
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

      {expanded && hasChildren && (
        <div>
          {task.children!.map((child) => (
            <TaskRow key={child.id} task={child} depth={depth + 1} {...sharedChildProps} />
          ))}
        </div>
      )}
    </div>
  );
}
