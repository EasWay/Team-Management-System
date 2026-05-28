import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useTeamContext } from "../contexts/TeamContext";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  Phone,
  PhoneOff,
  Users,
  Clock,
  Calendar,
  Plus,
  Settings,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

// Office roles for rooms
const OFFICE_ROLES = [
  { value: "project_manager", label: "Project Manager" },
  { value: "lead_researcher", label: "Lead Researcher" },
  { value: "systems_architect", label: "Systems Architect" },
  { value: "backend_engineer", label: "Backend Engineer" },
  { value: "fullstack_engineer", label: "Full Stack Engineer" },
  { value: "ai_engineer", label: "AI Engineer" },
  { value: "qa_tester", label: "QA Tester" },
  { value: "designer", label: "Designer" },
];

export default function VideoCalls() {
  const { selectedTeamId, teams } = useTeamContext();
  const [createRoomDialogOpen, setCreateRoomDialogOpen] = useState(false);
  const [startCallDialogOpen, setStartCallDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);

  // Room form state
  const [roomForm, setRoomForm] = useState({
    name: "",
    description: "",
    officeRole: "",
    isPublic: true,
    maxParticipants: 10,
    screenSharingEnabled: true,
    recordingEnabled: false,
    chatEnabled: true,
  });

  // Call form state
  const [callForm, setCallForm] = useState({
    title: "",
    description: "",
    callType: "quick_huddle" as "quick_huddle" | "office_room",
    officeRole: "",
    integrationType: "webrtc" as const,
    meetingUrl: "",
  });

  const currentTeamName = teams?.find((t: any) => t.id === selectedTeamId)?.name || "Select a Team";

  // Fetch data
  const { data: officeRooms, isLoading: loadingRooms, refetch: refetchRooms } = trpc.officeRooms.list.useQuery(
    { teamId: selectedTeamId || 0 },
    { enabled: !!selectedTeamId }
  );

  const { data: activeCalls, isLoading: loadingCalls, refetch: refetchCalls } = trpc.videoCalls.getActive.useQuery(
    { teamId: selectedTeamId || 0 },
    { enabled: !!selectedTeamId }
  );

  const { data: callHistory } = trpc.videoCalls.getHistory.useQuery(
    { teamId: selectedTeamId || 0, limit: 10 },
    { enabled: !!selectedTeamId }
  );

  const { data: callStatistics } = trpc.videoCalls.getStatistics.useQuery(
    { teamId: selectedTeamId || 0 },
    { enabled: !!selectedTeamId }
  );

  // Mutations
  const createRoomMutation = trpc.officeRooms.create.useMutation({
    onSuccess: () => {
      toast.success("Office room created successfully");
      refetchRooms();
      setCreateRoomDialogOpen(false);
      resetRoomForm();
    },
    onError: (error) => {
      toast.error(`Failed to create room: ${error.message}`);
    },
  });

  const startCallMutation = trpc.videoCalls.start.useMutation({
    onSuccess: (data) => {
      toast.success("Call started successfully");
      refetchCalls();
      setStartCallDialogOpen(false);
      resetCallForm();
      // Open call in new window or navigate to call page
      if (data.meetingUrl) {
        window.open(data.meetingUrl, "_blank");
      }
    },
    onError: (error) => {
      toast.error(`Failed to start call: ${error.message}`);
    },
  });

  const joinCallMutation = trpc.videoCalls.join.useMutation({
    onSuccess: () => {
      toast.success("Joined call successfully");
      refetchCalls();
    },
    onError: (error) => {
      toast.error(`Failed to join call: ${error.message}`);
    },
  });

  const endCallMutation = trpc.videoCalls.end.useMutation({
    onSuccess: () => {
      toast.success("Call ended successfully");
      refetchCalls();
    },
    onError: (error) => {
      toast.error(`Failed to end call: ${error.message}`);
    },
  });

  // Reset forms
  const resetRoomForm = () => {
    setRoomForm({
      name: "",
      description: "",
      officeRole: "",
      isPublic: true,
      maxParticipants: 10,
      screenSharingEnabled: true,
      recordingEnabled: false,
      chatEnabled: true,
    });
  };

  const resetCallForm = () => {
    setCallForm({
      title: "",
      description: "",
      callType: "quick_huddle",
      officeRole: "",
      integrationType: "webrtc",
      meetingUrl: "",
    });
  };

  // Handle create room
  const handleCreateRoom = () => {
    if (!roomForm.name.trim()) {
      toast.error("Room name is required");
      return;
    }

    if (!roomForm.officeRole) {
      toast.error("Office role is required");
      return;
    }

    createRoomMutation.mutate({
      teamId: selectedTeamId!,
      ...roomForm,
    });
  };

  // Handle start call
  const handleStartCall = () => {
    if (!callForm.title.trim()) {
      toast.error("Call title is required");
      return;
    }

    startCallMutation.mutate({
      teamId: selectedTeamId!,
      ...callForm,
    });
  };

  // Handle join call
  const handleJoinCall = (callId: number) => {
    joinCallMutation.mutate({
      callId,
      isVideoOn: true,
      isMuted: false,
    });
  };

  // Handle end call
  const handleEndCall = (callId: number) => {
    if (confirm("Are you sure you want to end this call?")) {
      endCallMutation.mutate({ callId });
    }
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Format date
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const isLoading = loadingRooms || loadingCalls;

  return (
    <DashboardLayout>
      <div className="flex-1 max-w-7xl mx-auto w-full p-8 space-y-6 pb-20 overflow-y-auto custom-scrollbar">
        {/* Header */}
        <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pt-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
              <span>{currentTeamName}</span>
              <span className="size-1 bg-foreground/20 rounded-full"></span>
              <span>Video Calls</span>
            </div>
            <h1 className="text-3xl font-light tracking-tight text-foreground">
              Office Video Rooms
            </h1>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setCreateRoomDialogOpen(true)} variant="outline" className="gap-2">
              <Plus className="size-4" />
              Create Room
            </Button>
            <Button onClick={() => setStartCallDialogOpen(true)} className="gap-2">
              <Video className="size-4" />
              Start Call
            </Button>
          </div>
        </section>

        {/* Statistics */}
        {callStatistics && (
          <section className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="liquid-glass p-6 space-y-2 rounded-xl">
              <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">
                Total Calls
              </div>
              <div className="text-3xl font-light text-foreground">
                {callStatistics.totalCalls || 0}
              </div>
            </div>
            <div className="liquid-glass p-6 space-y-2 rounded-xl">
              <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">
                Total Duration
              </div>
              <div className="text-3xl font-light text-foreground">
                {callStatistics.totalDuration ? formatDuration(callStatistics.totalDuration) : "0m"}
              </div>
            </div>
            <div className="liquid-glass p-6 space-y-2 rounded-xl">
              <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">
                Avg Duration
              </div>
              <div className="text-3xl font-light text-foreground">
                {callStatistics.avgDuration ? formatDuration(Math.round(callStatistics.avgDuration)) : "0m"}
              </div>
            </div>
            <div className="liquid-glass p-6 space-y-2 rounded-xl">
              <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">
                Recorded
              </div>
              <div className="text-3xl font-light text-foreground">
                {callStatistics.totalRecorded || 0}
              </div>
            </div>
          </section>
        )}

        {/* Tabs */}
        <Tabs defaultValue="rooms" className="space-y-6">
          <TabsList>
            <TabsTrigger value="rooms">Office Rooms</TabsTrigger>
            <TabsTrigger value="active">Active Calls</TabsTrigger>
            <TabsTrigger value="history">Call History</TabsTrigger>
          </TabsList>

          {/* Office Rooms Tab */}
          <TabsContent value="rooms" className="space-y-6">
            {isLoading ? (
              <div className="flex justify-center items-center py-20">
                <RefreshCw className="animate-spin size-8 text-muted-foreground" />
              </div>
            ) : officeRooms && officeRooms.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {officeRooms.map((room) => (
                  <div key={room.id} className="liquid-glass p-6 rounded-xl space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-foreground">{room.name}</h3>
                        {room.description && (
                          <p className="text-sm text-muted-foreground mt-1">{room.description}</p>
                        )}
                      </div>
                      <div
                        className={`size-3 rounded-full ${
                          (room.activeParticipants ?? 0) > 0 ? "bg-green-500" : "bg-gray-500"
                        }`}
                      />
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="size-4" />
                        <span>
                          {room.activeParticipants}/{room.maxParticipants}
                        </span>
                      </div>
                      {room.screenSharingEnabled && <Monitor className="size-4" />}
                      {room.recordingEnabled && <Video className="size-4" />}
                    </div>

                    <div className="flex gap-2">
                      {room.currentCallId ? (
                        <>
                          <Button
                            size="sm"
                            className="flex-1 gap-2"
                            onClick={() => handleJoinCall(room.currentCallId!)}
                          >
                            <Phone className="size-4" />
                            Join Call
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleEndCall(room.currentCallId!)}
                          >
                            <PhoneOff className="size-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          className="flex-1 gap-2"
                          onClick={() => {
                            setCallForm({
                              ...callForm,
                              title: `${room.name} Call`,
                              callType: "office_room",
                              officeRole: room.officeRole,
                            });
                            setStartCallDialogOpen(true);
                          }}
                        >
                          <Video className="size-4" />
                          Start Call
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="liquid-glass p-12 rounded-xl text-center">
                <Video className="size-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No office rooms yet</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Create office rooms for your team to collaborate
                </p>
                <Button onClick={() => setCreateRoomDialogOpen(true)} className="gap-2">
                  <Plus className="size-4" />
                  Create Your First Room
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Active Calls Tab */}
          <TabsContent value="active" className="space-y-6">
            {activeCalls && activeCalls.length > 0 ? (
              <div className="space-y-4">
                {activeCalls.map((call) => (
                  <div
                    key={call.id}
                    className="liquid-glass p-6 rounded-xl flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="size-12 rounded-full bg-green-500/10 flex items-center justify-center">
                        <Video className="size-6 text-green-500" />
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">{call.title}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="size-4" />
                            Started {call.actualStartTime && formatDate(call.actualStartTime)}
                          </span>
                          <span className="capitalize">{call.callType.replace("_", " ")}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleJoinCall(call.id)} className="gap-2">
                        <Phone className="size-4" />
                        Join
                      </Button>
                      {call.meetingUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(call.meetingUrl!, "_blank")}
                        >
                          <ExternalLink className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="liquid-glass p-12 rounded-xl text-center">
                <Phone className="size-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No active calls</h3>
                <p className="text-sm text-muted-foreground">
                  Start a call to begin collaborating with your team
                </p>
              </div>
            )}
          </TabsContent>

          {/* Call History Tab */}
          <TabsContent value="history" className="space-y-6">
            {callHistory && callHistory.length > 0 ? (
              <div className="liquid-glass rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="text-left py-3 px-4 text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                        Title
                      </th>
                      <th className="text-left py-3 px-4 text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                        Type
                      </th>
                      <th className="text-left py-3 px-4 text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                        Date
                      </th>
                      <th className="text-right py-3 px-4 text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                        Duration
                      </th>
                      <th className="text-center py-3 px-4 text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                        Recorded
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {callHistory.map((call) => (
                      <tr key={call.id} className="border-b border-border/30 hover:bg-foreground/5">
                        <td className="py-3 px-4 text-foreground">{call.title}</td>
                        <td className="py-3 px-4 text-muted-foreground capitalize">
                          {call.callType.replace("_", " ")}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {call.actualStartTime && formatDate(call.actualStartTime)}
                        </td>
                        <td className="py-3 px-4 text-right text-foreground">
                          {call.duration ? formatDuration(call.duration) : "-"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {call.isRecorded ? (
                            <Video className="size-4 text-green-500 mx-auto" />
                          ) : (
                            <VideoOff className="size-4 text-muted-foreground mx-auto" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="liquid-glass p-12 rounded-xl text-center">
                <Calendar className="size-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No call history</h3>
                <p className="text-sm text-muted-foreground">
                  Your call history will appear here
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Create Room Dialog */}
        <Dialog open={createRoomDialogOpen} onOpenChange={setCreateRoomDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Office Room</DialogTitle>
              <DialogDescription>
                Set up a permanent video room for your office
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Room Name</Label>
                <Input
                  placeholder="Enter room name"
                  value={roomForm.name}
                  onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  placeholder="Enter room description"
                  value={roomForm.description}
                  onChange={(e) => setRoomForm({ ...roomForm, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div>
                <Label>Office Role</Label>
                <Select
                  value={roomForm.officeRole}
                  onValueChange={(value) => setRoomForm({ ...roomForm, officeRole: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select office role" />
                  </SelectTrigger>
                  <SelectContent>
                    {OFFICE_ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Max Participants</Label>
                <Input
                  type="number"
                  min="2"
                  max="50"
                  value={roomForm.maxParticipants}
                  onChange={(e) =>
                    setRoomForm({ ...roomForm, maxParticipants: parseInt(e.target.value) })
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={roomForm.screenSharingEnabled}
                    onChange={(e) =>
                      setRoomForm({ ...roomForm, screenSharingEnabled: e.target.checked })
                    }
                  />
                  <span className="text-sm">Enable screen sharing</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={roomForm.recordingEnabled}
                    onChange={(e) =>
                      setRoomForm({ ...roomForm, recordingEnabled: e.target.checked })
                    }
                  />
                  <span className="text-sm">Enable recording</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={roomForm.chatEnabled}
                    onChange={(e) =>
                      setRoomForm({ ...roomForm, chatEnabled: e.target.checked })
                    }
                  />
                  <span className="text-sm">Enable chat</span>
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateRoomDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateRoom}>Create Room</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Start Call Dialog */}
        <Dialog open={startCallDialogOpen} onOpenChange={setStartCallDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start Video Call</DialogTitle>
              <DialogDescription>Start a new video call with your team</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Call Title</Label>
                <Input
                  placeholder="Enter call title"
                  value={callForm.title}
                  onChange={(e) => setCallForm({ ...callForm, title: e.target.value })}
                />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  placeholder="Enter call description"
                  value={callForm.description}
                  onChange={(e) => setCallForm({ ...callForm, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div>
                <Label>Call Type</Label>
                <Select
                  value={callForm.callType}
                  onValueChange={(value: any) => setCallForm({ ...callForm, callType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quick_huddle">Quick Huddle</SelectItem>
                    <SelectItem value="office_room">Office Room</SelectItem>
                    <SelectItem value="scheduled_meeting">Scheduled Meeting</SelectItem>
                    <SelectItem value="screen_share">Screen Share</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Integration</Label>
                <Select
                  value={callForm.integrationType}
                  onValueChange={(value: any) =>
                    setCallForm({ ...callForm, integrationType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="webrtc">Built-in WebRTC</SelectItem>
                    <SelectItem value="zoom">Zoom</SelectItem>
                    <SelectItem value="google_meet">Google Meet</SelectItem>
                    <SelectItem value="teams">Microsoft Teams</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {callForm.integrationType !== "webrtc" && (
                <div>
                  <Label>Meeting URL</Label>
                  <Input
                    placeholder="Enter meeting URL"
                    value={callForm.meetingUrl}
                    onChange={(e) => setCallForm({ ...callForm, meetingUrl: e.target.value })}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStartCallDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleStartCall}>Start Call</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
