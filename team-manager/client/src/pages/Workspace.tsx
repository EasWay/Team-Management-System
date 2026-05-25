import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { useTeamContext } from "@/contexts/TeamContext";
import { toast } from "sonner";
import {
  Palette,
  Briefcase,
  Code,
  TestTube,
  CheckCircle,
  ArrowRight,
  Upload,
  Link as LinkIcon,
  FileText,
  Github,
  Image as ImageIcon,
  Loader2,
  Package,
  Clock,
  Inbox,
  FolderOpen,
  Lock,
  Send,
  Building2,
  Sparkles,
  Target,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const ROLE_CONFIG = {
  project_manager: {
    icon: Briefcase,
    label: "Project Manager's Office",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    description: "📋 Oversee workflows, manage pipeline, ensure timelines",
    officeNumber: "100",
    realName: "Abena Ntewusu Exceltrine",
  },
  lead_researcher: {
    icon: Target,
    label: "Lead Researcher's Office",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    description: "🔬 Research frameworks, scope requirements, evaluate tech",
    officeNumber: "101",
    realName: "George Essel Bonsu",
  },
  systems_architect: {
    icon: Briefcase,
    label: "Systems Architect's Office",
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    description: "🏗️ Design scalable architecture, plan deployments",
    officeNumber: "201",
    realName: "Daniel Mensah",
  },
  backend_engineer: {
    icon: Code,
    label: "Backend Engineer's Office",
    color: "text-green-600",
    bgColor: "bg-green-50",
    description: "⚙️ Build APIs, databases, backend architecture",
    officeNumber: "202",
    realName: "Kingsley Okyere (Founder)",
  },
  fullstack_engineer: {
    icon: Code,
    label: "Full Stack Engineer's Office",
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
    description: "💻 Full-stack development (Python, React, Next.js, Rust)",
    officeNumber: "203",
    realName: "Godfred Fokuo (Co-founder)",
  },
  ai_engineer: {
    icon: Sparkles,
    label: "AI Engineer's Office",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    description: "🤖 Autonomous agents, intelligent backend capabilities",
    officeNumber: "301",
    realName: "Godsway Ganyo",
  },
  qa_tester: {
    icon: TestTube,
    label: "QA Tester's Office",
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    description: "🧪 Test functionality, find bugs, ensure quality",
    officeNumber: "302",
    realName: "Quality Assurance Team",
  },
  designer: {
    icon: Palette,
    label: "Designer's Office",
    color: "text-pink-600",
    bgColor: "bg-pink-50",
    description: "🎨 Create mockups, wireframes, and visual designs",
    officeNumber: "303",
    realName: "Design Team",
  },
};

const DELIVERABLE_TYPES = [
  { value: 'figma', label: 'Figma Design', icon: Palette },
  { value: 'github', label: 'GitHub PR/Repo', icon: Github },
  { value: 'pdf', label: 'PDF Document', icon: FileText },
  { value: 'link', label: 'External Link', icon: LinkIcon },
  { value: 'document', label: 'Document', icon: FileText },
  { value: 'image', label: 'Image', icon: ImageIcon },
];

const WORKFLOW_STAGES = [
  { value: 'research', label: 'Research & Scoping', role: 'lead_researcher' },
  { value: 'architecture', label: 'Systems Architecture', role: 'systems_architect' },
  { value: 'design', label: 'Design', role: 'designer' },
  { value: 'backend', label: 'Backend Development', role: 'backend_engineer' },
  { value: 'fullstack', label: 'Full Stack Development', role: 'fullstack_engineer' },
  { value: 'ai', label: 'AI Integration', role: 'ai_engineer' },
  { value: 'testing', label: 'QA Testing', role: 'qa_tester' },
  { value: 'review', label: 'Final Review', role: 'project_manager' },
  { value: 'completed', label: 'Completed', role: null },
];

export default function Workspace() {
  const { selectedTeamId } = useTeamContext();
  const [selectedRole, setSelectedRole] = useState<keyof typeof ROLE_CONFIG>('project_manager');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isAddingDeliverable, setIsAddingDeliverable] = useState(false);
  const [isHandingOff, setIsHandingOff] = useState(false);

  // Deliverable form
  const [deliverableType, setDeliverableType] = useState<string>('link');
  const [deliverableUrl, setDeliverableUrl] = useState("");
  const [deliverableDescription, setDeliverableDescription] = useState("");

  // Handoff form
  const [handoffStage, setHandoffStage] = useState<string>('');
  const [handoffComments, setHandoffComments] = useState("");
  const [requiresApproval, setRequiresApproval] = useState(true);

  const { data: workspaceItems, isLoading } = trpc.workflow.getWorkspace.useQuery(
    {
      teamId: selectedTeamId!,
      assignedRole: selectedRole,
      entityType: 'task',
    },
    { enabled: !!selectedTeamId }
  );

  const { data: workspaceSummary } = trpc.workflow.getSummary.useQuery(
    { teamId: selectedTeamId! },
    { enabled: !!selectedTeamId }
  );

  const utils = trpc.useUtils();

  const addDeliverableMutation = trpc.workflow.addDeliverable.useMutation({
    onSuccess: () => {
      toast.success("Deliverable added successfully!");
      utils.workflow.getWorkspace.invalidate();
      setIsAddingDeliverable(false);
      setDeliverableUrl("");
      setDeliverableDescription("");
    },
    onError: (error) => toast.error(error.message),
  });

  const handoffMutation = trpc.workflow.handoff.useMutation({
    onSuccess: (data) => {
      if (data.pendingApproval) {
        toast.success("Handoff requested! Waiting for approval.");
      } else {
        toast.success("Handoff completed successfully!");
      }
      utils.workflow.getWorkspace.invalidate();
      utils.approvals.list.invalidate();
      setIsHandingOff(false);
      setHandoffComments("");
      setSelectedItem(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const handleAddDeliverable = () => {
    if (!selectedItem || !deliverableUrl || !deliverableDescription) {
      toast.error("Please fill in all fields");
      return;
    }

    addDeliverableMutation.mutate({
      entityType: 'task',
      entityId: selectedItem.id,
      deliverable: {
        type: deliverableType as any,
        url: deliverableUrl,
        description: deliverableDescription,
        uploadedAt: new Date().toISOString(),
      },
    });
  };

  const handleHandoff = () => {
    if (!selectedItem || !handoffStage) {
      toast.error("Please select a stage to handoff to");
      return;
    }

    const stage = WORKFLOW_STAGES.find((s) => s.value === handoffStage);
    if (!stage || !stage.role) {
      toast.error("Invalid stage selected");
      return;
    }

    handoffMutation.mutate({
      entityType: 'task',
      entityId: selectedItem.id,
      toStage: handoffStage as any,
      toRole: stage.role as any,
      comments: handoffComments || undefined,
      requiresApproval,
    });
  };

  const roleConfig = ROLE_CONFIG[selectedRole];
  const RoleIcon = roleConfig.icon;

  if (!selectedTeamId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Please select a team to enter the Digital HQ</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-primary/10">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">🏢 My Office</h1>
            <p className="text-muted-foreground">
              Your private workspace in the Digital HQ
            </p>
          </div>
        </div>

        {/* Office Status */}
        {workspaceSummary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-primary">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  My Office
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold capitalize">
                  {workspaceSummary.myRole || 'Visitor'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">🔒 Private Workspace</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  On My Desk
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {workspaceSummary.assignedItems.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Active folders</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Inbox className="h-4 w-4" />
                  In My Inbox
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {workspaceSummary.pendingHandoffs.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">New deliveries</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Office Directory */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle>Office Directory</CardTitle>
            </div>
            <CardDescription>Visit different offices in the Digital HQ</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {Object.entries(ROLE_CONFIG).map(([key, config]) => {
                const Icon = config.icon;
                const isSelected = selectedRole === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedRole(key as any)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all relative ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-lg'
                        : 'border-border hover:border-primary/50 hover:shadow-md'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <Lock className="h-3 w-3 text-primary" />
                      </div>
                    )}
                    <div className={`p-2 rounded-lg ${config.bgColor}`}>
                      <Icon className={`h-6 w-6 ${config.color}`} />
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-bold text-muted-foreground">#{config.officeNumber}</div>
                      <span className="text-xs font-medium leading-tight">{config.label}</span>
                      {config.realName && (
                        <div className="text-[10px] text-muted-foreground mt-1 leading-tight">
                          {config.realName}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Current Office View */}
        <Card className="border-2 border-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-lg ${roleConfig.bgColor} border-2 border-primary/20`}>
                  <RoleIcon className={`h-6 w-6 ${roleConfig.color}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle>{roleConfig.label}</CardTitle>
                    <Badge variant="outline" className="text-xs">
                      Office #{roleConfig.officeNumber}
                    </Badge>
                  </div>
                  <CardDescription>{roleConfig.description}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" />
                <span>Private</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="desk" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="desk">
                  <FolderOpen className="h-4 w-4 mr-2" />
                  My Desk
                </TabsTrigger>
                <TabsTrigger value="inbox">
                  <Inbox className="h-4 w-4 mr-2" />
                  Inbox
                </TabsTrigger>
              </TabsList>

              <TabsContent value="desk" className="space-y-4 mt-4">
                {isLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : workspaceItems && workspaceItems.length > 0 ? (
                  <div className="space-y-3">
                    {workspaceItems.map((item: any) => (
                      <Card key={item.id} className="hover:shadow-md transition-shadow border-l-4 border-l-primary">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <FolderOpen className={`h-5 w-5 mt-1 ${roleConfig.color}`} />
                              <div className="space-y-1">
                                <CardTitle className="text-lg">📁 {item.title}</CardTitle>
                                {item.description && (
                                  <CardDescription>{item.description}</CardDescription>
                                )}
                              </div>
                            </div>
                            <Badge variant="secondary">{item.workflowStage || 'No Stage'}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Files in Folder */}
                          {item.deliverables && Object.keys(item.deliverables).length > 0 && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                              <Package className="h-4 w-4" />
                              <span>
                                {Object.values(item.deliverables).flat().length} file(s) in folder
                              </span>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedItem(item);
                                    setIsAddingDeliverable(true);
                                    setIsHandingOff(false);
                                  }}
                                >
                                  <Upload className="h-4 w-4 mr-1" />
                                  Add File to Folder
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>📄 Add File to Folder</DialogTitle>
                                  <DialogDescription>
                                    Add your work to folder: {item.title}
                                  </DialogDescription>
                                </DialogHeader>

                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="type">File Type</Label>
                                <Select value={deliverableType} onValueChange={setDeliverableType}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {DELIVERABLE_TYPES.map((type) => {
                                      const Icon = type.icon;
                                      return (
                                        <SelectItem key={type.value} value={type.value}>
                                          <div className="flex items-center gap-2">
                                            <Icon className="h-4 w-4" />
                                            {type.label}
                                          </div>
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="url">URL</Label>
                                <Input
                                  id="url"
                                  type="url"
                                  placeholder="https://..."
                                  value={deliverableUrl}
                                  onChange={(e) => setDeliverableUrl(e.target.value)}
                                />
                              </div>

                                  <div className="space-y-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Textarea
                                      id="description"
                                      placeholder="Describe this file..."
                                      value={deliverableDescription}
                                      onChange={(e) => setDeliverableDescription(e.target.value)}
                                      rows={3}
                                    />
                                  </div>

                                  <Button
                                    onClick={handleAddDeliverable}
                                    disabled={addDeliverableMutation.isPending}
                                    className="w-full"
                                  >
                                    {addDeliverableMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                      <Upload className="h-4 w-4 mr-2" />
                                    )}
                                    Add File to Folder
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>

                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedItem(item);
                                    setIsHandingOff(true);
                                    setIsAddingDeliverable(false);
                                  }}
                                >
                                  <Send className="h-4 w-4 mr-1" />
                                  Deliver Folder
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>📤 Deliver Folder to Next Office</DialogTitle>
                                  <DialogDescription>
                                    Send folder "{item.title}" to the next office
                                  </DialogDescription>
                                </DialogHeader>

                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="stage">Deliver To Office</Label>
                                <Select value={handoffStage} onValueChange={setHandoffStage}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select stage..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {WORKFLOW_STAGES.filter((s) => s.role).map((stage) => (
                                      <SelectItem key={stage.value} value={stage.value}>
                                        {stage.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="comments">Comments (Optional)</Label>
                                <Textarea
                                  id="comments"
                                  placeholder="Add notes for the next person..."
                                  value={handoffComments}
                                  onChange={(e) => setHandoffComments(e.target.value)}
                                  rows={3}
                                />
                              </div>

                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="approval"
                                  checked={requiresApproval}
                                  onChange={(e) => setRequiresApproval(e.target.checked)}
                                  className="rounded"
                                />
                                <Label htmlFor="approval" className="cursor-pointer">
                                  Requires approval before handoff
                                </Label>
                              </div>

                              <Button
                                onClick={handleHandoff}
                                disabled={handoffMutation.isPending}
                                className="w-full"
                              >
                                {handoffMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <ArrowRight className="h-4 w-4 mr-2" />
                                )}
                                Push to {handoffStage ? WORKFLOW_STAGES.find(s => s.value === handoffStage)?.label : 'Next Stage'}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No items assigned to {roleConfig.label} yet
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
