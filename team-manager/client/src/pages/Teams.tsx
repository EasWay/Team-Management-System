import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Users } from "lucide-react";
import { TeamList } from "@/components/TeamList";
import { CreateTeamForm } from "@/components/CreateTeamForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Teams() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const handleCreateSuccess = () => {
    setIsCreateDialogOpen(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Teams</h1>
            <p className="text-gray-600 mt-2">Manage your collaborative development teams</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Team
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Team</DialogTitle>
                <DialogDescription>
                  Create a new collaborative development team.
                </DialogDescription>
              </DialogHeader>
              <CreateTeamForm onSuccess={handleCreateSuccess} />
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="my-teams" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="my-teams" className="gap-2">
              <Users className="h-4 w-4" />
              My Teams
            </TabsTrigger>
            <TabsTrigger value="discover" className="gap-2">
              <Search className="h-4 w-4" />
              Discover
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-teams">
            <TeamList />
          </TabsContent>

          <TabsContent value="discover">
            <TeamList discover />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
