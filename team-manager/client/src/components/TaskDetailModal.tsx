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
  priority: string | null;
  status: string | null;
  teamId: number | null;
  assignedTo: number | null;
  createdBy: number | null;
  dueDate: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  position?: number;
  githubPrUrl?: string | null;
}

interface TaskDetailModalProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdated?: () => void;
}

const priorityColors = {
  low: "bg-foreground/5 text-foreground/70 border-border",
  medium: "bg-blue-500/10 text-blue-600 border-blue-300/50",
  high: "bg-orange-500/10 text-orange-600 border-orange-300/50",
  urgent: "bg-red-500/10 text-red-600 border-red-300/50",
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
        assignedTo: editedTask.assignedTo || undefined,
        priority: editedTask.priority || undefined,
        status: editedTask.status || undefined,
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
                  className="text-lg font-semibold text-foreground"
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
                  <label className="text-sm font-semibold mb-2 block text-foreground/90">
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
                  <label className="text-sm font-semibold mb-2 block text-foreground/90">
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
                <label className="text-sm font-semibold mb-2 block text-foreground/90">
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
                  <p className="text-sm text-foreground/80 leading-relaxed italic">
                    {task.description || "No description provided"}
                  </p>
                )}
              </div>

              {/* Assignee */}
              <div>
                <label className="text-sm font-semibold mb-2 block text-foreground/90">
                  Assignee
                </label>
                {isEditing ? (
                  <Select
                    value={editedTask.assignedTo ? String(editedTask.assignedTo) : "unassigned"}
                    onValueChange={(value) =>
                      setEditedTask({
                        ...editedTask,
                        assignedTo: value === "unassigned" ? null : Number(value),
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
                          key={member.memberId}
                          value={String(member.memberId)}
                        >
                          {member.member?.name || member.member?.email || `User ${member.memberId}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-foreground/80">
                    {task.assignedTo
                      ? members?.find((m) => m.memberId === task.assignedTo)?.member
                        ?.name || `User ${task.assignedTo}`
                      : "Unassigned"}
                  </p>
                )}
              </div>

              {/* Due Date */}
              <div>
                <label className="text-sm font-semibold mb-2 block text-foreground/90">
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
                          <span className="text-foreground font-medium">{format(new Date(editedTask.dueDate), "PPP")}</span>
                        ) : (
                          <span className="text-foreground/75">Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-70" />
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
                  <p className="text-sm text-foreground/80 font-medium">
                    {task.dueDate
                      ? format(new Date(task.dueDate), "PPP")
                      : "No due date"}
                  </p>
                )}
              </div>

              {/* GitHub PR URL */}
              <div>
                <label className="text-sm font-semibold mb-2 block text-foreground/90">
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
                    className="text-sm text-foreground hover:underline flex items-center gap-1 font-medium"
                  >
                    <Github className="h-4 w-4" />
                    View Pull Request
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">No PR linked</p>
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
                      className="bg-foreground/[0.03] hover:bg-foreground/5 border-border/50 text-foreground"
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
            <AlertDialogCancel className="bg-foreground/[0.03] hover:bg-foreground/5 border-border/50 text-foreground">Cancel</AlertDialogCancel>
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
