import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GitBranch, ExternalLink, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface Repository {
  id: number;
  name: string;
  fullName: string;
  url: string;
  lastSyncAt: Date | null;
}

interface RepositoryCardProps {
  repository: Repository;
}

export function RepositoryCard({ repository }: RepositoryCardProps) {
  const utils = trpc.useUtils();
  const syncMutation = trpc.repositories.sync.useMutation({
    onSuccess: () => {
      toast.success("Repository synced successfully");
      utils.repositories.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to sync repository: ${error.message}`);
    },
  });

  const handleSync = () => {
    syncMutation.mutate({ id: repository.id });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-5 w-5" />
          {repository.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 mb-4">{repository.fullName}</p>
        {repository.lastSyncAt && (
          <p className="text-xs text-gray-500 mb-4">
            Last synced: {new Date(repository.lastSyncAt).toLocaleString()}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(repository.url, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View on GitHub
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Sync
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
