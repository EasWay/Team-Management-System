import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
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
      <div className="flex-1 w-full flex flex-col h-screen overflow-hidden text-foreground bg-background custom-scrollbar">

        {/* Main Scrollable Area */}
        <div className="flex-1 overflow-y-auto pt-16 pb-32 px-8 lg:px-16 custom-scrollbar scroll-smooth">

          <div className="max-w-5xl mx-auto flex flex-col items-center text-center">
            {/* Search Bar (Top) */}
            <div className="w-full max-w-xl relative group mb-20">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 size-4" />
              <input
                className="w-full bg-foreground/[0.03] border border-border rounded-full px-12 py-3 text-xs tracking-wide text-foreground focus:outline-none focus:border-primary/20 transition-all placeholder:text-muted-foreground/30 shadow-2xl shadow-black/5"
                placeholder="Search team members..."
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
                <div className="size-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-tighter">Live Directory</span>
              </div>
            </div>

            {/* Hero Quote */}
            <div className="space-y-6 mb-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">
              <h1 className="text-5xl md:text-7xl font-serif italic tracking-tight text-foreground leading-tight">
                Quality is at the heart of <br /> everything we do
              </h1>
              <p className="text-muted-foreground text-sm md:text-base max-w-2xl mx-auto font-light leading-relaxed">
                At {currentTeamName}, quality defines us. Precision, passion, perfection - it's in every detail we create.
              </p>
              <div className="pt-4">
                <button
                  onClick={() => setIsAddDialogOpen(true)}
                  className="px-8 py-3 bg-primary text-primary-foreground text-[10px] font-bold tracking-[0.2em] uppercase rounded-full hover:opacity-90 transition-all duration-300 shadow-xl shadow-primary/5"
                >
                  SEE OPEN POSITION
                </button>
              </div>
            </div>

            {/* Banner Box */}
            <div
              className="w-full aspect-[21/9] bg-card rounded-[2rem] mb-24 relative overflow-hidden flex flex-col items-center justify-center border border-border"
              style={{
                backgroundImage: 'url("https://www.saasable.io/assets/images/team/team-member-2.jpg")',
                backgroundSize: 'cover',
                backgroundPosition: 'center 20%'
              }}
            >
              <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px]"></div>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-foreground/[0.05] to-transparent"></div>

              <div className="relative z-10 flex flex-col items-center">
                <h2 className="text-foreground/40 text-4xl font-serif italic tracking-[0.3em] font-light uppercase">{currentTeamName}</h2>
                <div className="mt-8 flex gap-8">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="text-left space-y-2 opacity-50 group">
                      <p className="text-[8px] uppercase tracking-widest font-bold text-foreground/60">Stat {i + 1}</p>
                      <div className="h-[1px] w-12 bg-border"></div>
                      <p className="text-[10px] text-foreground font-mono">0.00{i}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                <p className="text-[9px] uppercase tracking-[0.4em] text-foreground/30 font-bold">REDACTED LOGISTICS DIV.</p>
              </div>
            </div>

            {/* Sub-header */}
            <div className="w-full flex flex-col items-center mb-16">
              <div className="h-px w-24 bg-gradient-to-r from-transparent via-border to-transparent mb-6"></div>
              <h3 className="text-[10px] font-bold tracking-[0.5em] uppercase text-muted-foreground/40">OUR DEDICATED TEAM</h3>

              {isAdmin && (
                <div className="flex gap-4 mt-8">
                  <button
                    onClick={() => setView('active')}
                    className={`px-6 py-1 text-[9px] uppercase tracking-widest font-bold transition-all rounded-full ${view === 'active' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground/40 hover:text-foreground'}`}
                  >
                    ROSTER ({activeMembers.length})
                  </button>
                  <button
                    onClick={() => setView('pending')}
                    className={`px-6 py-1 text-[9px] uppercase tracking-widest font-bold transition-all rounded-full ${view === 'pending' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground/40 hover:text-foreground'}`}
                  >
                    REQUESTS ({pendingMembers.length})
                  </button>
                </div>
              )}
            </div>

            {/* Squad Grid */}
            {filteredMembers && filteredMembers.length === 0 ? (
              <div className="py-20">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-bold">No records found in current sector</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-12 gap-y-20 w-full mb-32">
                {filteredMembers?.map(({ member, id: membershipId, role, status }) => (
                  <div key={member.id} className="group relative flex flex-col items-center text-center">

                    {/* Circle Avatar */}
                    <div className="relative mb-6">
                      <div className="size-40 rounded-full overflow-hidden border border-border p-1 bg-gradient-to-b from-foreground/10 to-transparent group-hover:from-foreground/20 transition-all duration-500">
                        <div className="size-full rounded-full overflow-hidden bg-muted">
                          {member.pictureFileName ? (
                            <img
                              alt={member.name}
                              className="size-full object-cover grayscale brightness-90 group-hover:grayscale-0 group-hover:brightness-100 transition-all duration-700 pointer-events-none"
                              src={`/api/uploads/${member.pictureFileName}`}
                            />
                          ) : (
                            <div className="size-full flex items-center justify-center text-5xl font-serif italic text-muted-foreground/20 group-hover:text-muted-foreground/40 transition-colors">
                              {member.name.charAt(0)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Floating Action Menu (Glass) */}
                      <div className="absolute top-0 right-0 md:-right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 z-50">
                        {status === 'active' ? (
                          <>
                            <button
                              onClick={() => { setSelectedMember(member); setIsDetailModalOpen(true); }}
                              className="size-8 rounded-full bg-background/20 backdrop-blur-xl border border-border flex items-center justify-center text-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-300 shadow-lg"
                            >
                              <Eye className="size-3" />
                            </button>
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => { setSelectedMember(member); setIsEditDialogOpen(true); }}
                                  className="size-8 rounded-full bg-background/20 backdrop-blur-xl border border-border flex items-center justify-center text-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-300 shadow-lg"
                                >
                                  <Edit className="size-3" />
                                </button>
                                <button
                                  onClick={() => { setMemberToDelete(member.id); setIsDeleteDialogOpen(true); }}
                                  className="size-8 rounded-full bg-background/20 backdrop-blur-xl border border-border flex items-center justify-center text-foreground hover:bg-red-500 hover:text-white transition-all duration-300 shadow-lg"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </>
                            )}
                          </>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => handleApprove(member.id)}
                              className="size-8 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/20 border border-border flex items-center justify-center text-white hover:bg-primary hover:text-primary-foreground transition-all duration-300"
                              title="Approve"
                            >
                              <RefreshCw className="size-3" />
                            </button>
                            <button
                              onClick={() => handleDelete()}
                              className="size-8 rounded-full bg-background/20 backdrop-blur-xl border border-border flex items-center justify-center text-foreground hover:bg-red-500 hover:text-white transition-all duration-300"
                              title="Reject"
                            >
                              <X className="size-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Member Info */}
                    <div className="space-y-1">
                      <h4 className="text-xl font-serif italic text-foreground/90 group-hover:text-foreground transition-colors">{member.name}</h4>
                      <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground/40">{member.position || 'Operative'}</p>
                    </div>

                    {/* Status Dot */}
                    {status === 'pending' && (
                      <div className="mt-4 px-3 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded-full">
                        <p className="text-[8px] text-yellow-500 font-bold uppercase tracking-widest">Awaiting Clearance</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Footer Text */}
            <div className="pt-20 pb-10 flex flex-col items-center">
              <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent mb-8"></div>
              <div className="flex justify-between w-full text-[9px] uppercase tracking-[0.3em] font-medium text-muted-foreground/20 px-4">
                <span>© 2026 BLACKOUT TEAM SYSTEMS LTD.</span>
                <div className="flex gap-8">
                  <span className="hover:text-foreground cursor-pointer transition-colors">DATA PRIVACY</span>
                  <span className="hover:text-foreground cursor-pointer transition-colors">TERMINALS</span>
                  <span className="hover:text-foreground cursor-pointer transition-colors">SUPPORT</span>
                </div>
              </div>
            </div>

          </div>
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
