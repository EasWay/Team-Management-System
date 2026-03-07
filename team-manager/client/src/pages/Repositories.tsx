import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { ConnectRepositoryModal } from "@/components/ConnectRepositoryModal";
import { CreateRepositoryModal } from "@/components/CreateRepositoryModal";
import { trpc } from "@/lib/trpc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  RefreshCw,
  Database,
  Github,
  Search,
  Loader2,
  Globe,
  Lock,
  ExternalLink,
  Plus,
  Trash2,
  AlertCircle
} from "lucide-react";
import { useTeamContext } from "@/contexts/TeamContext";
import { toast } from "sonner";
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

export default function Repositories() {
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [repoToDelete, setRepoToDelete] = useState<{ owner: string, repo: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { selectedTeamId, setSelectedTeamId, teams, isLoading: teamsLoading } = useTeamContext();

  const utils = trpc.useUtils();
  const { data: isConfigured, isLoading: configLoading } = trpc.repositories.isConfigured.useQuery(
    { teamId: selectedTeamId! },
    { enabled: !!selectedTeamId }
  );

  const { data: githubProfile, isLoading: profileLoading } = trpc.repositories.getAccountProfile.useQuery(
    { teamId: selectedTeamId! },
    { enabled: !!selectedTeamId && !!isConfigured }
  );

  const { data: githubRepos, isLoading: reposLoading, error: reposError, refetch } = trpc.repositories.listFromAccount.useQuery(
    { teamId: selectedTeamId! },
    { enabled: !!selectedTeamId && !!isConfigured }
  );

  const deleteMutation = trpc.repositories.deleteFromAccount.useMutation({
    onSuccess: () => {
      toast.success("Repository deleted successfully from GitHub");
      utils.repositories.listFromAccount.invalidate({ teamId: selectedTeamId! });
      setDeleteDialogOpen(false);
      setRepoToDelete(null);
    },
    onError: (error) => {
      toast.error(`Failed to delete repository: ${error.message}`);
    },
  });

  const handleDeleteConfirm = () => {
    if (repoToDelete && selectedTeamId) {
      deleteMutation.mutate({
        teamId: selectedTeamId,
        owner: repoToDelete.owner,
        repo: repoToDelete.repo,
      });
    }
  };

  const filteredRepos = githubRepos?.filter(repo =>
    repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    repo.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedTeamName = teams?.find(t => t.id === selectedTeamId)?.name || "Repositories";

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full font-display text-foreground bg-background overflow-hidden w-full relative">

        {/* Top Header */}
        <header className="h-16 border-b border-border flex items-center justify-between px-8 sticky top-0 z-10 liquid-glass shrink-0">
          <div className="flex items-center gap-6">
            <nav className="flex items-center gap-2 text-[11px] font-medium tracking-wide">
              <span className="text-muted-foreground">{selectedTeamId ? selectedTeamName : "DIVISION"}</span>
              <span className="text-muted-foreground/50">/</span>
              <span className="text-muted-foreground">Source Control</span>
              <span className="text-muted-foreground/50">/</span>
              <span className="text-foreground">Repository Hub</span>
            </nav>
          </div>

          <div className="flex items-center gap-6">
            {teamsLoading ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : teams && teams.length > 0 ? (
              <Select
                value={selectedTeamId?.toString() || ""}
                onValueChange={(value) => setSelectedTeamId(parseInt(value))}
              >
                <SelectTrigger className="w-[180px] h-8 bg-foreground/5 border-border text-[10px] uppercase tracking-widest font-bold text-muted-foreground hover:text-foreground hover:bg-foreground/10 focus:ring-0">
                  <SelectValue placeholder="Select Division" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border liquid-glass text-foreground">
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id.toString()} className="text-xs font-medium">
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            <div className="h-4 w-px bg-border"></div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => refetch()}
                disabled={reposLoading || !isConfigured}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
              >
                <RefreshCw className={`size-4 ${reposLoading ? 'animate-spin' : ''}`} />
              </button>

              {isConfigured && (
                <button
                  onClick={() => setCreateModalOpen(true)}
                  className="bg-blue-600/10 text-blue-500 hover:bg-blue-600/20 text-[11px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full transition-all flex items-center gap-2 mr-1 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                >
                  <Plus className="size-3.5" />
                  New Repo
                </button>
              )}

              <button
                onClick={() => setConnectModalOpen(true)}
                className="bg-foreground text-background text-[11px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full hover:bg-foreground/90 transition-all flex items-center gap-2 shadow-lg"
              >
                <Github className="size-3.5" />
                {isConfigured ? "Update PAT" : "Connect Account"}
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar p-8">
          {selectedTeamId ? (
            <div className="max-w-7xl mx-auto">
              <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="flex-1">
                  {isConfigured && githubProfile ? (
                    <div className="flex items-center gap-10 animate-in fade-in slide-in-from-left-8 duration-1000">
                      <div className="relative">
                        <img
                          src={githubProfile.avatarUrl}
                          alt={githubProfile.login}
                          className="size-32 rounded-[2.5rem] border-4 border-background shadow-[0_20px_50px_rgba(0,0,0,0.15)] ring-1 ring-border"
                        />
                        <div className="absolute -bottom-2 -right-2 size-10 bg-background border-4 border-background rounded-full flex items-center justify-center shadow-xl">
                          <div className="size-4 rounded-full bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)] animate-pulse" />
                        </div>
                      </div>
                      <div className="flex flex-col justify-center">
                        <p className="text-[11px] uppercase tracking-[0.5em] text-blue-500 mb-4 font-black">Division Identity Hub</p>
                        <h1 className="text-7xl font-light text-foreground leading-none tracking-tighter mb-4">
                          {githubProfile.name || githubProfile.login}
                        </h1>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 bg-foreground/5 px-3 py-1.5 rounded-full border border-border">
                            <Github className="size-3.5 text-muted-foreground" />
                            <span className="text-[11px] text-muted-foreground font-mono uppercase tracking-widest font-bold">
                              @{githubProfile.login}
                            </span>
                          </div>
                          <a
                            href={githubProfile.htmlUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] uppercase tracking-widest font-black text-muted-foreground/40 hover:text-foreground transition-colors"
                          >
                            View External Profile →
                          </a>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60 mb-6 font-bold">Source Governance</p>
                      <h1 className="text-5xl font-light text-foreground leading-[1.1] tracking-tight mb-4">
                        GitHub Account Hub
                      </h1>
                      <p className="text-muted-foreground text-[11px] tracking-wide uppercase">
                        Account-wide repository management for the division.
                      </p>
                    </>
                  )}
                </div>

                {isConfigured && (
                  <div className="relative w-full md:w-[320px]">
                    <Input
                      placeholder="Search repositories..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-12 pl-12 bg-foreground/[0.03] border-border rounded-xl focus-visible:ring-1 focus-visible:ring-blue-500/20 text-sm"
                    />
                    <Search className="size-4 absolute left-4 top-4 text-muted-foreground/40" />
                  </div>
                )}
              </div>

              {!isConfigured ? (
                <div className="flex items-center justify-center min-h-[400px] border-2 border-dashed border-border rounded-3xl bg-foreground/[0.01]">
                  <div className="text-center max-w-sm px-6">
                    <div className="size-16 rounded-2xl bg-foreground/5 flex items-center justify-center mx-auto mb-6">
                      <Github className="size-8 text-muted-foreground/40" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">Connect GitHub Account</h3>
                    <p className="text-sm text-muted-foreground mb-8">
                      Authorize access to list all repositories for this division using a Personal Access Token.
                    </p>
                    <button
                      onClick={() => setConnectModalOpen(true)}
                      className="px-8 py-3 bg-foreground text-background rounded-2xl text-[11px] font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl"
                    >
                      Connect Division Account
                    </button>
                  </div>
                </div>
              ) : reposError ? (
                <div className="flex items-center justify-center min-h-[400px] border border-red-500/20 rounded-3xl bg-red-500/[0.02] p-8">
                  <div className="text-center max-w-sm">
                    <div className="size-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                      <AlertCircle className="size-8 text-red-500" />
                    </div>
                    <h3 className="text-lg font-medium mb-2 text-red-500">Connection Failed</h3>
                    <p className="text-sm text-muted-foreground mb-8">
                      {reposError.message.includes("Bad credentials")
                        ? "Your GitHub token is invalid or has expired. Please update it to restore synchronization."
                        : reposError.message}
                    </p>
                    <button
                      onClick={() => setConnectModalOpen(true)}
                      className="px-8 py-3 bg-foreground text-background rounded-2xl text-[11px] font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl"
                    >
                      Update GitHub Token
                    </button>
                  </div>
                </div>
              ) : reposLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <div key={i} className="h-44 rounded-2xl border border-border bg-foreground/[0.01] animate-pulse" />
                  ))}
                </div>
              ) : filteredRepos && filteredRepos.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredRepos.map((repo: any) => {
                    const [owner, name] = repo.fullName.split('/');
                    return (
                      <div
                        key={repo.id}
                        className="group p-6 rounded-2xl border border-border bg-foreground/[0.01] hover:bg-foreground/[0.03] hover:border-foreground/20 transition-all liquid-glass flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <div className={`size-8 rounded-lg flex items-center justify-center ${repo.private ? 'bg-orange-500/10 text-orange-500' : 'bg-green-500/10 text-green-500'}`}>
                              {repo.private ? <Lock className="size-4" /> : <Globe className="size-4" />}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setRepoToDelete({ owner, repo: name });
                                  setDeleteDialogOpen(true);
                                }}
                                className="p-1.5 text-muted-foreground/0 group-hover:text-red-500/40 hover:text-red-500 transition-all rounded-md hover:bg-red-500/5"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                              <a
                                href={repo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-muted-foreground/0 group-hover:text-muted-foreground/40 hover:text-foreground transition-all rounded-md hover:bg-foreground/5"
                              >
                                <ExternalLink className="size-3.5" />
                              </a>
                            </div>
                          </div>
                          <h4 className="font-semibold text-lg tracking-tight mb-2 truncate group-hover:text-blue-500 transition-colors">
                            {repo.name}
                          </h4>
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed opacity-60 font-medium">
                            {repo.description || "No description provided."}
                          </p>
                        </div>
                        <div className="mt-6 flex items-center justify-between opacity-40 group-hover:opacity-100 transition-all">
                          <span className="text-[10px] font-bold uppercase tracking-widest">
                            {repo.defaultBranch}
                          </span>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-foreground/10">
                            {repo.private ? 'Private' : 'Public'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : githubRepos && githubRepos.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground/30 flex-col">
                  <Database className="size-12 mb-4" />
                  <p className="text-[10px] uppercase tracking-widest font-bold">No repositories found in this account</p>
                  <p className="text-[10px] mt-2 opacity-50">Try fetching again if new repos were recently added</p>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground/30 flex-col">
                  <Search className="size-12 mb-4" />
                  <p className="text-[10px] uppercase tracking-widest font-bold">No repositories found matching search</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[60vh] flex-col text-muted-foreground/40">
              <Database className="size-12 mb-4" />
              <p className="text-[10px] uppercase tracking-widest font-bold">
                Connect to division hub
              </p>
            </div>
          )}
        </div>

        {selectedTeamId && (
          <>
            <ConnectRepositoryModal
              teamId={selectedTeamId}
              open={connectModalOpen}
              onOpenChange={setConnectModalOpen}
            />
            <CreateRepositoryModal
              teamId={selectedTeamId}
              open={createModalOpen}
              onOpenChange={setCreateModalOpen}
            />
          </>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="bg-background/95 backdrop-blur-xl border-border rounded-xl shadow-2xl">
            <AlertDialogHeader className="space-y-4">
              <div className="size-12 rounded-xl bg-red-500/10 flex items-center justify-center mb-2">
                <AlertCircle className="size-6 text-red-500" />
              </div>
              <AlertDialogTitle className="text-2xl font-light tracking-tight">Destroy Repository?</AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed">
                You are about to permanently delete <span className="text-foreground font-semibold">"{repoToDelete?.repo}"</span> from GitHub. This action is irreversible and will remove all code, issues, and history.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-8 pt-4 border-t border-border flex items-center gap-4">
              <AlertDialogCancel className="bg-transparent border-transparent hover:bg-foreground/5 text-[10px] uppercase tracking-widest font-bold h-11 px-6 rounded-lg">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-red-500 hover:bg-red-600 text-white text-[10px] uppercase tracking-widest font-bold h-11 px-8 rounded-lg border-0 shadow-lg"
              >
                {deleteMutation.isPending ? "Destroying..." : "Confirm Destruction"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
