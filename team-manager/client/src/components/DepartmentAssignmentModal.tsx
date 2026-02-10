import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, Building2, Calendar, User } from "lucide-react";
import type { TeamMember, Department } from "@shared/types";

const assignmentSchema = z.object({
  teamMemberId: z.number().min(1, "Please select a team member"),
  departmentId: z.number().min(1, "Please select a department"),
});

type AssignmentFormValues = z.infer<typeof assignmentSchema>;

interface DepartmentAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTeamMember?: TeamMember;
  selectedDepartment?: Department;
  mode?: 'assign' | 'reassign' | 'unassign';
}

export function DepartmentAssignmentModal({
  isOpen,
  onClose,
  selectedTeamMember,
  selectedDepartment,
  mode = 'assign'
}: DepartmentAssignmentModalProps) {
  const [currentMode, setCurrentMode] = useState<'assign' | 'reassign' | 'unassign'>(mode);
  
  const { data: teamMembers } = trpc.team.listWithDepartments.useQuery();
  const { data: departments } = trpc.department.list.useQuery();
  const assignMutation = trpc.department.assignMember.useMutation();
  const unassignMutation = trpc.department.unassignMember.useMutation();
  
  const utils = trpc.useUtils();

  const form = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      teamMemberId: selectedTeamMember?.id || 0,
      departmentId: selectedDepartment?.id || 0,
    },
  });

  const selectedTeamMemberData = teamMembers?.find(
    member => member.id === form.watch('teamMemberId')
  );

  const selectedDepartmentData = departments?.find(
    dept => dept.id === form.watch('departmentId')
  );

  const handleAssign = async (values: AssignmentFormValues) => {
    try {
      await assignMutation.mutateAsync({
        teamMemberId: values.teamMemberId,
        departmentId: values.departmentId,
      });

      toast.success(
        currentMode === 'reassign' 
          ? "Team member reassigned successfully" 
          : "Team member assigned successfully"
      );

      // Invalidate relevant queries
      await utils.team.listWithDepartments.invalidate();
      await utils.department.getMembers.invalidate();
      await utils.department.list.invalidate();

      form.reset();
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to assign team member";
      toast.error(errorMessage);
    }
  };

  const handleUnassign = async () => {
    if (!selectedTeamMemberData) return;

    try {
      await unassignMutation.mutateAsync({
        teamMemberId: selectedTeamMemberData.id,
      });

      toast.success("Team member unassigned successfully");

      // Invalidate relevant queries
      await utils.team.listWithDepartments.invalidate();
      await utils.department.getMembers.invalidate();
      await utils.department.list.invalidate();

      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to unassign team member";
      toast.error(errorMessage);
    }
  };

  const isLoading = assignMutation.isPending || unassignMutation.isPending;

  const getModalTitle = () => {
    switch (currentMode) {
      case 'assign':
        return 'Assign Team Member to Department';
      case 'reassign':
        return 'Reassign Team Member';
      case 'unassign':
        return 'Unassign Team Member';
      default:
        return 'Manage Department Assignment';
    }
  };

  const getCurrentAssignment = () => {
    if (!selectedTeamMemberData) return null;
    
    // The current assignment is available through currentDepartment
    if (selectedTeamMemberData.currentDepartment) {
      return {
        department: selectedTeamMemberData.currentDepartment,
        assignment: {
          departmentId: selectedTeamMemberData.currentDepartment.id,
          isActive: true,
          assignedAt: new Date(), // We don't have the exact date from this endpoint
        }
      };
    }
    
    return null;
  };

  const currentAssignment = getCurrentAssignment();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {getModalTitle()}
          </DialogTitle>
          <DialogDescription>
            Manage team member department assignments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode Selection */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={currentMode === 'assign' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentMode('assign')}
              disabled={isLoading}
            >
              Assign
            </Button>
            <Button
              type="button"
              variant={currentMode === 'reassign' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentMode('reassign')}
              disabled={isLoading}
            >
              Reassign
            </Button>
            <Button
              type="button"
              variant={currentMode === 'unassign' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentMode('unassign')}
              disabled={isLoading}
            >
              Unassign
            </Button>
          </div>

          {/* Current Assignment Display */}
          {selectedTeamMemberData && currentAssignment && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium">Current Assignment</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {currentAssignment.department?.name || 'Unknown Department'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Calendar className="h-3 w-3" />
                  Assigned: {new Date(currentAssignment.assignment.assignedAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          )}

          {/* Unassign Mode */}
          {currentMode === 'unassign' && (
            <div className="space-y-4">
              {selectedTeamMemberData && currentAssignment ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Are you sure you want to unassign <strong>{selectedTeamMemberData.name}</strong> from{' '}
                    <strong>{currentAssignment.department?.name}</strong>?
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleUnassign}
                      disabled={isLoading}
                      variant="destructive"
                      className="flex-1"
                    >
                      {isLoading ? "Unassigning..." : "Confirm Unassign"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onClose}
                      disabled={isLoading}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600">
                  Please select a team member with an active assignment to unassign.
                </p>
              )}
            </div>
          )}

          {/* Assign/Reassign Mode */}
          {(currentMode === 'assign' || currentMode === 'reassign') && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleAssign)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="teamMemberId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Team Member
                      </FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value?.toString() || ""}
                        disabled={isLoading || !!selectedTeamMember}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a team member" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {teamMembers?.map((member) => {
                            const hasActiveAssignment = !!member.currentDepartment;
                            const currentDept = member.currentDepartment;

                            return (
                              <SelectItem key={member.id} value={member.id.toString()}>
                                <div className="flex items-center justify-between w-full">
                                  <div>
                                    <span>{member.name}</span>
                                    <span className="text-gray-500 text-sm ml-2">- {member.position}</span>
                                  </div>
                                  {currentDept && (
                                    <Badge variant="outline" className="ml-2 text-xs">
                                      {currentDept.name}
                                    </Badge>
                                  )}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="departmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Department
                      </FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value?.toString() || ""}
                        disabled={isLoading || !!selectedDepartment}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {departments?.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id.toString()}>
                              {dept.name}
                              {dept.description && (
                                <span className="text-gray-500 text-sm ml-2">
                                  - {dept.description.substring(0, 30)}
                                  {dept.description.length > 30 ? "..." : ""}
                                </span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Assignment Preview */}
                {selectedTeamMemberData && selectedDepartmentData && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">Assignment Preview</span>
                    </div>
                    <p className="text-sm text-blue-700">
                      <strong>{selectedTeamMemberData.name}</strong> will be assigned to{' '}
                      <strong>{selectedDepartmentData.name}</strong>
                      {currentMode === 'reassign' && currentAssignment && (
                        <span> (currently in {currentAssignment.department?.name})</span>
                      )}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={isLoading} className="flex-1">
                    {isLoading ? (
                      currentMode === 'reassign' ? "Reassigning..." : "Assigning..."
                    ) : (
                      currentMode === 'reassign' ? "Reassign Member" : "Assign Member"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}