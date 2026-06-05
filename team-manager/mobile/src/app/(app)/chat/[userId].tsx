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
  Pressable,
  Modal,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { trpc } from '@/lib/api';
import { useThemeStore } from '@/store/themeStore';
import { getSocket } from '@/lib/socket';
import { format, isToday, isYesterday } from 'date-fns';
import * as Haptics from 'expo-haptics';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function msgTimeStr(date: Date | string) {
  return format(new Date(date), 'h:mm a');
}

function dateLabel(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d))     return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMMM d, yyyy');
}

type Grouped = { date: string; items: any[] };

function groupByDate(messages: any[]): Grouped[] {
  const map = new Map<string, any[]>();
  for (const msg of messages) {
    const key = format(new Date(msg.createdAt), 'yyyy-MM-dd');
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(msg);
  }
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, size = 36, isDark }: { name?: string | null; size?: number; isDark: boolean }) {
  const initials = (name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: isDark ? '#1E1E1E' : '#E0E0E0',
      borderWidth: 1.5, borderColor: isDark ? '#2A2A2A' : '#D0D0D0',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: isDark ? '#AAAAAA' : '#555555', fontSize: size * 0.36, fontWeight: '800' }}>
        {initials}
      </Text>
    </View>
  );
}

// ─── Typing dots ─────────────────────────────────────────────────────────────
function TypingIndicator({ isDark }: { isDark: boolean }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12,
      paddingBottom: 6, gap: 6,
    }}>
      <View style={{ width: 28 }} />
      <View style={{
        backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF',
        borderRadius: 18, borderBottomLeftRadius: 4,
        paddingHorizontal: 14, paddingVertical: 12,
        flexDirection: 'row', gap: 4, alignItems: 'center',
        borderWidth: 0.5, borderColor: isDark ? '#2A2A2A' : '#E8E8E8',
      }}>
        {[0, 1, 2].map(i => (
          <View key={i} style={{
            width: 6, height: 6, borderRadius: 3,
            backgroundColor: isDark ? '#555555' : '#AAAAAA',
          }} />
        ))}
      </View>
    </View>
  );
}

// ─── Date pill separator ──────────────────────────────────────────────────────
function DateSeparator({ label, isDark }: { label: string; isDark: boolean }) {
  return (
    <View style={{ alignItems: 'center', marginVertical: 12 }}>
      <View style={{
        backgroundColor: isDark ? '#1A1A1A' : 'rgba(0,0,0,0.08)',
        borderRadius: 100,
        paddingHorizontal: 12,
        paddingVertical: 4,
      }}>
        <Text style={{
          color: isDark ? '#888888' : '#555555',
          fontSize: 11, fontWeight: '600', letterSpacing: 0.2,
        }}>
          {label}
        </Text>
      </View>
    </View>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({
  msg, isMine, partnerName, isDark, isLastInCluster, onLongPress,
}: {
  msg: any;
  isMine: boolean;
  partnerName: string;
  isDark: boolean;
  isLastInCluster: boolean;
  onLongPress: (msg: any) => void;
}) {
  const timeStr = msgTimeStr(msg.createdAt);
  const isRead  = !!msg.readAt;

  // Mono-WA palette
  const myBg     = isDark ? '#1E1E1E' : '#0A0A0A';
  const theirBg  = isDark ? '#141414' : '#FFFFFF';
  const myText   = '#FFFFFF';
  const theirText = isDark ? '#F2F2F2' : '#0A0A0A';
  const myTime   = isDark ? '#666666' : 'rgba(255,255,255,0.55)';
  const theirTime = isDark ? '#555555' : '#AAAAAA';

  return (
    <View style={{
      flexDirection: isMine ? 'row-reverse' : 'row',
      alignItems: 'flex-end',
      marginBottom: isLastInCluster ? 6 : 2,
      paddingHorizontal: 10,
      gap: 5,
    }}>
      {/* Partner avatar placeholder — keeps layout stable */}
      <View style={{ width: 30, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 0 }}>
        {!isMine && isLastInCluster && (
          <Avatar name={partnerName} size={28} isDark={isDark} />
        )}
      </View>

      <Pressable
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onLongPress(msg);
        }}
        style={{
          maxWidth: '76%',
          backgroundColor: isMine ? myBg : theirBg,
          borderRadius: 18,
          borderBottomRightRadius: isMine && isLastInCluster ? 4 : 18,
          borderBottomLeftRadius: !isMine && isLastInCluster ? 4 : 18,
          paddingHorizontal: 13,
          paddingTop: 8,
          paddingBottom: 6,
          // Subtle shadow for partner bubbles in light mode
          ...(!isMine && !isDark ? {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.07,
            shadowRadius: 2,
            elevation: 1,
          } : {}),
          borderWidth: isMine ? 0 : (isDark ? 1 : 0.5),
          borderColor: isDark ? '#2A2A2A' : '#EBEBEB',
        }}
      >
        <Text style={{ color: isMine ? myText : theirText, fontSize: 15, lineHeight: 22 }}>
          {msg.content}
        </Text>
        {/* Time + read receipt row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 3 }}>
          <Text style={{ color: isMine ? myTime : theirTime, fontSize: 10 }}>{timeStr}</Text>
          {isMine && (
            <Ionicons
              name={isRead ? 'checkmark-done' : 'checkmark'}
              size={13}
              color={isRead
                ? (isDark ? '#AAAAAA' : 'rgba(255,255,255,0.9)')
                : (isDark ? '#555555' : 'rgba(255,255,255,0.45)')}
            />
          )}
        </View>
      </Pressable>
    </View>
  );
}

// ─── Context Menu Modal ───────────────────────────────────────────────────────
function MessageContextMenu({
  msg, isMine, isDark, onClose, onDelete,
}: {
  msg: any | null;
  isMine: boolean;
  isDark: boolean;
  onClose: () => void;
  onDelete?: (id: number) => void;
}) {
  if (!msg) return null;

  const actions: { icon: string; label: string; onPress: () => void; destructive?: boolean }[] = [
    {
      icon: 'copy-outline', label: 'Copy',
      onPress: () => {
        // Clipboard.setString(msg.content); // expo-clipboard if needed
        onClose();
      },
    },
    {
      icon: 'share-outline', label: 'Share',
      onPress: async () => {
        await Share.share({ message: msg.content });
        onClose();
      },
    },
  ];
  if (isMine && onDelete) {
    actions.push({
      icon: 'trash-outline', label: 'Delete',
      destructive: true,
      onPress: () => { onDelete(msg.id); onClose(); },
    });
  }

  return (
    <Modal visible={!!msg} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} onPress={onClose}>
        <View style={{
          backgroundColor: isDark ? '#111111' : '#FFFFFF',
          borderRadius: 20,
          padding: 8,
          minWidth: 200,
          borderWidth: 1, borderColor: isDark ? '#2A2A2A' : '#E8E8E8',
          shadowColor: '#000', shadowRadius: 20, shadowOpacity: 0.25, shadowOffset: { width: 0, height: 8 },
        }}>
          {/* Message preview */}
          <View style={{
            paddingHorizontal: 14, paddingVertical: 10,
            borderBottomWidth: 1, borderBottomColor: isDark ? '#1E1E1E' : '#F0F0F0',
            marginBottom: 4,
          }}>
            <Text style={{ color: isDark ? '#888888' : '#AAAAAA', fontSize: 12 }} numberOfLines={2}>
              {msg.content}
            </Text>
          </View>
          {actions.map((a) => (
            <Pressable
              key={a.label}
              onPress={a.onPress}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 12,
                paddingHorizontal: 14, paddingVertical: 13,
                borderRadius: 12,
                backgroundColor: pressed ? (isDark ? '#1A1A1A' : '#F5F5F5') : 'transparent',
              })}
            >
              <Ionicons name={a.icon as any} size={18} color={a.destructive ? '#f87171' : (isDark ? '#FFFFFF' : '#0A0A0A')} />
              <Text style={{ color: a.destructive ? '#f87171' : (isDark ? '#FFFFFF' : '#0A0A0A'), fontSize: 15, fontWeight: '500' }}>
                {a.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
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

  const [message, setMessage]       = useState('');
  const [sending, setSending]       = useState(false);
  const [isTyping, setIsTyping]     = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [contextMsg, setContextMsg] = useState<any>(null);
  const [atBottom, setAtBottom]     = useState(true);

  const listRef  = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const utils    = trpc.useUtils();

  // ─── Queries / Mutations ───────────────────────────────────────────────────
  const messagesQuery = trpc.chat.getMessages.useQuery(
    { memberA: myMemberId, memberB: partnerId, teamId },
    { enabled: !!myMemberId && !!partnerId && !!teamId, refetchInterval: 8_000, staleTime: 4_000 }
  );

  const sendMutation = trpc.chat.send.useMutation({
    onMutate: () => setSending(true),
    onSuccess: () => {
      setMessage('');
      setSending(false);
      utils.chat.getMessages.invalidate();
      utils.chat.getConversations.invalidate();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    },
    onError: () => setSending(false),
  });

  const markReadMutation = trpc.chat.markRead.useMutation();

  const messages = messagesQuery.data as any[] ?? [];

  // ─── Mark read ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (myMemberId && partnerId && teamId) {
      markReadMutation.mutate({ fromMemberId: partnerId, toMemberId: myMemberId, teamId });
    }
  }, [messages.length]);

  // ─── Real-time socket ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!myMemberId) return;
    let cleanup: (() => void) | null = null;
    getSocket().then((sock) => {
      const handler = (msg: any) => {
        const relevant =
          (msg.fromMemberId === partnerId && msg.toMemberId === myMemberId) ||
          (msg.fromMemberId === myMemberId && msg.toMemberId === partnerId);
        if (!relevant) return;
        utils.chat.getMessages.invalidate();
        utils.chat.getConversations.invalidate();
        if (msg.fromMemberId === partnerId) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          markReadMutation.mutate({ fromMemberId: partnerId, toMemberId: myMemberId, teamId });
        }
      };
      const typingHandler = (data: any) => {
        if (data.fromMemberId === partnerId) setIsTyping(data.isTyping);
      };
      sock.on('chatMessage', handler);
      sock.on('typing', typingHandler);
      cleanup = () => { sock.off('chatMessage', handler); sock.off('typing', typingHandler); };
    });
    return () => cleanup?.();
  }, [myMemberId, partnerId, teamId]);

  // ─── Scroll to bottom on new messages ─────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0 && atBottom) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages.length]);

  // ─── Send ──────────────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMutation.mutate({
      fromMemberId: myMemberId,
      toMemberId: partnerId,
      teamId,
      content: trimmed,
    });
  }, [message, sending, myMemberId, partnerId, teamId]);

  // ─── Colors ────────────────────────────────────────────────────────────────
  const headerBg  = isDark ? '#000000' : '#FFFFFF';
  const chatBg    = isDark ? '#0A0A0A' : '#EBEBEB';
  const inputBg   = isDark ? '#000000' : '#FFFFFF';
  const inputCard = isDark ? '#111111' : '#FFFFFF';
  const borderCol = isDark ? '#1A1A1A' : '#E8E8E8';
  const fg        = isDark ? '#F2F2F2' : '#0A0A0A';
  const muted     = isDark ? '#555555' : '#AAAAAA';

  const grouped = groupByDate(messages);

  // Flat message list with cluster info
  const flatItems: any[] = [];
  for (const g of grouped) {
    flatItems.push({ type: 'date', label: dateLabel(g.date), key: `d-${g.date}` });
    for (let i = 0; i < g.items.length; i++) {
      const msg = g.items[i];
      const next = g.items[i + 1];
      const isLastInCluster = !next || next.fromMemberId !== msg.fromMemberId;
      flatItems.push({ type: 'msg', msg, isLastInCluster, key: `m-${msg.id}` });
    }
  }
  if (isTyping) flatItems.push({ type: 'typing', key: 'typing' });

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#000000' : '#FFFFFF' }}>
      {/* Top safe area — header sits below status bar */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: headerBg }}>
        {/* ─── Header ─────────────────────────────────────────────────── */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 8, paddingVertical: 10,
          borderBottomWidth: 1, borderBottomColor: borderCol,
          backgroundColor: headerBg,
          gap: 6,
        }}>
          {/* Back */}
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.navigate('/(app)/messages' as any); }}
            style={{ padding: 6, borderRadius: 10 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color={fg} />
          </TouchableOpacity>

          {/* Avatar + info — tappable area */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            <View style={{ position: 'relative' }}>
              <Avatar name={partnerName} size={40} isDark={isDark} />
              {/* Online dot */}
              <View style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 11, height: 11, borderRadius: 6,
                backgroundColor: '#4ADE80',
                borderWidth: 2, borderColor: headerBg,
              }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: fg, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
                {partnerName}
              </Text>
              <Text style={{ color: muted, fontSize: 12, marginTop: 1 }}>
                {isTyping ? 'typing…' : 'Online'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Action buttons */}
          <TouchableOpacity
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: isDark ? '#111111' : '#F0F0F0', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="call-outline" size={17} color={fg} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: isDark ? '#111111' : '#F0F0F0', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="videocam-outline" size={17} color={fg} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ─── Chat area ───────────────────────────────────────────────────── */}
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: chatBg }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        {messagesQuery.isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={isDark ? '#FFFFFF' : '#0A0A0A'} />
          </View>
        ) : messages.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 }}>
            <View style={{
              width: 72, height: 72, borderRadius: 36,
              backgroundColor: isDark ? '#111111' : '#FFFFFF',
              borderWidth: 1, borderColor: isDark ? '#2A2A2A' : '#E0E0E0',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Avatar name={partnerName} size={56} isDark={isDark} />
            </View>
            <Text style={{ color: fg, fontSize: 17, fontWeight: '700' }}>{partnerName}</Text>
            <Text style={{ color: muted, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              No messages yet. Say hello! 👋
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={flatItems}
            keyExtractor={(item: any) => item.key}
            contentContainerStyle={{ paddingTop: 10, paddingBottom: 10 }}
            showsVerticalScrollIndicator={false}
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
            onScroll={(e) => {
              const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
              const distFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
              setAtBottom(distFromBottom < 80);
            }}
            scrollEventThrottle={100}
            renderItem={({ item }: { item: any }) => {
              if (item.type === 'date') {
                return <DateSeparator label={item.label} isDark={isDark} />;
              }
              if (item.type === 'typing') {
                return <TypingIndicator isDark={isDark} />;
              }
              return (
                <MessageBubble
                  msg={item.msg}
                  isMine={item.msg.fromMemberId === myMemberId}
                  partnerName={partnerName}
                  isDark={isDark}
                  isLastInCluster={item.isLastInCluster}
                  onLongPress={setContextMsg}
                />
              );
            }}
          />
        )}

        {/* Scroll-to-bottom FAB */}
        {!atBottom && messages.length > 0 && (
          <TouchableOpacity
            onPress={() => listRef.current?.scrollToEnd({ animated: true })}
            style={{
              position: 'absolute', bottom: 70, right: 16,
              width: 38, height: 38, borderRadius: 19,
              backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF',
              borderWidth: 1, borderColor: isDark ? '#2A2A2A' : '#E0E0E0',
              alignItems: 'center', justifyContent: 'center',
              shadowColor: '#000', shadowRadius: 8, shadowOpacity: 0.12, shadowOffset: { width: 0, height: 3 },
              elevation: 4,
            }}
          >
            <Ionicons name="chevron-down" size={18} color={fg} />
          </TouchableOpacity>
        )}

        {/* ─── Input bar ─────────────────────────────────────────────────── */}
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: inputBg }}>
          <View style={{
            flexDirection: 'row', alignItems: 'flex-end', gap: 8,
            paddingHorizontal: 10, paddingVertical: 10,
            borderTopWidth: 1, borderTopColor: borderCol,
            backgroundColor: inputBg,
          }}>
            {/* Emoji button */}
            <TouchableOpacity
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 2 }}
            >
              <Ionicons name="happy-outline" size={24} color={muted} />
            </TouchableOpacity>

            {/* Text input */}
            <View style={{
              flex: 1, backgroundColor: inputCard,
              borderRadius: 24, borderWidth: 1, borderColor: isDark ? '#2A2A2A' : '#E0E0E0',
              paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 10 : 6,
              maxHeight: 120, justifyContent: 'center',
            }}>
              <TextInput
                ref={inputRef}
                value={message}
                onChangeText={setMessage}
                placeholder={`Message…`}
                placeholderTextColor={muted}
                style={{ color: fg, fontSize: 15, lineHeight: 22, padding: 0 }}
                multiline
                maxLength={4000}
                returnKeyType="default"
              />
            </View>

            {/* Attachment */}
            {!message.trim() && (
              <TouchableOpacity
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 0 }}
              >
                <Ionicons name="attach-outline" size={24} color={muted} />
              </TouchableOpacity>
            )}

            {/* Send / Mic */}
            <TouchableOpacity
              onPress={message.trim() ? handleSend : () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              disabled={!!message.trim() && sending}
              style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: message.trim()
                  ? (isDark ? '#FFFFFF' : '#0A0A0A')
                  : (isDark ? '#111111' : '#F0F0F0'),
                alignItems: 'center', justifyContent: 'center',
                borderWidth: message.trim() ? 0 : 1,
                borderColor: isDark ? '#2A2A2A' : '#E0E0E0',
              }}
            >
              {sending
                ? <ActivityIndicator size="small" color={isDark ? '#000000' : '#FFFFFF'} />
                : message.trim()
                  ? <Ionicons name="send" size={18} color={isDark ? '#000000' : '#FFFFFF'} />
                  : <Ionicons name="mic-outline" size={20} color={muted} />}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>

      {/* ─── Context menu ────────────────────────────────────────────────── */}
      <MessageContextMenu
        msg={contextMsg}
        isMine={contextMsg?.fromMemberId === myMemberId}
        isDark={isDark}
        onClose={() => setContextMsg(null)}
      />
    </View>
  );
}
