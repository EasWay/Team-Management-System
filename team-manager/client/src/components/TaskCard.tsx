import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Github, CheckCheck, MessageSquare, User } from "lucide-react";

interface Task {
  id: number;
  title: string;
  description: string | null;
  assignedTo: number | null;
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
  isDone?: boolean;
  isInProgress?: boolean;
  isOverlay?: boolean;
}

const priorityConfig = {
  low: { color: "bg-blue-500/10 text-blue-500 border-blue-500/20", label: "Low" },
  medium: { color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", label: "Medium" },
  high: { color: "bg-orange-500/10 text-orange-600 border-orange-500/20", label: "High" },
  urgent: { color: "bg-rose-500/10 text-rose-600 border-rose-500/20", label: "Urgent" },
};

export function TaskCard({ task, onClick, assigneeName, isDone, isInProgress, isOverlay }: TaskCardProps) {
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
    opacity: isDragging ? 0 : 1,
  };

  const init = (name?: string) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  // Base styles — use foreground/border semantic tokens
  let cardClass = "liquid-glass-card p-4 rounded-xl flex flex-col cursor-grab group transition-colors relative ";

  if (isOverlay) {
    cardClass += " w-full ";
  } else if (isDone) {
    cardClass += " opacity-50 hover:bg-foreground/[0.03] ";
  } else if (isInProgress) {
    cardClass += " border-foreground/20 bg-foreground/[0.04] hover:bg-foreground/[0.06] ";
  } else {
    cardClass += " hover:bg-foreground/[0.04] ";
  }

  const priorityStyle = priorityConfig[task.priority].color;
  const textDecoration = isDone ? "line-through decoration-foreground/20" : "";

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        className={cardClass}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        {/* Left accent stripe */}
        <div className="absolute top-0 left-0 w-1 h-full bg-foreground/15 rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>

        <div className="flex justify-between items-start mb-3 relative z-10">
          <div className="flex gap-2">
            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border border-border text-muted-foreground ${isDone ? 'opacity-50' : ''}`}>
              Task
            </span>
            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border ${priorityStyle} ${isDone ? 'opacity-50' : ''}`}>
              {priorityConfig[task.priority].label}
            </span>
          </div>
          <span className={`font-mono text-[10px] transition-colors ${isDone ? 'text-muted-foreground/40 ' + textDecoration : 'text-muted-foreground/60 group-hover:text-muted-foreground'}`}>
            GLS-{task.id}
          </span>
        </div>

        <h4 className={`text-[13px] font-medium mb-1.5 leading-snug relative z-10 ${isDone ? 'text-muted-foreground/50 ' + textDecoration : 'text-foreground/90'}`}>
          {task.title}
        </h4>

        {task.description && !isDone && (
          <p className="text-xs text-muted-foreground mb-4 line-clamp-2 relative z-10">
            {task.description}
          </p>
        )}

        <div className={`flex justify-between items-center pt-3 border-t ${isInProgress ? 'border-foreground/10' : 'border-border/50'} relative z-10 mt-auto`}>

          <div className={`flex items-center gap-2 text-xs transition-colors cursor-pointer ${isDone ? 'text-muted-foreground/40' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}>
            {isDone ? (
              <>
                <CheckCheck className="size-3.5" />
              </>
            ) : task.githubPrUrl ? (
              <a
                href={task.githubPrUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`flex items-center gap-2 ${isInProgress ? 'text-foreground/70 hover:text-foreground' : ''}`}
              >
                <Github className="w-3.5 h-3.5" />
                <span className="font-mono pt-0.5 text-[10px]">PR Link</span>
              </a>
            ) : (
              <>
                <MessageSquare className="size-3.5" />
                <span className="text-[10px] font-mono">{(task.description?.length || 0) % 5}</span>
              </>
            )}
          </div>

          {/* Assignee Avatar */}
          <div>
            {assigneeName ? (
              <div
                className={`size-6 rounded-full border flex items-center justify-center text-[9px] font-bold uppercase ${isInProgress ? 'border-foreground/40 bg-foreground/10 text-foreground' : isDone ? 'border-border/40 bg-foreground/5 text-muted-foreground/40' : 'border-border text-muted-foreground'}`}
                title={assigneeName}
              >
                {init(assigneeName)}
              </div>
            ) : (
              <div className={`size-6 rounded-full border border-dashed flex items-center justify-center ${isDone ? 'border-border/30 text-muted-foreground/20' : 'border-border text-muted-foreground/30'}`}>
                <User className="size-3" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
