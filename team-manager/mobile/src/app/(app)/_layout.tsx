import { useEffect, useMemo } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColorScheme } from 'nativewind';
import { useAuthStore } from '@/store/authStore';
import { trpc } from '@/lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTeamStore } from '@/store/teamStore';
import {
  setBadgeCount,
  registerPushToken,
  setupNotificationResponseListener,
  setupNotificationReceivedListener,
  handleInitialNotification,
} from '@/lib/notifications';
import { Alert } from '@/components/CustomAlert';
import * as Haptics from 'expo-haptics';

export default function AppLayout() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const { setTeams, restoreActiveTeam, activeTeam } = useTeamStore();
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';

  // ─── Core queries ────────────────────────────────────────────────────────────
  const teamsQuery = trpc.teams.list.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: 4,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 15000),
    refetchOnMount: true,
  });

  const unreadQuery = trpc.notifications.getUnreadCount.useQuery(
    { teamId: activeTeam?.id ?? 0 },
    { enabled: isAuthenticated && !!activeTeam?.id, refetchInterval: 30_000 }
  );

  // ─── Badge queries ────────────────────────────────────────────────────────────
  const membersQuery = trpc.teams.getMembers.useQuery(
    { teamId: activeTeam?.id ?? 0 },
    { enabled: isAuthenticated && !!activeTeam?.id, staleTime: 60_000 }
  );

  const currentMemberId = useMemo<number | null>(() => {
    const members = membersQuery.data as any[] ?? [];
    const m = members.find((m: any) => (m.member?.email ?? m.email) === user?.email);
    return m?.member?.id ?? m?.id ?? null;
  }, [membersQuery.data, user?.email]);

  const convsQuery = trpc.chat.getConversations.useQuery(
    { memberId: currentMemberId ?? 0, teamId: activeTeam?.id ?? 0 },
    { enabled: !!currentMemberId && !!activeTeam?.id, refetchInterval: 15_000, staleTime: 10_000 }
  );

  const tasksQuery = trpc.tasks.list.useQuery(
    { teamId: activeTeam?.id ?? 0 },
    { enabled: isAuthenticated && !!activeTeam?.id, staleTime: 30_000 }
  );

  // ─── Derived badge values ─────────────────────────────────────────────────────
  const chatBadge = useMemo<number | undefined>(() => {
    const total = (convsQuery.data as any[] ?? [])
      .reduce((s: number, c: any) => s + (c.unreadCount ?? 0), 0);
    return total > 0 ? total : undefined;
  }, [convsQuery.data]);

  const taskBadge = useMemo<number | undefined>(() => {
    const open = (tasksQuery.data as any[] ?? [])
      .filter((t: any) => t.status !== 'done').length;
    return open > 0 ? open : undefined;
  }, [tasksQuery.data]);

  const notifBadge = useMemo<number | undefined>(() => {
    const count = (unreadQuery.data as number | undefined) ?? 0;
    return count > 0 ? count : undefined;
  }, [unreadQuery.data]);

  // ─── Side effects ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/(auth)/login');
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (teamsQuery.data && teamsQuery.data.length > 0) {
      setTeams(teamsQuery.data as any);
      restoreActiveTeam();
    }
  }, [teamsQuery.data]);

  useEffect(() => {
    const count = (unreadQuery.data as number | undefined) ?? 0;
    setBadgeCount(count).catch(() => {});
  }, [unreadQuery.data]);

  useEffect(() => {
    if (isAuthenticated) {
      registerPushToken().catch(console.warn);
      handleInitialNotification().catch(console.warn);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const sub = setupNotificationResponseListener();
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const sub = setupNotificationReceivedListener((notification: any) => {
      const { title, body } = notification.request.content;
      if (title || body) Alert.alert(title ?? 'Notification', body ?? '');
    });
    return () => sub.remove();
  }, []);

  // ─── Styles ───────────────────────────────────────────────────────────────────
  const tabBg      = isDark ? '#000000' : '#FFFFFF';
  const tabBorder  = isDark ? '#1A1A1A' : '#E8E8E8';
  const tabInactive = isDark ? '#555555' : '#AAAAAA';

  const TAB_COLORS = {
    office:   '#5B8DEF',
    tasks:    '#10B981',
    projects: '#8B5CF6',
    chat:     '#F59E0B',
    profile:  '#EC4899',
  };

  const badgeStyle = {
    backgroundColor: isDark ? '#FFFFFF' : '#0A0A0A',
    color: isDark ? '#000000' : '#FFFFFF',
    fontSize: 10,
    fontWeight: '700' as const,
    minWidth: 16,
    height: 16,
    lineHeight: Platform.OS === 'android' ? 16 : undefined,
    borderRadius: 8,
    paddingHorizontal: 3,
    top: -2,
  };

  const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: tabBg,
          borderTopColor: tabBorder,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 68 + Math.max(insets.bottom, 20) : 68,
          paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 20) : 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: isDark ? '#FFFFFF' : '#0A0A0A', // overridden per-tab below
        tabBarInactiveTintColor: tabInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500', marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Office',
          tabBarActiveTintColor: TAB_COLORS.office,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
          tabBarBadge: notifBadge,
          tabBarBadgeStyle: badgeStyle,
        }}
        listeners={{ tabPress: tap }}
      />
      <Tabs.Screen
        name="tasks/index"
        options={{
          title: 'Tasks',
          tabBarActiveTintColor: TAB_COLORS.tasks,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'checkmark-circle' : 'checkmark-circle-outline'} size={22} color={color} />
          ),
          tabBarBadge: taskBadge,
          tabBarBadgeStyle: badgeStyle,
        }}
        listeners={{ tabPress: tap }}
      />
      <Tabs.Screen
        name="projects/index"
        options={{
          title: 'Projects',
          tabBarActiveTintColor: TAB_COLORS.projects,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'folder' : 'folder-outline'} size={22} color={color} />
          ),
        }}
        listeners={{ tabPress: tap }}
      />
      <Tabs.Screen
        name="messages/index"
        options={{
          title: 'Chat',
          tabBarActiveTintColor: TAB_COLORS.chat,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} size={22} color={color} />
          ),
          tabBarBadge: chatBadge,
          tabBarBadgeStyle: badgeStyle,
        }}
        listeners={{ tabPress: tap }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Profile',
          tabBarActiveTintColor: TAB_COLORS.profile,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          ),
        }}
        listeners={{ tabPress: tap }}
      />

      {/* Hidden screens — navigated via router.push */}
      <Tabs.Screen name="files/index"      options={{ href: null }} />
      <Tabs.Screen name="calendar/index"   options={{ href: null }} />
      <Tabs.Screen name="analytics/index"  options={{ href: null }} />
      <Tabs.Screen name="conference/index" options={{ href: null }} />
      <Tabs.Screen name="teams/index"      options={{ href: null }} />
      <Tabs.Screen name="chat/[userId]"    options={{ href: null }} />
      <Tabs.Screen name="admin/index"      options={{ href: null }} />
    </Tabs>
  );
}
