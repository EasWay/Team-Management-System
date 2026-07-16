import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Users, Mail, Loader2 } from "lucide-react";
import { TeamList } from "@/components/TeamList";
import { CreateTeamForm } from "@/components/CreateTeamForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function Teams() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: myInvitations, refetch: refetchInvitations } = trpc.teams.getMyInvitations.useQuery();
  const acceptMutation = trpc.teams.acceptInvitation.useMutation();
  const rejectMutation = trpc.teams.rejectInvitation.useMutation();
  const utils = trpc.useUtils();

  const handleCreateSuccess = () => {
    setIsCreateDialogOpen(false);
  };

  const handleAcceptInvite = async (token: string) => {
    try {
      await acceptMutation.mutateAsync({ token });
      toast.success("Successfully joined the team!");
      refetchInvitations();
      utils.teams.list.invalidate(); // Refresh user teams list
      // Refresh the entire page context to ensure active team state is updated
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to accept invitation");
    }
  };

  const handleDeclineInvite = async (token: string) => {
    try {
      await rejectMutation.mutateAsync({ token });
      toast.info("Invitation declined");
      refetchInvitations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to decline invitation");
    }
  };

  const pendingCount = myInvitations?.length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Teams</h1>
            <p className="text-muted-foreground mt-2">Manage your collaborative development teams</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Team
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Team</DialogTitle>
                <DialogDescription>
                  Create a new collaborative development team.
                </DialogDescription>
              </DialogHeader>
              <CreateTeamForm onSuccess={handleCreateSuccess} />
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="my-teams" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="my-teams" className="gap-2">
              <Users className="h-4 w-4" />
              My Teams
            </TabsTrigger>
            <TabsTrigger value="discover" className="gap-2">
              <Search className="h-4 w-4" />
              Discover
            </TabsTrigger>
            <TabsTrigger value="invitations" className="gap-2 relative">
              <Mail className="h-4 w-4" />
              Invitations
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-1.5 px-1.5 py-0.5 text-[10px] min-w-5 h-5 flex items-center justify-center rounded-full bg-blue-500 hover:bg-blue-600 text-white border-none">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-teams">
            <TeamList />
          </TabsContent>

          <TabsContent value="discover">
            <TeamList discover />
          </TabsContent>

          <TabsContent value="invitations">
            {myInvitations && myInvitations.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {myInvitations.map(({ invitation, teamName }) => (
                  <Card key={invitation.id} className="liquid-glass border-white/5 bg-white/[0.02] shadow-lg backdrop-blur-xl relative overflow-hidden group hover:border-white/10 transition-all duration-300">
                    <CardContent className="pt-6 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="size-10 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20">
                          <Mail className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white text-lg">{teamName}</h3>
                          <p className="text-xs text-muted-foreground/60">Team Invitation</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground/60">Invited Role:</span>
                        <span className="inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/10 uppercase tracking-wider">
                          {invitation.role || "member"}
                        </span>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button 
                          onClick={() => handleDeclineInvite(invitation.token)}
                          variant="ghost" 
                          size="sm" 
                          className="flex-1 text-muted-foreground hover:text-white hover:bg-white/5"
                          disabled={acceptMutation.isPending || rejectMutation.isPending}
                        >
                          Decline
                        </Button>
                        <Button 
                          onClick={() => handleAcceptInvite(invitation.token)}
                          size="sm" 
                          className="flex-1 gap-2"
                          disabled={acceptMutation.isPending || rejectMutation.isPending}
                        >
                          {acceptMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Accept"
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="liquid-glass border-white/5 bg-white/[0.02]">
                <CardContent className="py-12 text-center text-muted-foreground/60">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-40 text-blue-400" />
                  <p className="text-sm">You have no pending invitations.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
