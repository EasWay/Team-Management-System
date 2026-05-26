import { useState, useEffect } from "react";
import { Bell, Check, X, Inbox, FolderOpen, CheckCircle2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { useTeamContext } from "@/contexts/TeamContext";
import { useSocket } from "@/contexts/SocketContext";
import { toast } from "sonner";

export function NotificationBell() {
  const { selectedTeamId } = useTeamContext();
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch notifications
  const { data: notificationsData, refetch } = trpc.notifications.list.useQuery(
    { teamId: selectedTeamId!, limit: 10 },
    { enabled: !!selectedTeamId }
  );

  useEffect(() => {
    if (notificationsData) {
      setNotifications(notificationsData);
      setUnreadCount(notificationsData.filter((n: any) => !n.read).length);
    }
  }, [notificationsData]);

  // Listen for real-time notifications
  useEffect(() => {
    if (!socket) return;

    const handleNotification = (notification: any) => {
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // Show toast
      toast.info(notification.title, {
        description: notification.message,
      });
    };

    socket.on('notification' as any, handleNotification);

    return () => {
      socket.off('notification' as any, handleNotification);
    };
  }, [socket]);

  const markAsReadMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const markAllAsReadMutation = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("All notifications marked as read");
    },
  });

  const handleMarkAsRead = (notificationId: number) => {
    markAsReadMutation.mutate({ notificationId });
  };

  const handleMarkAllAsRead = () => {
    if (!selectedTeamId) return;
    markAllAsReadMutation.mutate({ teamId: selectedTeamId });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'folder_received':
        return <Inbox className="h-4 w-4 text-blue-500" />;
      case 'folder_delivered':
        return <FolderOpen className="h-4 w-4 text-green-500" />;
      case 'approval_pending':
        return <CheckCircle2 className="h-4 w-4 text-yellow-500" />;
      case 'approval_approved':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'approval_rejected':
        return <X className="h-4 w-4 text-red-500" />;
      case 'message':
        return <MessageSquare className="h-4 w-4 text-purple-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleMarkAllAsRead}
              className="h-6 text-xs"
            >
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No notifications yet
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`flex items-start gap-3 p-3 cursor-pointer ${
                  !notification.read ? 'bg-blue-50' : ''
                }`}
                onClick={() => {
                  if (!notification.read) {
                    handleMarkAsRead(notification.id);
                  }
                  // Navigate to relevant page if link exists
                  if (notification.link) {
                    window.location.href = notification.link;
                  }
                }}
              >
                <div className="mt-0.5">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {notification.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </div>
                {!notification.read && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                )}
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
