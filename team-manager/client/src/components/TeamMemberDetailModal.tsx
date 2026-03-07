import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Calendar, MapPin, Mail, Phone, Briefcase, Building2, History, UserCheck } from "lucide-react";
import type { TeamMember } from "@shared/types";

interface TeamMemberDetailModalProps {
  member: TeamMember;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function TeamMemberDetailModal({ member, isOpen, onClose, onUpdate }: TeamMemberDetailModalProps) {

  const formatDate = (date: Date | string | null) => {
    if (!date) return "Unknown date";
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
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
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
                      src={`/api/uploads/${member.pictureFileName}?t=${Date.now()}`}
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
                    <div className="flex items-start gap-2 mb-2">
                      <Briefcase className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Duties</span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 pl-6 whitespace-pre-wrap">{member.duties}</p>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}