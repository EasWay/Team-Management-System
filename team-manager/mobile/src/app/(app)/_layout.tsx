import { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColorScheme } from 'nativewind';
import { useAuthStore } from '@/store/authStore';
import { trpc } from '@/lib/api';
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

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; title: string; icon: IconName; activeIcon: IconName }[] = [
  { name: 'index',          title: 'Office',   icon: 'home-outline',               activeIcon: 'home' },
  { name: 'tasks/index',    title: 'Tasks',    icon: 'checkmark-circle-outline',   activeIcon: 'checkmark-circle' },
  { name: 'projects/index', title: 'Projects', icon: 'folder-outline',             activeIcon: 'folder' },
  { name: 'messages/index', title: 'Chat',     icon: 'chatbubble-ellipses-outline', activeIcon: 'chatbubble-ellipses' },
  { name: 'profile/index',  title: 'Profile',  icon: 'person-outline',             activeIcon: 'person' },
];

export default function AppLayout() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();
  const { setTeams, restoreActiveTeam } = useTeamStore();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const teamsQuery = trpc.teams.list.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: 4,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 15000),
    refetchOnMount: true,
  });

  const unreadQuery = trpc.notifications.getUnreadCount.useQuery(
    { teamId: useTeamStore.getState().activeTeam?.id ?? 0 },
    { enabled: isAuthenticated && !!useTeamStore.getState().activeTeam?.id, refetchInterval: 30_000 }
  );

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

  // Register push token + check if app was opened via notification
  useEffect(() => {
    if (isAuthenticated) {
      registerPushToken().catch(console.warn);
      handleInitialNotification().catch(console.warn);
    }
  }, [isAuthenticated]);

  // Notification tap → navigate (works from background/killed state)
  useEffect(() => {
    const responseSub = setupNotificationResponseListener();
    return () => responseSub.remove();
  }, []);

  // Foreground notification → show in-app alert banner
  useEffect(() => {
    const receivedSub = setupNotificationReceivedListener((notification: any) => {
      const { title, body } = notification.request.content;
      if (title || body) {
        Alert.alert(title ?? 'Notification', body ?? '');
      }
    });
    return () => receivedSub.remove();
  }, []);

  const tabBg = isDark ? '#000000' : '#FFFFFF';
  const tabBorder = isDark ? '#1A1A1A' : '#E8E8E8';
  const tabInactive = isDark ? '#555555' : '#AAAAAA';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: tabBg,
          borderTopColor: tabBorder,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: isDark ? '#FFFFFF' : '#0A0A0A',
        tabBarInactiveTintColor: tabInactive,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
        },
      }}
    >
      {TABS.map(tab => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? tab.activeIcon : tab.icon}
                size={22}
                color={color}
              />
            ),
          }}
          listeners={{
            tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
          }}
        />
      ))}
      {/* Hidden screens — accessible via router.push */}
      <Tabs.Screen name="files/index"      options={{ href: null }} />
      <Tabs.Screen name="calendar/index"   options={{ href: null }} />
      <Tabs.Screen name="analytics/index"  options={{ href: null }} />
      <Tabs.Screen name="conference/index" options={{ href: null }} />
      <Tabs.Screen name="teams/index"      options={{ href: null }} />
      <Tabs.Screen name="chat/[userId]"    options={{ href: null }} />
    </Tabs>
  );
}
