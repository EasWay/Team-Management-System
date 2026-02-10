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
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { TaskCard } from "./TaskCard";
import { TaskDetailModal } from "./TaskDetailModal";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useSocket, useSocketEvent } from "@/contexts/SocketContext";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

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

interface KanbanBoardProps {
  teamId: number;
  searchQuery?: string;
  assigneeFilter?: number;
  priorityFilter?: string;
}

const columns = [
  { id: "todo", title: "To Do", status: "todo" as const },
  { id: "in_progress", title: "In Progress", status: "in_progress" as const },
  { id: "review", title: "Review", status: "review" as const },
  { id: "done", title: "Done", status: "done" as const },
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
    assigneeId: assigneeFilter,
    priority: priorityFilter,
  });

  const { data: membersData } = trpc.teams.getMembers.useQuery({ teamId });
  const moveMutation = trpc.tasks.move.useMutation();
  const utils = trpc.useUtils();
  const { isConnected, joinTeam, leaveTeam } = useSocket();

  // Type assertions to help TypeScript understand the correct types
  const tasks = tasksData as Task[] | undefined;
  const members = membersData as Array<{
    id: number;
    teamId: number;
    userId: number;
    role: string;
    joinedAt: Date;
    user: {
      id: number;
      name: string | null;
      email: string | null;
    };
  }> | undefined;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Join team room on mount and leave on unmount
  useEffect(() => {
    if (isConnected && teamId) {
      joinTeam(teamId);
      console.log(`[KanbanBoard] Joined team room: ${teamId}`);
    }

    return () => {
      if (teamId) {
        leaveTeam(teamId);
        console.log(`[KanbanBoard] Left team room: ${teamId}`);
      }
    };
  }, [teamId, isConnected, joinTeam, leaveTeam]);

  // Cleanup stale optimistic updates and pending operations
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const staleThreshold = 10000; // 10 seconds

      // Check for stale optimistic updates
      optimisticUpdates.forEach((_, taskId) => {
        const lastUpdate = lastUpdateTimestampRef.current.get(taskId) || 0;
        if (now - lastUpdate > staleThreshold) {
          console.warn(`[KanbanBoard] Clearing stale optimistic update for task ${taskId}`);
          setOptimisticUpdates((prev) => {
            const next = new Map(prev);
            next.delete(taskId);
            return next;
          });
          pendingOperationsRef.current.delete(taskId);
        }
      });
    }, 5000); // Check every 5 seconds

    return () => clearInterval(cleanupInterval);
  }, [optimisticUpdates]);

  // Handle user presence tracking
  const handleUserJoined = useCallback((data: { userId: number; username: string; teamId: number }) => {
    if (data.teamId === teamId) {
      setActiveUsers((prev) => new Set(prev).add(data.userId));
      console.log(`[KanbanBoard] User joined: ${data.username}`);
    }
  }, [teamId]);

  const handleUserLeft = useCallback((data: { userId: number; teamId: number }) => {
    if (data.teamId === teamId) {
      setActiveUsers((prev) => {
        const next = new Set(prev);
        next.delete(data.userId);
        return next;
      });
      console.log(`[KanbanBoard] User left: ${data.userId}`);
    }
  }, [teamId]);

  // Handle real-time task created event
  const handleTaskCreated = useCallback((task: Task) => {
    if (task.teamId === teamId) {
      console.log('[KanbanBoard] Task created event received:', task.id);
      utils.tasks.list.invalidate({ teamId });
      toast.info(`New task created: ${task.title}`);
    }
  }, [teamId, utils]);

  // Handle real-time task updated event
  const handleTaskUpdated = useCallback((task: Task) => {
    if (task.teamId === teamId) {
      console.log('[KanbanBoard] Task updated event received:', task.id);
      
      // Check if this is our own optimistic update
      const pendingOp = pendingOperationsRef.current.get(task.id);
      if (pendingOp) {
        // This is a confirmation of our own update, clear the optimistic state
        setOptimisticUpdates((prev) => {
          const next = new Map(prev);
          next.delete(task.id);
          return next;
        });
        pendingOperationsRef.current.delete(task.id);
        lastUpdateTimestampRef.current.set(task.id, Date.now());
      } else {
        // This is an update from another user
        const lastUpdate = lastUpdateTimestampRef.current.get(task.id) || 0;
        const timeSinceLastUpdate = Date.now() - lastUpdate;
        
        // Check for potential conflict (update within 2 seconds of our last update)
        if (timeSinceLastUpdate < 2000 && lastUpdate > 0) {
          setConflictingTasks((prev) => new Set(prev).add(task.id));
          toast.warning(`Task "${task.title}" was updated by another user`, {
            description: 'The task list will refresh to show the latest changes.',
          });
          
          // Clear conflict indicator after 3 seconds
          setTimeout(() => {
            setConflictingTasks((prev) => {
              const next = new Set(prev);
              next.delete(task.id);
              return next;
            });
          }, 3000);
        } else {
          toast.info(`Task updated: ${task.title}`);
        }
        
        lastUpdateTimestampRef.current.set(task.id, Date.now());
      }
      
      utils.tasks.list.invalidate({ teamId });
      
      // Update selected task if it's the one being viewed
      if (selectedTask?.id === task.id) {
        setSelectedTask(task);
      }
    }
  }, [teamId, utils, selectedTask]);

  // Handle real-time task moved event
  const handleTaskMoved = useCallback((data: { taskId: number; newStatus: string; newPosition: number }) => {
    console.log('[KanbanBoard] Task moved event received:', data);
    
    // Check if this is our own move operation
    const pendingOp = pendingOperationsRef.current.get(data.taskId);
    if (pendingOp) {
      // This is a confirmation of our own move, clear the optimistic state
      setOptimisticUpdates((prev) => {
        const next = new Map(prev);
        next.delete(data.taskId);
        return next;
      });
      pendingOperationsRef.current.delete(data.taskId);
      lastUpdateTimestampRef.current.set(data.taskId, Date.now());
    } else {
      // This is a move from another user
      const movedTask = tasks?.find((t) => t.id === data.taskId);
      if (movedTask) {
        const lastUpdate = lastUpdateTimestampRef.current.get(data.taskId) || 0;
        const timeSinceLastUpdate = Date.now() - lastUpdate;
        
        // Check for potential conflict
        if (timeSinceLastUpdate < 2000 && lastUpdate > 0) {
          setConflictingTasks((prev) => new Set(prev).add(data.taskId));
          toast.warning(`Task "${movedTask.title}" was moved by another user`, {
            description: 'Your changes may have been overwritten.',
          });
          
          // Clear conflict indicator after 3 seconds
          setTimeout(() => {
            setConflictingTasks((prev) => {
              const next = new Set(prev);
              next.delete(data.taskId);
              return next;
            });
          }, 3000);
        } else {
          toast.info(`Task moved: ${movedTask.title}`);
        }
        
        lastUpdateTimestampRef.current.set(data.taskId, Date.now());
      }
    }
    
    utils.tasks.list.invalidate({ teamId });
  }, [teamId, utils, tasks]);

  // Handle real-time task deleted event
  const handleTaskDeleted = useCallback((data: { taskId: number }) => {
    console.log('[KanbanBoard] Task deleted event received:', data.taskId);
    utils.tasks.list.invalidate({ teamId });
    
    // Close modal if the deleted task is currently selected
    if (selectedTask?.id === data.taskId) {
      setSelectedTask(null);
      toast.info('Task was deleted');
    } else {
      toast.info('A task was deleted');
    }
  }, [teamId, utils, selectedTask]);

  // Register Socket.io event listeners
  useSocketEvent('userJoined', handleUserJoined);
  useSocketEvent('userLeft', handleUserLeft);
  useSocketEvent('taskCreated', handleTaskCreated);
  useSocketEvent('taskUpdated', handleTaskUpdated);
  useSocketEvent('taskMoved', handleTaskMoved);
  useSocketEvent('taskDeleted', handleTaskDeleted);

  // Merge optimistic updates with actual tasks
  const mergedTasks = tasks?.map((task) => {
    const optimisticUpdate = optimisticUpdates.get(task.id);
    return optimisticUpdate || task;
  });

  // Filter tasks by search query
  const filteredTasks = mergedTasks?.filter((task) => {
    const matchesSearch =
      !searchQuery ||
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Group tasks by status
  const tasksByStatus = columns.reduce((acc, column) => {
    acc[column.status] = filteredTasks?.filter(
      (task) => task.status === column.status
    ) || [];
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

    // Determine the new status
    let newStatus: Task["status"] | null = null;
    
    // Check if dropped on a column
    const column = columns.find((col) => col.id === overId);
    if (column) {
      newStatus = column.status;
    } else {
      // Dropped on another task - find which column that task is in
      const overTask = filteredTasks?.find((t) => t.id === overId);
      if (overTask) {
        newStatus = overTask.status;
      }
    }

    if (!newStatus) return;

    const task = filteredTasks?.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    // Check if there's already a pending operation for this task
    if (pendingOperationsRef.current.has(taskId)) {
      toast.warning('This task is already being moved. Please wait.');
      return;
    }

    // Create abort controller for this operation
    const abortController = new AbortController();
    pendingOperationsRef.current.set(taskId, abortController);

    try {
      // Calculate position - place at the end of the target column
      const targetColumnTasks = tasksByStatus[newStatus] || [];
      const position = targetColumnTasks.length;

      // Optimistic update - store in optimistic updates map
      const optimisticTask = { ...task, status: newStatus, position };
      setOptimisticUpdates((prev) => new Map(prev).set(taskId, optimisticTask));

      // Also update the cache optimistically
      utils.tasks.list.setData({ teamId }, (old) => {
        if (!old) return old;
        return old.map((t) =>
          t.id === taskId ? optimisticTask : t
        );
      });

      await moveMutation.mutateAsync({
        id: taskId,
        status: newStatus,
        position,
      });

      toast.success("Task moved successfully");
      
      // Clear optimistic update after successful mutation
      setOptimisticUpdates((prev) => {
        const next = new Map(prev);
        next.delete(taskId);
        return next;
      });
      pendingOperationsRef.current.delete(taskId);
      lastUpdateTimestampRef.current.set(taskId, Date.now());
    } catch (error) {
      // Rollback on error
      console.error('[KanbanBoard] Failed to move task:', error);
      
      // Clear optimistic update
      setOptimisticUpdates((prev) => {
        const next = new Map(prev);
        next.delete(taskId);
        return next;
      });
      pendingOperationsRef.current.delete(taskId);
      
      // Invalidate to get fresh data
      utils.tasks.list.invalidate({ teamId });
      
      const errorMessage =
        error instanceof Error ? error.message : "Failed to move task";
      toast.error(`${errorMessage}. Changes have been reverted.`);
    }
  };

  const getAssigneeName = (assigneeId: number | null) => {
    if (!assigneeId) return undefined;
    const member = members?.find((m) => m.userId === assigneeId);
    return member?.user?.name || member?.user?.email || `User ${assigneeId}`;
  };

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
        <div className="flex items-center gap-2">
          <Badge variant={isConnected ? "default" : "secondary"} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
          {activeUsers.size > 0 && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {activeUsers.size} {activeUsers.size === 1 ? 'viewer' : 'viewers'}
            </Badge>
          )}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {columns.map((column) => {
            const columnTasks = tasksByStatus[column.status];
            const taskIds = columnTasks.map((task) => task.id);

            return (
              <Card key={column.id} className="flex flex-col h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center justify-between">
                    <span>{column.title}</span>
                    <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                      {columnTasks.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto max-h-[calc(100vh-300px)]">
                  <SortableContext
                    items={taskIds}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {columnTasks.map((task) => {
                        const isConflicting = conflictingTasks.has(task.id);
                        const isOptimistic = optimisticUpdates.has(task.id);
                        
                        return (
                          <div key={task.id} className="relative">
                            {isConflicting && (
                              <div className="absolute -top-1 -right-1 z-10">
                                <Badge variant="destructive" className="text-xs px-1 py-0 h-5 animate-pulse">
                                  Conflict
                                </Badge>
                              </div>
                            )}
                            {isOptimistic && (
                              <div className="absolute -top-1 -right-1 z-10">
                                <Badge variant="secondary" className="text-xs px-1 py-0 h-5">
                                  Saving...
                                </Badge>
                              </div>
                            )}
                            <TaskCard
                              task={task}
                              onClick={() => setSelectedTask(task)}
                              assigneeName={getAssigneeName(task.assigneeId)}
                            />
                          </div>
                        );
                      })}
                      {columnTasks.length === 0 && (
                        <div className="text-center py-8 text-gray-400 text-sm">
                          No tasks
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="opacity-80">
              <TaskCard
                task={activeTask}
                onClick={() => {}}
                assigneeName={getAssigneeName(activeTask.assigneeId)}
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
            // Update the selected task with fresh data
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
