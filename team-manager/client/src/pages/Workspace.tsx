import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { OfficeChat } from "@/components/OfficeChat";
import { GoogleDriveConnect } from "@/components/GoogleDriveConnect";
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
import { useAuth } from "@/_core/hooks/useAuth";
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
  AlertTriangle,
  Lamp,
  Monitor,
  Coffee,
  BookOpen,
  Trash2,
  Archive,
  FilePlus,
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
    description: "Oversee workflows, manage pipeline, ensure timelines",
    officeNumber: "100",
    realName: "Abena Ntewusu Exceltrine",
  },
  lead_researcher: {
    icon: Target,
    label: "Lead Researcher's Office",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    description: "Research frameworks, scope requirements, evaluate tech",
    officeNumber: "101",
    realName: "George Essel Bonsu",
  },
  systems_architect: {
    icon: Briefcase,
    label: "Systems Architect's Office",
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    description: "Design scalable architecture, plan deployments",
    officeNumber: "201",
    realName: "Daniel Mensah",
  },
  backend_engineer: {
    icon: Code,
    label: "Backend Engineer's Office",
    color: "text-green-600",
    bgColor: "bg-green-50",
    description: "Build APIs, databases, backend architecture",
    officeNumber: "202",
    realName: "Kingsley Okyere (Founder)",
  },
  fullstack_engineer: {
    icon: Code,
    label: "Full Stack Engineer's Office",
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
    description: "Full-stack development (Python, React, Next.js, Rust)",
    officeNumber: "203",
    realName: "Godfred Fokuo (Co-founder)",
  },
  ai_engineer: {
    icon: Sparkles,
    label: "AI Engineer's Office",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    description: "Autonomous agents, intelligent backend capabilities",
    officeNumber: "301",
    realName: "Godsway Ganyo",
  },
  qa_tester: {
    icon: TestTube,
    label: "QA Tester's Office",
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    description: "Test functionality, find bugs, ensure quality",
    officeNumber: "302",
    realName: "Quality Assurance Team",
  },
  designer: {
    icon: Palette,
    label: "Designer's Office",
    color: "text-pink-600",
    bgColor: "bg-pink-50",
    description: "Create mockups, wireframes, and visual designs",
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
  const { user } = useAuth();
  
  // Get team members to find current user's office role
  const { data: members } = trpc.teams.getMembers.useQuery(
    { teamId: selectedTeamId! },
    { enabled: !!selectedTeamId }
  );
  
  // Find current user's membership and office role
  const currentUserMembership = members?.find((m: any) => m.member?.email === user?.email);
  const userOfficeRole = currentUserMembership?.officeRole as keyof typeof ROLE_CONFIG | null;
  const userRole = currentUserMembership?.role; // admin, team_lead, etc.
  
  // Default to user's assigned office, or project_manager if not assigned
  const [selectedRole, setSelectedRole] = useState<keyof typeof ROLE_CONFIG>('project_manager');
  const [showAccessDialog, setShowAccessDialog] = useState(false);
  const [pendingOfficeRole, setPendingOfficeRole] = useState<keyof typeof ROLE_CONFIG | null>(null);
  const [officeCodeInput, setOfficeCodeInput] = useState("");
  const [accessError, setAccessError] = useState("");
  const [isOfficeLocked, setIsOfficeLocked] = useState(false); // New: Track if office is in locked/focused mode
  
  // Update selected role when user's office role is loaded
  useEffect(() => {
    if (userOfficeRole) {
      setSelectedRole(userOfficeRole);
      setIsOfficeLocked(true); // Auto-lock when loading user's own office
    }
  }, [userOfficeRole]);
  
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isAddingDeliverable, setIsAddingDeliverable] = useState(false);
  const [isHandingOff, setIsHandingOff] = useState(false);
  
  // Handle office selection with access control
  const handleOfficeClick = (officeRole: keyof typeof ROLE_CONFIG) => {
    // If it's their own office, lock it immediately
    if (officeRole === userOfficeRole) {
      setSelectedRole(officeRole);
      setIsOfficeLocked(true); // Auto-lock when entering own office
      toast.success(`Entered your office - Locked Mode`, { icon: <Lock className="h-4 w-4" /> });
      return;
    }
    
    // Allow access without code if they're an admin or team_lead
    if (userRole === 'admin' || userRole === 'team_lead') {
      setSelectedRole(officeRole);
      return;
    }
    
    // Otherwise, require office code
    setPendingOfficeRole(officeRole);
    setOfficeCodeInput("");
    setAccessError("");
    setShowAccessDialog(true);
  };
  
  // Verify office code
  const handleAccessSubmit = () => {
    if (!pendingOfficeRole) return;
    
    const officeConfig = ROLE_CONFIG[pendingOfficeRole];
    const correctCode = officeConfig.officeNumber;
    
    if (officeCodeInput === correctCode) {
      setSelectedRole(pendingOfficeRole);
      setShowAccessDialog(false);
      setPendingOfficeRole(null);
      setOfficeCodeInput("");
      setAccessError("");
      setIsOfficeLocked(true); // Lock the office when entering with code
      toast.success(`Entered ${officeConfig.label} - Locked Mode`, { icon: <Lock className="h-4 w-4" /> });
    } else {
      setAccessError("Incorrect office code. Please try again.");
      toast.error("Incorrect office code");
    }
  };
  
  // Unlock office and return to directory view
  const handleUnlockOffice = () => {
    setIsOfficeLocked(false);
    toast.success("Office unlocked - Directory visible");
  };

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

  // Also fetch regular tasks assigned to this user
  const { data: myTasks } = trpc.tasks.list.useQuery(
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
            <h1 className="text-3xl font-bold">My Office</h1>
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
                <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Lock className="h-3 w-3" />
                  Private Workspace
                </p>
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

        {/* Office Directory - Only show when NOT in locked mode */}
        {!isOfficeLocked && (
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
                  const isUserOffice = key === userOfficeRole;
                  const hasAccess = isUserOffice || userRole === 'admin' || userRole === 'team_lead';
                  
                  return (
                    <button
                      key={key}
                      onClick={() => handleOfficeClick(key as keyof typeof ROLE_CONFIG)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all relative ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-lg'
                          : 'border-border hover:border-primary/50 hover:shadow-md'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2">
                          {hasAccess ? (
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          ) : (
                            <Lock className="h-3 w-3 text-yellow-500" />
                          )}
                        </div>
                      )}
                      {!isSelected && !hasAccess && (
                        <div className="absolute top-2 right-2">
                          <Lock className="h-3 w-3 text-muted-foreground" />
                        </div>
                      )}
                      <div className={`p-2 rounded-lg ${config.bgColor}`}>
                        <Icon className={`h-6 w-6 ${config.color}`} />
                      </div>
                      <div className="text-center">
                        <span className="text-xs font-medium leading-tight">{config.label.replace("'s Office", "")}</span>
                        {config.realName && (
                          <div className="text-[10px] text-muted-foreground mt-1 leading-tight">
                            {config.realName}
                          </div>
                        )}
                        {isUserOffice && (
                          <div className="text-[10px] text-green-600 font-bold mt-1">YOUR OFFICE</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Office View - Real Office Design */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Side - Office Interior */}
          <div className="lg:col-span-2 space-y-6">
            {/* Office Header */}
            <Card className="border-2 border-primary">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-lg ${roleConfig.bgColor} border-2 border-primary/20`}>
                      <RoleIcon className={`h-6 w-6 ${roleConfig.color}`} />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {roleConfig.label}
                        {selectedRole === userOfficeRole && (
                          <Badge variant="default" className="text-xs">Your Office</Badge>
                        )}
                        {isOfficeLocked && (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                            <Lock className="h-3 w-3 mr-1" />
                            Locked Mode
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{roleConfig.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOfficeLocked && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleUnlockOffice}
                        className="mr-2"
                      >
                        <Lock className="h-4 w-4 mr-2" />
                        Unlock Office
                      </Button>
                    )}
                    <Lamp className="h-5 w-5 text-yellow-500" />
                    <Monitor className="h-5 w-5 text-blue-500" />
                    <Coffee className="h-5 w-5 text-amber-600" />
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Desk Area */}
            <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50/50 to-orange-50/30">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-5 w-5 text-primary" />
                    <CardTitle>My Desk</CardTitle>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <FilePlus className="h-4 w-4 mr-2" />
                        New Folder
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Folder</DialogTitle>
                        <DialogDescription>
                          Create a new work folder on your desk
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Folder Name</Label>
                          <Input placeholder="Enter folder name..." />
                        </div>
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Textarea placeholder="What's this folder for?" rows={3} />
                        </div>
                        <Button className="w-full">
                          <FolderOpen className="h-4 w-4 mr-2" />
                          Create Folder
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <CardDescription>Active work folders on your desk</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Workflow Folders */}
                    {workspaceItems && workspaceItems.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <FolderOpen className="h-4 w-4" />
                          Workflow Folders
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {workspaceItems.map((item: any) => (
                            <Card key={item.id} className="hover:shadow-lg transition-all border-2 hover:border-primary cursor-pointer bg-card">
                              <CardHeader className="pb-3">
                                <div className="flex items-start gap-3">
                                  <FolderOpen className={`h-8 w-8 ${roleConfig.color} flex-shrink-0`} />
                                  <div className="flex-1 min-w-0">
                                    <CardTitle className="text-base truncate">{item.title}</CardTitle>
                                    {item.description && (
                                      <CardDescription className="text-xs line-clamp-2 mt-1">
                                        {item.description}
                                      </CardDescription>
                                    )}
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                {/* File Count */}
                                {item.deliverables && Object.keys(item.deliverables).length > 0 && (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                                    <Package className="h-3 w-3" />
                                    <span>{Object.values(item.deliverables).flat().length} files</span>
                                  </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-2">
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => {
                                          setSelectedItem(item);
                                          setIsAddingDeliverable(true);
                                        }}
                                      >
                                        <Upload className="h-3 w-3 mr-1" />
                                        Add File
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                          <FilePlus className="h-4 w-4" />
                                          Add File to Folder
                                        </DialogTitle>
                                        <DialogDescription>
                                          Add your work to: {item.title}
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="space-y-4">
                                        <div className="space-y-2">
                                          <Label>File Type</Label>
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
                                          <Label>File URL or Link</Label>
                                          <Input
                                            type="url"
                                            placeholder="https://..."
                                            value={deliverableUrl}
                                            onChange={(e) => setDeliverableUrl(e.target.value)}
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <Label>Description</Label>
                                          <Textarea
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
                                          Add File
                                        </Button>
                                      </div>
                                    </DialogContent>
                                  </Dialog>

                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => {
                                          setSelectedItem(item);
                                          setIsHandingOff(true);
                                        }}
                                      >
                                        <Send className="h-3 w-3 mr-1" />
                                        Send
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                          <Send className="h-4 w-4" />
                                          Send Folder to Next Office
                                        </DialogTitle>
                                        <DialogDescription>
                                          Deliver "{item.title}" to another office
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="space-y-4">
                                        <div className="space-y-2">
                                          <Label>Send To</Label>
                                          <Select value={handoffStage} onValueChange={setHandoffStage}>
                                            <SelectTrigger>
                                              <SelectValue placeholder="Select office..." />
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
                                          <Label>Notes (Optional)</Label>
                                          <Textarea
                                            placeholder="Add notes for the recipient..."
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
                                          <Label htmlFor="approval" className="cursor-pointer text-sm">
                                            Requires approval before delivery
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
                                            <Send className="h-4 w-4 mr-2" />
                                          )}
                                          Send to {handoffStage ? WORKFLOW_STAGES.find(s => s.value === handoffStage)?.label : 'Office'}
                                        </Button>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Regular Tasks from Kanban */}
                    {myTasks && myTasks.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" />
                            My Tasks
                          </h3>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => window.location.href = '/tasks'}
                          >
                            View All →
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {myTasks.slice(0, 5).map((task: any) => (
                            <div 
                              key={task.id} 
                              className="p-3 bg-card rounded-lg border hover:border-primary transition-colors cursor-pointer"
                              onClick={() => window.location.href = '/tasks'}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{task.title}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{task.status}</p>
                                </div>
                                <Badge variant="outline" className="text-xs shrink-0">
                                  {task.priority || 'medium'}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Empty State */}
                    {(!workspaceItems || workspaceItems.length === 0) && (!myTasks || myTasks.length === 0) && (
                      <div className="flex flex-col items-center justify-center h-48 text-center bg-muted/50 rounded-lg border-2 border-dashed">
                        <Monitor className="h-16 w-16 text-muted-foreground/30 mb-3" />
                        <p className="text-muted-foreground font-medium">Your desk is clear</p>
                        <p className="text-sm text-muted-foreground/70 mt-1">No active work right now</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-4"
                          onClick={() => window.location.href = '/tasks'}
                        >
                          Go to Tasks Board
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Side - Office Furniture */}
          <div className="space-y-6">
            {/* Office Chat */}
            <OfficeChat officeRole={selectedRole} teamId={selectedTeamId} />

            {/* Team Google Drive */}
            <GoogleDriveConnect
              teamId={selectedTeamId}
              connectionType="team"
              isOwner={userRole === 'admin' || userRole === 'team_lead'}
            />

            {/* Office Google Drive */}
            {selectedRole && (
              <GoogleDriveConnect
                teamId={selectedTeamId}
                officeRole={selectedRole}
                connectionType="office"
                isOwner={selectedRole === userOfficeRole || userRole === 'admin' || userRole === 'team_lead'}
              />
            )}

            {/* Inbox */}
            <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50/50 to-cyan-50/30">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Inbox className="h-5 w-5 text-blue-600" />
                  <CardTitle>Inbox</CardTitle>
                </div>
                <CardDescription>New folders delivered to you</CardDescription>
              </CardHeader>
              <CardContent>
                {workspaceSummary && workspaceSummary.pendingHandoffs.length > 0 ? (
                  <div className="space-y-2">
                    {workspaceSummary.pendingHandoffs.slice(0, 5).map((item: any, idx: number) => (
                      <div key={idx} className="p-3 bg-card rounded-lg border hover:border-primary transition-colors cursor-pointer">
                        <div className="flex items-start gap-2">
                          <FolderOpen className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.title || 'New Folder'}</p>
                            <p className="text-xs text-muted-foreground">Just arrived</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-32 text-center bg-muted/50 rounded-lg border-2 border-dashed">
                    <Inbox className="h-12 w-12 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">Inbox is empty</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Filing Cabinet */}
            <Card className="border-2 border-border bg-gradient-to-br from-muted/50 to-muted/30">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Archive className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>Filing Cabinet</CardTitle>
                </div>
                <CardDescription>Archived and completed work</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center h-32 text-center bg-muted/50 rounded-lg border-2 border-dashed">
                  <Archive className="h-12 w-12 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No archived folders</p>
                </div>
              </CardContent>
            </Card>

            {/* Bookshelf - Resources */}
            <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50/50 to-pink-50/30">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-purple-600" />
                  <CardTitle>Quick Access</CardTitle>
                </div>
                <CardDescription>Navigate to other areas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={() => window.location.href = '/repositories'}
                  >
                    <Github className="h-4 w-4 mr-2" />
                    GitHub Repos
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={() => window.location.href = '/tasks'}
                  >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    All Tasks
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={() => window.location.href = '/projects'}
                  >
                    <Briefcase className="h-4 w-4 mr-2" />
                    Projects
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start bg-amber-50 border-amber-300 hover:bg-amber-100"
                    onClick={() => window.location.href = '/conference-room'}
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    Conference Room
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Office Access Dialog */}
      <Dialog open={showAccessDialog} onOpenChange={setShowAccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Office Access Required
            </DialogTitle>
            <DialogDescription>
              {pendingOfficeRole && (
                <>
                  You're trying to access <strong>{ROLE_CONFIG[pendingOfficeRole].label}</strong>.
                  <br />
                  Enter the office code to gain access.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="officeCode">Office Code</Label>
              <Input
                id="officeCode"
                type="text"
                placeholder="Enter office number (e.g., 202)"
                value={officeCodeInput}
                onChange={(e) => {
                  setOfficeCodeInput(e.target.value);
                  setAccessError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAccessSubmit();
                  }
                }}
                className={accessError ? "border-red-500" : ""}
              />
              {accessError && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {accessError}
                </p>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={handleAccessSubmit}
                className="flex-1"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Access Office
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAccessDialog(false);
                  setPendingOfficeRole(null);
                  setOfficeCodeInput("");
                  setAccessError("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
