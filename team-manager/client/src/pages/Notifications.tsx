import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useTeamContext } from "../contexts/TeamContext";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Clock,
  Mail,
  Settings,
  Trash2,
  AlertCircle,
  Info,
  AlertTriangle,
  Zap,
  Filter,
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Priority icons
const priorityIcons = {
  low: Info,
  normal: Bell,
  high: AlertTriangle,
  urgent: Zap,
};

const priorityColors = {
  low: "text-blue-500",
  normal: "text-muted-foreground",
  high: "text-orange-500",
  urgent: "text-red-500",
};

export default function Notifications() {
  const { selectedTeamId, teams } = useTeamContext();
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterRead, setFilterRead] = useState<string>("all");

  const currentTeamName = teams?.find((t: any) => t.id === selectedTeamId)?.name || "Select a Team";

  // Fetch notifications
  const { data: notifications, isLoading, refetch } = trpc.notifications.list.useQuery(
    {
      teamId: selectedTeamId || 0,
      isRead: filterRead === "all" ? undefined : filterRead === "unread" ? false : true,
      type: filterType === "all" ? undefined : filterType,
      limit: 50,
    },
    { enabled: !!selectedTeamId }
  );

  // Fetch unread count
  const { data: unreadCount } = trpc.notifications.getUnreadCount.useQuery(
    { teamId: selectedTeamId || 0 },
    { enabled: !!selectedTeamId }
  );

  // Fetch preferences
  const { data: preferences, refetch: refetchPreferences } = trpc.notificationPreferences.get.useQuery(
    { teamId: selectedTeamId || 0 },
    { enabled: !!selectedTeamId }
  );

  // Fetch statistics
  const { data: statistics } = trpc.notifications.getStatistics.useQuery(
    { teamId: selectedTeamId || 0 },
    { enabled: !!selectedTeamId }
  );

  // Fetch daily digest
  const { data: dailyDigest } = trpc.dailyDigest.generate.useQuery(
    { teamId: selectedTeamId || 0 },
    { enabled: !!selectedTeamId }
  );

  // Mutations
  const markAsReadMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const markAllAsReadMutation = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      toast.success("All notifications marked as read");
      refetch();
    },
  });

  const deleteNotificationMutation = trpc.notifications.delete.useMutation({
    onSuccess: () => {
      toast.success("Notification deleted");
      refetch();
    },
  });

  const updatePreferencesMutation = trpc.notificationPreferences.update.useMutation({
    onSuccess: () => {
      toast.success("Preferences updated successfully");
      refetchPreferences();
      setSettingsDialogOpen(false);
    },
  });

  // Handlers
  const handleMarkAsRead = (notificationId: number) => {
    markAsReadMutation.mutate({ notificationId });
  };

  const handleMarkAllAsRead = () => {
    if (selectedTeamId) {
      markAllAsReadMutation.mutate({ teamId: selectedTeamId });
    }
  };

  const handleDelete = (notificationId: number) => {
    deleteNotificationMutation.mutate({ notificationId });
  };

  const handleUpdatePreferences = (updates: any) => {
    if (selectedTeamId) {
      updatePreferencesMutation.mutate({
        teamId: selectedTeamId,
        ...updates,
      });
    }
  };

  // Format date
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Get notification type label
  const getTypeLabel = (type: string) => {
    return type.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  return (
    <DashboardLayout>
      <div className="flex-1 max-w-7xl mx-auto w-full p-8 space-y-6 pb-20 overflow-y-auto custom-scrollbar">
        {/* Header */}
        <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pt-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
              <span>{currentTeamName}</span>
              <span className="size-1 bg-foreground/20 rounded-full"></span>
              <span>Notifications</span>
            </div>
            <h1 className="text-3xl font-light tracking-tight text-foreground">
              Smart Notifications
            </h1>
            {unreadCount !== undefined && unreadCount > 0 && (
              <p className="text-sm text-muted-foreground">
                You have {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={() => refetch()} variant="outline" size="sm" className="gap-2">
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <Button onClick={handleMarkAllAsRead} variant="outline" size="sm" className="gap-2">
              <CheckCheck className="size-4" />
              Mark All Read
            </Button>
            <Button onClick={() => setSettingsDialogOpen(true)} variant="outline" size="sm" className="gap-2">
              <Settings className="size-4" />
              Settings
            </Button>
          </div>
        </section>

        {/* Statistics */}
        {statistics && (
          <section className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="liquid-glass p-6 space-y-2 rounded-xl">
              <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">
                Total
              </div>
              <div className="text-3xl font-light text-foreground">
                {statistics.total || 0}
              </div>
            </div>
            <div className="liquid-glass p-6 space-y-2 rounded-xl">
              <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">
                Unread
              </div>
              <div className="text-3xl font-light text-foreground">
                {statistics.unread || 0}
              </div>
            </div>
            <div className="liquid-glass p-6 space-y-2 rounded-xl">
              <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">
                Read Rate
              </div>
              <div className="text-3xl font-light text-foreground">
                {statistics.total > 0
                  ? Math.round(((statistics.total - statistics.unread) / statistics.total) * 100)
                  : 0}%
              </div>
            </div>
            <div className="liquid-glass p-6 space-y-2 rounded-xl">
              <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">
                Today
              </div>
              <div className="text-3xl font-light text-foreground">
                {notifications?.filter((n: any) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return new Date(n.createdAt) >= today;
                }).length || 0}
              </div>
            </div>
          </section>
        )}

        {/* Tabs */}
        <Tabs defaultValue="notifications" className="space-y-6">
          <TabsList>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="digest">Daily Digest</TabsTrigger>
          </TabsList>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            {/* Filters */}
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-2">
                <Filter className="size-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Filter:</span>
              </div>
              <Select value={filterRead} onValueChange={setFilterRead}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="task_assignment">Task Assignments</SelectItem>
                  <SelectItem value="deadline_approaching">Deadlines</SelectItem>
                  <SelectItem value="mention">Mentions</SelectItem>
                  <SelectItem value="approval_request">Approvals</SelectItem>
                  <SelectItem value="folder_alert">Folder Alerts</SelectItem>
                  <SelectItem value="project_update">Project Updates</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notifications List */}
            {isLoading ? (
              <div className="flex justify-center items-center py-20">
                <RefreshCw className="animate-spin size-8 text-muted-foreground" />
              </div>
            ) : notifications && notifications.length > 0 ? (
              <div className="space-y-2">
                {notifications.map((notification: any) => {
                  const PriorityIcon = priorityIcons[notification.priority as keyof typeof priorityIcons] || Bell;
                  const priorityColor = priorityColors[notification.priority as keyof typeof priorityColors] || "text-muted-foreground";

                  return (
                    <div
                      key={notification.id}
                      className={`liquid-glass p-4 rounded-xl flex items-start gap-4 transition-all ${
                        !notification.isRead ? "border-l-4 border-blue-500" : ""
                      }`}
                    >
                      <div className={`size-10 rounded-full bg-foreground/5 flex items-center justify-center shrink-0 ${priorityColor}`}>
                        <PriorityIcon className="size-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-medium text-foreground">{notification.title}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="size-3" />
                                {formatDate(notification.createdAt)}
                              </span>
                              <span className="capitalize">{getTypeLabel(notification.type)}</span>
                              {notification.priority !== "normal" && (
                                <span className={`capitalize font-medium ${priorityColor}`}>
                                  {notification.priority}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-2 shrink-0">
                            {!notification.isRead && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleMarkAsRead(notification.id)}
                                title="Mark as read"
                              >
                                <Check className="size-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(notification.id)}
                              title="Delete"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>

                        {notification.actionUrl && notification.actionLabel && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-3"
                            onClick={() => window.location.href = notification.actionUrl}
                          >
                            {notification.actionLabel}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="liquid-glass p-12 rounded-xl text-center">
                <Bell className="size-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No notifications</h3>
                <p className="text-sm text-muted-foreground">
                  You're all caught up! Check back later for updates.
                </p>
              </div>
            )}
          </TabsContent>

          {/* Daily Digest Tab */}
          <TabsContent value="digest" className="space-y-6">
            {dailyDigest ? (
              <div className="space-y-6">
                {/* Tasks Due Today */}
                {dailyDigest.tasksDueToday && dailyDigest.tasksDueToday.length > 0 && (
                  <div className="liquid-glass p-6 rounded-xl">
                    <h3 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
                      <AlertCircle className="size-5 text-orange-500" />
                      Tasks Due Today ({dailyDigest.tasksDueToday.length})
                    </h3>
                    <div className="space-y-2">
                      {dailyDigest.tasksDueToday.map((task: any) => (
                        <div key={task.id} className="p-3 bg-foreground/5 rounded-lg">
                          <div className="font-medium text-foreground">{task.title}</div>
                          <div className="text-sm text-muted-foreground mt-1">{task.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Overdue Tasks */}
                {dailyDigest.tasksOverdue && dailyDigest.tasksOverdue.length > 0 && (
                  <div className="liquid-glass p-6 rounded-xl border-l-4 border-red-500">
                    <h3 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
                      <AlertTriangle className="size-5 text-red-500" />
                      Overdue Tasks ({dailyDigest.tasksOverdue.length})
                    </h3>
                    <div className="space-y-2">
                      {dailyDigest.tasksOverdue.map((task: any) => (
                        <div key={task.id} className="p-3 bg-red-500/10 rounded-lg">
                          <div className="font-medium text-foreground">{task.title}</div>
                          <div className="text-sm text-muted-foreground mt-1">{task.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unread Mentions */}
                {dailyDigest.unreadMentions && dailyDigest.unreadMentions.length > 0 && (
                  <div className="liquid-glass p-6 rounded-xl">
                    <h3 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
                      <Bell className="size-5 text-blue-500" />
                      Unread Mentions ({dailyDigest.unreadMentions.length})
                    </h3>
                    <div className="space-y-2">
                      {dailyDigest.unreadMentions.map((mention: any) => (
                        <div key={mention.id} className="p-3 bg-foreground/5 rounded-lg">
                          <div className="font-medium text-foreground">{mention.title}</div>
                          <div className="text-sm text-muted-foreground mt-1">{mention.message}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Idle Folders */}
                {dailyDigest.foldersIdle && dailyDigest.foldersIdle.length > 0 && (
                  <div className="liquid-glass p-6 rounded-xl">
                    <h3 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
                      <Clock className="size-5 text-yellow-500" />
                      Idle Folders ({dailyDigest.foldersIdle.length})
                    </h3>
                    <div className="space-y-2">
                      {dailyDigest.foldersIdle.map((folder: any) => (
                        <div key={folder.id} className="p-3 bg-foreground/5 rounded-lg">
                          <div className="font-medium text-foreground">{folder.name}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Sitting idle for more than 24 hours
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {(!dailyDigest.tasksDueToday || dailyDigest.tasksDueToday.length === 0) &&
                  (!dailyDigest.tasksOverdue || dailyDigest.tasksOverdue.length === 0) &&
                  (!dailyDigest.unreadMentions || dailyDigest.unreadMentions.length === 0) &&
                  (!dailyDigest.foldersIdle || dailyDigest.foldersIdle.length === 0) && (
                    <div className="liquid-glass p-12 rounded-xl text-center">
                      <Mail className="size-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-foreground mb-2">All clear!</h3>
                      <p className="text-sm text-muted-foreground">
                        Nothing needs your attention today.
                      </p>
                    </div>
                  )}
              </div>
            ) : (
              <div className="liquid-glass p-12 rounded-xl text-center">
                <RefreshCw className="animate-spin size-8 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">Loading daily digest...</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Settings Dialog */}
        <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Notification Preferences</DialogTitle>
              <DialogDescription>
                Customize how and when you receive notifications
              </DialogDescription>
            </DialogHeader>

            {preferences && (
              <div className="space-y-6 py-4">
                {/* Channels */}
                <div className="space-y-4">
                  <h3 className="font-medium text-foreground">Notification Channels</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="email">Email Notifications</Label>
                      <Switch
                        id="email"
                        checked={preferences.emailEnabled}
                        onCheckedChange={(checked) =>
                          handleUpdatePreferences({ emailEnabled: checked })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="push">Push Notifications</Label>
                      <Switch
                        id="push"
                        checked={preferences.pushEnabled}
                        onCheckedChange={(checked) =>
                          handleUpdatePreferences({ pushEnabled: checked })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="inApp">In-App Notifications</Label>
                      <Switch
                        id="inApp"
                        checked={preferences.inAppEnabled}
                        onCheckedChange={(checked) =>
                          handleUpdatePreferences({ inAppEnabled: checked })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Notification Types */}
                <div className="space-y-4">
                  <h3 className="font-medium text-foreground">Notification Types</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="taskAssignments">Task Assignments</Label>
                      <Switch
                        id="taskAssignments"
                        checked={preferences.taskAssignments}
                        onCheckedChange={(checked) =>
                          handleUpdatePreferences({ taskAssignments: checked })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="taskDeadlines">Task Deadlines</Label>
                      <Switch
                        id="taskDeadlines"
                        checked={preferences.taskDeadlines}
                        onCheckedChange={(checked) =>
                          handleUpdatePreferences({ taskDeadlines: checked })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="mentions">@Mentions</Label>
                      <Switch
                        id="mentions"
                        checked={preferences.mentions}
                        onCheckedChange={(checked) =>
                          handleUpdatePreferences({ mentions: checked })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="approvalRequests">Approval Requests</Label>
                      <Switch
                        id="approvalRequests"
                        checked={preferences.approvalRequests}
                        onCheckedChange={(checked) =>
                          handleUpdatePreferences({ approvalRequests: checked })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="folderAlerts">Folder Alerts</Label>
                      <Switch
                        id="folderAlerts"
                        checked={preferences.folderAlerts}
                        onCheckedChange={(checked) =>
                          handleUpdatePreferences({ folderAlerts: checked })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="projectUpdates">Project Updates</Label>
                      <Switch
                        id="projectUpdates"
                        checked={preferences.projectUpdates}
                        onCheckedChange={(checked) =>
                          handleUpdatePreferences({ projectUpdates: checked })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Priority Filter */}
                <div className="space-y-4">
                  <h3 className="font-medium text-foreground">Priority Filter</h3>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="highPriorityOnly">High Priority Only</Label>
                    <Switch
                      id="highPriorityOnly"
                      checked={preferences.highPriorityOnly}
                      onCheckedChange={(checked) =>
                        handleUpdatePreferences({ highPriorityOnly: checked })
                      }
                    />
                  </div>
                </div>

                {/* Quiet Hours */}
                <div className="space-y-4">
                  <h3 className="font-medium text-foreground">Quiet Hours</h3>
                  <div className="flex items-center justify-between mb-3">
                    <Label htmlFor="quietHours">Enable Quiet Hours</Label>
                    <Switch
                      id="quietHours"
                      checked={preferences.quietHoursEnabled}
                      onCheckedChange={(checked) =>
                        handleUpdatePreferences({ quietHoursEnabled: checked })
                      }
                    />
                  </div>
                  {preferences.quietHoursEnabled && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="quietStart">Start Time</Label>
                        <Input
                          id="quietStart"
                          type="time"
                          value={preferences.quietHoursStart || "22:00"}
                          onChange={(e) =>
                            handleUpdatePreferences({ quietHoursStart: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="quietEnd">End Time</Label>
                        <Input
                          id="quietEnd"
                          type="time"
                          value={preferences.quietHoursEnd || "08:00"}
                          onChange={(e) =>
                            handleUpdatePreferences({ quietHoursEnd: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Daily Digest */}
                <div className="space-y-4">
                  <h3 className="font-medium text-foreground">Daily Digest</h3>
                  <div className="flex items-center justify-between mb-3">
                    <Label htmlFor="dailyDigest">Enable Daily Digest Email</Label>
                    <Switch
                      id="dailyDigest"
                      checked={preferences.dailyDigestEnabled}
                      onCheckedChange={(checked) =>
                        handleUpdatePreferences({ dailyDigestEnabled: checked })
                      }
                    />
                  </div>
                  {preferences.dailyDigestEnabled && (
                    <div>
                      <Label htmlFor="digestTime">Delivery Time</Label>
                      <Input
                        id="digestTime"
                        type="time"
                        value={preferences.dailyDigestTime || "08:00"}
                        onChange={(e) =>
                          handleUpdatePreferences({ dailyDigestTime: e.target.value })
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
