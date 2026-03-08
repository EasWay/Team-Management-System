import { useState, useEffect, useCallback, useRef } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TaskCard, type Task } from "./TaskCard";
import { TaskDetailModal } from "./TaskDetailModal";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { useSocket, useSocketEvent } from "@/contexts/SocketContext";
import { MoreHorizontal, Users } from "lucide-react";



interface KanbanBoardProps {
  teamId: number;
  searchQuery?: string;
  assigneeFilter?: number;
  priorityFilter?: string;
}

const columns = [
  { id: "todo", title: "To Do", status: "todo" as const, color: "bg-slate-500", shadow: "shadow-[0_0_8px_rgba(148,163,184,0.4)]" },
  { id: "in_progress", title: "In Progress", status: "in_progress" as const, color: "bg-primary", shadow: "shadow-[0_0_8px_rgba(99,102,241,0.8)]" },
  { id: "review", title: "Review", status: "review" as const, color: "bg-purple-400", shadow: "shadow-[0_0_8px_rgba(192,132,252,0.4)]" },
  { id: "done", title: "Done", status: "done" as const, color: "bg-emerald-500", shadow: "shadow-[0_0_8px_rgba(16,185,129,0.4)]" },
];

export function KanbanBoard({
  teamId,
  searchQuery = "",
  assigneeFilter,
  priorityFilter,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeUsers, setActiveUsers] = useState<Set<number>>(new Set());
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<number, Task>>(new Map());
  const [conflictingTasks, setConflictingTasks] = useState<Set<number>>(new Set());
  const pendingOperationsRef = useRef<Map<number, AbortController>>(new Map());
  const lastUpdateTimestampRef = useRef<Map<number, number>>(new Map());

  const { data: tasksData, isLoading } = trpc.tasks.list.useQuery({
    teamId,
    assignedTo: assigneeFilter,
    priority: priorityFilter,
  });

  const { data: membersData } = trpc.teams.getMembers.useQuery({ teamId });
  const moveMutation = trpc.tasks.move.useMutation();
  const utils = trpc.useUtils();
  const { isConnected, joinTeam, leaveTeam } = useSocket();

  const tasks = tasksData as Task[] | undefined;
  const members = membersData as Array<{
    id: number;
    teamId: number;
    memberId: number;
    role: string;
    joinedAt: Date;
    member: {
      id: number;
      name: string | null;
      email: string | null;
      pictureFileName?: string | null;
    };
  }> | undefined;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    if (isConnected && teamId) {
      joinTeam(teamId);
    }
    return () => {
      if (teamId) {
        leaveTeam(teamId);
      }
    };
  }, [teamId, isConnected, joinTeam, leaveTeam]);

  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const staleThreshold = 10000;
      optimisticUpdates.forEach((_, taskId) => {
        const lastUpdate = lastUpdateTimestampRef.current.get(taskId) || 0;
        if (now - lastUpdate > staleThreshold) {
          setOptimisticUpdates((prev) => {
            const next = new Map(prev);
            next.delete(taskId);
            return next;
          });
          pendingOperationsRef.current.delete(taskId);
        }
      });
    }, 5000);
    return () => clearInterval(cleanupInterval);
  }, [optimisticUpdates]);

  const handleUserJoined = useCallback((data: { userId: number; username: string; teamId: number }) => {
    if (data.teamId === teamId) {
      setActiveUsers((prev) => new Set(prev).add(data.userId));
    }
  }, [teamId]);

  const handleUserLeft = useCallback((data: { userId: number; teamId: number }) => {
    if (data.teamId === teamId) {
      setActiveUsers((prev) => {
        const next = new Set(prev);
        next.delete(data.userId);
        return next;
      });
    }
  }, [teamId]);

  const handleTaskCreated = useCallback((task: Task) => {
    if (task.teamId === teamId) {
      utils.tasks.list.invalidate({ teamId });
      toast.info(`New task created: ${task.title}`);
    }
  }, [teamId, utils]);

  const handleTaskUpdated = useCallback((task: Task) => {
    if (task.teamId === teamId) {
      const pendingOp = pendingOperationsRef.current.get(task.id);
      if (pendingOp) {
        setOptimisticUpdates((prev) => {
          const next = new Map(prev);
          next.delete(task.id);
          return next;
        });
        pendingOperationsRef.current.delete(task.id);
        lastUpdateTimestampRef.current.set(task.id, Date.now());
      } else {
        const lastUpdate = lastUpdateTimestampRef.current.get(task.id) || 0;
        const timeSinceLastUpdate = Date.now() - lastUpdate;
        if (timeSinceLastUpdate < 2000 && lastUpdate > 0) {
          setConflictingTasks((prev) => new Set(prev).add(task.id));
          toast.warning(`Task "${task.title}" was updated by another user`);
          setTimeout(() => {
            setConflictingTasks((prev) => {
              const next = new Set(prev);
              next.delete(task.id);
              return next;
            });
          }, 3000);
        }
        lastUpdateTimestampRef.current.set(task.id, Date.now());
      }
      utils.tasks.list.invalidate({ teamId });
      if (selectedTask?.id === task.id) {
        setSelectedTask(task);
      }
    }
  }, [teamId, utils, selectedTask]);

  const handleTaskMoved = useCallback((data: { taskId: number; newStatus: string; newPosition: number }) => {
    const pendingOp = pendingOperationsRef.current.get(data.taskId);
    if (pendingOp) {
      setOptimisticUpdates((prev) => {
        const next = new Map(prev);
        next.delete(data.taskId);
        return next;
      });
      pendingOperationsRef.current.delete(data.taskId);
      lastUpdateTimestampRef.current.set(data.taskId, Date.now());
    } else {
      const movedTask = tasks?.find((t) => t.id === data.taskId);
      if (movedTask) {
        const lastUpdate = lastUpdateTimestampRef.current.get(data.taskId) || 0;
        const timeSinceLastUpdate = Date.now() - lastUpdate;
        if (timeSinceLastUpdate < 2000 && lastUpdate > 0) {
          setConflictingTasks((prev) => new Set(prev).add(data.taskId));
          toast.warning(`Task "${movedTask.title}" was moved by another user`);
          setTimeout(() => {
            setConflictingTasks((prev) => {
              const next = new Set(prev);
              next.delete(data.taskId);
              return next;
            });
          }, 3000);
        }
        lastUpdateTimestampRef.current.set(data.taskId, Date.now());
      }
    }
    utils.tasks.list.invalidate({ teamId });
  }, [teamId, utils, tasks]);

  const handleTaskDeleted = useCallback((data: { taskId: number }) => {
    utils.tasks.list.invalidate({ teamId });
    if (selectedTask?.id === data.taskId) {
      setSelectedTask(null);
    }
  }, [teamId, utils, selectedTask]);

  useSocketEvent('userJoined', handleUserJoined);
  useSocketEvent('userLeft', handleUserLeft);
  useSocketEvent('taskCreated', handleTaskCreated);
  useSocketEvent('taskUpdated', handleTaskUpdated);
  useSocketEvent('taskMoved', handleTaskMoved);
  useSocketEvent('taskDeleted', handleTaskDeleted);

  const mergedTasks = tasks?.map((task) => {
    const optimisticUpdate = optimisticUpdates.get(task.id);
    return optimisticUpdate || task;
  });

  const filteredTasks = mergedTasks?.filter((task) => {
    const matchesSearch =
      !searchQuery ||
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const tasksByStatus = columns.reduce((acc, column) => {
    acc[column.status] = filteredTasks?.filter(
      (task) => task.status === column.status
    ).sort((a, b) => (a.position || 0) - (b.position || 0)) || [];
    return acc;
  }, {} as Record<string, Task[]>);

  const handleDragStart = (event: DragStartEvent) => {
    const task = filteredTasks?.find((t) => t.id === event.active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as number;
    const overId = over.id;

    let newStatus: Task["status"] | null = null;
    let newPosition = 0;

    const column = columns.find((col) => col.id === overId);
    if (column) {
      newStatus = column.status;
      newPosition = tasksByStatus[newStatus]?.length || 0;
    } else {
      const overTask = filteredTasks?.find((t: Task) => t.id === overId);
      if (overTask) {
        newStatus = overTask.status;
        const targetTasks = tasksByStatus[newStatus!] || [];
        const index = targetTasks.findIndex((t: Task) => t.id === overId);
        // Place below the dragged-over task
        newPosition = index !== -1 ? index + 1 : targetTasks.length;
      }
    }

    if (!newStatus) return;

    const task = filteredTasks?.find((t) => t.id === taskId);
    if (!task) return;

    if (pendingOperationsRef.current.has(taskId)) {
      toast.warning('This task is already being moved. Please wait.');
      return;
    }

    const abortController = new AbortController();
    pendingOperationsRef.current.set(taskId, abortController);

    try {
      const optimisticTask: Task = { ...task, status: newStatus, position: newPosition };
      setOptimisticUpdates((prev) => new Map(prev).set(taskId, optimisticTask));

      utils.tasks.list.setData({ teamId }, (old) => {
        if (!old) return old;
        return (old as Task[]).map((t) =>
          t.id === taskId ? optimisticTask : t
        );
      });

      await moveMutation.mutateAsync({
        id: taskId,
        status: newStatus as "todo" | "in_progress" | "review" | "done",
      });

      setOptimisticUpdates((prev) => {
        const next = new Map(prev);
        next.delete(taskId);
        return next;
      });
      pendingOperationsRef.current.delete(taskId);
      lastUpdateTimestampRef.current.set(taskId, Date.now());
    } catch (error) {
      setOptimisticUpdates((prev) => {
        const next = new Map(prev);
        next.delete(taskId);
        return next;
      });
      pendingOperationsRef.current.delete(taskId);
      utils.tasks.list.invalidate({ teamId });

      const errorMessage = error instanceof Error ? error.message : "Failed to move task";
      toast.error(`${errorMessage}. Changes have been reverted.`);
    }
  };

  const getAssigneeName = (assignedTo: number | null) => {
    if (!assignedTo) return undefined;
    const member = members?.find((m) => m.memberId === assignedTo);
    return member?.member?.name || member?.member?.email || `User ${assignedTo}`;
  };

  const getAssigneePicture = (assignedTo: number | null) => {
    const member = members?.find((m) => m.memberId === assignedTo);
    return member?.member?.pictureFileName;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-foreground/5 border border-border text-xs font-medium text-muted-foreground">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-accent-success shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-muted-foreground/40'}`} />
            {isConnected ? 'Socket Connected' : 'Offline'}
          </div>
          {activeUsers.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-foreground/5 border border-border text-xs font-medium text-muted-foreground">
              <Users className="size-3.5" />
              {activeUsers.size} active {activeUsers.size === 1 ? 'user' : 'users'}
            </div>
          )}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="inline-flex h-full gap-4 min-w-full px-1">
          {columns.map((column) => {
            const columnTasks = tasksByStatus[column.status];
            const taskIds = columnTasks.map((task) => task.id);

            return (
              <div key={column.id} className="w-[300px] flex flex-col shrink-0 h-full rounded-2xl glass-panel border-none bg-transparent">
                {/* Column Header */}
                <div className={`p-4 flex items-center justify-between sticky top-0 backdrop-blur-xl z-20 rounded-t-2xl border-b ${column.id === 'in_progress' ? 'border-primary/20 bg-primary/5' : 'border-border/50 bg-background/60'}`}>
                  <div className="flex items-center gap-3">
                    {column.id === 'in_progress' ? (
                      <div className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${column.color} ${column.shadow}`}></span>
                      </div>
                    ) : (
                      <div className={`size-2 rounded-full ${column.color} ${column.shadow}`}></div>
                    )}
                    <h3 className="font-display font-semibold text-foreground tracking-wide">{column.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full ${column.id === 'in_progress' ? 'bg-primary/20 text-primary' : 'bg-foreground/5 text-muted-foreground'} text-[10px] font-mono`}>
                      {columnTasks.length}
                    </span>
                  </div>
                  <button className="text-muted-foreground hover:text-foreground transition-colors">
                    <MoreHorizontal className="size-4" />
                  </button>
                </div>

                {/* Cards List */}
                <div className={`flex-1 p-3 flex flex-col gap-3 overflow-y-auto kanban-scroll ${column.id === 'done' ? 'opacity-60 hover:opacity-100 transition-opacity duration-300' : ''}`}>
                  <SortableContext
                    items={taskIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {columnTasks.map((task) => {
                      const isConflicting = conflictingTasks.has(task.id);
                      const isOptimistic = optimisticUpdates.has(task.id);

                      return (
                        <div key={task.id} className="relative group">
                          {isConflicting && (
                            <div className="absolute -top-2 -right-2 z-10 px-2 py-0.5 bg-accent-alert text-white text-[10px] rounded">
                              Conflict
                            </div>
                          )}
                          {isOptimistic && (
                            <div className="absolute -top-2 -right-2 z-10 px-2 py-0.5 bg-primary/70 text-white text-[10px] rounded">
                              Saving
                            </div>
                          )}
                          <TaskCard
                            task={task}
                            onClick={() => setSelectedTask(task)}
                            assigneeName={getAssigneeName(task.assignedTo)}
                            isDone={column.id === 'done'}
                            isInProgress={column.id === 'in_progress'}
                          />
                        </div>
                      );
                    })}
                  </SortableContext>
                </div>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="card-dragged">
              <TaskCard
                task={activeTask}
                onClick={() => { }}
                assigneeName={getAssigneeName(activeTask.assignedTo)}
                isOverlay
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          open={!!selectedTask}
          onOpenChange={(open) => !open && setSelectedTask(null)}
          onTaskUpdated={() => {
            utils.tasks.list.invalidate({ teamId });
            const updatedTask = mergedTasks?.find((t) => t.id === selectedTask.id);
            if (updatedTask) {
              setSelectedTask(updatedTask);
            }
          }}
        />
      )}
    </>
  );
}
