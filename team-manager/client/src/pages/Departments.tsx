import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Plus, BarChart3, Network } from "lucide-react";
import { DepartmentList } from "@/components/DepartmentList";
import { DepartmentForm } from "@/components/DepartmentForm";
import { OrganizationalChart } from "@/components/OrganizationalChart";
// import { DepartmentReports } from "@/components/DepartmentReports";
import DashboardLayout from "@/components/DashboardLayout";

// Temporary placeholder until Vite cache clears
function DepartmentReports() {
  return <div className="p-8 text-center">Department Reports - Coming Soon</div>;
}

export default function Departments() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const handleCreateSuccess = () => {
    setIsCreateDialogOpen(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Department Management</h1>
            <p className="text-gray-600 mt-2">Organize your team into departments and manage hierarchies</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Department
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Department</DialogTitle>
                <DialogDescription>
                  Add a new department to your organization. You can assign a parent department and manager.
                </DialogDescription>
              </DialogHeader>
              <DepartmentForm onSuccess={handleCreateSuccess} />
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="list" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="list" className="gap-2">
              <Building2 className="h-4 w-4" />
              Departments
            </TabsTrigger>
            <TabsTrigger value="chart" className="gap-2">
              <Network className="h-4 w-4" />
              Org Chart
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Departments</CardTitle>
                <CardDescription>
                  Manage your organization's departments, assign managers, and organize hierarchies
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DepartmentList />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chart" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Organizational Chart</CardTitle>
                <CardDescription>
                  Visual representation of your department hierarchy and reporting structure
                </CardDescription>
              </CardHeader>
              <CardContent>
                <OrganizationalChart />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Department Reports</CardTitle>
                <CardDescription>
                  Analytics and insights about your department structure and team distribution
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DepartmentReports />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}