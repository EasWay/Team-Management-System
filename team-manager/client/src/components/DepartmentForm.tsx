import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import type { Department } from "@shared/types";

const formSchema = z.object({
  name: z.string().min(1, "Department name is required").max(100, "Department name must be less than 100 characters"),
  description: z.string().max(500, "Description must be less than 500 characters").optional(),
  parentId: z.number().optional(),
  managerId: z.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface DepartmentFormProps {
  department?: Department;
  onSuccess: () => void;
  onCancel?: () => void;
}

export function DepartmentForm({ department, onSuccess, onCancel }: DepartmentFormProps) {
  const { data: departments } = trpc.department.list.useQuery();
  const { data: teamMembers } = trpc.team.list.useQuery();
  const createMutation = trpc.department.create.useMutation();
  const updateMutation = trpc.department.update.useMutation();

  const isEditing = !!department;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: department?.name || "",
      description: department?.description || "",
      parentId: department?.parentId || undefined,
      managerId: department?.managerId || undefined,
    },
  });

  // Filter out the current department and its descendants from parent options to prevent circular references
  const getAvailableParentDepartments = () => {
    if (!departments || !isEditing) return departments || [];
    
    const findDescendants = (deptId: number): number[] => {
      const descendants: number[] = [deptId];
      const children = departments.filter(d => d.parentId === deptId);
      for (const child of children) {
        descendants.push(...findDescendants(child.id));
      }
      return descendants;
    };

    const excludedIds = findDescendants(department.id);
    return departments.filter(d => !excludedIds.includes(d.id));
  };

  const availableParentDepartments = getAvailableParentDepartments();

  async function onSubmit(values: FormValues) {
    try {
      // Validate department name uniqueness
      if (departments) {
        const existingDepartment = departments.find(d => 
          d.name.toLowerCase() === values.name.toLowerCase() && 
          (!isEditing || d.id !== department.id)
        );
        
        if (existingDepartment) {
          form.setError("name", {
            type: "manual",
            message: "A department with this name already exists",
          });
          return;
        }
      }

      if (isEditing) {
        await updateMutation.mutateAsync({
          id: department.id,
          ...values,
          description: values.description || null,
        });
        toast.success("Department updated successfully");
      } else {
        await createMutation.mutateAsync({
          ...values,
          description: values.description || null,
        });
        toast.success("Department created successfully");
      }

      form.reset();
      onSuccess();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save department";
      toast.error(errorMessage);
      
      // Handle specific validation errors
      if (errorMessage.includes("already exists")) {
        form.setError("name", {
          type: "manual",
          message: "A department with this name already exists",
        });
      }
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Department Name</FormLabel>
              <FormControl>
                <Input 
                  placeholder="e.g., Engineering, Marketing, Sales" 
                  {...field} 
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Describe the department's purpose and responsibilities..."
                  rows={3}
                  {...field}
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="parentId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Parent Department (Optional)</FormLabel>
              <Select 
                onValueChange={(value) => field.onChange(value === "none" ? undefined : parseInt(value))}
                value={field.value?.toString() || "none"}
                disabled={isLoading}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a parent department" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">No parent (Root level)</SelectItem>
                  {availableParentDepartments?.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id.toString()}>
                      {dept.name}
                      {dept.description && (
                        <span className="text-gray-500 text-sm ml-2">
                          - {dept.description.substring(0, 30)}
                          {dept.description.length > 30 ? "..." : ""}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="managerId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Department Manager (Optional)</FormLabel>
              <Select 
                onValueChange={(value) => field.onChange(value === "none" ? undefined : parseInt(value))}
                value={field.value?.toString() || "none"}
                disabled={isLoading}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a department manager" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">No manager assigned</SelectItem>
                  {teamMembers?.map((member) => (
                    <SelectItem key={member.id} value={member.id.toString()}>
                      {member.name}
                      <span className="text-gray-500 text-sm ml-2">
                        - {member.position}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2 pt-4">
          <Button type="submit" disabled={isLoading} className="flex-1">
            {isLoading ? (
              isEditing ? "Updating..." : "Creating..."
            ) : (
              isEditing ? "Update Department" : "Create Department"
            )}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}