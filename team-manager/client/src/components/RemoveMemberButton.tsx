import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
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
import { UserMinus } from "lucide-react";
import { toast } from "sonner";

interface RemoveMemberButtonProps {
  teamId: number;
  userId: number;
  userName: string;
}

export function RemoveMemberButton({ teamId, userId, userName }: RemoveMemberButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const removeMemberMutation = trpc.teams.removeMember.useMutation();
  const utils = trpc.useUtils();

  const handleRemove = async () => {
    try {
      await removeMemberMutation.mutateAsync({
        teamId,
        userId,
      });
      toast.success(`${userName} has been removed from the team`);
      utils.teams.getMembers.invalidate({ teamId });
      setIsDialogOpen(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to remove member";
      toast.error(errorMessage);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsDialogOpen(true)}
        disabled={removeMemberMutation.isPending}
      >
        <UserMinus className="h-4 w-4 text-red-500" />
      </Button>

      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {userName} from this team? They will lose access to all team resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-foreground/[0.03] hover:bg-foreground/5 border-border/50 text-foreground">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
