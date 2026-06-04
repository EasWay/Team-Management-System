import { useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
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
import { Avatar } from '@/components/Avatar';
import { getSocket } from '@/lib/socket';
import { formatDistanceToNow } from 'date-fns';

// ─── Avatar ───────────────────────────────────────────────────────────────────
function MemberAvatar({ name, avatarUrl, size = 50, unread = 0 }: { name?: string | null; avatarUrl?: string | null; size?: number; unread?: number }) {
  const isDark = useThemeStore(state => state.isDark);
  return (
    <View style={{ position: 'relative' }}>
      <Avatar name={name} avatarUrl={avatarUrl} size={size} />
      {unread > 0 && (
        <View style={{
          position: 'absolute', top: -2, right: -2,
          minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 3,
          backgroundColor: isDark ? '#FFFFFF' : '#0A0A0A', borderWidth: 2, borderColor: isDark ? '#000000' : '#F5F5F5',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: isDark ? '#000000' : '#FFFFFF', fontSize: 10, fontWeight: '800' }}>{unread > 99 ? '99+' : unread}</Text>
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
    { enabled: !!currentMemberId && !!activeTeam?.id, staleTime: 1000 * 30, refetchInterval: 30_000 }
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#000000' : '#F5F5F5' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: isDark ? '#555555' : '#888888', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 }}>
              {activeTeam?.name ?? 'Team'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text className="text-slate-900 dark:text-white" style={{ fontSize: 24, fontWeight: '800' }}>Messages</Text>
              {totalUnread > 0 && (
                <View style={{ backgroundColor: isDark ? '#FFFFFF' : '#0A0A0A', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ color: isDark ? '#000000' : '#FFFFFF', fontSize: 12, fontWeight: '800' }}>{totalUnread}</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setShowPicker(true)}
            style={{
              width: 42, height: 42, borderRadius: 21, backgroundColor: isDark ? '#FFFFFF' : '#0A0A0A',
              alignItems: 'center', justifyContent: 'center',
              shadowColor: '#000', shadowRadius: 10, shadowOpacity: 0.15, shadowOffset: { width: 0, height: 3 },
            }}
          >
            <Ionicons name="create-outline" size={18} color={isDark ? '#000000' : '#FFFFFF'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Conversations list */}
      {convsQuery.isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={isDark ? '#FFFFFF' : '#0A0A0A'} />
        </View>
      ) : conversations.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <View style={{
            width: 72, height: 72, borderRadius: 24, backgroundColor: isDark ? '#000000' : '#ffffff',
            borderWidth: 1, borderColor: isDark ? '#1A1A1A' : '#D0D0D0', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
          }}>
            <Ionicons name="chatbubble-ellipses-outline" size={32} color={isDark ? '#555555' : '#AAAAAA'} />
          </View>
          <Text className="text-slate-900 dark:text-white" style={{ fontSize: 17, fontWeight: '700', marginBottom: 6 }}>No conversations yet</Text>
          <Text className="text-slate-500 dark:text-neutral-400" style={{ fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
            Send a message to a team member to start chatting.
          </Text>
          <TouchableOpacity
            onPress={() => setShowPicker(true)}
            style={{
              marginTop: 20, backgroundColor: isDark ? '#FFFFFF' : '#0A0A0A', borderRadius: 14,
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
            <RefreshControl refreshing={convsQuery.isFetching} onRefresh={() => convsQuery.refetch()} tintColor={isDark ? '#FFFFFF' : '#0A0A0A'} />
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
                  borderBottomWidth: 1, borderBottomColor: isDark ? '#000000' : '#E8E8E8',
                  backgroundColor: hasUnread ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)') : 'transparent',
                }}
              >
                <MemberAvatar name={item.partnerName} avatarUrl={item.partnerAvatarUrl} size={50} unread={item.unreadCount} />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text
                      className="text-slate-900 dark:text-white"
                      style={{ fontSize: 15, fontWeight: hasUnread ? '700' : '600', flex: 1, color: hasUnread ? undefined : (isDark ? '#94a3b8' : '#475569') }}
                      numberOfLines={1}
                    >
                      {item.partnerName ?? 'Team Member'}
                    </Text>
                    <Text className="text-slate-400 dark:text-neutral-500" style={{ fontSize: 11, marginLeft: 8 }}>{timeStr}</Text>
                  </View>
                  <Text
                    className="text-slate-500 dark:text-neutral-400"
                    style={{ fontSize: 13, fontWeight: hasUnread ? '500' : '400', color: hasUnread ? undefined : (isDark ? '#555555' : '#AAAAAA') }}
                    numberOfLines={1}
                  >
                    {item.lastMessage || 'No messages yet'}
                  </Text>
                </View>
                {hasUnread && (
                  <View style={{ marginLeft: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: isDark ? '#FFFFFF' : '#0A0A0A' }} />
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* New message member picker overlay */}
      {showPicker && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end', zIndex: 999 }}>
          <View style={{ backgroundColor: isDark ? '#000000' : '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: isDark ? '#1A1A1A' : '#D0D0D0', paddingBottom: 40 }}>
            <View style={{ width: 40, height: 4, backgroundColor: isDark ? '#1A1A1A' : '#D0D0D0', borderRadius: 2, alignSelf: 'center', marginTop: 14, marginBottom: 16 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 }}>
              <Text className="text-slate-900 dark:text-white" style={{ fontSize: 18, fontWeight: '800' }}>New Message</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Ionicons name="close" size={20} color={isDark ? '#555555' : '#888888'} />
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
                    <MemberAvatar name={member.name} avatarUrl={(item as any).userAvatarUrl ?? member.avatarUrl} size={44} />
                    <View style={{ flex: 1 }}>
                      <Text className="text-slate-900 dark:text-white" style={{ fontSize: 14, fontWeight: '600' }}>{member.name}</Text>
                      {item.officeRole && (
                        <Text className="text-slate-400 dark:text-neutral-500" style={{ fontSize: 11, marginTop: 1 }}>
                          {item.officeRole.replace(/_/g, ' ')}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={isDark ? '#334155' : '#D0D0D0'} />
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
