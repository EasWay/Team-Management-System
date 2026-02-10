import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { CommitList } from "./CommitList";
import { PullRequestList } from "./PullRequestList";
import { IssueList } from "./IssueList";

interface RepositoryDashboardProps {
  repositoryId: number;
}

export function RepositoryDashboard({ repositoryId }: RepositoryDashboardProps) {
  const { data: repoData, isLoading, error } = trpc.repositories.getData.useQuery({ id: repositoryId });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-12 text-center">
          <p className="text-red-600">Failed to load repository data: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  if (!repoData) {
    return null;
  }

  return (
    <Tabs defaultValue="commits" className="w-full">
      <TabsList>
        <TabsTrigger value="commits">Commits</TabsTrigger>
        <TabsTrigger value="prs">Pull Requests</TabsTrigger>
        <TabsTrigger value="issues">Issues</TabsTrigger>
        <TabsTrigger value="branches">Branches</TabsTrigger>
      </TabsList>
      <TabsContent value="commits">
        <CommitList commits={repoData.commits} />
      </TabsContent>
      <TabsContent value="prs">
        <PullRequestList pullRequests={repoData.pullRequests} />
      </TabsContent>
      <TabsContent value="issues">
        <IssueList issues={repoData.issues} />
      </TabsContent>
      <TabsContent value="branches">
        <Card>
          <CardHeader>
            <CardTitle>Branches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {repoData.branches.map((branch) => (
                <div key={branch.name} className="flex items-center justify-between p-2 border rounded">
                  <span className="font-mono text-sm">{branch.name}</span>
                  {branch.protected && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Protected</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
