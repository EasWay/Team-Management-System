import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { useTeamContext } from "@/contexts/TeamContext";
import { Search, UserPlus, User } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  position: z.string().min(1, "Position is required"),
  duties: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AddTeamMemberFormProps {
  onSuccess: () => void;
}

export function AddTeamMemberForm({ onSuccess }: AddTeamMemberFormProps) {
  const { selectedTeamId } = useTeamContext();
  const [mode, setMode] = useState<'search' | 'create'>('search');
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const { data: searchResults, isLoading: isSearching } = trpc.teams.searchGlobalMembers.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length > 2 && mode === 'search' }
  );

  const addMemberMutation = trpc.teams.addMember.useMutation();
  const createMutation = trpc.team.create.useMutation();
  const [pictureFile, setPictureFile] = useState<File | null>(null);
  const [picturePreview, setPicturePreview] = useState<string>("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      position: "",
      duties: "",
      email: "",
      phone: "",
    },
  });

  const handleAddExisting = async (memberId: number) => {
    if (!selectedTeamId) return;
    try {
      await addMemberMutation.mutateAsync({ teamId: selectedTeamId, memberId });
      toast.success("Member added to team!");
      onSuccess();
    } catch (error) {
      toast.error("Failed to add member");
    }
  };

  const handlePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPictureFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPicturePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  async function onSubmit(values: FormValues) {
    try {
      let pictureFileName: string | undefined;

      if (pictureFile) {
        const formData = new FormData();
        formData.append("file", pictureFile);
        const uploadResponse = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload picture");
        }

        const uploadData = await uploadResponse.json();
        pictureFileName = uploadData.fileName;
      }

      // 1. Create the global profile
      const newMember = await createMutation.mutateAsync({
        ...values,
        email: values.email || undefined,
        pictureFileName,
      });

      // 2. Add to current team if we have one
      if (selectedTeamId && newMember.id) {
        await addMemberMutation.mutateAsync({
          teamId: selectedTeamId,
          memberId: newMember.id
        });
      }

      form.reset();
      setPictureFile(null);
      setPicturePreview("");
      onSuccess();
      toast.success("Personnel recruited successfully");
    } catch (error) {
      toast.error("Failed to recruit operative");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 p-1 bg-muted rounded-lg">
        <button
          onClick={() => setMode('search')}
          className={`flex-1 py-1.5 text-[10px] uppercase tracking-widest font-bold rounded ${mode === 'search' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Search Global
        </button>
        <button
          onClick={() => setMode('create')}
          className={`flex-1 py-1.5 text-[10px] uppercase tracking-widest font-bold rounded ${mode === 'create' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Create New
        </button>
      </div>

      {mode === 'search' ? (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {isSearching && (
              <p className="text-center py-4 text-[10px] uppercase tracking-widest text-muted-foreground">Searching directory...</p>
            )}

            {debouncedQuery.length > 2 && searchResults?.length === 0 && !isSearching && (
              <div className="text-center py-8">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-4">No matching personnel found.</p>
                <Button variant="outline" size="sm" onClick={() => setMode('create')}>
                  Create New Profile
                </Button>
              </div>
            )}

            {searchResults?.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-foreground/[0.02] hover:bg-foreground/[0.05] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-muted flex items-center justify-center">
                    <User className="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">{user.name}</h4>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{user.position || 'Operative'}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-3 text-[10px] uppercase tracking-widest font-bold hover:bg-foreground hover:text-background"
                  onClick={() => handleAddExisting(user.id)}
                  disabled={addMemberMutation.isPending}
                >
                  <UserPlus className="size-3.5 mr-2" />
                  Select
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] uppercase tracking-widest font-bold">Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="position"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] uppercase tracking-widest font-bold">Position</FormLabel>
                  <FormControl>
                    <Input placeholder="Senior Developer" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] uppercase tracking-widest font-bold">Email</FormLabel>
                    <FormControl>
                      <Input placeholder="john@example.com" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] uppercase tracking-widest font-bold">Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+1..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="duties"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] uppercase tracking-widest font-bold">Duties</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Describe responsibilities..." {...field} className="min-h-[80px]" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-bold">Profile Picture</label>
              <Input type="file" accept="image/*" onChange={handlePictureChange} className="text-[10px] uppercase" />
              {picturePreview && (
                <div className="relative w-full h-32 bg-muted rounded-md overflow-hidden border border-border">
                  <img src={picturePreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            <Button type="submit" className="w-full h-10 text-[10px] uppercase tracking-widest font-bold" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Recruiting..." : "Confirm Recruit"}
            </Button>
          </form>
        </Form>
      )}
    </div>
  );
}

