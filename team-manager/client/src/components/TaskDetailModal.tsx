import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarIcon, Github, Trash2 } from "lucide-react";
import { TaskHistoryTimeline } from "./TaskHistoryTimeline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

interface TaskDetailModalProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdated?: () => void;
}

const priorityColors = {
  low: "bg-gray-100 text-gray-700 border-gray-300",
  medium: "bg-blue-100 text-blue-700 border-blue-300",
  high: "bg-orange-100 text-orange-700 border-orange-300",
  urgent: "bg-red-100 text-red-700 border-red-300",
};

export function TaskDetailModal({
  task,
  open,
  onOpenChange,
  onTaskUpdated,
}: TaskDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editedTask, setEditedTask] = useState(task);

  const updateMutation = trpc.tasks.update.useMutation();
  const deleteMutation = trpc.tasks.delete.useMutation();
  const { data: members } = trpc.teams.getMembers.useQuery({
    teamId: task.teamId,
  });
  const utils = trpc.useUtils();

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        id: task.id,
        title: editedTask.title,
        description: editedTask.description || undefined,
        assigneeId: editedTask.assigneeId || undefined,
        priority: editedTask.priority,
        status: editedTask.status,
        dueDate: editedTask.dueDate || undefined,
        githubPrUrl: editedTask.githubPrUrl || undefined,
      });
      toast.success("Task updated successfully");
      setIsEditing(false);
      utils.tasks.list.invalidate();
      onTaskUpdated?.();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update task";
      toast.error(errorMessage);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ id: task.id });
      toast.success("Task deleted successfully");
      utils.tasks.list.invalidate();
      onOpenChange(false);
      onTaskUpdated?.();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete task";
      toast.error(errorMessage);
    }
  };

  const handleCancel = () => {
    setEditedTask(task);
    setIsEditing(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? (
                <Input
                  value={editedTask.title}
                  onChange={(e) =>
                    setEditedTask({ ...editedTask, title: e.target.value })
                  }
                  className="text-lg font-semibold"
                />
              ) : (
                task.title
              )}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 mt-4">
              {/* Priority and Status */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">
                    Priority
                  </label>
                  {isEditing ? (
                    <Select
                      value={editedTask.priority}
                      onValueChange={(value: any) =>
                        setEditedTask({ ...editedTask, priority: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge
                      variant="outline"
                      className={priorityColors[task.priority]}
                    >
                      {task.priority}
                    </Badge>
                  )}
                </div>

                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">
                    Status
                  </label>
                  {isEditing ? (
                    <Select
                      value={editedTask.status}
                      onValueChange={(value: any) =>
                        setEditedTask({ ...editedTask, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todo">To Do</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="review">Review</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline">{task.status.replace(/_/g, " ")}</Badge>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Description
                </label>
                {isEditing ? (
                  <Textarea
                    value={editedTask.description || ""}
                    onChange={(e) =>
                      setEditedTask({ ...editedTask, description: e.target.value })
                    }
                    rows={4}
                    placeholder="Add a description..."
                  />
                ) : (
                  <p className="text-sm text-gray-600">
                    {task.description || "No description provided"}
                  </p>
                )}
              </div>

              {/* Assignee */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Assignee
                </label>
                {isEditing ? (
                  <Select
                    value={editedTask.assigneeId ? String(editedTask.assigneeId) : "unassigned"}
                    onValueChange={(value) =>
                      setEditedTask({
                        ...editedTask,
                        assigneeId: value === "unassigned" ? null : Number(value),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {members?.map((member) => (
                        <SelectItem
                          key={member.userId}
                          value={String(member.userId)}
                        >
                          {member.user?.name || member.user?.email || `User ${member.userId}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-gray-600">
                    {task.assigneeId
                      ? members?.find((m) => m.userId === task.assigneeId)?.user
                          ?.name || `User ${task.assigneeId}`
                      : "Unassigned"}
                  </p>
                )}
              </div>

              {/* Due Date */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Due Date
                </label>
                {isEditing ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        {editedTask.dueDate ? (
                          format(new Date(editedTask.dueDate), "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={editedTask.dueDate ? new Date(editedTask.dueDate) : undefined}
                        onSelect={(date) =>
                          setEditedTask({ ...editedTask, dueDate: date || null })
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                ) : (
                  <p className="text-sm text-gray-600">
                    {task.dueDate
                      ? format(new Date(task.dueDate), "PPP")
                      : "No due date"}
                  </p>
                )}
              </div>

              {/* GitHub PR URL */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  GitHub Pull Request
                </label>
                {isEditing ? (
                  <Input
                    value={editedTask.githubPrUrl || ""}
                    onChange={(e) =>
                      setEditedTask({ ...editedTask, githubPrUrl: e.target.value })
                    }
                    placeholder="https://github.com/owner/repo/pull/123"
                  />
                ) : task.githubPrUrl ? (
                  <a
                    href={task.githubPrUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Github className="h-4 w-4" />
                    View Pull Request
                  </a>
                ) : (
                  <p className="text-sm text-gray-600">No PR linked</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t">
                {isEditing ? (
                  <>
                    <Button
                      onClick={handleSave}
                      disabled={updateMutation.isPending}
                      className="flex-1"
                    >
                      {updateMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCancel}
                      disabled={updateMutation.isPending}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button onClick={() => setIsEditing(true)} className="flex-1">
                      Edit Task
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <TaskHistoryTimeline taskId={task.id} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
