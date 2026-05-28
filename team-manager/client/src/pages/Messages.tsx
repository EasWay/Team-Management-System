import { useState, useEffect, useRef, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTeamContext } from "@/contexts/TeamContext";
import { useSocket } from "@/contexts/SocketContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Send, Paperclip, Search, MessageSquare, CheckCheck,
  Phone, Video, MoreVertical, Smile, ArrowLeft,
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: number;
  fromMemberId: number;
  toMemberId: number;
  teamId: number;
  content: string;
  messageType: string;
  fileUrl?: string | null;
  fileName?: string | null;
  readAt?: Date | string | null;
  createdAt: Date | string;
  fromName?: string | null;
  toName?: string | null;
}

interface ConversationSummary {
  partnerId: number;
  partnerName: string | null;
  lastMessage: string;
  lastMessageAt: Date | string | null;
  unreadCount: number;
}

interface TeamMemberEntry {
  id: number;
  teamId: number;
  memberId: number;
  role: string;
  member: { id: number; name: string | null; email: string | null; pictureFileName?: string | null };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-fuchsia-500", "bg-teal-500",
];
function avatarColor(id: number): string {
  return AVATAR_COLORS[Math.abs(id) % AVATAR_COLORS.length];
}

function formatSidebarTime(date: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "dd/MM/yy");
}

function formatBubbleTime(date: Date | string): string {
  return format(new Date(date), "HH:mm");
}

function dateSeparatorLabel(date: Date | string): string {
  const d = new Date(date);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMMM d, yyyy");
}

function isDifferentDay(a: Date | string, b: Date | string): boolean {
  return new Date(a).toDateString() !== new Date(b).toDateString();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Messages() {
  const { user } = useAuth();
  const { selectedTeamId } = useTeamContext();
  const { socket } = useSocket();

  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [typingPartners, setTypingPartners] = useState<Set<number>>(new Set());
  const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set());
  const [conversationCache, setConversationCache] = useState<Map<number, ConversationSummary>>(new Map());
  const [showSidebar, setShowSidebar] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentMemberId = user?.id ?? 0;

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: membersData, isLoading: membersLoading } = trpc.teams.getMembers.useQuery(
    { teamId: selectedTeamId! },
    { enabled: !!selectedTeamId }
  );

  const { data: conversationsData, refetch: refetchConversations } = trpc.chat.getConversations.useQuery(
    { memberId: currentMemberId, teamId: selectedTeamId! },
    { enabled: !!selectedTeamId && !!currentMemberId, refetchInterval: 30000 }
  );

  const { data: threadData } = trpc.chat.getMessages.useQuery(
    { memberA: currentMemberId, memberB: selectedPartnerId!, teamId: selectedTeamId! },
    { enabled: !!selectedPartnerId && !!selectedTeamId && !!currentMemberId }
  );

  const sendMutation = trpc.chat.send.useMutation();
  const markReadMutation = trpc.chat.markRead.useMutation();

  // ── Sync remote data ──────────────────────────────────────────────────────

  useEffect(() => {
    if (threadData) setLocalMessages(threadData as ChatMessage[]);
  }, [threadData]);

  useEffect(() => {
    if (!conversationsData) return;
    const map = new Map<number, ConversationSummary>();
    (conversationsData as ConversationSummary[]).forEach(c => map.set(c.partnerId, c));
    setConversationCache(map);
  }, [conversationsData]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  // ── Mark read on open ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedPartnerId || !selectedTeamId) return;
    socket?.emit("chat:read" as any, { fromMemberId: selectedPartnerId, teamId: selectedTeamId });
    markReadMutation.mutate({ fromMemberId: selectedPartnerId, toMemberId: currentMemberId, teamId: selectedTeamId });
    setConversationCache(prev => {
      const next = new Map(prev);
      const c = next.get(selectedPartnerId);
      if (c) next.set(selectedPartnerId, { ...c, unreadCount: 0 });
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPartnerId, selectedTeamId]);

  // ── Socket listeners ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!socket) return;

    const onMessage = (msg: ChatMessage) => {
      const isActiveThread =
        (msg.fromMemberId === selectedPartnerId && msg.toMemberId === currentMemberId) ||
        (msg.fromMemberId === currentMemberId && msg.toMemberId === selectedPartnerId);

      if (isActiveThread) {
        setLocalMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        if (msg.fromMemberId === selectedPartnerId)
          socket.emit("chat:read" as any, { fromMemberId: msg.fromMemberId, teamId: msg.teamId });
      }

      const partnerId = msg.fromMemberId === currentMemberId ? msg.toMemberId : msg.fromMemberId;
      setConversationCache(prev => {
        const next = new Map(prev);
        const existing = next.get(partnerId);
        const isCurrentlyOpen = selectedPartnerId === partnerId && msg.fromMemberId !== currentMemberId;
        next.set(partnerId, {
          partnerId,
          partnerName: existing?.partnerName ?? null,
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt,
          unreadCount: isCurrentlyOpen ? 0 : (existing?.unreadCount ?? 0) + (msg.fromMemberId !== currentMemberId ? 1 : 0),
        });
        return next;
      });
    };

    const onTyping = ({ fromMemberId }: { fromMemberId: number }) =>
      setTypingPartners(prev => new Set(Array.from(prev).concat(fromMemberId)));

    const onTypingStop = ({ fromMemberId }: { fromMemberId: number }) =>
      setTypingPartners(prev => { const s = new Set(prev); s.delete(fromMemberId); return s; });

    const onRead = ({ byMemberId }: { byMemberId: number }) =>
      setLocalMessages(prev =>
        prev.map(m =>
          m.fromMemberId === currentMemberId && m.toMemberId === byMemberId && !m.readAt
            ? { ...m, readAt: new Date().toISOString() } : m
        )
      );

    const onOnline = ({ userId }: { userId: number }) =>
      setOnlineUsers(prev => new Set(Array.from(prev).concat(userId)));

    const onOffline = ({ userId }: { userId: number }) =>
      setOnlineUsers(prev => { const s = new Set(prev); s.delete(userId); return s; });

    socket.on("chatMessage" as any, onMessage);
    socket.on("chat:typing" as any, onTyping);
    socket.on("chat:typing_stop" as any, onTypingStop);
    socket.on("chat:read" as any, onRead);
    socket.on("presence:online" as any, onOnline);
    socket.on("presence:offline" as any, onOffline);

    return () => {
      socket.off("chatMessage" as any, onMessage);
      socket.off("chat:typing" as any, onTyping);
      socket.off("chat:typing_stop" as any, onTypingStop);
      socket.off("chat:read" as any, onRead);
      socket.off("presence:online" as any, onOnline);
      socket.off("presence:offline" as any, onOffline);
    };
  }, [socket, selectedPartnerId, currentMemberId]);

  // ── Typing emission ───────────────────────────────────────────────────────

  const handleInputChange = (value: string) => {
    setMessageInput(value);
    if (!selectedPartnerId || !socket) return;
    socket.emit("chat:typing" as any, { toMemberId: selectedPartnerId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("chat:typing_stop" as any, { toMemberId: selectedPartnerId });
    }, 1500);
  };

  // ── Send ──────────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (
    content: string,
    type: "text" | "file" | "image" = "text",
    fileUrl?: string,
    fileName?: string,
  ) => {
    if (!content.trim() && type === "text") return;
    if (!selectedPartnerId || !selectedTeamId) return;

    socket?.emit("chat:typing_stop" as any, { toMemberId: selectedPartnerId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    const optimistic: ChatMessage = {
      id: Date.now() * -1,
      fromMemberId: currentMemberId,
      toMemberId: selectedPartnerId,
      teamId: selectedTeamId,
      content,
      messageType: type,
      fileUrl: fileUrl ?? null,
      fileName: fileName ?? null,
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    setLocalMessages(prev => [...prev, optimistic]);
    setMessageInput("");

    try {
      if (socket?.connected) {
        socket.emit("chat:send" as any, { toMemberId: selectedPartnerId, content, messageType: type, fileUrl, fileName, teamId: selectedTeamId });
      } else {
        await sendMutation.mutateAsync({
          fromMemberId: currentMemberId, toMemberId: selectedPartnerId,
          teamId: selectedTeamId, content, messageType: type, fileUrl, fileName,
        });
      }
      refetchConversations();
    } catch {
      toast.error("Failed to send message");
      setLocalMessages(prev => prev.filter(m => m.id !== optimistic.id));
    }
  }, [selectedPartnerId, selectedTeamId, currentMemberId, socket, sendMutation, refetchConversations]);

  // ── File attach ───────────────────────────────────────────────────────────

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("File must be under 5 MB"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      sendMessage(file.name, file.type.startsWith("image/") ? "image" : "file", dataUrl, file.name);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── Contact list ──────────────────────────────────────────────────────────

  const allMembers = (membersData as TeamMemberEntry[] | undefined) ?? [];
  const contacts = allMembers
    .filter(m => m.memberId !== currentMemberId)
    .map(m => {
      const conv = conversationCache.get(m.memberId);
      return {
        id: m.memberId,
        name: m.member?.name ?? "Team Member",
        lastMessage: conv?.lastMessage ?? "",
        lastMessageAt: conv?.lastMessageAt ?? null,
        unreadCount: conv?.unreadCount ?? 0,
        isOnline: onlineUsers.has(m.memberId),
      };
    })
    .filter(c => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (a.lastMessageAt && b.lastMessageAt)
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      if (a.lastMessageAt) return -1;
      if (b.lastMessageAt) return 1;
      return a.name.localeCompare(b.name);
    });

  const selectedContact = contacts.find(c => c.id === selectedPartnerId);

  if (!selectedTeamId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Select a team to start messaging
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden bg-background">

        {/* ── SIDEBAR ───────────────────────────────────────────────────── */}
        <div className={`flex flex-col border-r border-border bg-background shrink-0 w-full md:w-80 lg:w-96 ${selectedPartnerId ? "hidden md:flex" : "flex"}`}>
          <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
            <h2 className="flex-1 font-bold text-foreground text-lg">Messages</h2>
          </div>

          <div className="px-3 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts…"
                className="pl-9 bg-muted/50 border-0 focus-visible:ring-1 rounded-xl"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            {membersLoading ? (
              <p className="text-center py-12 text-sm text-muted-foreground">Loading…</p>
            ) : contacts.length === 0 ? (
              <p className="text-center py-12 text-sm text-muted-foreground">No team members found</p>
            ) : contacts.map(contact => (
              <button
                key={contact.id}
                onClick={() => setSelectedPartnerId(contact.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left ${selectedPartnerId === contact.id ? "bg-muted/70" : ""}`}
              >
                <div className="relative shrink-0">
                  <div className={`w-12 h-12 rounded-full ${avatarColor(contact.id)} flex items-center justify-center text-white font-semibold text-sm`}>
                    {initials(contact.name)}
                  </div>
                  {contact.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-semibold text-sm text-foreground truncate">{contact.name}</span>
                    {contact.lastMessageAt && (
                      <span className="text-[11px] text-muted-foreground shrink-0 ml-1">{formatSidebarTime(contact.lastMessageAt)}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground truncate pr-2">
                      {typingPartners.has(contact.id)
                        ? <span className="text-emerald-500 italic">typing…</span>
                        : contact.lastMessage || "Start a conversation"
                      }
                    </span>
                    {contact.unreadCount > 0 && (
                      <span className="shrink-0 bg-emerald-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {contact.unreadCount > 99 ? "99+" : contact.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </ScrollArea>
        </div>

        {/* ── CHAT PANEL ────────────────────────────────────────────────── */}
        <div className={`flex-1 flex flex-col min-w-0 ${!selectedPartnerId ? "hidden md:flex" : "flex"}`}>
          {!selectedPartnerId ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
              <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
                <MessageSquare className="w-10 h-10 text-muted-foreground/40" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-xl mb-1">Team Chat</h3>
                <p className="text-sm text-muted-foreground max-w-xs">Select a contact to start messaging</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
                <button className="md:hidden p-1 -ml-1 rounded hover:bg-muted/50" onClick={() => setSelectedPartnerId(null)}>
                  <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>

                <div className="relative shrink-0">
                  <div className={`w-10 h-10 rounded-full ${avatarColor(selectedPartnerId)} flex items-center justify-center text-white font-semibold text-sm`}>
                    {initials(selectedContact?.name)}
                  </div>
                  {selectedContact?.isOnline && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-background" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">{selectedContact?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {typingPartners.has(selectedPartnerId)
                      ? <span className="text-emerald-500 italic">typing…</span>
                      : selectedContact?.isOnline
                        ? <span className="text-emerald-500">online</span>
                        : "offline"
                    }
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="w-9 h-9 text-muted-foreground" disabled><Video className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="w-9 h-9 text-muted-foreground" disabled><Phone className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="w-9 h-9 text-muted-foreground"><MoreVertical className="w-4 h-4" /></Button>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 px-4 py-2 bg-muted/10">
                <div className="flex flex-col gap-0.5 py-2">
                  {localMessages.length === 0 && (
                    <div className="flex justify-center py-8">
                      <span className="bg-muted/80 text-muted-foreground text-xs px-4 py-2 rounded-full">
                        Start your conversation with {selectedContact?.name}
                      </span>
                    </div>
                  )}

                  {localMessages.map((msg, i) => {
                    const isMine = msg.fromMemberId === currentMemberId;
                    const showSep = i === 0 || isDifferentDay(localMessages[i - 1].createdAt, msg.createdAt);
                    const prevSame = i > 0 && localMessages[i - 1].fromMemberId === msg.fromMemberId && !isDifferentDay(localMessages[i - 1].createdAt, msg.createdAt);

                    return (
                      <div key={msg.id}>
                        {showSep && (
                          <div className="flex justify-center my-3">
                            <span className="bg-muted/80 text-muted-foreground text-[11px] font-medium px-3 py-1 rounded-full">
                              {dateSeparatorLabel(msg.createdAt)}
                            </span>
                          </div>
                        )}

                        <div className={`flex ${isMine ? "justify-end" : "justify-start"} ${prevSame ? "mt-0.5" : "mt-2"}`}>
                          {!isMine && !prevSame && (
                            <div className={`w-7 h-7 rounded-full ${avatarColor(msg.fromMemberId)} flex items-center justify-center text-white text-[10px] font-bold mr-1 mt-auto mb-0.5 shrink-0`}>
                              {initials(msg.fromName ?? selectedContact?.name)}
                            </div>
                          )}
                          {!isMine && prevSame && <div className="w-8 shrink-0" />}

                          <div className={`max-w-[70%] px-3 py-2 text-sm shadow-sm ${
                            isMine
                              ? "bg-[#dcf8c6] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] rounded-t-2xl rounded-bl-2xl rounded-br-sm"
                              : "bg-card text-foreground rounded-t-2xl rounded-br-2xl rounded-bl-sm"
                          }`}>
                            {msg.messageType === "image" && msg.fileUrl ? (
                              <img src={msg.fileUrl} alt={msg.fileName ?? "image"} className="max-w-full rounded-lg max-h-48 object-cover mb-1" />
                            ) : msg.messageType === "file" && msg.fileUrl ? (
                              <a href={msg.fileUrl} download={msg.fileName ?? "file"} className="flex items-center gap-2 text-blue-500 hover:underline">
                                <Paperclip className="w-4 h-4 shrink-0" />
                                <span className="truncate">{msg.fileName ?? "file"}</span>
                              </a>
                            ) : (
                              <p className="whitespace-pre-wrap break-words leading-snug">{msg.content}</p>
                            )}

                            <div className={`flex items-center gap-1 mt-0.5 ${isMine ? "justify-end" : "justify-start"}`}>
                              <span className="text-[10px] opacity-60">{formatBubbleTime(msg.createdAt)}</span>
                              {isMine && (
                                msg.readAt
                                  ? <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
                                  : <CheckCheck className="w-3.5 h-3.5 opacity-40" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Typing indicator */}
                  {typingPartners.has(selectedPartnerId) && (
                    <div className="flex justify-start mt-2">
                      <div className="w-8 shrink-0" />
                      <div className="bg-card px-4 py-3 rounded-2xl shadow-sm flex items-center gap-1">
                        {[0, 1, 2].map(i => (
                          <span key={i} className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input bar */}
              <div className="flex items-end gap-2 px-4 py-3 border-t border-border bg-background">
                <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="w-5 h-5" />
                </Button>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileAttach} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" />

                <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground" disabled>
                  <Smile className="w-5 h-5" />
                </Button>

                <textarea
                  value={messageInput}
                  onChange={e => handleInputChange(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(messageInput); } }}
                  placeholder="Type a message"
                  rows={1}
                  className="flex-1 resize-none bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring max-h-32 overflow-y-auto leading-snug"
                  style={{ minHeight: "42px" }}
                />

                <Button
                  size="icon"
                  className="shrink-0 rounded-full w-10 h-10 bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-40"
                  disabled={!messageInput.trim()}
                  onClick={() => sendMessage(messageInput)}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
