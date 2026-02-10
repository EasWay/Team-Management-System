import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { KanbanBoard } from "@/components/KanbanBoard";
import { CreateTaskForm } from "@/components/CreateTaskForm";
import { Card, CardContent } from "@/components/ui/card";

export default function Tasks() {
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: teams, isLoading: teamsLoading } = trpc.teams.list.useQuery();

  const handleCreateSuccess = () => {
    setIsCreateDialogOpen(false);
  };

  // Auto-select first team if none selected
  if (teams && teams.length > 0 && !selectedTeamId) {
    setSelectedTeamId(teams[0].id);
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Task Board</h1>
            <p className="text-gray-600 mt-2">Manage tasks with Kanban boards</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Team Selector */}
            {teamsLoading ? (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading teams...</span>
              </div>
            ) : teams && teams.length > 0 ? (
              <Select 
                value={selectedTeamId?.toString() || ""} 
                onValueChange={(value) => setSelectedTeamId(parseInt(value))}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id.toString()}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            {/* Create Task Button */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" disabled={!selectedTeamId}>
                  <Plus className="h-4 w-4" />
                  Create Task
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Task</DialogTitle>
                  <DialogDescription>
                    Add a new task to the selected team's board.
                  </DialogDescription>
                </DialogHeader>
                {selectedTeamId && (
                  <CreateTaskForm teamId={selectedTeamId} onSuccess={handleCreateSuccess} />
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Task Board Content */}
        {teamsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 text-gray-400 mx-auto mb-4 animate-spin" />
              <p className="text-gray-500">Loading teams...</p>
            </div>
          </div>
        ) : !teams || teams.length === 0 ? (
          <Card>
            <CardContent className="pt-12 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No teams yet. Create a team first to start managing tasks.</p>
            </CardContent>
          </Card>
        ) : selectedTeamId ? (
          <KanbanBoard teamId={selectedTeamId} />
        ) : (
          <Card>
            <CardContent className="pt-12 text-center">
              <p className="text-gray-600">Select a team to view its task board</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
