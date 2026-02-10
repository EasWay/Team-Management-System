import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Users, User, Plus, X, UserPlus, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { DepartmentAssignmentModal } from "./DepartmentAssignmentModal";
import type { Department, TeamMember } from "@shared/types";

interface DepartmentCardProps {
  department: Department;
  onUpdate?: () => void;
  className?: string;
}

interface TeamMemberWithAssignment extends TeamMember {
  assignedAt?: Date;
  assignedBy?: number;
  assignedByName?: string;
}

export function DepartmentCard({ department, onUpdate, className }: DepartmentCardProps) {
  const { data: departmentMembers, refetch: refetchMembers } = trpc.department.getMembers.useQuery(
    { departmentId: department.id }
  );
  const { data: allTeamMembers } = trpc.team.list.useQuery();
  const { data: unassignedMembers } = trpc.department.getUnassignedMembers.useQuery();
  
  const assignMutation = trpc.department.assignMember.useMutation();
  const unassignMutation = trpc.department.unassignMember.useMutation();
  
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);

  // Get manager information
  const manager = allTeamMembers?.find(tm => tm.id === department.managerId);

  // Get available members for assignment (unassigned members)
  const availableMembers = unassignedMembers || [];

  const handleAssignMember = async () => {
    if (!selectedMemberId) {
      toast.error("Please select a team member to assign");
      return;
    }

    setIsAssigning(true);
    try {
      await assignMutation.mutateAsync({
        teamMemberId: parseInt(selectedMemberId),
        departmentId: department.id,
      });
      
      toast.success("Team member assigned successfully");
      setIsAssignDialogOpen(false);
      setSelectedMemberId("");
      refetchMembers();
      onUpdate?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to assign team member";
      toast.error(errorMessage);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassignMember = async (teamMemberId: number, memberName: string) => {
    if (window.confirm(`Are you sure you want to unassign ${memberName} from ${department.name}?`)) {
      try {
        await unassignMutation.mutateAsync({
          teamMemberId,
          departmentId: department.id,
        });
        
        toast.success("Team member unassigned successfully");
        refetchMembers();
        onUpdate?.();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to unassign team member";
        toast.error(errorMessage);
      }
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Card className={`overflow-hidden hover:shadow-lg transition-shadow ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-xl">{department.name}</CardTitle>
              {department.description && (
                <CardDescription className="mt-1">
                  {department.description}
                </CardDescription>
              )}
            </div>
          </div>
          
          <Badge variant="secondary" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {departmentMembers?.length || 0}
          </Badge>
        </div>

        {manager && (
          <div className="flex items-center gap-2 mt-3 p-2 bg-gray-50 rounded-lg">
            <User className="h-4 w-4 text-purple-600" />
            <span className="text-sm text-gray-600">Manager:</span>
            <span className="text-sm font-medium">{manager.name}</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Team Members Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-700">Team Members</h4>
            <div className="flex gap-2">
              <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1">
                    <UserPlus className="h-3 w-3" />
                    Assign
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Assign Team Member</DialogTitle>
                    <DialogDescription>
                      Select a team member to assign to this department.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        Select Team Member
                    </label>
                    <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a team member..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id.toString()}>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={member.pictureFileName ? `/uploads/${member.pictureFileName}` : undefined} />
                                <AvatarFallback className="text-xs">
                                  {getInitials(member.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{member.name}</p>
                                <p className="text-xs text-gray-500">{member.position}</p>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {availableMembers.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No unassigned team members available
                    </p>
                  )}
                  
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setIsAssignDialogOpen(false)}
                      disabled={isAssigning}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAssignMember}
                      disabled={!selectedMemberId || isAssigning || availableMembers.length === 0}
                    >
                      {isAssigning ? "Assigning..." : "Assign Member"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            
            <Button 
              size="sm" 
              variant="default" 
              className="gap-1"
              onClick={() => setIsAssignmentModalOpen(true)}
            >
              <Users className="h-3 w-3" />
              Manage
            </Button>
            </div>
          </div>

          {departmentMembers && departmentMembers.length > 0 ? (
            <div className="space-y-2">
              {departmentMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.pictureFileName ? `/uploads/${member.pictureFileName}` : undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{member.name}</p>
                      <p className="text-xs text-gray-500">{member.position}</p>
                      {(member as TeamMemberWithAssignment).assignedAt && (
                        <p className="text-xs text-gray-400">
                          Assigned: {formatDate((member as TeamMemberWithAssignment).assignedAt!)}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleUnassignMember(member.id, member.name)}
                    disabled={unassignMutation.isPending}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <UserMinus className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm">No team members assigned</p>
              <p className="text-xs text-gray-400 mt-1">
                Click "Assign" to add team members to this department
              </p>
            </div>
          )}
        </div>

        {/* Department Info */}
        <div className="pt-3 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
            <div>
              <p>Created</p>
              <p className="font-medium text-gray-700">
                {formatDate(department.createdAt)}
              </p>
            </div>
            <div>
              <p>Last Updated</p>
              <p className="font-medium text-gray-700">
                {formatDate(department.updatedAt)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
      
      {/* Department Assignment Modal */}
      <DepartmentAssignmentModal
        isOpen={isAssignmentModalOpen}
        onClose={() => {
          setIsAssignmentModalOpen(false);
          refetchMembers();
          onUpdate?.();
        }}
        selectedDepartment={department}
        mode="assign"
      />
    </Card>
  );
}