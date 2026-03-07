import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { GitFork, ExternalLink, RefreshCw } from "lucide-react";

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
    <div className="group flex flex-col justify-between p-6 rounded-xl liquid-glass border border-border/50 transition-all hover:bg-foreground/[0.04] hover:border-border relative overflow-hidden">
      {/* Decorative Blur */}
      <div className="absolute -top-12 -right-12 w-24 h-24 bg-foreground/5 rounded-full blur-2xl pointer-events-none transition-all group-hover:bg-foreground/8"></div>

      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-4">
          <div className="shrink-0 size-8 rounded bg-foreground flex items-center justify-center text-background shadow-lg">
            <GitFork className="size-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-foreground font-medium text-xs tracking-wide truncate">{repository.name}</span>
              <span className="px-1.5 py-0.5 rounded border border-border text-[8px] text-muted-foreground uppercase tracking-widest leading-none">Connected</span>
            </div>
            <p className="text-muted-foreground text-[10px] truncate" title={repository.fullName}>{repository.fullName}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-auto">
        <div className="flex flex-col">
          {repository.lastSyncAt ? (
            <span className="text-muted-foreground/60 text-[9px] uppercase tracking-wider font-mono">
              Synced {new Date(repository.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : (
            <span className="text-muted-foreground/60 text-[9px] uppercase tracking-wider font-mono">Never Synced</span>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => window.open(repository.url, '_blank')}
            className="p-1.5 rounded bg-foreground/5 hover:bg-foreground/10 text-foreground/60 border border-transparent hover:border-border flex items-center transition-colors"
            title="View Repository"
          >
            <ExternalLink className="size-3.5" />
          </button>
          <button
            onClick={handleSync}
            disabled={syncMutation.isPending}
            className="p-1.5 rounded bg-foreground hover:bg-foreground/80 text-background flex items-center transition-colors disabled:opacity-50"
            title="Sync Data"
          >
            <RefreshCw className={`size-3.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
