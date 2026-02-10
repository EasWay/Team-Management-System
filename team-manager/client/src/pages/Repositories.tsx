import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { RepositoryList } from "@/components/RepositoryList";
import { ConnectRepositoryModal } from "@/components/ConnectRepositoryModal";
import { trpc } from "@/lib/trpc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Repositories() {
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [connectModalOpen, setConnectModalOpen] = useState(false);

  const { data: teams } = trpc.teams.list.useQuery();

  // Auto-select first team if available
  if (teams && teams.length > 0 && !selectedTeamId) {
    setSelectedTeamId(teams[0].id);
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Repositories</h1>
            <p className="text-gray-600 mt-2">Connect and manage GitHub repositories</p>
          </div>
          {selectedTeamId && (
            <Button onClick={() => setConnectModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Connect Repository
            </Button>
          )}
        </div>

        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">Team:</label>
          <Select
            value={selectedTeamId?.toString() || ""}
            onValueChange={(value) => setSelectedTeamId(parseInt(value))}
          >
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select a team" />
            </SelectTrigger>
            <SelectContent>
              {teams?.map((team) => (
                <SelectItem key={team.id} value={team.id.toString()}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedTeamId ? (
          <RepositoryList teamId={selectedTeamId} />
        ) : (
          <div className="text-center py-12 text-gray-500">
            Select a team to view repositories
          </div>
        )}

        {selectedTeamId && (
          <ConnectRepositoryModal
            teamId={selectedTeamId}
            open={connectModalOpen}
            onOpenChange={setConnectModalOpen}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
