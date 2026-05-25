import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Building2,
  Briefcase,
  Target,
  Code,
  Sparkles,
  TestTube,
  Palette,
  Check,
  Loader2,
} from "lucide-react";

interface OfficeRoleDropdownProps {
  teamId: number;
  userId: number;
  currentOfficeRole: string | null;
}

const OFFICE_ROLES = [
  {
    value: "project_manager",
    label: "Project Manager",
    icon: Briefcase,
    office: "100",
    color: "text-blue-600",
  },
  {
    value: "lead_researcher",
    label: "Lead Researcher",
    icon: Target,
    office: "101",
    color: "text-purple-600",
  },
  {
    value: "systems_architect",
    label: "Systems Architect",
    icon: Briefcase,
    office: "201",
    color: "text-indigo-600",
  },
  {
    value: "backend_engineer",
    label: "Backend Engineer",
    icon: Code,
    office: "202",
    color: "text-green-600",
  },
  {
    value: "fullstack_engineer",
    label: "Full Stack Engineer",
    icon: Code,
    office: "203",
    color: "text-cyan-600",
  },
  {
    value: "ai_engineer",
    label: "AI Engineer",
    icon: Sparkles,
    office: "301",
    color: "text-orange-600",
  },
  {
    value: "qa_tester",
    label: "QA Tester",
    icon: TestTube,
    office: "302",
    color: "text-yellow-600",
  },
  {
    value: "designer",
    label: "Designer",
    icon: Palette,
    office: "303",
    color: "text-pink-600",
  },
];

export function OfficeRoleDropdown({
  teamId,
  userId,
  currentOfficeRole,
}: OfficeRoleDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const utils = trpc.useUtils();

  const updateOfficeRoleMutation = trpc.teams.updateOfficeRole.useMutation({
    onSuccess: () => {
      toast.success("Office role updated successfully!");
      utils.teams.getMembers.invalidate({ teamId });
      setIsOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleRoleChange = (newRole: string | null) => {
    updateOfficeRoleMutation.mutate({
      teamId,
      userId,
      officeRole: newRole,
    });
  };

  const currentRole = OFFICE_ROLES.find((r) => r.value === currentOfficeRole);
  const CurrentIcon = currentRole?.icon || Building2;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={updateOfficeRoleMutation.isPending}
        >
          {updateOfficeRoleMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CurrentIcon className={`h-4 w-4 mr-2 ${currentRole?.color || ""}`} />
          )}
          {currentRole ? `Office #${currentRole.office}` : "Assign Office"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Assign to Office</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {OFFICE_ROLES.map((role) => {
          const Icon = role.icon;
          const isSelected = currentOfficeRole === role.value;
          
          return (
            <DropdownMenuItem
              key={role.value}
              onClick={() => handleRoleChange(role.value)}
              className="cursor-pointer"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${role.color}`} />
                  <div>
                    <div className="font-medium">{role.label}</div>
                    <div className="text-xs text-muted-foreground">
                      Office #{role.office}
                    </div>
                  </div>
                </div>
                {isSelected && <Check className="h-4 w-4 text-primary" />}
              </div>
            </DropdownMenuItem>
          );
        })}
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={() => handleRoleChange(null)}
          className="cursor-pointer text-muted-foreground"
        >
          <Building2 className="h-4 w-4 mr-2" />
          No Office (Visitor)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
