import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Calendar, MapPin, Mail, Phone, Briefcase, Building2, History, UserCheck } from "lucide-react";
import { DepartmentAssignmentModal } from "./DepartmentAssignmentModal";
import { toast } from "sonner";
import type { TeamMember } from "@shared/types";

interface TeamMemberDetailModalProps {
  member: TeamMember & { currentDepartment?: any };
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function TeamMemberDetailModal({ member, isOpen, onClose, onUpdate }: TeamMemberDetailModalProps) {
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const { data: memberWithHistory, refetch } = trpc.team.getByIdWithDepartment.useQuery(
    { id: member.id },
    { enabled: isOpen }
  );

  const handleAssignmentSuccess = () => {
    setIsAssignmentModalOpen(false);
    refetch();
    onUpdate();
    toast.success("Department assignment updated successfully");
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Team Member Details
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{member.name}</CardTitle>
                <CardDescription className="text-blue-600 font-medium">
                  {member.position}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {member.pictureFileName && (
                  <div className="relative w-32 h-32 bg-gray-100 rounded-lg overflow-hidden mx-auto">
                    <img
                      src={`/api/uploads/${member.pictureFileName}`}
                      alt={member.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {member.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">{member.email}</span>
                    </div>
                  )}
                  {member.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">{member.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">Joined {formatDate(member.createdAt)}</span>
                  </div>
                </div>

                {member.duties && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Briefcase className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium">Duties</span>
                    </div>
                    <p className="text-sm text-gray-700 pl-6">{member.duties}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Current Department Assignment */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Current Department
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAssignmentModalOpen(true)}
                  >
                    {memberWithHistory?.currentDepartment ? "Reassign" : "Assign"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {memberWithHistory?.currentDepartment ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-green-700 bg-green-100">
                        Active
                      </Badge>
                      <span className="font-medium">{memberWithHistory.currentDepartment.name}</span>
                    </div>
                    {memberWithHistory.currentDepartment.description && (
                      <p className="text-sm text-gray-600">
                        {memberWithHistory.currentDepartment.description}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <MapPin className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">Not assigned to any department</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Department Assignment History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Assignment History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {memberWithHistory?.departmentHistory && memberWithHistory.departmentHistory.length > 0 ? (
                  <div className="space-y-3">
                    {memberWithHistory.departmentHistory
                      .sort((a, b) => new Date(b.assignment.assignedAt).getTime() - new Date(a.assignment.assignedAt).getTime())
                      .map((historyItem, index) => (
                        <div key={historyItem.assignment.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                          <div className="flex-shrink-0 mt-1">
                            <Badge variant={historyItem.assignment.isActive ? "default" : "secondary"}>
                              {historyItem.assignment.isActive ? "Current" : "Past"}
                            </Badge>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">
                              {historyItem.department?.name || "Unknown Department"}
                            </p>
                            <p className="text-xs text-gray-500">
                              Assigned on {formatDate(historyItem.assignment.assignedAt)}
                            </p>
                            {historyItem.assignment.assignedBy && (
                              <p className="text-xs text-gray-500">
                                Assigned by user ID: {historyItem.assignment.assignedBy}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <History className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No assignment history available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Department Assignment Modal */}
      <DepartmentAssignmentModal
        isOpen={isAssignmentModalOpen}
        onClose={() => {
          setIsAssignmentModalOpen(false);
          // Refetch data when modal closes (it handles success internally)
          refetch();
          onUpdate();
        }}
        selectedTeamMember={member}
      />
    </>
  );
}