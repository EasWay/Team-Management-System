import { trpc } from "@/lib/trpc";
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
          <Loader2 className="h-8 w-8 text-slate-400 mx-auto mb-4 animate-spin" />
          <p className="text-slate-500">Loading repositories...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center flex flex-col items-center justify-center">
        <p className="text-accent-alert mb-4">Failed to load repositories: {error.message}</p>
      </div>
    );
  }

  if (!repositories || repositories.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center flex flex-col items-center justify-center">
        <GitBranch className="h-12 w-12 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-400 mb-4">No repositories connected yet.</p>
      </div>
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
