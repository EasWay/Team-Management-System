import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit2, Users, Search, Filter, Eye } from "lucide-react";
import { AddTeamMemberForm } from "@/components/AddTeamMemberForm";
import { EditTeamMemberForm } from "@/components/EditTeamMemberForm";
import { TeamMemberDetailModal } from "@/components/TeamMemberDetailModal";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import type { TeamMember } from "@shared/types";

export default function TeamMembers() {
  const { data: members, isLoading, refetch } = trpc.team.listWithDepartments.useQuery();
  const { data: departments } = trpc.department.list.useQuery();
  const deleteMutation = trpc.team.delete.useMutation();
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");

  const handleDelete = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this team member?")) {
      try {
        await deleteMutation.mutateAsync({ id });
        toast.success("Team member deleted successfully");
        refetch();
      } catch (error) {
        toast.error("Failed to delete team member");
      }
    }
  };

  const handleAddSuccess = () => {
    setIsAddDialogOpen(false);
    refetch();
    toast.success("Team member added successfully");
  };

  const handleEditSuccess = () => {
    setIsEditDialogOpen(false);
    setSelectedMember(null);
    refetch();
    toast.success("Team member updated successfully");
  };

  // Filter members based on search term and department
  const filteredMembers = members?.filter((member) => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.duties?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = departmentFilter === "all" || 
                             (departmentFilter === "unassigned" && !member.currentDepartment) ||
                             (member.currentDepartment?.id.toString() === departmentFilter);
    
    return matchesSearch && matchesDepartment;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Loading team members...</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Team Members</h1>
            <p className="text-gray-600 mt-2">Manage your company team and their roles</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Team Member
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
                <DialogDescription>
                  Add a new member to your team with their details and role.
                </DialogDescription>
              </DialogHeader>
              <AddTeamMemberForm onSuccess={handleAddSuccess} />
            </DialogContent>
          </Dialog>
        </div>

      {/* Search and Filter Controls */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search team members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {departments?.map((dept) => (
                <SelectItem key={dept.id} value={dept.id.toString()}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredMembers && filteredMembers.length === 0 ? (
        <Card>
          <CardContent className="pt-12 text-center">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">
              {members && members.length === 0 
                ? "No team members yet. Add your first team member to get started."
                : "No team members match your current filters."
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMembers?.map((member) => (
            <Card key={member.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{member.name}</CardTitle>
                    <CardDescription className="text-sm font-medium text-blue-600 mt-1">
                      {member.position}
                    </CardDescription>
                    {member.currentDepartment && (
                      <CardDescription className="text-xs text-green-600 mt-1">
                        {member.currentDepartment.name}
                      </CardDescription>
                    )}
                    {!member.currentDepartment && (
                      <CardDescription className="text-xs text-gray-500 mt-1">
                        Unassigned
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedMember(member);
                        setIsDetailModalOpen(true);
                      }}
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedMember(member);
                        setIsEditDialogOpen(true);
                      }}
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(member.id)}
                      disabled={deleteMutation.isPending}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {member.pictureFileName && (
                  <div className="relative w-full h-40 bg-gray-100 rounded-md overflow-hidden">
                    <img
                      src={`/api/uploads/${member.pictureFileName}`}
                      alt={member.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                {member.email && (
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm text-gray-700">{member.email}</p>
                  </div>
                )}
                {member.phone && (
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="text-sm text-gray-700">{member.phone}</p>
                  </div>
                )}
                {member.duties && (
                  <div>
                    <p className="text-xs text-gray-500">Duties</p>
                    <p className="text-sm text-gray-700 line-clamp-2">{member.duties}</p>
                  </div>
                )}
                {/* Department Information */}
                <div>
                  <p className="text-xs text-gray-500">Department</p>
                  {member.currentDepartment ? (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-700">{member.currentDepartment.name}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // TODO: Open department reassignment modal
                          toast.info("Department reassignment coming soon");
                        }}
                        className="text-xs"
                      >
                        Reassign
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-500">Unassigned</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // TODO: Open department assignment modal
                          toast.info("Department assignment coming soon");
                        }}
                        className="text-xs"
                      >
                        Assign
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedMember && (
        <>
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Team Member</DialogTitle>
                <DialogDescription>
                  Update team member information and role.
                </DialogDescription>
              </DialogHeader>
              <EditTeamMemberForm member={selectedMember} onSuccess={handleEditSuccess} />
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
      </div>
    </DashboardLayout>
  );
}
