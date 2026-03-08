import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AddTeamMemberForm } from "@/components/AddTeamMemberForm";
import { EditTeamMemberForm } from "@/components/EditTeamMemberForm";
import { TeamMemberDetailModal } from "@/components/TeamMemberDetailModal";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import type { TeamMember } from "@shared/types";
import { Search, Eye, Edit, Trash2, RefreshCw, X } from "lucide-react";
import { useTeamContext } from "@/contexts/TeamContext";
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

// Random color/badge generator for roles
function getRoleStyles(position: string) {
  const p = position.toLowerCase();
  if (p.includes('admin') || p.includes('lead') || p.includes('manager')) {
    return "border-yellow-500/30 text-yellow-400 bg-yellow-500/10";
  }
  if (p.includes('frontend') || p.includes('ui') || p.includes('design')) {
    return "border-cyan-500/30 text-cyan-400 bg-cyan-500/10";
  }
  if (p.includes('backend') || p.includes('data')) {
    return "border-blue-500/30 text-blue-400 bg-blue-500/10";
  }
  if (p.includes('devops') || p.includes('infra')) {
    return "border-purple-500/30 text-purple-400 bg-purple-500/10";
  }
  if (p.includes('qa') || p.includes('test')) {
    return "border-pink-500/30 text-pink-400 bg-pink-500/10";
  }
  return "border-green-500/30 text-green-400 bg-green-500/10";
}

export default function TeamMembers() {
  const { selectedTeamId, teams } = useTeamContext();
  const { user } = useAuth();
  const { data: members, isLoading, refetch } = trpc.teams.getMembers.useQuery({ teamId: selectedTeamId || 0 }, { enabled: !!selectedTeamId });
  const approveMutation = trpc.teams.approveJoin.useMutation();
  const removeMutation = trpc.teams.removeMember.useMutation();

  const userMembership = members?.find(m => m.member.id === user?.id);
  const isAdmin = userMembership?.role === 'admin' || userMembership?.role === 'team_lead';

  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState<'active' | 'pending'>('active');

  const currentTeamName = teams?.find(t => t.id === selectedTeamId)?.name || 'NO ACTIVE TEAM';

  const handleDelete = async () => {
    if (!memberToDelete || !selectedTeamId) return;
    try {
      await removeMutation.mutateAsync({ teamId: selectedTeamId, userId: memberToDelete });
      toast.success("Team member removed successfully");
      refetch();
      setIsDeleteDialogOpen(false);
      setMemberToDelete(null);
    } catch (error) {
      toast.error("Failed to remove team member");
    }
  };

  const handleApprove = async (memberId: number) => {
    if (!selectedTeamId) return;
    try {
      await approveMutation.mutateAsync({ teamId: selectedTeamId, memberId });
      toast.success("Member approved!");
      refetch();
    } catch (error) {
      toast.error("Failed to approve member");
    }
  };

  const handleAddSuccess = () => {
    setIsAddDialogOpen(false);
    refetch();
  };

  const handleEditSuccess = () => {
    setIsEditDialogOpen(false);
    setSelectedMember(null);
    refetch();
    toast.success("Team member updated successfully");
  };

  const activeMembers = members?.filter(m => m.status === 'active') || [];
  const pendingMembers = members?.filter(m => m.status === 'pending') || [];

  const displayMembers = view === 'active' ? activeMembers : pendingMembers;

  const filteredMembers = displayMembers?.filter(({ member }) => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.position?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center flex-1 h-screen">
          <div className="text-center">
            <RefreshCw className="text-muted-foreground/40 mb-4 animate-spin size-12 mx-auto" />
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Loading roster...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex-1 max-w-[1600px] mx-auto w-full p-8 flex flex-col h-screen overflow-hidden text-foreground font-body">

        {/* Header */}
        <header className="flex flex-col md:flex-row md:justify-between md:items-end mb-12 shrink-0 pt-4 gap-6">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground text-[10px] uppercase tracking-widest font-bold mb-2">
              <span>{currentTeamName}</span>
              <span className="size-1 rounded-full bg-foreground/20"></span>
              <span>{view === 'active' ? 'REGISTRY' : 'REQUESTS'}</span>
            </div>
            <h2 className="text-4xl font-light tracking-tight text-foreground mb-2">{currentTeamName}</h2>
            <p className="text-[10px] text-muted-foreground max-w-md font-medium tracking-wide">
              {view === 'active'
                ? "Manage role assignments and review operational status inside your division grid."
                : "Review pending join requests from personnel across the global directory."
              }
            </p>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setView('active')}
                className={`px-4 py-1.5 text-[10px] uppercase tracking-widest font-bold border transition-all rounded ${view === 'active' ? 'bg-foreground text-background border-foreground' : 'text-muted-foreground border-border hover:border-foreground/30'}`}
              >
                Roster ({activeMembers.length})
              </button>
              {isAdmin && (
                <button
                  onClick={() => setView('pending')}
                  className={`px-4 py-1.5 text-[10px] uppercase tracking-widest font-bold border transition-all rounded ${view === 'pending' ? 'bg-foreground text-background border-foreground' : 'text-muted-foreground border-border hover:border-foreground/30'}`}
                >
                  Requests ({pendingMembers.length})
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
              <input
                className="bg-foreground/5 border border-border rounded px-10 py-2.5 text-[10px] uppercase tracking-widest font-bold text-foreground focus:outline-none focus:border-foreground/30 w-full md:w-64 transition-all hover:bg-foreground/10 placeholder:text-muted-foreground"
                placeholder="Search candidates..."
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              className="px-6 py-2.5 bg-white text-black text-[10px] font-bold tracking-widest uppercase hover:bg-slate-200 transition-colors rounded"
              onClick={() => setIsAddDialogOpen(true)}
            >
              Add Global Member
            </button>
          </div>
        </header>

        {/* Scrollable Grid Container */}
        <div className="flex-1 overflow-y-auto pb-24 custom-scrollbar">
          {filteredMembers && filteredMembers.length === 0 ? (
            <div className="flex items-center justify-center flex-1 h-[400px]">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">No personnel match parameters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pr-2">
              {filteredMembers?.map(({ member, id: membershipId, role, status }) => (
                <div key={member.id} className="liquid-glass-card rounded-xl overflow-hidden group relative">

                  {/* Grid Hovers Action Area */}
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                    {status === 'active' ? (
                      <>
                        <button
                          onClick={() => {
                            setSelectedMember(member);
                            setIsDetailModalOpen(true);
                          }}
                          className="size-8 rounded bg-background/80 backdrop-blur-md border border-border hover:bg-foreground hover:text-background flex items-center justify-center text-muted-foreground transition-colors"
                          title="View Bio"
                        >
                          <Eye className="size-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedMember(member);
                            setIsEditDialogOpen(true);
                          }}
                          className="size-8 rounded bg-background/80 backdrop-blur-md border border-border hover:bg-foreground hover:text-background flex items-center justify-center text-muted-foreground transition-colors"
                          title="Change Assignment"
                        >
                          <Edit className="size-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setMemberToDelete(member.id);
                            setIsDeleteDialogOpen(true);
                          }}
                          disabled={removeMutation.isPending}
                          className="size-8 rounded bg-background/80 backdrop-blur-md border border-border hover:bg-red-500 hover:border-red-500 hover:text-white flex items-center justify-center text-muted-foreground transition-colors"
                          title="Purge Record"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleDelete()} // Reject is essentially delete membership
                        className="size-8 rounded bg-background/80 backdrop-blur-md border border-border hover:bg-red-500 hover:border-red-500 hover:text-white flex items-center justify-center text-muted-foreground transition-colors"
                        title="Reject Request"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="h-48 relative overflow-hidden bg-white/5">
                    {member.pictureFileName ? (
                      <img
                        alt={member.name}
                        className="w-full h-full object-cover grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500"
                        src={`/api/uploads/${member.pictureFileName}?t=${Date.now()}`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl font-light text-muted-foreground/30 bg-muted grayscale group-hover:grayscale-0 group-hover:text-foreground/40 transition-all duration-500">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
                    <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                      <div>
                        <h3 className="text-sm font-bold text-white tracking-wide">{member.name}</h3>
                        <p className="text-[10px] text-white/60 uppercase tracking-widest">{member.position || 'Operative'}</p>
                      </div>
                      <div className={`size-2 rounded-full ${status === 'active' ? 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]' : 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.8)]'}`}></div>
                    </div>
                  </div>

                  {status === 'active' ? (
                    <div className="p-4 grid grid-cols-3 gap-2 border-t border-border bg-muted/30">
                      <div className="text-center">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Fitness</p>
                        <p className="text-xs text-foreground font-mono">100%</p>
                      </div>
                      <div className="text-center border-x border-border">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Velocity</p>
                        <p className="text-xs text-foreground font-mono">1.0x</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Health</p>
                        <p className="text-xs text-foreground font-mono">OPT</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 border-t border-border bg-yellow-500/5">
                      <button
                        onClick={() => handleApprove(member.id)}
                        disabled={approveMutation.isPending}
                        className="w-full py-2 bg-yellow-500 text-black text-[10px] font-bold tracking-widest uppercase hover:bg-yellow-400 transition-colors rounded"
                      >
                        {approveMutation.isPending ? "Confirming..." : "Approve Access"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-md bg-background text-foreground liquid-glass-card overflow-hidden">
          <DialogHeader className="relative z-10 border-b border-border pb-4 mb-4">
            <DialogTitle className="text-foreground text-lg font-light tracking-tight">Recruit Operative</DialogTitle>
            <DialogDescription className="text-muted-foreground text-[10px] uppercase tracking-widest">
              Assign a new member to your working squad.
            </DialogDescription>
          </DialogHeader>
          <div className="relative z-10">
            <AddTeamMemberForm onSuccess={handleAddSuccess} />
          </div>
        </DialogContent>
      </Dialog>

      {selectedMember && (
        <>
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-md bg-background text-foreground liquid-glass-card overflow-hidden">
              <DialogHeader className="relative z-10 border-b border-border pb-4 mb-4">
                <DialogTitle className="text-foreground text-lg font-light tracking-tight">Reassign Operative</DialogTitle>
                <DialogDescription className="text-muted-foreground text-[10px] uppercase tracking-widest">
                  Update file and clearance for {selectedMember.name}.
                </DialogDescription>
              </DialogHeader>
              <div className="relative z-10">
                <EditTeamMemberForm member={selectedMember} onSuccess={handleEditSuccess} />
              </div>
            </DialogContent>
          </Dialog>

          <TeamMemberDetailModal
            member={selectedMember}
            isOpen={isDetailModalOpen}
            onClose={() => {
              setIsDetailModalOpen(false);
              setSelectedMember(null);
            }}
            onUpdate={refetch}
          />
        </>
      )}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Purge Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this team member? This action is permanent and will remove them from the operational registry.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-foreground/[0.03] hover:bg-foreground/5 border-border/50 text-foreground">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Confirm Purge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
