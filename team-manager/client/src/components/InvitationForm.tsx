import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { toast } from "sonner";

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(["admin", "team_lead", "developer", "viewer"]),
});

type FormValues = z.infer<typeof formSchema>;

interface InvitationFormProps {
  teamId: number;
}

export function InvitationForm({ teamId }: InvitationFormProps) {
  const createInvitationMutation = trpc.teams.createInvitation.useMutation();
  const utils = trpc.useUtils();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      role: "developer",
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      await createInvitationMutation.mutateAsync({
        teamId,
        email: values.email,
        role: values.role,
      });
      toast.success(`Invitation sent to ${values.email}`);
      form.reset();
      utils.teams.getInvitations.invalidate({ teamId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send invitation";
      toast.error(errorMessage);
    }
  }

  const isLoading = createInvitationMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <FormControl>
                <Input 
                  type="email"
                  placeholder="user@example.com" 
                  {...field} 
                  disabled={isLoading}
                />
              </FormControl>
              <FormDescription>
                Enter the email address of the person you want to invite
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select 
                onValueChange={field.onChange}
                value={field.value}
                disabled={isLoading}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex flex-col">
                      <span className="font-medium">Admin</span>
                      <span className="text-xs text-gray-500">Full team management permissions</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="team_lead">
                    <div className="flex flex-col">
                      <span className="font-medium">Team Lead</span>
                      <span className="text-xs text-gray-500">Project and task management</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="developer">
                    <div className="flex flex-col">
                      <span className="font-medium">Developer</span>
                      <span className="text-xs text-gray-500">Code editing and task assignment</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <div className="flex flex-col">
                      <span className="font-medium">Viewer</span>
                      <span className="text-xs text-gray-500">Read-only access</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Choose the role for the invited user
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2 pt-4">
          <Button type="submit" disabled={isLoading} className="flex-1">
            {isLoading ? "Sending..." : "Send Invitation"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
