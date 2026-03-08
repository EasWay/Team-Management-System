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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background text-foreground border-border liquid-glass-card rounded-3xl p-0 overflow-hidden">
          <div className="relative p-8">
            <DialogHeader className="mb-8 border-b border-border pb-6">
              <DialogTitle className="flex items-center gap-2 text-2xl font-serif italic text-foreground tracking-tight">
                <UserCheck className="h-6 w-6 text-primary" />
                Personnel File
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Basic Information */}
              <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
                {member.pictureFileName && (
                  <div className="relative w-40 h-40 bg-muted rounded-full overflow-hidden border border-border shadow-xl">
                    <img
                      src={`/api/uploads/${member.pictureFileName}`}
                      alt={member.name}
                      className="w-full h-full object-cover grayscale brightness-90 hover:grayscale-0 hover:brightness-100 transition-all duration-700"
                    />
                  </div>
                )}

                <div className="space-y-4 flex-1">
                  <div className="space-y-1">
                    <h3 className="text-3xl font-serif italic text-foreground leading-tight">{member.name}</h3>
                    <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-primary">{member.position || 'Operative'}</p>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {member.email && (
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <Mail className="h-4 w-4 text-primary/60" />
                        <span className="text-xs font-medium tracking-wide">{member.email}</span>
                      </div>
                    )}
                    {member.phone && (
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <Phone className="h-4 w-4 text-primary/60" />
                        <span className="text-xs font-medium tracking-wide">{member.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Calendar className="h-4 w-4 text-primary/60" />
                      <span className="text-xs font-medium tracking-wide uppercase tracking-[0.1em]">Joined {formatDate(member.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {member.duties && (
                <div className="mt-12 bg-foreground/[0.03] rounded-2xl p-6 border border-border">
                  <div className="flex items-start gap-3 mb-4">
                    <Briefcase className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground">Operational Duties</span>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed font-light whitespace-pre-wrap">{member.duties}</p>
                </div>
              )}

            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}