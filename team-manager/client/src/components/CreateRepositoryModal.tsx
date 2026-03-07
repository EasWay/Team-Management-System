import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Loader2, Globe, Lock } from "lucide-react";

interface CreateRepositoryModalProps {
    teamId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateRepositoryModal({ teamId, open, onOpenChange }: CreateRepositoryModalProps) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isPrivate, setIsPrivate] = useState(true);

    const utils = trpc.useUtils();
    const createMutation = trpc.repositories.createFromAccount.useMutation({
        onSuccess: () => {
            toast.success("Repository created successfully on GitHub");
            utils.repositories.listFromAccount.invalidate({ teamId });
            onOpenChange(false);
            setName("");
            setDescription("");
            setIsPrivate(true);
        },
        onError: (error) => {
            toast.error(`Failed to create repository: ${error.message}`);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) {
            toast.error("Please enter a repository name");
            return;
        }
        createMutation.mutate({ teamId, name, description, isPrivate });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px] bg-background/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl p-0 overflow-hidden text-foreground">

                {/* Modal Header */}
                <div className="px-8 pt-8 pb-4 flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-foreground/5 rounded-lg">
                                <Plus className="size-5" />
                            </div>
                            <h2 className="text-2xl font-light tracking-tight text-foreground">New Repository</h2>
                        </div>
                        <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold">Initialize a new codebase on GitHub</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col">
                    <div className="px-8 py-6 space-y-6">
                        <div className="relative group">
                            <label htmlFor="repoName" className="block text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Repository Name</label>
                            <input
                                id="repoName"
                                className="block w-full px-4 py-3 bg-foreground/5 border border-border rounded-lg focus:border-foreground/30 text-sm text-foreground placeholder-muted-foreground transition-all outline-none"
                                placeholder="my-awesome-project"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="relative group">
                            <label htmlFor="repoDesc" className="block text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Description <span className="text-muted-foreground/40 font-normal lowercase">(Optional)</span></label>
                            <textarea
                                id="repoDesc"
                                rows={3}
                                className="block w-full px-4 py-3 bg-foreground/5 border border-border rounded-lg focus:border-foreground/30 text-sm text-foreground placeholder-muted-foreground transition-all outline-none resize-none"
                                placeholder="Unified backend for the division..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-4 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsPrivate(true)}
                                className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${isPrivate ? 'bg-orange-500/10 border-orange-500/30 ring-1 ring-orange-500/20' : 'bg-foreground/5 border-transparent'}`}
                            >
                                <Lock className={`size-4 ${isPrivate ? 'text-orange-500' : 'text-muted-foreground'}`} />
                                <span className={`text-[10px] font-bold uppercase tracking-widest ${isPrivate ? 'text-orange-500' : 'text-muted-foreground'}`}>Private</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsPrivate(false)}
                                className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${!isPrivate ? 'bg-green-500/10 border-green-500/30 ring-1 ring-green-500/20' : 'bg-foreground/5 border-transparent'}`}
                            >
                                <Globe className={`size-4 ${!isPrivate ? 'text-green-500' : 'text-muted-foreground'}`} />
                                <span className={`text-[10px] font-bold uppercase tracking-widest ${!isPrivate ? 'text-green-500' : 'text-muted-foreground'}`}>Public</span>
                            </button>
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
                            disabled={createMutation.isPending}
                            className="px-6 py-2.5 bg-foreground text-background text-[10px] font-bold tracking-widest uppercase hover:bg-foreground/90 transition-all rounded-lg disabled:opacity-50 flex items-center gap-2 shadow-lg"
                        >
                            {createMutation.isPending ? (
                                <>
                                    <Loader2 className="size-3.5 animate-spin" />
                                    Creating...
                                </>
                            ) : "Create on GitHub"}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
