import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Crown, Shield, Code, Eye } from "lucide-react";
import { toast } from "sonner";

interface RoleChangeDropdownProps {
  teamId: number;
  userId: number;
  currentRole: string;
}

const roles = [
  { value: "admin", label: "Admin", icon: Crown, description: "Full team management" },
  { value: "team_lead", label: "Team Lead", icon: Shield, description: "Project management" },
  { value: "developer", label: "Developer", icon: Code, description: "Code editing" },
  { value: "viewer", label: "Viewer", icon: Eye, description: "Read-only access" },
];

export function RoleChangeDropdown({ teamId, userId, currentRole }: RoleChangeDropdownProps) {
  const changeMemberRoleMutation = trpc.teams.changeMemberRole.useMutation();
  const utils = trpc.useUtils();

  const handleRoleChange = async (newRole: string) => {
    if (newRole === currentRole) return;

    try {
      await changeMemberRoleMutation.mutateAsync({
        teamId,
        userId,
        role: newRole as "admin" | "team_lead" | "developer" | "viewer",
      });
      toast.success(`Role changed to ${newRole}`);
      utils.teams.getMembers.invalidate({ teamId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to change role";
      toast.error(errorMessage);
    }
  };

  const currentRoleData = roles.find(r => r.value === currentRole);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={changeMemberRoleMutation.isPending}>
          {currentRoleData?.label || currentRole}
          <ChevronDown className="h-4 w-4 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {roles.map((role) => {
          const Icon = role.icon;
          return (
            <DropdownMenuItem
              key={role.value}
              onClick={() => handleRoleChange(role.value)}
              disabled={role.value === currentRole}
            >
              <Icon className="h-4 w-4 mr-2" />
              <div className="flex flex-col">
                <span className="font-medium">{role.label}</span>
                <span className="text-xs text-gray-500">{role.description}</span>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
