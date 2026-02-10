import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, GripVertical, Github } from "lucide-react";
import { format } from "date-fns";

interface Task {
  id: number;
  title: string;
  description: string | null;
  assigneeId: number | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "todo" | "in_progress" | "review" | "done";
  dueDate: Date | null;
  githubPrUrl: string | null;
  teamId: number;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  assigneeName?: string;
}

const priorityColors = {
  low: "bg-gray-100 text-gray-700 border-gray-300",
  medium: "bg-blue-100 text-blue-700 border-blue-300",
  high: "bg-orange-100 text-orange-700 border-orange-300",
  urgent: "bg-red-100 text-red-700 border-red-300",
};

export function TaskCard({ task, onClick, assigneeName }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getInitials = (name?: string) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow mb-2"
        onClick={onClick}
      >
        <CardHeader className="p-3 pb-2">
          <div className="flex items-start gap-2">
            <button
              className="cursor-grab active:cursor-grabbing mt-1"
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-4 w-4 text-gray-400" />
            </button>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm line-clamp-2">{task.title}</h4>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-2">
          {task.description && (
            <p className="text-xs text-gray-600 line-clamp-2">
              {task.description}
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={`text-xs ${priorityColors[task.priority]}`}
            >
              {task.priority}
            </Badge>

            {task.githubPrUrl && (
              <Badge variant="outline" className="text-xs">
                <Github className="h-3 w-3 mr-1" />
                PR
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between">
            {task.dueDate && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Calendar className="h-3 w-3" />
                <span>{format(new Date(task.dueDate), "MMM d")}</span>
              </div>
            )}

            {assigneeName && (
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">
                  {getInitials(assigneeName)}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
