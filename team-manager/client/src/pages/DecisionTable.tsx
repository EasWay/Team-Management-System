import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { useTeamContext } from "@/contexts/TeamContext";
import { toast } from "sonner";
import { IdeationPanel } from "@/components/IdeationPanel";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Users,
  User,
  Crown,
  Briefcase,
  ArrowRight,
  FileText,
  Loader2,
  Lightbulb,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function DecisionTable() {
  const { selectedTeamId } = useTeamContext();
  const [selectedApproval, setSelectedApproval] = useState<any>(null);
  const [voteChoice, setVoteChoice] = useState<'for' | 'against' | 'abstain'>('for');
  const [voteReason, setVoteReason] = useState("");
  const [approvalComments, setApprovalComments] = useState("");

  const { data: pendingApprovals, isLoading: pendingLoading } = trpc.approvals.list.useQuery(
    { teamId: selectedTeamId!, status: 'pending' },
    { enabled: !!selectedTeamId }
  );

  const { data: approvedApprovals, isLoading: approvedLoading } = trpc.approvals.list.useQuery(
    { teamId: selectedTeamId!, status: 'approved' },
    { enabled: !!selectedTeamId }
  );

  const { data: rejectedApprovals, isLoading: rejectedLoading } = trpc.approvals.list.useQuery(
    { teamId: selectedTeamId!, status: 'rejected' },
    { enabled: !!selectedTeamId }
  );

  const utils = trpc.useUtils();

  const approveMutation = trpc.approvals.approve.useMutation({
    onSuccess: () => {
      toast.success("Approval granted!");
      utils.approvals.list.invalidate();
      setSelectedApproval(null);
      setApprovalComments("");
    },
    onError: (error) => toast.error(error.message),
  });

  const rejectMutation = trpc.approvals.reject.useMutation({
    onSuccess: () => {
      toast.success("Approval rejected");
      utils.approvals.list.invalidate();
      setSelectedApproval(null);
      setApprovalComments("");
    },
    onError: (error) => toast.error(error.message),
  });

  const voteMutation = trpc.approvals.vote.useMutation({
    onSuccess: () => {
      toast.success("Vote cast successfully!");
      utils.approvals.list.invalidate();
      setSelectedApproval(null);
      setVoteReason("");
    },
    onError: (error) => toast.error(error.message),
  });

  const handleApprove = () => {
    if (!selectedApproval) return;
    approveMutation.mutate({
      approvalId: selectedApproval.id,
      comments: approvalComments || undefined,
    });
  };

  const handleReject = () => {
    if (!selectedApproval) return;
    rejectMutation.mutate({
      approvalId: selectedApproval.id,
      comments: approvalComments || undefined,
    });
  };

  const handleVote = () => {
    if (!selectedApproval) return;
    voteMutation.mutate({
      approvalId: selectedApproval.id,
      vote: voteChoice,
      reason: voteReason || undefined,
    });
  };

  const getApproverTypeIcon = (type: string) => {
    switch (type) {
      case 'boss':
        return <Crown className="h-4 w-4" />;
      case 'pm':
        return <Briefcase className="h-4 w-4" />;
      case 'team_vote':
        return <Users className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getApproverTypeLabel = (type: string) => {
    switch (type) {
      case 'boss':
        return 'Boss Approval';
      case 'pm':
        return 'PM Approval';
      case 'team_vote':
        return 'Team Vote';
      default:
        return 'Unknown';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return null;
    }
  };

  const renderApprovalCard = (approval: any) => (
    <Card key={approval.id} className="hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-lg">
                📁 Folder: {approval.entityType.charAt(0).toUpperCase() + approval.entityType.slice(1)} #{approval.entityId}
              </CardTitle>
              {getStatusBadge(approval.status)}
            </div>
            {approval.entityName && (
              <CardDescription className="font-medium">{approval.entityName}</CardDescription>
            )}
          </div>
          {getStatusIcon(approval.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Approval Type */}
        <div className="flex items-center gap-2 text-sm">
          {getApproverTypeIcon(approval.approverType)}
          <span className="font-medium">{getApproverTypeLabel(approval.approverType)}</span>
          {approval.approverName && (
            <span className="text-muted-foreground">by {approval.approverName}</span>
          )}
        </div>

        {/* Handoff Information */}
        {approval.fromStage && approval.toStage && (
          <div className="flex items-center gap-2 text-sm bg-muted p-2 rounded">
            <span className="font-medium">{approval.fromStage}</span>
            <ArrowRight className="h-4 w-4" />
            <span className="font-medium">{approval.toStage}</span>
          </div>
        )}

        {/* Team Vote Progress */}
        {approval.approverType === 'team_vote' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Votes Progress</span>
              <span className="font-medium">
                {approval.votesFor || 0} / {approval.requiredVotes || 0}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(
                    ((approval.votesFor || 0) / (approval.requiredVotes || 1)) * 100,
                    100
                  )}%`,
                }}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <ThumbsUp className="h-3 w-3" /> {approval.votesFor || 0} For
              </span>
              <span className="flex items-center gap-1">
                <ThumbsDown className="h-3 w-3" /> {approval.votesAgainst || 0} Against
              </span>
              <span className="flex items-center gap-1">
                <Minus className="h-3 w-3" /> {approval.votesAbstain || 0} Abstain
              </span>
            </div>
          </div>
        )}

        {/* Comments */}
        {approval.comments && (
          <div className="text-sm">
            <p className="text-muted-foreground">{approval.comments}</p>
          </div>
        )}

        {/* Timestamps */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Created {new Date(approval.createdAt).toLocaleDateString()}</span>
          {approval.resolvedAt && (
            <span>Resolved {new Date(approval.resolvedAt).toLocaleDateString()}</span>
          )}
        </div>

        {/* Actions for Pending Approvals */}
        {approval.status === 'pending' && (
          <div className="flex gap-2 pt-2">
            <Dialog>
              <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setSelectedApproval(approval)}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    📋 Review Folder
                  </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    📋 Review Folder: {approval.entityType} #{approval.entityId}
                  </DialogTitle>
                  <DialogDescription>
                    {approval.entityName || 'Review this folder before it moves to the next office'}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Approval Details */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {getApproverTypeIcon(approval.approverType)}
                      <span className="font-medium">{getApproverTypeLabel(approval.approverType)}</span>
                    </div>
                    {approval.fromStage && approval.toStage && (
                      <div className="flex items-center gap-2 bg-muted p-3 rounded">
                        <span className="font-medium">{approval.fromStage}</span>
                        <ArrowRight className="h-4 w-4" />
                        <span className="font-medium">{approval.toStage}</span>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Boss/PM Approval */}
                  {approval.approverType !== 'team_vote' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="comments">Comments (Optional)</Label>
                        <Textarea
                          id="comments"
                          placeholder="Add your comments..."
                          value={approvalComments}
                          onChange={(e) => setApprovalComments(e.target.value)}
                          rows={3}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          onClick={handleReject}
                          disabled={rejectMutation.isPending}
                          className="flex-1"
                        >
                          {rejectMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4 mr-2" />
                          )}
                          Reject
                        </Button>
                        <Button
                          onClick={handleApprove}
                          disabled={approveMutation.isPending}
                          className="flex-1"
                        >
                          {approveMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                          )}
                          Approve
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Team Vote */}
                  {approval.approverType === 'team_vote' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Your Vote</Label>
                        <RadioGroup value={voteChoice} onValueChange={(v: any) => setVoteChoice(v)}>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="for" id="for" />
                            <Label htmlFor="for" className="flex items-center gap-2 cursor-pointer">
                              <ThumbsUp className="h-4 w-4 text-green-500" />
                              Vote For
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="against" id="against" />
                            <Label htmlFor="against" className="flex items-center gap-2 cursor-pointer">
                              <ThumbsDown className="h-4 w-4 text-red-500" />
                              Vote Against
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="abstain" id="abstain" />
                            <Label htmlFor="abstain" className="flex items-center gap-2 cursor-pointer">
                              <Minus className="h-4 w-4 text-gray-500" />
                              Abstain
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reason">Reason (Optional)</Label>
                        <Textarea
                          id="reason"
                          placeholder="Explain your vote..."
                          value={voteReason}
                          onChange={(e) => setVoteReason(e.target.value)}
                          rows={3}
                        />
                      </div>

                      <Button
                        onClick={handleVote}
                        disabled={voteMutation.isPending}
                        className="w-full"
                      >
                        {voteMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                        )}
                        Cast Vote
                      </Button>

                      {/* Current Votes */}
                      {approval.voters && approval.voters.length > 0 && (
                        <>
                          <Separator />
                          <div className="space-y-2">
                            <Label>Current Votes ({approval.voters.length})</Label>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {approval.voters.map((voter: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between text-sm p-2 bg-muted rounded">
                                  <span>User #{voter.userId}</span>
                                  <Badge variant={voter.vote === 'for' ? 'default' : voter.vote === 'against' ? 'destructive' : 'secondary'}>
                                    {voter.vote}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (!selectedTeamId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Please select a team to view approvals</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">🏛️ Conference Room</h1>
          <p className="text-muted-foreground">
            Idea Lab for brainstorming • Decision Table for approvals • Quality gates
          </p>
        </div>

        <Tabs defaultValue="idea-lab" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="idea-lab">
              <Lightbulb className="h-4 w-4 mr-2" />
              🎨 Idea Lab
            </TabsTrigger>
            <TabsTrigger value="pending">
              <Clock className="h-4 w-4 mr-2" />
              📋 Awaiting Review ({pendingApprovals?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="approved">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              ✅ Approved ({approvedApprovals?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="rejected">
              <XCircle className="h-4 w-4 mr-2" />
              ❌ Rejected ({rejectedApprovals?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="idea-lab" className="space-y-4">
            <IdeationPanel 
              teamId={selectedTeamId} 
              onProjectActivated={() => {
                toast.success("Project activated! Delivered to Lead Researcher's inbox.");
              }}
            />
          </TabsContent>

          <TabsContent value="pending" className="space-y-4">
            {pendingLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : pendingApprovals && pendingApprovals.length > 0 ? (
              <div className="grid gap-4">
                {pendingApprovals.map(renderApprovalCard)}
              </div>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center h-64">
                  <p className="text-muted-foreground">No pending approvals</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="approved" className="space-y-4">
            {approvedLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : approvedApprovals && approvedApprovals.length > 0 ? (
              <div className="grid gap-4">
                {approvedApprovals.map(renderApprovalCard)}
              </div>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center h-64">
                  <p className="text-muted-foreground">No approved items yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="rejected" className="space-y-4">
            {rejectedLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : rejectedApprovals && rejectedApprovals.length > 0 ? (
              <div className="grid gap-4">
                {rejectedApprovals.map(renderApprovalCard)}
              </div>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center h-64">
                  <p className="text-muted-foreground">No rejected items</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
