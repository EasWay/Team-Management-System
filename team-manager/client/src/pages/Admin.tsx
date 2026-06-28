import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useTeamContext } from "@/contexts/TeamContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ShieldAlert, UserPlus, Trash2, Shield, ShieldOff, RefreshCw } from "lucide-react";

export default function Admin() {
  const { user } = useAuth();
  const { teams } = useTeamContext();
  const utils = trpc.useUtils();

  // Add user form state
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addTeamId, setAddTeamId] = useState<string>("");
  const [addRole, setAddRole] = useState("developer");
  const [addOfficeRole, setAddOfficeRole] = useState("fullstack_engineer");
  const [addPosition, setAddPosition] = useState("Team Member");
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);

  // Delete confirmation
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
  const [deleteUserName, setDeleteUserName] = useState<string>("");

  const userRole = ((user as any)?.role || '').toLowerCase().trim();
  const isAdmin = ['admin', 'owner', 'superadmin'].includes(userRole);

  const { data: allUsers, isLoading, refetch } = trpc.admin.listUsers.useQuery(undefined, {
    enabled: isAdmin,
    retry: false,
  });

  const setRoleMutation = trpc.admin.setSystemRole.useMutation({
    onSuccess: () => {
      toast.success("User role updated");
      utils.admin.listUsers.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const removeUserMutation = trpc.admin.removeUser.useMutation({
    onSuccess: () => {
      toast.success("User removed from system");
      utils.admin.listUsers.invalidate();
      setDeleteUserId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const addUserMutation = trpc.admin.addUser.useMutation({
    onSuccess: () => {
      toast.success("User added to system");
      utils.admin.listUsers.invalidate();
      setAddName("");
      setAddEmail("");
      setAddTeamId("");
      setAddRole("developer");
      setAddOfficeRole("fullstack_engineer");
      setAddPosition("Team Member");
      setIsAddFormOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName || !addEmail || !addTeamId) {
      toast.error("Name, email, and team are required");
      return;
    }
    addUserMutation.mutate({
      name: addName,
      email: addEmail,
      teamId: Number(addTeamId),
      role: addRole,
      officeRole: addOfficeRole,
      position: addPosition,
    });
  };

  // If not admin, show access denied
  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8">
          <ShieldAlert className="size-16 text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground text-center max-w-md">
            You need administrator privileges to access this page.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage system users and permissions</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-2"
            >
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setIsAddFormOpen(!isAddFormOpen)}
              className="gap-2"
            >
              <UserPlus className="size-4" />
              Add User
            </Button>
          </div>
        </div>

        {/* Add User Form */}
        {isAddFormOpen && (
          <div className="bg-card border border-border rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Add New User</h2>
            <form onSubmit={handleAddUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Full Name</label>
                <Input
                  placeholder="Jane Smith"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</label>
                <Input
                  type="email"
                  placeholder="jane@example.com"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Team</label>
                <Select value={addTeamId} onValueChange={setAddTeamId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams?.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Team Role</label>
                <Select value={addRole} onValueChange={setAddRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="team_lead">Team Lead</SelectItem>
                    <SelectItem value="developer">Developer</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Office Role</label>
                <Select value={addOfficeRole} onValueChange={setAddOfficeRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="project_manager">Project Manager</SelectItem>
                    <SelectItem value="lead_researcher">Lead Researcher</SelectItem>
                    <SelectItem value="systems_architect">Systems Architect</SelectItem>
                    <SelectItem value="backend_engineer">Backend Engineer</SelectItem>
                    <SelectItem value="fullstack_engineer">Fullstack Engineer</SelectItem>
                    <SelectItem value="ai_engineer">AI Engineer</SelectItem>
                    <SelectItem value="qa_tester">QA Tester</SelectItem>
                    <SelectItem value="designer">Designer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Position Title</label>
                <Input
                  placeholder="Senior Engineer"
                  value={addPosition}
                  onChange={(e) => setAddPosition(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3 flex gap-2 pt-2">
                <Button type="submit" disabled={addUserMutation.isPending}>
                  {addUserMutation.isPending ? "Adding..." : "Add User"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsAddFormOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">
              All Users {allUsers ? `(${allUsers.length})` : ""}
            </h2>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
            </div>
          ) : !allUsers || allUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 gap-2">
              <p className="text-muted-foreground text-sm">No users found</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {allUsers.map((u) => {
                const isCurrentUser = u.id === user?.id;
                const isAdmin = u.role === 'admin';

                return (
                  <div key={u.id} className="px-6 py-4 flex items-start justify-between gap-4 hover:bg-foreground/5 transition-colors">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {/* Avatar */}
                      <div className="size-10 rounded-full bg-foreground/10 flex items-center justify-center font-bold text-sm uppercase shrink-0">
                        {u.name?.charAt(0) || u.email?.charAt(0) || "?"}
                      </div>

                      {/* User info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground text-sm truncate">
                            {u.name || "Unnamed User"}
                          </span>
                          {isCurrentUser && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-medium border border-blue-500/20">
                              You
                            </span>
                          )}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                            isAdmin
                              ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/20"
                              : "bg-foreground/5 text-muted-foreground border-border"
                          }`}>
                            {u.role || "user"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{u.email}</p>

                        {/* Team memberships */}
                        {u.memberships && u.memberships.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {u.memberships.map((m: any) => (
                              <span
                                key={m.teamId}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-foreground/5 text-muted-foreground border border-border"
                              >
                                {m.teamName} · {m.role}
                              </span>
                            ))}
                          </div>
                        )}

                        <p className="text-[10px] text-muted-foreground mt-1">
                          Joined {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "unknown"}
                          {u.loginMethod && ` · ${u.loginMethod}`}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    {!isCurrentUser && (
                      <div className="flex items-center gap-2 shrink-0">
                        {!isAdmin ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs h-8"
                            disabled={setRoleMutation.isPending}
                            onClick={() => setRoleMutation.mutate({ userId: u.id, role: 'admin' })}
                          >
                            <Shield className="size-3.5" />
                            Make Admin
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs h-8"
                            disabled={setRoleMutation.isPending}
                            onClick={() => setRoleMutation.mutate({ userId: u.id, role: 'user' })}
                          >
                            <ShieldOff className="size-3.5" />
                            Remove Admin
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs h-8 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60 hover:bg-destructive/10"
                          onClick={() => {
                            setDeleteUserId(u.id);
                            setDeleteUserName(u.name || u.email || "this user");
                          }}
                        >
                          <Trash2 className="size-3.5" />
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteUserId !== null} onOpenChange={(open) => !open && setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User from System</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{deleteUserName}</strong> from the system? This will delete their
              account and remove them from all teams. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteUserId && removeUserMutation.mutate({ userId: deleteUserId })}
              disabled={removeUserMutation.isPending}
            >
              {removeUserMutation.isPending ? "Removing..." : "Remove User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
