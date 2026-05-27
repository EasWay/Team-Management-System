import { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { trpc } from '@/lib/api';
import { useTeamStore } from '@/store/teamStore';
import { setBadgeCount } from '@/lib/notifications';

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 4 }}>
      <Text
        style={{
          fontSize: 22,
          opacity: 1,
          transform: [{ scale: focused ? 1.1 : 1 }],
        }}
      >
        {emoji}
      </Text>
      <Text
        style={{
          fontSize: 10,
          marginTop: 2,
          color: focused ? '#38bdf8' : '#64748b',
          fontWeight: focused ? '700' : '400',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function AppLayout() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();
  const { setTeams } = useTeamStore();

  const teamsQuery = trpc.teams.listAll.useQuery(undefined, { enabled: isAuthenticated });
  const statsQuery = trpc.ideas.stats.useQuery(
    { teamId: useTeamStore.getState().activeTeam?.id ?? 0 },
    { enabled: isAuthenticated && !!useTeamStore.getState().activeTeam?.id, refetchInterval: 60_000 }
  );

  const unreadQuery = trpc.notifications.getUnreadCount.useQuery(
    { teamId: useTeamStore.getState().activeTeam?.id ?? 0 },
    { enabled: isAuthenticated && !!useTeamStore.getState().activeTeam?.id, refetchInterval: 30_000 }
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (teamsQuery.data) setTeams(teamsQuery.data as any);
  }, [teamsQuery.data]);

  useEffect(() => {
    const count = (unreadQuery.data as number | undefined) ?? 0;
    setBadgeCount(count).catch(() => {});
  }, [unreadQuery.data]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: '#0a0f1e',
          borderTopColor: '#0f172a',
          height: 80,
          paddingBottom: 12,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏠" label="Office" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="✅" label="Tasks" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📁" label="Projects" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="teams"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="👥" label="Teams" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="ideas"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="💡" label="Ideas" focused={focused} />
          ),
          tabBarBadge: (statsQuery.data as any)?.inbox > 0
            ? (statsQuery.data as any).inbox
            : undefined,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="👤" label="Profile" focused={focused} />
          ),
        }}
      />
      {/* Hidden tabs still registered for routing */}
      <Tabs.Screen name="files" options={{ href: null }} />
      <Tabs.Screen name="calendar" options={{ href: null }} />
      <Tabs.Screen name="analytics" options={{ href: null }} />
      <Tabs.Screen name="conference" options={{ href: null }} />
    </Tabs>
  );
}
