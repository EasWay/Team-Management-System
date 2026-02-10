import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface ConnectRepositoryModalProps {
  teamId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectRepositoryModal({ teamId, open, onOpenChange }: ConnectRepositoryModalProps) {
  const [repoUrl, setRepoUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");

  const utils = trpc.useUtils();
  const connectMutation = trpc.repositories.connect.useMutation({
    onSuccess: () => {
      toast.success("Repository connected successfully");
      utils.repositories.list.invalidate();
      onOpenChange(false);
      setRepoUrl("");
      setAccessToken("");
    },
    onError: (error) => {
      toast.error(`Failed to connect repository: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl || !accessToken) {
      toast.error("Please fill in all fields");
      return;
    }
    connectMutation.mutate({ teamId, repoUrl, accessToken });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect GitHub Repository</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="repoUrl">Repository URL</Label>
              <Input
                id="repoUrl"
                placeholder="https://github.com/owner/repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accessToken">GitHub Access Token</Label>
              <Input
                id="accessToken"
                type="password"
                placeholder="ghp_..."
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Create a personal access token in GitHub Settings → Developer settings
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={connectMutation.isPending}>
              {connectMutation.isPending ? "Connecting..." : "Connect"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
