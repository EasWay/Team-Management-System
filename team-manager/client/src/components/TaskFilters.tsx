import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface TaskFiltersProps {
  teamId: number;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  assigneeFilter?: number;
  onAssigneeFilterChange: (value: number | undefined) => void;
  priorityFilter?: string;
  onPriorityFilterChange: (value: string | undefined) => void;
}

export function TaskFilters({
  teamId,
  searchQuery,
  onSearchChange,
  assigneeFilter,
  onAssigneeFilterChange,
  priorityFilter,
  onPriorityFilterChange,
}: TaskFiltersProps) {
  const { data: membersData } = trpc.teams.getMembers.useQuery({ teamId });

  // Type assertion to help TypeScript understand the correct type
  const members = membersData as Array<{
    id: number;
    teamId: number;
    userId: number;
    role: string;
    joinedAt: Date;
    user: {
      id: number;
      name: string | null;
      email: string | null;
    };
  }> | undefined;

  return (
    <div className="flex gap-3 items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select
        value={assigneeFilter ? String(assigneeFilter) : "all"}
        onValueChange={(value) =>
          onAssigneeFilterChange(value === "all" ? undefined : Number(value))
        }
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All assignees" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All assignees</SelectItem>
          <SelectItem value="unassigned">Unassigned</SelectItem>
          {members?.map((member) => (
            <SelectItem key={member.userId} value={String(member.userId)}>
              {member.user?.name || member.user?.email || `User ${member.userId}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={priorityFilter || "all"}
        onValueChange={(value) =>
          onPriorityFilterChange(value === "all" ? undefined : value)
        }
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="All priorities" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All priorities</SelectItem>
          <SelectItem value="low">Low</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="urgent">Urgent</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}