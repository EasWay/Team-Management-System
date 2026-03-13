import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Search, Mail, User, Briefcase, MessageSquare, Clock, Loader2, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Messages() {
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: messages, isLoading } = trpc.messages.list.useQuery();

  const filteredMessages = messages?.filter(m =>
    m.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.clientEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.serviceType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedMessage = messages?.find(m => m.id === selectedMessageId);

  return (
    <DashboardLayout>
      <div className="flex h-full font-display text-foreground bg-[#F2F2F7] dark:bg-background overflow-hidden w-full relative">
        
        {/* Sidebar: Message List */}
        <aside className="w-80 border-r border-border flex flex-col liquid-glass z-20">
          <div className="p-6 border-b border-border">
            <h2 className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground mb-4">Inbound Messages</h2>
            <div className="relative flex items-center">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="h-10 bg-foreground/[0.03] border-none text-sm pl-10 focus-visible:ring-1 focus-visible:ring-blue-500/20 rounded-xl placeholder:text-muted-foreground/40 w-full"
              />
              <Search className="size-4 absolute left-3.5 text-muted-foreground/30" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
            {isLoading ? (
              <div className="flex items-center justify-center h-20">
                <Loader2 className="animate-spin text-muted-foreground/30" />
              </div>
            ) : filteredMessages?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground/40 text-[10px] uppercase font-bold tracking-widest">
                No messages found
              </div>
            ) : (
              filteredMessages?.map((message) => (
                <button
                  key={message.id}
                  onClick={() => setSelectedMessageId(message.id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                    selectedMessageId === message.id 
                      ? "bg-foreground/10 shadow-sm text-foreground" 
                      : "text-muted-foreground hover:bg-foreground/5"
                  }`}
                >
                  <div className="size-10 rounded-full bg-foreground/5 flex items-center justify-center shrink-0">
                    <User className="size-5 opacity-40" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h3 className="text-sm font-semibold truncate">{message.clientName}</h3>
                      <span className="text-[9px] text-muted-foreground/50 font-bold uppercase tracking-tighter">
                        {message.createdAt ? new Date(message.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 truncate uppercase tracking-widest font-medium">{message.serviceType}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto no-scrollbar relative p-8">
          {selectedMessage ? (
            <div className="max-w-4xl animate-in fade-in slide-in-from-right-2 duration-500">
              <header className="mb-12">
                <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60 mb-2 font-bold">
                  Client Communication
                </p>
                <h1 className="text-4xl font-light tracking-tight mb-2">{selectedMessage.clientName}</h1>
                <div className="flex items-center gap-4 text-xs text-muted-foreground/60">
                   <div className="flex items-center gap-1.5">
                     <Clock className="size-3.5" />
                     <span>Received {new Date(selectedMessage.createdAt).toLocaleString()}</span>
                   </div>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                <div className="liquid-glass-card p-6 rounded-2xl space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <Mail className="size-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground/50 uppercase font-bold tracking-widest">Contact Email</p>
                      <p className="text-sm font-medium">{selectedMessage.clientEmail}</p>
                    </div>
                  </div>
                </div>

                <div className="liquid-glass-card p-6 rounded-2xl space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                      <Briefcase className="size-4 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground/50 uppercase font-bold tracking-widest">Service Type</p>
                      <p className="text-sm font-medium">{selectedMessage.serviceType}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs uppercase tracking-widest font-bold opacity-40">Request Details</h4>
                <div className="liquid-glass-card p-8 rounded-3xl text-lg font-light leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {selectedMessage.details}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground/20">
              <div className="size-24 rounded-full border border-foreground/5 flex items-center justify-center mb-6">
                <MessageSquare className="size-12" />
              </div>
              <h2 className="text-2xl font-light tracking-tight text-foreground/20">Communications Portal</h2>
              <p className="text-[10px] mt-2 uppercase tracking-[0.2em] font-bold">Select a message to view details</p>
            </div>
          )}
        </main>
      </div>
    </DashboardLayout>
  );
}
