import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

const formSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters"),
  description: z.string().optional(),
  assignedTo: z.number().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  status: z.enum(["todo", "in_progress", "review", "done"]),
  dueDate: z.date().optional(),
  githubPrUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateTaskFormProps {
  teamId: number;
  onSuccess: () => void;
  onCancel?: () => void;
}

export function CreateTaskForm({
  teamId,
  onSuccess,
  onCancel,
}: CreateTaskFormProps) {
  const createMutation = trpc.tasks.create.useMutation();
  const { data: membersData } = trpc.teams.getMembers.useQuery({ teamId });
  const utils = trpc.useUtils();

  // Type assertion to help TypeScript understand the correct type
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
    };
  }> | undefined;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      status: "todo",
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      await createMutation.mutateAsync({
        teamId,
        ...values,
        githubPrUrl: values.githubPrUrl || undefined,
      });
      toast.success("Task created successfully");
      form.reset();
      utils.tasks.list.invalidate();
      onSuccess();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create task";
      toast.error(errorMessage);
    }
  }

  const isLoading = createMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground/90 font-semibold">Title</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Implement user authentication"
                  {...field}
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground/90 font-semibold">Description (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe the task in detail..."
                  rows={3}
                  {...field}
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground/90 font-semibold">Priority</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={isLoading}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground/90 font-semibold">Status</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={isLoading}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="assignedTo"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground/90 font-semibold">Assignee (Optional)</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(Number(value))}
                disabled={isLoading}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {members?.map((member) => (
                    <SelectItem key={member.memberId} value={String(member.memberId)}>
                      {member.member?.name || member.member?.email || `User ${member.memberId}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="dueDate"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="text-foreground/90 font-semibold">Due Date (Optional)</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className="w-full pl-3 text-left font-normal"
                      disabled={isLoading}
                    >
                      {field.value ? (
                        <span className="text-foreground font-medium">{format(field.value, "PPP")}</span>
                      ) : (
                        <span className="text-foreground/75">Pick a date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-70" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date < new Date(new Date().setHours(0, 0, 0, 0))
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="githubPrUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground/90 font-semibold">GitHub PR URL (Optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="https://github.com/owner/repo/pull/123"
                  {...field}
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2 pt-4">
          <Button type="submit" disabled={isLoading} className="flex-1">
            {isLoading ? "Creating..." : "Create Task"}
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              className="bg-foreground/[0.03] hover:bg-foreground/5 border-border/50 text-foreground"
            >
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
