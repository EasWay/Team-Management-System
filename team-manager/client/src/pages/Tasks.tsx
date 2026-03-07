import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { KanbanBoard } from "@/components/KanbanBoard";
import { CreateTaskForm } from "@/components/CreateTaskForm";
import { useTeamContext } from "@/contexts/TeamContext";
import { Loader2 } from "lucide-react";

export default function Tasks() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { selectedTeamId, teams, isLoading: teamsLoading } = useTeamContext();

  const handleCreateSuccess = () => {
    setIsCreateDialogOpen(false);
  };

  const selectedTeamName = teams?.find(t => t.id === selectedTeamId)?.name || "Task Board";

  return (
    <DashboardLayout>
      <div className="flex-1 max-w-[1600px] w-full p-6 mx-auto flex flex-col h-full overflow-hidden">
        {/* Header Section */}
        <header className="flex justify-between items-center mb-6 shrink-0 pt-2">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground text-[10px] uppercase tracking-widest font-bold mb-2">
              <span>{selectedTeamId ? selectedTeamName : "ALPHA GROUP"}</span>
              <span className="size-1 rounded-full bg-foreground/20"></span>
              <span>TASKS</span>
            </div>
            <h2 className="text-4xl font-light tracking-tight text-foreground">{selectedTeamName}</h2>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex -space-x-2">
              <div className="size-8 rounded-full border border-background bg-foreground/10 flex items-center justify-center text-[10px] font-bold text-foreground shadow-sm z-30">AL</div>
              <div className="size-8 rounded-full border border-background bg-foreground/20 flex items-center justify-center text-[10px] font-bold text-foreground shadow-sm z-20">MR</div>
              <div className="size-8 rounded-full border border-background bg-foreground/5 flex items-center justify-center text-[10px] font-bold text-muted-foreground shadow-sm z-10">+4</div>
            </div>

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <button
                  disabled={!selectedTeamId}
                  className="px-6 py-2.5 bg-foreground text-background text-[10px] font-bold tracking-widest uppercase hover:bg-foreground/80 transition-colors rounded disabled:opacity-50"
                >
                  Create Issue
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md bg-background text-foreground border-border">
                <div className="absolute inset-0 bg-primary/5 blur-[100px] pointer-events-none" />
                <DialogHeader className="relative z-10">
                  <DialogTitle className="text-foreground font-display text-xl">Create Task</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Add a new task to {selectedTeamName}'s board.
                  </DialogDescription>
                </DialogHeader>
                <div className="relative z-10">
                  {selectedTeamId && (
                    <CreateTaskForm teamId={selectedTeamId} onSuccess={handleCreateSuccess} />
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        {/* Task Board Content */}
        {teamsLoading ? (
          <div className="flex justify-center items-center flex-1">
            <div className="text-center">
              <Loader2 className="size-12 text-muted-foreground/30 mb-4 animate-spin text-center mx-auto" />
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Loading workspace...</p>
            </div>
          </div>
        ) : !teams || teams.length === 0 ? (
          <div className="flex justify-center items-center flex-1">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-4">No squads found. Create a squad to start.</p>
            </div>
          </div>
        ) : selectedTeamId ? (
          <div className="flex-1 overflow-hidden">
            <KanbanBoard teamId={selectedTeamId} />
          </div>
        ) : (
          <div className="flex justify-center items-center flex-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Select a squad to view flow</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
