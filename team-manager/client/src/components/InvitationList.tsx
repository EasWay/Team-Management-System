import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, Clock, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

interface InvitationListProps {
  teamId: number;
}

export function InvitationList({ teamId }: InvitationListProps) {
  const { data: invitations, isLoading, error } = trpc.teams.getInvitations.useQuery({ teamId });
  const rejectMutation = trpc.teams.rejectInvitation.useMutation();
  const utils = trpc.useUtils();

  const handleReject = async (token: string, email: string) => {
    try {
      await rejectMutation.mutateAsync({ token });
      toast.success(`Invitation to ${email} has been cancelled`);
      utils.teams.getInvitations.invalidate({ teamId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to cancel invitation";
      toast.error(errorMessage);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-gray-400 mx-auto mb-4 animate-spin" />
          <p className="text-gray-500">Loading invitations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-12 text-center">
          <p className="text-red-600 mb-4">Failed to load invitations: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  if (!invitations || invitations.length === 0) {
    return (
      <Card>
        <CardContent className="pt-12 text-center">
          <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No pending invitations.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {invitations.map((invitation) => {
        const isExpired = new Date(invitation.expiresAt) < new Date();
        const isAccepted = !!invitation.acceptedAt;
        const isPending = !isAccepted && !isExpired;

        return (
          <Card key={invitation.id}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{invitation.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{invitation.role}</Badge>
                      {isPending && (
                        <Badge className="bg-yellow-100 text-yellow-800">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                      {isAccepted && (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Accepted
                        </Badge>
                      )}
                      {isExpired && !isAccepted && (
                        <Badge className="bg-red-100 text-red-800">
                          <XCircle className="h-3 w-3 mr-1" />
                          Expired
                        </Badge>
                      )}
                      <span className="text-xs text-gray-500">
                        Sent {new Date(invitation.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                {isPending && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReject(invitation.token, invitation.email)}
                    disabled={rejectMutation.isPending}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
