import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { GitBranch, Loader2 } from "lucide-react";
import { RepositoryCard } from "./RepositoryCard";

interface RepositoryListProps {
  teamId: number;
}

export function RepositoryList({ teamId }: RepositoryListProps) {
  const { data: repositories, isLoading, error } = trpc.repositories.list.useQuery({ teamId });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-gray-400 mx-auto mb-4 animate-spin" />
          <p className="text-gray-500">Loading repositories...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-12 text-center">
          <p className="text-red-600 mb-4">Failed to load repositories: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  if (!repositories || repositories.length === 0) {
    return (
      <Card>
        <CardContent className="pt-12 text-center">
          <GitBranch className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No repositories connected yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {repositories.map((repo) => (
        <RepositoryCard key={repo.id} repository={repo} />
      ))}
    </div>
  );
}
