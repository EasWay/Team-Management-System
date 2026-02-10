import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { Clock, User } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface TaskHistoryTimelineProps {
  taskId: number;
}

export function TaskHistoryTimeline({ taskId }: TaskHistoryTimelineProps) {
  const { data: history, isLoading } = trpc.tasks.getHistory.useQuery({
    id: taskId,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No history available for this task
      </div>
    );
  }

  const getActivityDescription = (activity: typeof history[0]) => {
    const metadata = activity.metadata
      ? JSON.parse(activity.metadata)
      : {};

    switch (activity.type) {
      case "task_created":
        return "created this task";
      case "task_updated":
        if (metadata.field) {
          return `updated ${metadata.field} to "${metadata.newValue}"`;
        }
        return "updated this task";
      case "task_moved":
        return `moved task to ${metadata.newStatus || "a different column"}`;
      case "task_assigned":
        return `assigned this task to ${metadata.assigneeName || "someone"}`;
      default:
        return activity.type.replace(/_/g, " ");
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm text-gray-700 mb-3">Activity History</h3>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

        {/* Timeline items */}
        <div className="space-y-4">
          {history.map((activity, index) => (
            <div key={activity.id} className="relative flex gap-3">
              {/* Timeline dot */}
              <div className="relative z-10 flex items-center justify-center w-8 h-8 bg-white border-2 border-blue-500 rounded-full">
                <Clock className="h-3 w-3 text-blue-500" />
              </div>

              {/* Content */}
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <User className="h-3 w-3 text-gray-400" />
                  <span className="text-sm font-medium">
                    User {activity.userId}
                  </span>
                  <span className="text-xs text-gray-500">
                    {getActivityDescription(activity)}
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  {format(new Date(activity.createdAt), "MMM d, yyyy 'at' h:mm a")}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
