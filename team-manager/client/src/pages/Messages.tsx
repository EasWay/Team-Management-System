import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Search, Mail, User, Briefcase, MessageSquare, ChevronRight, Loader2, Clock } from "lucide-react";
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
      <div className="flex h-full bg-[#111b21] text-[#e9edef] overflow-hidden w-full relative border-l border-white/5">
        
        {/* Sidebar: Message List */}
        <aside className="w-[400px] flex flex-col border-r border-white/10 bg-[#111b21]">
          {/* Header */}
          <div className="h-16 flex items-center justify-between px-4 bg-[#202c33]">
            <h2 className="text-xl font-bold">Messages</h2>
            <div className="flex gap-4">
              <MessageSquare className="size-5 text-[#aebac1] cursor-pointer" />
            </div>
          </div>

          {/* Search */}
          <div className="p-2 border-b border-white/5">
            <div className="relative flex items-center">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search or start new chat"
                className="h-9 bg-[#202c33] border-none text-sm pl-12 focus-visible:ring-0 rounded-lg placeholder:text-[#8696a0] w-full text-[#d1d7db]"
              />
              <Search className="size-4 absolute left-4 text-[#8696a0]" />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {isLoading ? (
              <div className="flex items-center justify-center h-20">
                <Loader2 className="animate-spin text-[#00a884]" />
              </div>
            ) : filteredMessages?.length === 0 ? (
              <div className="p-8 text-center text-[#8696a0] text-sm">
                No messages found.
              </div>
            ) : (
              filteredMessages?.map((message) => (
                <button
                  key={message.id}
                  onClick={() => setSelectedMessageId(message.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#202c33] transition-colors relative border-b border-white/5 ${
                    selectedMessageId === message.id ? "bg-[#2a3942]" : ""
                  }`}
                >
                  <div className="size-12 rounded-full bg-[#6a7175] flex items-center justify-center shrink-0">
                    <User className="size-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className="text-base font-normal truncate">{message.clientName}</h3>
                      <span className="text-[11px] text-[#8696a0]">
                        {message.createdAt ? new Date(message.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                      </span>
                    </div>
                    <p className="text-xs text-[#8696a0] truncate">{message.serviceType}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 flex flex-col bg-[#0b141a] relative">
          {selectedMessage ? (
            <>
              {/* Content Header */}
              <div className="h-16 flex items-center px-4 bg-[#202c33] border-b border-white/5">
                <div className="size-10 rounded-full bg-[#6a7175] flex items-center justify-center mr-3">
                  <User className="size-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-normal">{selectedMessage.clientName}</h3>
                  <p className="text-[11px] text-[#8696a0]">Client</p>
                </div>
              </div>

              {/* Chat-like Details */}
              <div className="flex-1 overflow-y-auto p-12 space-y-8 bg-[#0b141a] custom-scrollbar">
                <div className="max-w-3xl mx-auto space-y-12">
                  {/* Message Bubble - Information */}
                  <div className="bg-[#202c33] p-6 rounded-lg rounded-tl-none shadow-sm relative self-start inline-block min-w-[300px]">
                    <div className="absolute top-0 -left-2 w-0 h-0 border-t-[10px] border-t-[#202c33] border-l-[10px] border-l-transparent"></div>
                    
                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <Mail className="size-4 text-[#00a884]" />
                        <div>
                          <p className="text-[10px] text-[#8696a0] uppercase tracking-widest font-bold">Email</p>
                          <p className="text-sm">{selectedMessage.clientEmail}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Briefcase className="size-4 text-[#00a884]" />
                        <div>
                          <p className="text-[10px] text-[#8696a0] uppercase tracking-widest font-bold">Service Type</p>
                          <p className="text-sm">{selectedMessage.serviceType}</p>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/5">
                        <p className="text-[10px] text-[#8696a0] uppercase tracking-widest font-bold mb-3">Request Details</p>
                        <div className="bg-[#111b21] p-4 rounded-lg text-sm leading-relaxed whitespace-pre-wrap">
                          {selectedMessage.details}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end mt-4">
                      <span className="text-[10px] text-[#8696a0]">
                        <Clock className="size-3 inline mr-1" />
                        {selectedMessage.createdAt ? new Date(selectedMessage.createdAt).toLocaleString() : ''}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[#8696a0] p-12 bg-[#222e35] relative">
              <div className="flex flex-col items-center">
                <div className="size-20 rounded-full border border-white/10 flex items-center justify-center mb-6">
                  <MessageSquare className="size-10 opacity-20" />
                </div>
                <h1 className="text-3xl font-light text-[#d1d7db] mb-4">Atsupi's Messages</h1>
                <p className="max-w-md text-center text-sm leading-relaxed opacity-60">
                  Select a message from the list to view client details and request information.
                </p>
              </div>
              <div className="absolute bottom-10 flex items-center gap-2 text-[10px] tracking-widest uppercase opacity-30">
                <User className="size-3" />
                <span>Internal Messaging System</span>
              </div>
            </div>
          )}
        </main>
      </div>
    </DashboardLayout>
  );
}
