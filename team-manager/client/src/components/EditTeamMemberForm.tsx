import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import type { TeamMember } from "@shared/types";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  position: z.string().min(1, "Position is required"),
  duties: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface EditTeamMemberFormProps {
  member: TeamMember;
  onSuccess: () => void;
}

export function EditTeamMemberForm({ member, onSuccess }: EditTeamMemberFormProps) {
  const [pictureFile, setPictureFile] = useState<File | null>(null);
  const [picturePreview, setPicturePreview] = useState<string>("");
  const updateMutation = trpc.team.update.useMutation();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: member.name || "",
      position: member.position || "",
      duties: member.duties || "",
      email: member.email || "",
      phone: member.phone || "",
    },
  });

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

      await updateMutation.mutateAsync({
        id: member.id,
        ...values,
        email: values.email || undefined,
        pictureFileName,
      });

      onSuccess();
    } catch (error) {
      toast.error("Failed to update team member");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
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
              <FormLabel>Position</FormLabel>
              <FormControl>
                <Input placeholder="Senior Developer" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
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
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <Input placeholder="+1 (555) 123-4567" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="duties"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Duties</FormLabel>
              <FormControl>
                <Textarea placeholder="Describe their main responsibilities..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <label className="text-sm font-medium">Profile Picture</label>
          {member.pictureFileName && !picturePreview && (
            <div className="relative w-full h-32 bg-gray-100 rounded-md overflow-hidden">
              <img
                src={`/api/uploads/${member.pictureFileName}`}
                alt={member.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <Input type="file" accept="image/*" onChange={handlePictureChange} />
          {picturePreview && (
            <div className="relative w-full h-32 bg-gray-100 rounded-md overflow-hidden">
              <img src={picturePreview} alt="Preview" className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? "Updating..." : "Update Team Member"}
        </Button>
      </form>
    </Form>
  );
}
