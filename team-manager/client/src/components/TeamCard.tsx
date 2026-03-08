import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Settings, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useTeamContext } from "@/contexts/TeamContext";
import { TeamSettingsModal } from "./TeamSettingsModal";
import { useLocation } from "wouter";
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

interface Team {
  id: number;
  name: string;
  description: string | null;
  createdBy: number | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
  memberStatus?: string;
  memberRole?: string;
}

interface TeamCardProps {
  team: Team;
  discover?: boolean;
}

export function TeamCard({ team, discover = false }: TeamCardProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { data: members } = trpc.teams.getMembers.useQuery({ teamId: team.id });
  const deleteMutation = trpc.teams.delete.useMutation();
  const joinMutation = trpc.teams.requestJoin.useMutation();
  const { setSelectedTeamId } = useTeamContext();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const handleJoin = async () => {
    try {
      await joinMutation.mutateAsync({ teamId: team.id });
      toast.success("Join request sent!");
      utils.teams.listAll.invalidate();
    } catch (error) {
      toast.error("Failed to join team");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ id: team.id });
      toast.success("Team deleted successfully");
      utils.teams.list.invalidate();
      utils.teams.listAll.invalidate();
      setIsDeleteDialogOpen(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete team";
      toast.error(errorMessage);
    }
  };

  const memberCount = members?.length || 0;
  const isMember = team.memberStatus === 'active';
  const isPending = team.memberStatus === 'pending';

  return (
    <>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">{team.name}</CardTitle>
            </div>
            {!discover && (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsSettingsOpen(true)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {team.description && (
            <div>
              <p className="text-xs text-gray-500">Description</p>
              <p className="text-sm text-gray-700 line-clamp-2">{team.description}</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Team Members</p>
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4 text-blue-500" />
                <p className="text-sm font-medium">{memberCount}</p>
              </div>
            </div>

            {discover && (
              <div>
                {isMember ? (
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">Member</span>
                ) : isPending ? (
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">Pending Approval</span>
                ) : (
                  <Button size="sm" onClick={handleJoin} disabled={joinMutation.isPending}>
                    Join Team
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="pt-2 border-t">
            <p className="text-xs text-gray-500">
              Created: {team.createdAt ? new Date(team.createdAt).toLocaleDateString() : 'N/A'}
            </p>
            {isMember && !discover && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2 gap-2"
                onClick={() => {
                  setSelectedTeamId(team.id);
                  setLocation("/");
                }}
              >
                Open Workspace
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <TeamSettingsModal
        team={team}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{team.name}"? This action cannot be undone and will remove all team data including tasks and documents.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-foreground/[0.03] hover:bg-foreground/5 border-border/50 text-foreground">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
