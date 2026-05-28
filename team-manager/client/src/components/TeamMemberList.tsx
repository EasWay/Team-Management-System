import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Shield, Crown, Code, Eye } from "lucide-react";
import { RoleChangeDropdown } from "./RoleChangeDropdown";
import { OfficeRoleDropdown } from "./OfficeRoleDropdown";
import { RemoveMemberButton } from "./RemoveMemberButton";

interface TeamMemberListProps {
  teamId: number;
}

const roleIcons = {
  admin: Crown,
  team_lead: Shield,
  developer: Code,
  viewer: Eye,
};

const roleColors = {
  admin: "bg-purple-100 text-purple-800",
  team_lead: "bg-blue-100 text-blue-800",
  developer: "bg-green-100 text-green-800",
  viewer: "bg-muted text-muted-foreground",
};

type TeamRole = "admin" | "team_lead" | "developer" | "viewer";

interface TeamMember {
  id: number;
  teamId: number;
  memberId: number;
  role: TeamRole;
  officeRole: string | null;
  joinedAt: Date;
  member: {
    id: number;
    name: string | null;
    email: string | null;
    pictureFileName: string | null;
  };
}

export function TeamMemberList({ teamId }: TeamMemberListProps) {
  const { data: members, isLoading, error } = trpc.teams.getMembers.useQuery({ teamId }) as {
    data: TeamMember[] | undefined;
    isLoading: boolean;
    error: Error | null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-muted-foreground mx-auto mb-4 animate-spin" />
          <p className="text-muted-foreground">Loading team members...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-12 text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">Failed to load team members: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  if (!members || members.length === 0) {
    return (
      <Card>
        <CardContent className="pt-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">No team members yet. Invite users to join this team.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {members.map((member) => {
        const RoleIcon = roleIcons[member.role as TeamRole];
        const roleColor = roleColors[member.role as TeamRole];
        const userName = member.member?.name || "Unknown Member";
        const roleLabel = member.officeRole
          ? member.officeRole.replace(/_/g, ' ')
          : member.role;

        return (
          <Card key={member.id}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                    {member.member?.pictureFileName ? (
                      <img
                        src={`/api/uploads/${member.member.pictureFileName}`}
                        alt={userName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Users className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{userName}</p>
                    <p className="text-sm text-muted-foreground capitalize">{roleLabel}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <OfficeRoleDropdown
                    teamId={teamId}
                    userId={member.memberId}
                    currentOfficeRole={member.officeRole}
                  />
                  <RoleChangeDropdown
                    teamId={teamId}
                    userId={member.memberId}
                    currentRole={member.role}
                  />
                  <RemoveMemberButton
                    teamId={teamId}
                    userId={member.memberId}
                    userName={userName}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
