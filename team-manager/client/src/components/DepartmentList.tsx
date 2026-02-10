import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Edit2, Building2, Users, Search } from "lucide-react";
import { toast } from "sonner";
import { DepartmentForm } from "./DepartmentForm";
import type { Department } from "@shared/types";

interface DepartmentWithDetails extends Department {
  memberCount?: number;
  managerName?: string;
  parentName?: string;
}

export function DepartmentList() {
  const { data: departments, isLoading, refetch } = trpc.department.list.useQuery();
  const { data: stats } = trpc.department.getStats.useQuery();
  const { data: teamMembers } = trpc.team.list.useQuery();
  const deleteMutation = trpc.department.delete.useMutation();
  
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentWithDetails | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterByManager, setFilterByManager] = useState("");

  // Enhance departments with additional details from stats
  const enhancedDepartments: DepartmentWithDetails[] = departments?.map(dept => {
    const deptStats = stats?.departmentSizeDistribution?.find((s: any) => s.departmentId === dept.id);
    const manager = teamMembers?.find(tm => tm.id === dept.managerId);
    
    return {
      ...dept,
      memberCount: deptStats?.memberCount || 0,
      managerName: manager?.name || undefined,
      parentName: departments.find(p => p.id === dept.parentId)?.name || undefined,
    };
  }) || [];

  // Filter departments based on search and filter criteria
  const filteredDepartments = enhancedDepartments.filter(dept => {
    const matchesSearch = dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (dept.description && dept.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesManager = !filterByManager || 
                          (dept.managerName && dept.managerName.toLowerCase().includes(filterByManager.toLowerCase()));
    
    return matchesSearch && matchesManager;
  });

  const handleDelete = async (id: number, name: string) => {
    if (window.confirm(`Are you sure you want to delete the department "${name}"? This action cannot be undone.`)) {
      try {
        await deleteMutation.mutateAsync({ id });
        toast.success("Department deleted successfully");
        refetch();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to delete department";
        toast.error(errorMessage);
      }
    }
  };

  const handleAddSuccess = () => {
    setIsAddDialogOpen(false);
    refetch();
    toast.success("Department created successfully");
  };

  const handleEditSuccess = () => {
    setIsEditDialogOpen(false);
    setSelectedDepartment(null);
    refetch();
    toast.success("Department updated successfully");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Loading departments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Departments</h1>
          <p className="text-gray-600 mt-2">Manage organizational departments and structure</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Department
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Department</DialogTitle>
              <DialogDescription>
                Create a new department in your organization. You can assign a parent department and manager.
              </DialogDescription>
            </DialogHeader>
            <DepartmentForm onSuccess={handleAddSuccess} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search departments by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="relative">
          <Input
            placeholder="Filter by manager..."
            value={filterByManager}
            onChange={(e) => setFilterByManager(e.target.value)}
            className="w-48"
          />
        </div>
      </div>

      {/* Department Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Building2 className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Departments</p>
                  <p className="text-2xl font-bold">{stats.totalDepartments}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Assigned Members</p>
                  <p className="text-2xl font-bold">{stats.totalAssignedMembers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-orange-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Unassigned Members</p>
                  <p className="text-2xl font-bold">{stats.totalUnassignedMembers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Department List */}
      {filteredDepartments.length === 0 ? (
        <Card>
          <CardContent className="pt-12 text-center">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            {departments?.length === 0 ? (
              <p className="text-gray-600 mb-4">No departments yet. Create your first department to get started.</p>
            ) : (
              <p className="text-gray-600 mb-4">No departments match your search criteria.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDepartments.map((department) => (
            <Card key={department.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{department.name}</CardTitle>
                    {department.parentName && (
                      <CardDescription className="text-sm text-gray-500 mt-1">
                        Parent: {department.parentName}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedDepartment(department);
                        setIsEditDialogOpen(true);
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(department.id, department.name)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {department.description && (
                  <div>
                    <p className="text-xs text-gray-500">Description</p>
                    <p className="text-sm text-gray-700 line-clamp-2">{department.description}</p>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">Team Members</p>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-blue-500" />
                      <p className="text-sm font-medium">{department.memberCount || 0}</p>
                    </div>
                  </div>
                  
                  {department.managerName && (
                    <div>
                      <p className="text-xs text-gray-500">Manager</p>
                      <p className="text-sm text-gray-700">{department.managerName}</p>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t">
                  <p className="text-xs text-gray-500">
                    Created: {new Date(department.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog - DepartmentForm will be implemented in subtask 9.3 */}
      {selectedDepartment && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Department</DialogTitle>
              <DialogDescription>
                Update department information, change parent department, or reassign the manager.
              </DialogDescription>
            </DialogHeader>
            <DepartmentForm 
              department={selectedDepartment} 
              onSuccess={handleEditSuccess}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}