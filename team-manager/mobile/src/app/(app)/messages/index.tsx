import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { trpc } from '@/lib/api';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { getSocket } from '@/lib/socket';
import { formatDistanceToNow } from 'date-fns';

// ─── Avatar ───────────────────────────────────────────────────────────────────
function MemberAvatar({ name, size = 50, unread = 0 }: { name?: string | null; size?: number; unread?: number }) {
  const isDark = useThemeStore(state => state.isDark);
  const colors = ['#38bdf8', '#a78bfa', '#34d399', '#fb923c', '#f472b6', '#fbbf24'];
  const idx = ((name?.charCodeAt(0) ?? 0) + (name?.charCodeAt(1) ?? 0)) % colors.length;
  const color = colors[idx];
  const initials = (name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <View style={{ position: 'relative' }}>
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: color + '25', borderWidth: 2, borderColor: color + '50',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ color, fontSize: size * 0.36, fontWeight: '800' }}>{initials}</Text>
      </View>
      {unread > 0 && (
        <View style={{
          position: 'absolute', top: -2, right: -2,
          minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 3,
          backgroundColor: '#38bdf8', borderWidth: 2, borderColor: isDark ? '#0a0f1e' : '#f8fafc',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function MessagesScreen() {
  const router = useRouter();
  const { activeTeam } = useTeamStore();
  const { user } = useAuthStore();
  const [showPicker, setShowPicker] = useState(false);

  const membersQuery = trpc.teams.getMembers.useQuery(
    { teamId: activeTeam?.id ?? 0 },
    { enabled: !!activeTeam?.id }
  );
  const membersList: any[] = membersQuery.data as any[] ?? [];

  const currentMember = membersList.find(m => (m.member?.email ?? m.email) === user?.email);
  const currentMemberId: number | null = currentMember?.member?.id ?? currentMember?.id ?? null;

  const convsQuery = trpc.chat.getConversations.useQuery(
    { memberId: currentMemberId ?? 0, teamId: activeTeam?.id ?? 0 },
    { enabled: !!currentMemberId && !!activeTeam?.id, refetchInterval: 10_000 }
  );

  const conversations = (convsQuery.data as any[] ?? []);
  const totalUnread = conversations.reduce((s: number, c: any) => s + (c.unreadCount ?? 0), 0);

  useEffect(() => {
    if (!currentMemberId) return;
    let cleanup: (() => void) | null = null;
    getSocket().then((sock) => {
      const refresh = () => convsQuery.refetch();
      sock.on('chatMessage', refresh);
      cleanup = () => sock.off('chatMessage', refresh);
    });
    return () => cleanup?.();
  }, [currentMemberId]);

  const openChat = (partnerId: number, partnerName: string) => {
    router.push({
      pathname: '/(app)/chat/[userId]' as any,
      params: {
        userId: String(partnerId),
        name: partnerName,
        memberId: String(currentMemberId),
        teamId: String(activeTeam?.id),
      },
    });
  };

  const isDark = useThemeStore(state => state.isDark);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#0a0f1e' : '#f8fafc' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: isDark ? '#475569' : '#64748b', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 }}>
              {activeTeam?.name ?? 'Team'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text className="text-slate-900 dark:text-white" style={{ fontSize: 24, fontWeight: '800' }}>Messages</Text>
              {totalUnread > 0 && (
                <View style={{ backgroundColor: '#38bdf8', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{totalUnread}</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setShowPicker(true)}
            style={{
              width: 42, height: 42, borderRadius: 21, backgroundColor: '#0ea5e9',
              alignItems: 'center', justifyContent: 'center',
              shadowColor: '#0ea5e9', shadowRadius: 10, shadowOpacity: 0.35, shadowOffset: { width: 0, height: 3 },
            }}
          >
            <Ionicons name="create-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Conversations list */}
      {convsQuery.isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#38bdf8" />
        </View>
      ) : conversations.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <View style={{
            width: 72, height: 72, borderRadius: 24, backgroundColor: isDark ? '#0f172a' : '#ffffff',
            borderWidth: 1, borderColor: isDark ? '#1e293b' : '#cbd5e1', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
          }}>
            <Ionicons name="chatbubble-ellipses-outline" size={32} color={isDark ? '#334155' : '#94a3b8'} />
          </View>
          <Text className="text-slate-900 dark:text-white" style={{ fontSize: 17, fontWeight: '700', marginBottom: 6 }}>No conversations yet</Text>
          <Text className="text-slate-500 dark:text-slate-400" style={{ fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
            Send a message to a team member to start chatting.
          </Text>
          <TouchableOpacity
            onPress={() => setShowPicker(true)}
            style={{
              marginTop: 20, backgroundColor: '#0ea5e9', borderRadius: 14,
              paddingHorizontal: 20, paddingVertical: 11,
              flexDirection: 'row', alignItems: 'center', gap: 8,
            }}
          >
            <Ionicons name="create-outline" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Start a Conversation</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item: any) => String(item.partnerId)}
          refreshControl={
            <RefreshControl refreshing={convsQuery.isFetching} onRefresh={() => convsQuery.refetch()} tintColor="#0ea5e9" />
          }
          renderItem={({ item }: { item: any }) => {
            const hasUnread = item.unreadCount > 0;
            const timeStr = item.lastMessageAt
              ? formatDistanceToNow(new Date(item.lastMessageAt), { addSuffix: false })
              : '';
            return (
              <TouchableOpacity
                onPress={() => openChat(item.partnerId, item.partnerName ?? 'Member')}
                activeOpacity={0.75}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 20, paddingVertical: 14,
                  borderBottomWidth: 1, borderBottomColor: isDark ? '#0f172a' : '#e2e8f0',
                  backgroundColor: hasUnread ? (isDark ? '#0ea5e908' : '#0ea5e904') : 'transparent',
                }}
              >
                <MemberAvatar name={item.partnerName} size={50} unread={item.unreadCount} />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text
                      className="text-slate-900 dark:text-white"
                      style={{ fontSize: 15, fontWeight: hasUnread ? '700' : '600', flex: 1, color: hasUnread ? undefined : (isDark ? '#94a3b8' : '#475569') }}
                      numberOfLines={1}
                    >
                      {item.partnerName ?? 'Team Member'}
                    </Text>
                    <Text className="text-slate-400 dark:text-slate-500" style={{ fontSize: 11, marginLeft: 8 }}>{timeStr}</Text>
                  </View>
                  <Text
                    className="text-slate-500 dark:text-slate-400"
                    style={{ fontSize: 13, fontWeight: hasUnread ? '500' : '400', color: hasUnread ? undefined : (isDark ? '#334155' : '#94a3b8') }}
                    numberOfLines={1}
                  >
                    {item.lastMessage || 'No messages yet'}
                  </Text>
                </View>
                {hasUnread && (
                  <View style={{ marginLeft: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#38bdf8' }} />
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* New message member picker overlay */}
      {showPicker && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end', zIndex: 999 }}>
          <View style={{ backgroundColor: isDark ? '#0f172a' : '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: isDark ? '#1e293b' : '#cbd5e1', paddingBottom: 40 }}>
            <View style={{ width: 40, height: 4, backgroundColor: isDark ? '#1e293b' : '#cbd5e1', borderRadius: 2, alignSelf: 'center', marginTop: 14, marginBottom: 16 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 }}>
              <Text className="text-slate-900 dark:text-white" style={{ fontSize: 18, fontWeight: '800' }}>New Message</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Ionicons name="close" size={20} color={isDark ? '#475569' : '#64748b'} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={membersList.filter(m => (m.member?.id ?? m.id) !== currentMemberId)}
              keyExtractor={(m) => String(m.member?.id ?? m.id)}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => {
                const member = item.member ?? item;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      setShowPicker(false);
                      openChat(member.id, member.name ?? 'Member');
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 14 }}
                  >
                    <MemberAvatar name={member.name} size={44} />
                    <View style={{ flex: 1 }}>
                      <Text className="text-slate-900 dark:text-white" style={{ fontSize: 14, fontWeight: '600' }}>{member.name}</Text>
                      {item.officeRole && (
                        <Text className="text-slate-400 dark:text-slate-500" style={{ fontSize: 11, marginTop: 1 }}>
                          {item.officeRole.replace(/_/g, ' ')}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={isDark ? '#334155' : '#cbd5e1'} />
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
