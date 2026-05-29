import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { trpc } from '@/lib/api';
import { useTeamStore } from '@/store/teamStore';
import { useThemeStore } from '@/store/themeStore';
import { getSocket } from '@/lib/socket';
import { format, isToday, isYesterday } from 'date-fns';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatMsgTime(date: Date | string): string {
  const d = new Date(date);
  if (isToday(d))     return format(d, 'h:mm a');
  if (isYesterday(d)) return `Yesterday ${format(d, 'h:mm a')}`;
  return format(d, 'MMM d, h:mm a');
}

function groupByDate(messages: any[]): { date: string; items: any[] }[] {
  const map = new Map<string, any[]>();
  for (const msg of messages) {
    const key = format(new Date(msg.createdAt), 'yyyy-MM-dd');
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(msg);
  }
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
}

function dateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d))     return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMMM d, yyyy');
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, size = 32 }: { name?: string | null; size?: number }) {
  const initials = (name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: '#E8E8E8', borderWidth: 1.5, borderColor: '#D0D0D0',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#555555', fontSize: size * 0.38, fontWeight: '800' }}>{initials}</Text>
    </View>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg, isMine, partnerName }: { msg: any; isMine: boolean; partnerName: string }) {
  const isDark = useThemeStore(state => state.isDark);
  const timeStr = formatMsgTime(msg.createdAt);
  const isRead  = !!msg.readAt;

  return (
    <View style={{
      flexDirection: isMine ? 'row-reverse' : 'row',
      alignItems: 'flex-end',
      marginBottom: 4,
      paddingHorizontal: 16,
      gap: 8,
    }}>
      {/* Avatar only for received messages */}
      {!isMine && <Avatar name={partnerName} size={28} />}

      {/* Bubble */}
      <View style={{
        maxWidth: '75%',
        backgroundColor: isMine ? (isDark ? '#2A2A2A' : '#0A0A0A') : (isDark ? '#1A1A1A' : '#F0F0F0'),
        borderRadius: 18,
        borderBottomRightRadius: isMine ? 4 : 18,
        borderBottomLeftRadius: isMine ? 18 : 4,
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}>
        <Text style={{ color: isMine ? (isDark ? '#F2F2F2' : '#FFFFFF') : (isDark ? '#F2F2F2' : '#0A0A0A'), fontSize: 14, lineHeight: 20 }}>
          {msg.content}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 }}>
          <Text style={{ color: isDark ? '#555555' : '#AAAAAA', fontSize: 10 }}>{timeStr}</Text>
          {isMine && (
            <Ionicons
              name={isRead ? 'checkmark-done' : 'checkmark'}
              size={12}
              color={isDark ? '#888888' : '#AAAAAA'}
            />
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const isDark = useThemeStore(state => state.isDark);
  const router = useRouter();
  const params = useLocalSearchParams<{
    userId: string;
    name: string;
    memberId: string;
    teamId: string;
  }>();

  const partnerId   = Number(params.userId);
  const partnerName = params.name ?? 'Member';
  const myMemberId  = Number(params.memberId);
  const teamId      = Number(params.teamId);

  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const utils = trpc.useUtils();

  const messagesQuery = trpc.chat.getMessages.useQuery(
    { memberA: myMemberId, memberB: partnerId, teamId },
    { enabled: !!myMemberId && !!partnerId && !!teamId, refetchInterval: 5_000 }
  );

  const sendMutation = trpc.chat.send.useMutation({
    onMutate: () => setSending(true),
    onSuccess: () => {
      setMessage('');
      setSending(false);
      utils.chat.getMessages.invalidate();
      utils.chat.getConversations.invalidate();
    },
    onError: () => setSending(false),
  });

  const markReadMutation = trpc.chat.markRead.useMutation();

  const messages = (messagesQuery.data as any[] ?? []);

  // Mark messages as read when screen opens / receives new messages
  useEffect(() => {
    if (myMemberId && partnerId && teamId) {
      markReadMutation.mutate({ fromMemberId: partnerId, toMemberId: myMemberId, teamId });
    }
  }, [messages.length, myMemberId, partnerId, teamId]);

  // Real-time socket for new messages
  useEffect(() => {
    if (!myMemberId) return;
    let cleanup: (() => void) | null = null;
    getSocket().then((sock) => {
      const handler = (msg: any) => {
        if (
          (msg.fromMemberId === partnerId && msg.toMemberId === myMemberId) ||
          (msg.fromMemberId === myMemberId && msg.toMemberId === partnerId)
        ) {
          utils.chat.getMessages.invalidate();
          utils.chat.getConversations.invalidate();
          // Auto-mark as read
          if (msg.fromMemberId === partnerId) {
            markReadMutation.mutate({ fromMemberId: partnerId, toMemberId: myMemberId, teamId });
          }
        }
      };
      sock.on('chatMessage', handler);
      cleanup = () => sock.off('chatMessage', handler);
    });
    return () => cleanup?.();
  }, [myMemberId, partnerId, teamId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    sendMutation.mutate({
      fromMemberId: myMemberId,
      toMemberId: partnerId,
      teamId,
      content: trimmed,
    });
  }, [message, sending, myMemberId, partnerId, teamId]);

  const grouped = groupByDate(messages);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#000000' : '#F5F5F5' }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
          borderBottomWidth: 1, borderBottomColor: isDark ? '#0D0D0D' : '#E8E8E8', backgroundColor: isDark ? '#000000' : '#F5F5F5',
        }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? '#0D0D0D' : '#E8E8E8', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
          >
            <Ionicons name="arrow-back" size={18} color={isDark ? '#64748b' : '#475569'} />
          </TouchableOpacity>

          <Avatar name={partnerName} size={38} />

          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ color: isDark ? '#F2F2F2' : '#0D0D0D', fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
              {partnerName}
            </Text>
            <Text style={{ color: isDark ? '#334155' : '#64748b', fontSize: 11, marginTop: 1 }}>Team member</Text>
          </View>

          {messagesQuery.isFetching && <ActivityIndicator size="small" color={isDark ? '#334155' : '#94a3b8'} />}
        </View>

        {/* Messages */}
        {messagesQuery.isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={isDark ? '#FFFFFF' : '#0A0A0A'} />
          </View>
        ) : messages.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
            <Avatar name={partnerName} size={64} />
            <Text style={{ color: isDark ? '#64748b' : '#475569', fontSize: 15, fontWeight: '600', marginTop: 16, marginBottom: 6 }}>
              Start a conversation
            </Text>
            <Text style={{ color: isDark ? '#334155' : '#64748b', fontSize: 13, textAlign: 'center' }}>
              Send a message to {partnerName}.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={grouped}
            keyExtractor={(g) => g.date}
            contentContainerStyle={{ paddingVertical: 16 }}
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item: group }) => (
              <View>
                {/* Date separator */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 12, paddingHorizontal: 16, gap: 10 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: isDark ? '#0D0D0D' : '#E8E8E8' }} />
                  <Text style={{ color: isDark ? '#334155' : '#64748b', fontSize: 11, fontWeight: '600' }}>
                    {dateLabel(group.date)}
                  </Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: isDark ? '#0D0D0D' : '#E8E8E8' }} />
                </View>
                {/* Messages in this date group */}
                {group.items.map((msg: any) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isMine={msg.fromMemberId === myMemberId}
                    partnerName={partnerName}
                  />
                ))}
              </View>
            )}
          />
        )}

        {/* Input bar */}
        <View style={{
          flexDirection: 'row', alignItems: 'flex-end', gap: 10,
          paddingHorizontal: 16, paddingVertical: 12,
          borderTopWidth: 1, borderTopColor: isDark ? '#0D0D0D' : '#E8E8E8',
          backgroundColor: isDark ? '#000000' : '#F5F5F5',
        }}>
          <View style={{
            flex: 1, backgroundColor: isDark ? '#0D0D0D' : '#ffffff', borderRadius: 24, borderWidth: 1, borderColor: isDark ? '#2A2A2A' : '#E0E0E0',
            paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 10 : 6,
            maxHeight: 120,
          }}>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder={`Message ${partnerName.split(' ')[0]}…`}
              placeholderTextColor={isDark ? '#334155' : '#94a3b8'}
              style={{ color: isDark ? '#F2F2F2' : '#0D0D0D', fontSize: 14, lineHeight: 20 }}
              multiline
              maxLength={4000}
              returnKeyType="default"
              onSubmitEditing={Platform.OS === 'ios' ? undefined : handleSend}
            />
          </View>
          <TouchableOpacity
            onPress={handleSend}
            disabled={!message.trim() || sending}
            style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: message.trim() ? (isDark ? '#FFFFFF' : '#0A0A0A') : (isDark ? '#1A1A1A' : '#F0F0F0'),
              alignItems: 'center', justifyContent: 'center',
              borderWidth: message.trim() ? 0 : 1, borderColor: isDark ? '#2A2A2A' : '#E0E0E0',
              shadowColor: message.trim() ? '#000' : 'transparent',
              shadowRadius: 8, shadowOpacity: 0.12, shadowOffset: { width: 0, height: 3 },
            }}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={18} color={message.trim() ? '#fff' : (isDark ? '#334155' : '#94a3b8')} />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
