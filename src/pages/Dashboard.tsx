import { Calendar, CheckSquare, FileText, Clock } from "lucide-react";
import { format } from "date-fns";

export function Dashboard() {
  const today = new Date();

  return (
    <div className="h-full overflow-y-auto selectable">
      <div className="max-w-3xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <p className="text-sm text-muted-foreground">
            {format(today, "EEEE, MMMM d")}
          </p>
          <h1 className="text-2xl font-semibold mt-1">Good morning</h1>
        </div>

        {/* Widget grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <DashboardCard
            title="Today's Tasks"
            icon={<CheckSquare size={16} />}
            count={0}
            emptyMessage="Nothing due today"
          />
          <DashboardCard
            title="Upcoming Events"
            icon={<Calendar size={16} />}
            count={0}
            emptyMessage="No events this week"
          />
          <DashboardCard
            title="Recent Notes"
            icon={<FileText size={16} />}
            count={0}
            emptyMessage="No notes yet"
          />
          <DashboardCard
            title="Quick Capture Inbox"
            icon={<Clock size={16} />}
            count={0}
            emptyMessage="Inbox is clear"
          />
        </div>
      </div>
    </div>
  );
}

function DashboardCard({
  title,
  icon,
  count,
  emptyMessage,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  emptyMessage: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-sm font-medium">{title}</h2>
        {count > 0 && (
          <span className="ml-auto text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">
            {count}
          </span>
        )}
      </div>
      {count === 0 && (
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      )}
    </div>
  );
}
