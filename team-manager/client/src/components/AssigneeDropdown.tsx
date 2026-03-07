import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";

interface AssigneeDropdownProps {
  teamId: number;
  value?: number;
  onChange: (value: number | undefined) => void;
  disabled?: boolean;
}

export function AssigneeDropdown({
  teamId,
  value,
  onChange,
  disabled,
}: AssigneeDropdownProps) {
  const { data: members, isLoading } = trpc.teams.getMembers.useQuery({
    teamId,
  });

  return (
    <Select
      value={value ? String(value) : undefined}
      onValueChange={(val) => onChange(val === "unassigned" ? undefined : Number(val))}
      disabled={disabled || isLoading}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select assignee" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unassigned">Unassigned</SelectItem>
        {members?.map((member) => (
          <SelectItem key={member.memberId} value={String(member.memberId)}>
            {member.member?.name || `User ${member.memberId}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
