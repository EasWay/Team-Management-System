import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/_core/hooks/useAuth";
import { useSocket } from "@/contexts/SocketContext";
import { Send, Users, MessageCircle, Wifi, WifiOff, Info } from "lucide-react";

interface OfficeChatProps {
  officeRole: string;
  teamId: number;
}

export function OfficeChat({ officeRole, teamId }: OfficeChatProps) {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState<Array<{
    userId: number;
    userName: string;
    message: string;
    timestamp: Date;
  }>>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [visitors, setVisitors] = useState<Array<{userId: number, userName: string}>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Join office room
  useEffect(() => {
    if (socket && isConnected && teamId && officeRole) {
      const roomId = `office-${teamId}-${officeRole}`;
      socket.emit('joinOffice' as any, { teamId, officeRole, userName: user?.name || user?.email });
      console.log(`[Office Chat] Joined office: ${roomId}`);

      return () => {
        socket.emit('leaveOffice' as any, { teamId, officeRole });
        console.log(`[Office Chat] Left office: ${roomId}`);
      };
    }
  }, [socket, isConnected, teamId, officeRole, user]);

  // Listen for office events
  useEffect(() => {
    if (!socket) return;

    const handleOfficeMessage = (data: {userId: number, userName: string, message: string, timestamp: string}) => {
      setMessages(prev => [...prev, {
        userId: data.userId,
        userName: data.userName,
        message: data.message,
        timestamp: new Date(data.timestamp)
      }]);
    };

    const handleVisitorJoined = (data: {userId: number, userName: string}) => {
      setVisitors(prev => {
        if (prev.find(v => v.userId === data.userId)) return prev;
        return [...prev, data];
      });
    };

    const handleVisitorLeft = (data: {userId: number}) => {
      setVisitors(prev => prev.filter(v => v.userId !== data.userId));
    };

    const handleVisitorsList = (data: {visitors: Array<{userId: number, userName: string}>}) => {
      setVisitors(data.visitors);
    };

    socket.on('officeMessage' as any, handleOfficeMessage);
    socket.on('officeVisitorJoined' as any, handleVisitorJoined);
    socket.on('officeVisitorLeft' as any, handleVisitorLeft);
    socket.on('officeVisitorsList' as any, handleVisitorsList);

    return () => {
      socket.off('officeMessage' as any, handleOfficeMessage);
      socket.off('officeVisitorJoined' as any, handleVisitorJoined);
      socket.off('officeVisitorLeft' as any, handleVisitorLeft);
      socket.off('officeVisitorsList' as any, handleVisitorsList);
    };
  }, [socket]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    if (!currentMessage.trim() || !socket || !isConnected || !user) return;

    const messageData = {
      teamId,
      officeRole,
      userId: user.id,
      userName: user.name || user.email || "Anonymous",
      message: currentMessage.trim(),
      timestamp: new Date().toISOString()
    };

    socket.emit('officeMessage' as any, messageData);
    setCurrentMessage("");
  };

  return (
    <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50/30 to-pink-50/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Office Chat
              {isConnected ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                  <Wifi className="h-3 w-3 mr-1" />
                  Live
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                  <WifiOff className="h-3 w-3 mr-1" />
                  Offline
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Chat with visitors in this office
            </CardDescription>
          </div>
          {visitors.length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{visitors.length} here</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Visitors */}
        {visitors.length > 0 && (
          <div className="flex items-center gap-2 p-2 bg-white rounded-lg border">
            <span className="text-xs text-muted-foreground">In office:</span>
            <div className="flex flex-wrap gap-1">
              {visitors.map((v) => (
                <Badge key={v.userId} variant="secondary" className="text-xs">
                  {v.userName}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="h-64 overflow-y-auto border rounded-lg p-3 bg-white space-y-3">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <MessageCircle className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">No messages yet</p>
              <p className="text-xs">Start a conversation!</p>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => {
                const isCurrentUser = msg.userId === user?.id;
                return (
                  <div key={idx} className={`flex gap-2 ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {msg.userName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`flex flex-col gap-1 max-w-[70%] ${isCurrentUser ? 'items-end' : ''}`}>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-semibold">{msg.userName}</span>
                        <span>{msg.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className={`rounded-lg p-2 ${
                        isCurrentUser 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted'
                      }`}>
                        <p className="text-sm">{msg.message}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            placeholder={isConnected ? "Type a message..." : "Connecting..."}
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={!isConnected}
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={!currentMessage.trim() || !isConnected}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground text-center">
          <Info className="h-3 w-3 shrink-0" />
          Collaborate with team members visiting your office
        </p>
      </CardContent>
    </Card>
  );
}
