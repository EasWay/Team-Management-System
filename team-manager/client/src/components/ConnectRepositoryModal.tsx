import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Github, Loader2, ShieldCheck } from "lucide-react";

interface ConnectRepositoryModalProps {
  teamId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectRepositoryModal({ teamId, open, onOpenChange }: ConnectRepositoryModalProps) {
  const [accessToken, setAccessToken] = useState("");

  const utils = trpc.useUtils();
  const connectMutation = trpc.repositories.configureAccount.useMutation({
    onSuccess: () => {
      toast.success("GitHub account connected successfully");
      utils.repositories.isConfigured.invalidate({ teamId });
      utils.repositories.listFromAccount.invalidate({ teamId });
      onOpenChange(false);
      setAccessToken("");
    },
    onError: (error) => {
      toast.error(`Failed to connect account: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) {
      toast.error("Please enter a GitHub Access Token");
      return;
    }
    connectMutation.mutate({ teamId, accessToken });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-background/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl p-0 overflow-hidden text-foreground">

        {/* Modal Header */}
        <div className="px-8 pt-8 pb-4 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-foreground/5 rounded-lg">
                <Github className="size-5" />
              </div>
              <h2 className="text-2xl font-light tracking-tight text-foreground">Connect Account</h2>
            </div>
            <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold">Synchronize all division repositories</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="px-8 py-6 space-y-6">
            <div className="relative group">
              <label htmlFor="accessToken" className="block text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Personal Access Token</label>
              <input
                id="accessToken"
                type="password"
                className="block w-full px-4 py-4 bg-foreground/5 border border-border rounded-xl focus:border-foreground/30 text-xs font-mono text-foreground placeholder-muted-foreground transition-all outline-none"
                placeholder="ghp_..."
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                autoFocus
              />
              <div className="mt-4 flex items-start gap-2 p-3 bg-blue-500/5 rounded-lg border border-blue-500/10">
                <ShieldCheck className="size-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-[10px] text-blue-500/80 leading-relaxed font-medium">
                  Your token is encrypted before storage. It will be used solely to list and synchronize division repositories.
                </p>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-8 py-4 border-t border-border flex items-center justify-end bg-foreground/5 gap-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={connectMutation.isPending}
              className="px-6 py-2.5 bg-foreground text-background text-[10px] font-bold tracking-widest uppercase hover:bg-foreground/90 transition-all rounded-lg disabled:opacity-50 flex items-center gap-2"
            >
              {connectMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Connecting...
                </>
              ) : "Connect Account"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
