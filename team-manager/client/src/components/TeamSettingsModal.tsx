import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { TeamMemberList } from "./TeamMemberList";
import { InvitationForm } from "./InvitationForm";
import { InvitationList } from "./InvitationList";

const formSchema = z.object({
  name: z.string().min(1, "Team name is required").max(100, "Team name must be less than 100 characters"),
  description: z.string().max(500, "Description must be less than 500 characters").optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Team {
  id: number;
  name: string;
  description: string | null;
  ownerId: number;
  createdAt: Date;
  updatedAt: Date;
}

interface TeamSettingsModalProps {
  team: Team;
  isOpen: boolean;
  onClose: () => void;
}

export function TeamSettingsModal({ team, isOpen, onClose }: TeamSettingsModalProps) {
  const [activeTab, setActiveTab] = useState("details");
  const updateMutation = trpc.teams.update.useMutation();
  const utils = trpc.useUtils();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: team.name,
      description: team.description || "",
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      await updateMutation.mutateAsync({
        id: team.id,
        ...values,
      });
      toast.success("Team updated successfully");
      utils.teams.list.invalidate();
      utils.teams.getById.invalidate({ id: team.id });
      onClose(); // Auto-close modal on success
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update team";
      toast.error(errorMessage);
    }
  }

  const isLoading = updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-slate-100">Team Settings - {team.name}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="invite">Invite</TabsTrigger>
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Team Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Frontend Team, Backend Team"
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
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the team's purpose and responsibilities..."
                          rows={3}
                          {...field}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Updating..." : "Update Team"}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="members">
            <TeamMemberList teamId={team.id} />
          </TabsContent>

          <TabsContent value="invite">
            <InvitationForm teamId={team.id} />
          </TabsContent>

          <TabsContent value="invitations">
            <InvitationList teamId={team.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
