import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useTeamContext } from "../contexts/TeamContext";
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  Users,
  MapPin,
  Video,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
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

// Event type colors
const EVENT_TYPE_COLORS: Record<string, string> = {
  deadline: "bg-red-500",
  meeting: "bg-blue-500",
  milestone: "bg-purple-500",
  personal: "bg-green-500",
  office_hours: "bg-yellow-500",
};

export default function Calendar() {
  const { selectedTeamId, teams } = useTeamContext();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  // Event form state
  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    eventType: "meeting" as const,
    startDate: new Date(),
    endDate: new Date(),
    allDay: false,
    location: "",
    meetingUrl: "",
    priority: "medium",
  });

  const currentTeamName = teams?.find((t: any) => t.id === selectedTeamId)?.name || "Select a Team";

  // Calculate date range for current view
  const getDateRange = () => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (viewMode === "month") {
      start.setDate(1);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
    } else if (viewMode === "week") {
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      end.setDate(start.getDate() + 6);
    } else {
      // day view
      end.setDate(end.getDate() + 1);
    }

    return { startDate: start, endDate: end };
  };

  const { startDate, endDate } = getDateRange();

  // Fetch data
  const { data: events, isLoading: loadingEvents, refetch: refetchEvents } = trpc.calendar.getEvents.useQuery(
    {
      teamId: selectedTeamId || 0,
      startDate,
      endDate,
    },
    { enabled: !!selectedTeamId }
  );

  const { data: milestones, isLoading: loadingMilestones } = trpc.milestones.getByTeam.useQuery(
    {
      teamId: selectedTeamId || 0,
      startDate,
      endDate,
    },
    { enabled: !!selectedTeamId }
  );

  const { data: upcomingDeadlines } = trpc.calendar.getUpcomingDeadlines.useQuery(
    { teamId: selectedTeamId || 0, days: 7 },
    { enabled: !!selectedTeamId }
  );

  const { data: teamAvailability } = trpc.availability.getByTeam.useQuery(
    {
      teamId: selectedTeamId || 0,
      startDate,
      endDate,
    },
    { enabled: !!selectedTeamId }
  );

  // Mutations
  const createEventMutation = trpc.calendar.createEvent.useMutation({
    onSuccess: () => {
      toast.success("Event created successfully");
      refetchEvents();
      setEventDialogOpen(false);
      resetEventForm();
    },
    onError: (error) => {
      toast.error(`Failed to create event: ${error.message}`);
    },
  });

  // Navigation
  const navigateMonth = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    if (viewMode === "month") {
      newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1));
    } else if (viewMode === "week") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
    } else {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Reset event form
  const resetEventForm = () => {
    setEventForm({
      title: "",
      description: "",
      eventType: "meeting",
      startDate: new Date(),
      endDate: new Date(),
      allDay: false,
      location: "",
      meetingUrl: "",
      priority: "medium",
    });
  };

  // Handle create event
  const handleCreateEvent = () => {
    if (!eventForm.title.trim()) {
      toast.error("Event title is required");
      return;
    }

    createEventMutation.mutate({
      teamId: selectedTeamId!,
      ...eventForm,
    });
  };

  // Format date
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Format time
  const formatTime = (date: Date | string) => {
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Generate calendar days for month view
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Add empty cells for days before the first of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  // Get events for a specific day
  const getEventsForDay = (date: Date) => {
    if (!events) return [];
    return events.filter((event) => {
      const eventDate = new Date(event.startDate);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const isLoading = loadingEvents || loadingMilestones;

  return (
    <DashboardLayout>
      <div className="flex-1 max-w-7xl mx-auto w-full p-8 space-y-6 pb-20 overflow-y-auto custom-scrollbar">
        {/* Header */}
        <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pt-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
              <span>{currentTeamName}</span>
              <span className="size-1 bg-foreground/20 rounded-full"></span>
              <span>Calendar & Timeline</span>
            </div>
            <h1 className="text-3xl font-light tracking-tight text-foreground">
              Team Calendar
            </h1>
          </div>

          <Button onClick={() => setEventDialogOpen(true)} className="gap-2">
            <Plus className="size-4" />
            New Event
          </Button>
        </section>

        {/* Tabs */}
        <Tabs defaultValue="calendar" className="space-y-6">
          <TabsList>
            <TabsTrigger value="calendar">Calendar View</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="deadlines">Upcoming Deadlines</TabsTrigger>
            <TabsTrigger value="availability">Team Availability</TabsTrigger>
          </TabsList>

          {/* Calendar View Tab */}
          <TabsContent value="calendar" className="space-y-6">
            {/* Calendar Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={() => navigateMonth("prev")}>
                  <ChevronLeft className="size-4" />
                </Button>
                <h2 className="text-xl font-medium">
                  {currentDate.toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </h2>
                <Button variant="outline" size="sm" onClick={() => navigateMonth("next")}>
                  <ChevronRight className="size-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={goToToday}>
                  Today
                </Button>
              </div>

              <div className="flex gap-2">
                {(["month", "week", "day"] as const).map((mode) => (
                  <Button
                    key={mode}
                    variant={viewMode === mode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode(mode)}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Calendar Grid */}
            {isLoading ? (
              <div className="flex justify-center items-center py-20">
                <RefreshCw className="animate-spin size-8 text-muted-foreground" />
              </div>
            ) : (
              <div className="liquid-glass p-6 rounded-xl">
                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div
                      key={day}
                      className="text-center text-[10px] font-bold tracking-widest uppercase text-muted-foreground py-2"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar days */}
                <div className="grid grid-cols-7 gap-2">
                  {generateCalendarDays().map((day, index) => {
                    if (!day) {
                      return <div key={`empty-${index}`} className="aspect-square" />;
                    }

                    const dayEvents = getEventsForDay(day);
                    const isToday =
                      day.getDate() === new Date().getDate() &&
                      day.getMonth() === new Date().getMonth() &&
                      day.getFullYear() === new Date().getFullYear();

                    return (
                      <div
                        key={day.toISOString()}
                        className={`aspect-square p-2 rounded-lg border transition-colors cursor-pointer ${
                          isToday
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-foreground/20 hover:bg-foreground/5"
                        }`}
                      >
                        <div className="text-sm font-medium mb-1">{day.getDate()}</div>
                        <div className="space-y-1">
                          {dayEvents.slice(0, 2).map((event) => (
                            <div
                              key={event.id}
                              className={`text-[10px] px-1 py-0.5 rounded truncate ${
                                EVENT_TYPE_COLORS[event.eventType]
                              } text-white`}
                              title={event.title}
                            >
                              {event.title}
                            </div>
                          ))}
                          {dayEvents.length > 2 && (
                            <div className="text-[10px] text-muted-foreground">
                              +{dayEvents.length - 2} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Event Legend */}
            <div className="flex flex-wrap gap-4">
              {Object.entries(EVENT_TYPE_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <div className={`size-3 rounded ${color}`} />
                  <span className="text-sm text-muted-foreground capitalize">
                    {type.replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="space-y-6">
            <div className="liquid-glass p-6 rounded-xl">
              <h3 className="text-lg font-medium mb-6">Project Timeline</h3>
              {milestones && milestones.length > 0 ? (
                <div className="space-y-4">
                  {milestones.map((milestone, index) => (
                    <div key={milestone.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className={`size-3 rounded-full ${
                            milestone.status === "completed"
                              ? "bg-green-500"
                              : milestone.status === "in_progress"
                              ? "bg-blue-500"
                              : "bg-muted-foreground"
                          }`}
                        />
                        {index < milestones.length - 1 && (
                          <div className="w-0.5 flex-1 bg-border mt-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-8">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-foreground">{milestone.name}</h4>
                            {milestone.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {milestone.description}
                              </p>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatDate(milestone.dueDate)}
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <div className="w-32 h-2 bg-border rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary"
                                style={{ width: `${milestone.progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {milestone.progress}%
                            </span>
                          </div>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              milestone.status === "completed"
                                ? "bg-green-500/10 text-green-500"
                                : milestone.status === "in_progress"
                                ? "bg-blue-500/10 text-blue-500"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {milestone.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No milestones found
                </div>
              )}
            </div>
          </TabsContent>

          {/* Upcoming Deadlines Tab */}
          <TabsContent value="deadlines" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Events */}
              <div className="liquid-glass p-6 rounded-xl">
                <div className="flex items-center gap-2 mb-4">
                  <CalendarIcon className="size-5 text-muted-foreground" />
                  <h3 className="font-medium">Events</h3>
                </div>
                {upcomingDeadlines?.events && upcomingDeadlines.events.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingDeadlines.events.map((event) => (
                      <div
                        key={event.id}
                        className="p-3 rounded-lg border border-border hover:border-foreground/20 transition-colors"
                      >
                        <div className="font-medium text-sm">{event.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatDate(event.startDate)} at {formatTime(event.startDate)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No upcoming events</p>
                )}
              </div>

              {/* Milestones */}
              <div className="liquid-glass p-6 rounded-xl">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="size-5 text-muted-foreground" />
                  <h3 className="font-medium">Milestones</h3>
                </div>
                {upcomingDeadlines?.milestones && upcomingDeadlines.milestones.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingDeadlines.milestones.map((milestone) => (
                      <div
                        key={milestone.id}
                        className="p-3 rounded-lg border border-border hover:border-foreground/20 transition-colors"
                      >
                        <div className="font-medium text-sm">{milestone.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Due: {formatDate(milestone.dueDate)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No upcoming milestones</p>
                )}
              </div>

              {/* Tasks */}
              <div className="liquid-glass p-6 rounded-xl">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="size-5 text-muted-foreground" />
                  <h3 className="font-medium">Tasks</h3>
                </div>
                {upcomingDeadlines?.tasks && upcomingDeadlines.tasks.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingDeadlines.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="p-3 rounded-lg border border-border hover:border-foreground/20 transition-colors"
                      >
                        <div className="font-medium text-sm">{task.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Due: {task.dueDate && formatDate(task.dueDate)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No upcoming tasks</p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Team Availability Tab */}
          <TabsContent value="availability" className="space-y-6">
            <div className="liquid-glass p-6 rounded-xl">
              <h3 className="text-lg font-medium mb-6">Team Availability</h3>
              {teamAvailability && teamAvailability.length > 0 ? (
                <div className="space-y-4">
                  {teamAvailability.map((availability) => (
                    <div
                      key={availability.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`size-3 rounded-full ${
                            availability.status === "available"
                              ? "bg-green-500"
                              : availability.status === "busy"
                              ? "bg-red-500"
                              : availability.status === "away"
                              ? "bg-yellow-500"
                              : "bg-muted-foreground"
                          }`}
                        />
                        <div>
                          <div className="font-medium">User #{availability.userId}</div>
                          {availability.reason && (
                            <div className="text-sm text-muted-foreground">
                              {availability.reason}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(availability.startDate)} - {formatDate(availability.endDate)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No availability data
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Create Event Dialog */}
        <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Event</DialogTitle>
              <DialogDescription>Add a new event to the team calendar</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Event Title</Label>
                <Input
                  placeholder="Enter event title"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  placeholder="Enter event description"
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Event Type</Label>
                  <Select
                    value={eventForm.eventType}
                    onValueChange={(value: any) =>
                      setEventForm({ ...eventForm, eventType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="deadline">Deadline</SelectItem>
                      <SelectItem value="milestone">Milestone</SelectItem>
                      <SelectItem value="personal">Personal</SelectItem>
                      <SelectItem value="office_hours">Office Hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Priority</Label>
                  <Select
                    value={eventForm.priority}
                    onValueChange={(value) => setEventForm({ ...eventForm, priority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date & Time</Label>
                  <Input
                    type="datetime-local"
                    value={eventForm.startDate.toISOString().slice(0, 16)}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, startDate: new Date(e.target.value) })
                    }
                  />
                </div>

                <div>
                  <Label>End Date & Time</Label>
                  <Input
                    type="datetime-local"
                    value={eventForm.endDate.toISOString().slice(0, 16)}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, endDate: new Date(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div>
                <Label>Location</Label>
                <Input
                  placeholder="Enter location"
                  value={eventForm.location}
                  onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                />
              </div>

              <div>
                <Label>Meeting URL</Label>
                <Input
                  placeholder="Enter meeting URL (Zoom, Teams, etc.)"
                  value={eventForm.meetingUrl}
                  onChange={(e) => setEventForm({ ...eventForm, meetingUrl: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEventDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateEvent}>Create Event</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
