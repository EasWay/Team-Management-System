import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, Zap } from "lucide-react";
import { Link } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";

export default function Home() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to Team Manager!
          </h1>
          <p className="text-gray-600 mb-6">
            Running in development mode. Manage your team members and departments.
          </p>
          <div className="flex gap-4">
            <Button asChild size="lg">
              <Link href="/team">
                <Users className="h-4 w-4 mr-2" />
                Team Members
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/departments">
                <Building2 className="h-4 w-4 mr-2" />
                Departments
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Start</CardTitle>
              <CardDescription>Get started with your team management</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-600">
                1. Navigate to the Team Members section to manage your team
              </p>
              <p className="text-sm text-gray-600">
                2. Create departments and organize your team structure
              </p>
              <p className="text-sm text-gray-600">
                3. Assign team members to departments and set up hierarchies
              </p>
              <p className="text-sm text-gray-600">
                4. View organizational charts and generate reports
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Features</CardTitle>
              <CardDescription>What you can do</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-600">
                ✓ Add and manage team members with profiles
              </p>
              <p className="text-sm text-gray-600">
                ✓ Create departments with hierarchical structure
              </p>
              <p className="text-sm text-gray-600">
                ✓ Assign team members to departments
              </p>
              <p className="text-sm text-gray-600">
                ✓ Generate organizational charts and reports
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
