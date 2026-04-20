import { useUiStore } from "@/store";
import { Dashboard } from "@/pages/Dashboard";
import { FolderView } from "@/components/notes/FolderView";
import { TaskListView } from "@/components/tasks/TaskListView";

export function MainPanel() {
  const { activeView } = useUiStore();

  return (
    <main className="flex-1 overflow-hidden bg-background">
      {activeView.type === "dashboard" && <Dashboard />}
      {activeView.type === "folder" && (
        <FolderView key={activeView.folderId} folderId={activeView.folderId} />
      )}
      {activeView.type === "note" && (
        <div className="p-6 text-muted-foreground">Note editor coming soon</div>
      )}
      {activeView.type === "tasklist" && (
        <TaskListView
          key={activeView.taskListId}
          taskListId={activeView.taskListId}
          title={activeView.title}
        />
      )}
      {activeView.type === "calendar" && (
        <div className="p-6 text-muted-foreground">Calendar coming soon</div>
      )}
      {activeView.type === "overview" && (
        <div className="p-6 text-muted-foreground">Overview map coming soon</div>
      )}
      {activeView.type === "settings" && (
        <div className="p-6 text-muted-foreground">Settings coming soon</div>
      )}
    </main>
  );
}
