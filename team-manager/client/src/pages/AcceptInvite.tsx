import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { tokenStorage } from "@/lib/tokenStorage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Mail, CheckCircle, XCircle, ShieldAlert, ArrowLeft } from "lucide-react";

export default function AcceptInvite() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  
  // Parse token from query parameter manually
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) {
      setToken(t);
      // Store token in case user needs to log in/register first
      localStorage.setItem("pending_invite_token", t);
    } else {
      const stored = localStorage.getItem("pending_invite_token");
      if (stored) {
        setToken(stored);
      }
    }
  }, []);

  const isLoggedIn = !!tokenStorage.getAccessToken();

  // Query invitation details
  const { data: inviteData, isLoading: isQueryLoading, error: queryError } = 
    trpc.teams.getInvitationByToken.useQuery(
      { token: token || "" },
      { enabled: !!token }
    );

  const acceptMutation = trpc.teams.acceptInvitation.useMutation();
  const rejectMutation = trpc.teams.rejectInvitation.useMutation();

  const handleAccept = async () => {
    if (!token) return;
    try {
      await acceptMutation.mutateAsync({ token });
      localStorage.removeItem("pending_invite_token");
      toast.success("Successfully joined the team!");
      setLocation("/");
      // Force reload to update active teams in state
      window.location.reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to accept invitation";
      toast.error(msg);
    }
  };

  const handleDecline = async () => {
    if (!token) return;
    try {
      await rejectMutation.mutateAsync({ token });
      localStorage.removeItem("pending_invite_token");
      toast.info("Invitation declined");
      setLocation("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to decline invitation";
      toast.error(msg);
    }
  };

  // If no token is provided in the URL or storage
  if (!token) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] text-white flex items-center justify-center p-4">
        <Card className="liquid-glass border-white/5 bg-white/[0.02] max-w-md w-full">
          <CardHeader className="text-center">
            <ShieldAlert className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle>Missing Invitation Token</CardTitle>
            <CardDescription className="text-muted-foreground/60 mt-2">
              No valid invitation token was found in the URL. Please verify the link you received.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="ghost" onClick={() => setLocation("/")} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If the user is not authenticated
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-[#0A0A0B] text-white flex items-center justify-center p-4">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>

        <Card className="relative z-10 liquid-glass border-white/5 bg-white/[0.02] max-w-md w-full shadow-2xl backdrop-blur-xl">
          <CardHeader className="text-center">
            <div className="size-12 bg-white/5 rounded-xl flex items-center justify-center mx-auto mb-4 border border-white/10">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <CardTitle>Team Invitation</CardTitle>
            <CardDescription className="text-muted-foreground/60 mt-2">
              You must be logged in to view and accept team invitations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 text-sm text-muted-foreground/80 leading-relaxed">
              We have saved your invitation code. Once you log in or register, you will be automatically redirected to accept the invite.
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={() => setLocation("/login")} className="w-full">
                Log In
              </Button>
              <Button variant="outline" onClick={() => setLocation("/register")} className="w-full border-white/10 hover:bg-white/5">
                Create an Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state while querying invitation details
  if (isQueryLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Checking invitation details...</p>
        </div>
      </div>
    );
  }

  // Error state (invalid/expired/not found)
  if (queryError || !inviteData) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] text-white flex items-center justify-center p-4">
        <Card className="liquid-glass border-white/5 bg-white/[0.02] max-w-md w-full">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle>Invalid or Expired Invitation</CardTitle>
            <CardDescription className="text-muted-foreground/60 mt-2">
              {queryError?.message || "This invitation link has expired, been declined, or is no longer valid."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="ghost" onClick={() => {
              localStorage.removeItem("pending_invite_token");
              setLocation("/");
            }} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { invitation, teamName } = inviteData;
  const isAccepted = invitation.status === "accepted";

  if (isAccepted) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] text-white flex items-center justify-center p-4">
        <Card className="liquid-glass border-white/5 bg-white/[0.02] max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <CardTitle>Invitation Already Accepted</CardTitle>
            <CardDescription className="text-muted-foreground/60 mt-2">
              You are already a member of <strong>{teamName}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => {
              localStorage.removeItem("pending_invite_token");
              setLocation("/");
            }} className="gap-2">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Active invitation acceptance panel
  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0A0A0B] text-white flex items-center justify-center p-4">
      {/* Visual background details */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>

      <Card className="relative z-10 liquid-glass border-white/5 bg-white/[0.02] max-w-md w-full shadow-2xl backdrop-blur-xl">
        <CardHeader className="text-center">
          <div className="size-12 bg-blue-500/10 rounded-xl flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
            <Mail className="h-6 w-6 text-blue-400 animate-bounce" />
          </div>
          <CardTitle>Join {teamName}</CardTitle>
          <CardDescription className="text-muted-foreground/60 mt-2">
            You've been invited to join the team
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-white/[0.02] border border-white/5 rounded-lg p-5 text-center">
            <p className="text-sm text-muted-foreground/80 mb-2">Role Assigned:</p>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider">
              {invitation.role || "member"}
            </span>
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={handleDecline} 
              variant="outline" 
              className="flex-1 border-white/10 hover:bg-white/5"
              disabled={acceptMutation.isPending || rejectMutation.isPending}
            >
              Decline
            </Button>
            <Button 
              onClick={handleAccept} 
              className="flex-1 gap-2"
              disabled={acceptMutation.isPending || rejectMutation.isPending}
            >
              {acceptMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Accept & Join"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
