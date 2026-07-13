import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useSocket } from "@/contexts/SocketContext";
import { toast } from "sonner";
import { 
  Sparkles, 
  Users, 
  Target, 
  Palette, 
  Code, 
  TrendingUp, 
  CheckCircle2, 
  Loader2,
  Rocket,
  MessageSquare,
  Send,
  MessageCircle,
  Wifi,
  WifiOff,
  Lightbulb,
  ClipboardPaste,
  AlertTriangle,
  Trash2,
  Bot,
  RotateCcw,
} from "lucide-react";

interface IdeationPanelProps {
  teamId: number;
  onProjectActivated?: () => void;
}

export function IdeationPanel({ teamId, onProjectActivated }: IdeationPanelProps) {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const [chatLogs, setChatLogs] = useState("");
  const [ideationResult, setIdeationResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  
  // Live chat state
  const [liveMessages, setLiveMessages] = useState<Array<{name: string, message: string, timestamp: Date, userId?: number}>>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [onlineUsers, setOnlineUsers] = useState<Array<{userId: number, username: string}>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Client info for activation
  const [clientFirstName, setClientFirstName] = useState("");
  const [clientLastName, setClientLastName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");

  // Join ideation room when component mounts
  useEffect(() => {
    if (socket && isConnected && teamId) {
      const roomId = `ideation-${teamId}`;
      socket.emit('joinDocument', roomId);
      console.log(`[Ideation] Joined room: ${roomId}`);

      return () => {
        socket.emit('leaveDocument', roomId);
        console.log(`[Ideation] Left room: ${roomId}`);
      };
    }
  }, [socket, isConnected, teamId]);

  // Listen for real-time messages
  useEffect(() => {
    if (!socket) return;

    const handleIdeationMessage = (data: {name: string, message: string, timestamp: string, userId: number}) => {
      setLiveMessages(prev => [...prev, {
        name: data.name,
        message: data.message,
        timestamp: new Date(data.timestamp),
        userId: data.userId
      }]);
    };

    const handleUserJoined = (data: {userId: number, username: string}) => {
      setOnlineUsers(prev => {
        if (prev.find(u => u.userId === data.userId)) return prev;
        return [...prev, data];
      });
      toast.success(`${data.username} joined the brainstorming session`);
    };

    const handleUserLeft = (data: {userId: number}) => {
      setOnlineUsers(prev => prev.filter(u => u.userId !== data.userId));
    };

    const handleChatCleared = () => {
      setLiveMessages([]);
      toast.info("Chat was cleared by a team member");
    };

    socket.on('ideationMessage' as any, handleIdeationMessage);
    socket.on('ideationUserJoined' as any, handleUserJoined);
    socket.on('ideationUserLeft' as any, handleUserLeft);
    socket.on('ideationChatCleared' as any, handleChatCleared);

    return () => {
      socket.off('ideationMessage' as any, handleIdeationMessage);
      socket.off('ideationUserJoined' as any, handleUserJoined);
      socket.off('ideationUserLeft' as any, handleUserLeft);
      socket.off('ideationChatCleared' as any, handleChatCleared);
    };
  }, [socket]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveMessages]);

  // Send message in live chat (real-time)
  const handleSendMessage = () => {
    if (!currentMessage.trim() || !user || !socket || !isConnected) return;
    
    const messageData = {
      teamId,
      name: user.name || user.email || "Anonymous",
      message: currentMessage.trim(),
      timestamp: new Date().toISOString(),
      userId: user.id
    };
    
    // Emit to all users in the room
    socket.emit('ideationMessage' as any, messageData);
    
    setCurrentMessage("");
  };

  // Convert live chat to text format for AI processing
  const handleProcessLiveChat = () => {
    if (liveMessages.length === 0) {
      toast.error("No messages in chat yet. Start brainstorming!");
      return;
    }
    
    // Convert messages to chat log format
    const formattedChat = liveMessages.map(msg => {
      const time = msg.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      return `[${time}] ${msg.name}: ${msg.message}`;
    }).join('\n\n');
    
    setChatLogs(formattedChat);
    setIsProcessing(true);
    processIdeationMutation.mutate({ chatLogs: formattedChat });
  };

  // Clear live chat (broadcast to all users)
  const handleClearChat = () => {
    if (socket && isConnected) {
      socket.emit('ideationClearChat' as any, { teamId });
    }
    setLiveMessages([]);
    toast.success("Chat cleared");
  };

  const processIdeationMutation = trpc.projects.processIdeation.useMutation({
    onSuccess: (data) => {
      setIdeationResult(data);
      toast.success("Ideation processed successfully!");
      setIsProcessing(false);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsProcessing(false);
    }
  });

  const activateProjectMutation = trpc.projects.activateProject.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setIsActivating(false);
      setIdeationResult(null);
      setChatLogs("");
      setClientFirstName("");
      setClientLastName("");
      setClientEmail("");
      setClientPhone("");
      onProjectActivated?.();
    },
    onError: (error) => {
      toast.error(error.message);
      setIsActivating(false);
    },
  });

  const handleProcessIdeation = () => {
    if (!chatLogs.trim()) {
      toast.error("Please paste chat logs first");
      return;
    }
    setIsProcessing(true);
    processIdeationMutation.mutate({ chatLogs });
  };

  const handleActivateProject = () => {
    if (!ideationResult) return;
    
    setIsActivating(true);
    activateProjectMutation.mutate({
      teamId,
      ideationResult,
      clientFirstName: clientFirstName || undefined,
      clientLastName: clientLastName || undefined,
      clientEmail: clientEmail || undefined,
      clientPhone: clientPhone || undefined,
    });
  };

  const handleSampleChat = () => {
    const sample = `[2024-03-15, 10:30] John (CEO): Hey team, I've been thinking about our next project. What if we build a food delivery app specifically for boats and yachts?

[2024-03-15, 10:32] Sarah (Designer): That's interesting! So like Uber Eats but for people on the water?

[2024-03-15, 10:33] John (CEO): Exactly! There's a huge market of yacht owners and boat renters who want restaurant-quality food delivered to their vessels.

[2024-03-15, 10:35] Mike (Developer): From a technical standpoint, we'd need GPS tracking for both boats and delivery drivers. That's doable with modern APIs.

[2024-03-15, 10:37] Sarah (Designer): We should focus on a premium experience. High-end restaurants, elegant UI, maybe even a concierge service.

[2024-03-15, 10:40] Lisa (Business Analyst): Target market would be yacht clubs, marinas, and coastal cities. Revenue model could be commission-based plus premium subscriptions.

[2024-03-15, 10:42] Mike (Developer): We'll need real-time location tracking, payment processing, restaurant POS integration, and a driver app. I'd suggest React Native for mobile.

[2024-03-15, 10:45] John (CEO): Perfect. Let's aim for a 3-month MVP. Success metrics: 50 restaurants onboarded, 1000 active users, $100K in monthly transactions.

[2024-03-15, 10:47] Sarah (Designer): I'll start on wireframes and branding. Thinking nautical theme with modern, clean aesthetics.

[2024-03-15, 10:50] Lisa (Business Analyst): I'll work on the business plan and partnership strategy with marinas and restaurants.`;
    
    setChatLogs(sample);
    toast.success("Sample chat loaded! Click 'Process Ideation' to analyze.");
  };

  return (
    <div className="space-y-6">
      {!ideationResult ? (
        <Card className="border-2 border-purple-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-purple-50">
                <MessageSquare className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <CardTitle>Idea Lab - AI Transcriptionist</CardTitle>
                <CardDescription>
                  Chat live with your team OR paste external conversations - AI will structure it into a project folder
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="live-chat" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="live-chat">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Live Chat
                </TabsTrigger>
                <TabsTrigger value="paste">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Paste Conversation
                </TabsTrigger>
              </TabsList>

              {/* Live Chat Tab */}
              <TabsContent value="live-chat" className="space-y-4">
                <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50/30 to-purple-50/30">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <MessageCircle className="h-4 w-4" />
                          Team Brainstorming Chat
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
                          Chat with your team in real-time. AI will capture the conversation and generate a project folder.
                        </CardDescription>
                      </div>
                      {onlineUsers.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{onlineUsers.length} online</span>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Online Users */}
                    {onlineUsers.length > 0 && (
                      <div className="flex items-center gap-2 p-2 bg-white rounded-lg border">
                        <span className="text-xs text-muted-foreground">Online:</span>
                        <div className="flex flex-wrap gap-1">
                          {onlineUsers.map((u) => (
                            <Badge key={u.userId} variant="secondary" className="text-xs">
                              {u.username}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Chat Messages */}
                    <div className="h-96 overflow-y-auto border rounded-lg p-4 bg-white space-y-3">
                      {liveMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                          <MessageCircle className="h-12 w-12 mb-3 opacity-30" />
                          <p className="font-medium">Start brainstorming!</p>
                          <p className="text-sm">Type your ideas below and AI will capture everything</p>
                          {!isConnected && (
                            <p className="flex items-center justify-center gap-1 text-xs text-red-500 mt-2">
                              <AlertTriangle className="h-3 w-3" />
                              Connecting to server...
                            </p>
                          )}
                        </div>
                      ) : (
                        <>
                          {liveMessages.map((msg, idx) => {
                            const isCurrentUser = msg.userId === user?.id;
                            return (
                              <div key={idx} className={`flex flex-col gap-1 ${isCurrentUser ? 'items-end' : 'items-start'}`}>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sm">{msg.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {msg.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <div className={`rounded-lg p-3 max-w-[80%] ${
                                  isCurrentUser 
                                    ? 'bg-primary text-primary-foreground' 
                                    : 'bg-muted/50'
                                }`}>
                                  <p className="text-sm">{msg.message}</p>
                                </div>
                              </div>
                            );
                          })}
                          <div ref={messagesEndRef} />
                        </>
                      )}
                    </div>

                    {/* Message Input */}
                    <div className="flex gap-2">
                      <Input
                        placeholder={isConnected ? "Type your message..." : "Connecting..."}
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
                      <Button onClick={handleSendMessage} disabled={!currentMessage.trim() || !isConnected}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        onClick={handleClearChat}
                        disabled={liveMessages.length === 0}
                        className="flex-1"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Clear Chat
                      </Button>
                      <Button
                        onClick={handleProcessLiveChat}
                        disabled={isProcessing || liveMessages.length === 0}
                        className="flex-1 bg-purple-600 hover:bg-purple-700"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            AI is analyzing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Generate Project Folder
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground text-center">
                      <Lightbulb className="h-3.5 w-3.5 shrink-0" />
                      Tip: Discuss goals, features, timeline, and team roles. AI will capture everything!
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Paste Conversation Tab */}
              <TabsContent value="paste" className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="chatLogs" className="flex items-center gap-1.5">
                      <ClipboardPaste className="h-3.5 w-3.5" />
                      Paste External Chat Logs
                    </Label>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleSampleChat}
                      type="button"
                    >
                      Load Sample
                    </Button>
                  </div>
                  <Textarea
                    id="chatLogs"
                    placeholder="Paste your brainstorming chat here...

Example formats:
- WhatsApp: [Date, Time] Name: Message
- Slack: Name [Time]: Message
- Discord: Name - Today at Time: Message
- Generic: Name: Message

The AI will identify all speakers and extract:
- Business goals
- Design requirements
- Technical specifications
- Target audience
- Success metrics"
                    value={chatLogs}
                    onChange={(e) => setChatLogs(e.target.value)}
                    rows={15}
                    className="font-mono text-sm"
                  />
                </div>

                <Button 
                  onClick={handleProcessIdeation} 
                  disabled={isProcessing || !chatLogs.trim()}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      AI is analyzing your chat...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Create Project Folder with AI
                    </>
                  )}
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Final Decision Report */}
          <Card className="border-primary border-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <CardTitle>{ideationResult.finalDecisionReport.projectName}</CardTitle>
                </div>
                <Badge variant="secondary" className="flex items-center gap-1 bg-purple-100 text-purple-700">
                  <Bot className="h-3 w-3" />
                  AI Generated Folder
                </Badge>
              </div>
              <CardDescription>
                {ideationResult.finalDecisionReport.executiveSummary}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="speakers" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="speakers">
                    <Users className="h-4 w-4 mr-1" />
                    Team
                  </TabsTrigger>
                  <TabsTrigger value="business">
                    <Target className="h-4 w-4 mr-1" />
                    Business
                  </TabsTrigger>
                  <TabsTrigger value="design">
                    <Palette className="h-4 w-4 mr-1" />
                    Design
                  </TabsTrigger>
                  <TabsTrigger value="technical">
                    <Code className="h-4 w-4 mr-1" />
                    Technical
                  </TabsTrigger>
                  <TabsTrigger value="timeline">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    Timeline
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="speakers" className="space-y-4">
                  <div className="grid gap-3">
                    {ideationResult.speakers.map((speaker: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{speaker.name}</p>
                          <p className="text-sm text-muted-foreground">{speaker.role}</p>
                        </div>
                        <Badge variant="outline">{speaker.contributions} contributions</Badge>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="business" className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Goals</h4>
                      <ul className="space-y-1">
                        {ideationResult.finalDecisionReport.businessRequirements.goals.map((goal: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm">{goal}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-2">Target Market</h4>
                      <p className="text-sm text-muted-foreground">
                        {ideationResult.finalDecisionReport.businessRequirements.targetMarket}
                      </p>
                    </div>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-2">Revenue Model</h4>
                      <p className="text-sm text-muted-foreground">
                        {ideationResult.finalDecisionReport.businessRequirements.revenueModel}
                      </p>
                    </div>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-2">Competitive Advantage</h4>
                      <p className="text-sm text-muted-foreground">
                        {ideationResult.finalDecisionReport.businessRequirements.competitiveAdvantage}
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="design" className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">User Experience</h4>
                      <ul className="space-y-1">
                        {ideationResult.finalDecisionReport.designRequirements.userExperience.map((ux: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm">{ux}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-2">Visual Style</h4>
                      <p className="text-sm text-muted-foreground">
                        {ideationResult.finalDecisionReport.designRequirements.visualStyle}
                      </p>
                    </div>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-2">Platforms</h4>
                      <div className="flex flex-wrap gap-2">
                        {ideationResult.finalDecisionReport.designRequirements.platforms.map((platform: string, idx: number) => (
                          <Badge key={idx} variant="secondary">{platform}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="technical" className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Architecture</h4>
                      <p className="text-sm text-muted-foreground">
                        {ideationResult.finalDecisionReport.technicalRequirements.architecture}
                      </p>
                    </div>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-2">Technologies</h4>
                      <div className="flex flex-wrap gap-2">
                        {ideationResult.finalDecisionReport.technicalRequirements.technologies.map((tech: string, idx: number) => (
                          <Badge key={idx} variant="outline">{tech}</Badge>
                        ))}
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-2">Integrations</h4>
                      <ul className="space-y-1">
                        {ideationResult.finalDecisionReport.technicalRequirements.integrations.map((integration: string, idx: number) => (
                          <li key={idx} className="text-sm text-muted-foreground">• {integration}</li>
                        ))}
                      </ul>
                    </div>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-2">Security</h4>
                      <ul className="space-y-1">
                        {ideationResult.finalDecisionReport.technicalRequirements.security.map((sec: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm">{sec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="timeline" className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Estimated Duration</h4>
                      <p className="text-lg font-bold text-primary">
                        {ideationResult.finalDecisionReport.timeline.estimatedDuration}
                      </p>
                    </div>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-3">Phases</h4>
                      <div className="space-y-3">
                        {ideationResult.finalDecisionReport.timeline.phases.map((phase: any, idx: number) => (
                          <div key={idx} className="border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="font-medium">{phase.name}</h5>
                              <Badge variant="outline">{phase.duration}</Badge>
                            </div>
                            <ul className="space-y-1">
                              {phase.deliverables.map((deliverable: string, dIdx: number) => (
                                <li key={dIdx} className="text-sm text-muted-foreground">• {deliverable}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Client Information & Activation */}
          <Card className="border-green-200 border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Deliver Folder to Lead Researcher's Office
              </CardTitle>
              <CardDescription>
                Add client information and send this folder to George Essel Bonsu (Lead Researcher) to start scoping
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientFirstName">Client First Name</Label>
                  <Input
                    id="clientFirstName"
                    placeholder="Optional"
                    value={clientFirstName}
                    onChange={(e) => setClientFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientLastName">Client Last Name</Label>
                  <Input
                    id="clientLastName"
                    placeholder="Optional"
                    value={clientLastName}
                    onChange={(e) => setClientLastName(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientEmail">Client Email</Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    placeholder="Optional"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientPhone">Client Phone</Label>
                  <Input
                    id="clientPhone"
                    type="tel"
                    placeholder="Optional"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setIdeationResult(null)}
                  className="flex-1"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Start Over
                </Button>
                <Button 
                  onClick={handleActivateProject}
                  disabled={isActivating}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {isActivating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Delivering...
                    </>
                  ) : (
                    <>
                      <Rocket className="mr-2 h-4 w-4" />
                      Deliver to Lead Researcher
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
