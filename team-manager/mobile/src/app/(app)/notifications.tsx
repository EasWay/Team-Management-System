import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { trpc } from '@/lib/api';
import { useTeamStore } from '@/store/teamStore';
import { useThemeStore } from '@/store/themeStore';
import { formatDistanceToNow } from 'date-fns';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function getNotificationIcon(type: string): { icon: IconName; color: string } {
  if (type.includes('task')) return { icon: 'checkmark-circle-outline', color: '#10B981' };
  if (type.includes('project')) return { icon: 'folder-outline', color: '#8B5CF6' };
  if (type.includes('member') || type.includes('invite')) return { icon: 'person-add-outline', color: '#5B8DEF' };
  if (type.includes('comment') || type.includes('chat') || type.includes('messages')) return { icon: 'chatbubble-outline', color: '#F59E0B' };
  if (type.includes('repo')) return { icon: 'logo-github', color: '#EC4899' };
  if (type.includes('folder')) return { icon: 'document-outline', color: '#3b82f6' };
  return { icon: 'notifications-outline', color: '#94a3b8' };
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { activeTeam } = useTeamStore();
  const isDark = useThemeStore(state => state.isDark);
  const teamId = activeTeam?.id ?? 0;

  const notifsQuery = trpc.notifications.list.useQuery(
    { teamId },
    { enabled: !!teamId }
  );

  const dashQuery = trpc.dashboard.get.useQuery(
    { teamId },
    { enabled: !!teamId }
  );
  
  const markReadMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      notifsQuery.refetch();
    }
  });

  const isRefreshing = notifsQuery.isFetching || dashQuery.isFetching;
  
  const refetch = () => {
    notifsQuery.refetch();
    dashQuery.refetch();
  };

  const mixedFeed = useMemo(() => {
    const notifs = (notifsQuery.data ?? []).map(n => ({
      ...n,
      isActivity: false,
      timestamp: new Date(n.createdAt).getTime()
    }));
    
    const activities = (dashQuery.data?.activities ?? []).map(a => ({
      ...a,
      isActivity: true,
      title: a.userName ? `${a.userName}` : 'Activity',
      message: a.description,
      isRead: true, // Activities are always read
      timestamp: new Date(a.createdAt).getTime()
    }));
    
    return [...notifs, ...activities].sort((a, b) => b.timestamp - a.timestamp);
  }, [notifsQuery.data, dashQuery.data?.activities]);

  const handlePress = (item: any) => {
    if (!item.isActivity && !item.isRead) {
      markReadMutation.mutate({ notificationId: item.id });
    }
    if (item.actionUrl) {
      router.push(item.actionUrl as any);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-black" edges={['top']}>
      <View className="px-5 py-4 border-b border-slate-200 dark:border-neutral-800 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color={isDark ? '#FFF' : '#000'} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-slate-900 dark:text-white">Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        className="flex-1"
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refetch} tintColor={isDark ? '#FFF' : '#000'} />}
      >
        {notifsQuery.isLoading ? (
          <View className="flex-1 items-center justify-center pt-20">
            <ActivityIndicator size="large" color={isDark ? '#FFF' : '#000'} />
          </View>
        ) : mixedFeed.length === 0 ? (
          <View className="p-10 items-center justify-center mt-10">
            <Ionicons name="notifications-off-outline" size={48} color="#94a3b8" />
            <Text className="text-slate-400 dark:text-neutral-500 text-base mt-4">All caught up!</Text>
          </View>
        ) : (
          <View className="py-2">
            {mixedFeed.map((item: any, index) => {
              const { icon, color } = getNotificationIcon(item.type ?? '');
              const isLast = index === mixedFeed.length - 1;
              const unreadStyle = (!item.isActivity && !item.isRead) ? 'bg-blue-50 dark:bg-blue-900/20' : '';
              
              return (
                <TouchableOpacity
                  key={`${item.isActivity ? 'act' : 'notif'}-${item.id}`}
                  onPress={() => handlePress(item)}
                  activeOpacity={0.7}
                  className={`flex-row items-start gap-4 px-5 py-4 ${
                    !isLast ? 'border-b border-slate-200 dark:border-neutral-800' : ''
                  } ${unreadStyle}`}
                >
                  <View
                    className="rounded-full items-center justify-center mt-0.5"
                    style={{
                      width: 40, height: 40,
                      backgroundColor: color + '15',
                      borderWidth: 1,
                      borderColor: color + '30',
                    }}
                  >
                    <Ionicons name={icon} size={20} color={color} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-900 dark:text-white font-semibold text-base mb-0.5">
                      {item.title}
                    </Text>
                    <Text className="text-slate-500 dark:text-neutral-400 text-sm leading-5">
                      {item.message}
                    </Text>
                    <Text className="text-slate-400 dark:text-neutral-500 text-xs mt-1.5 font-medium">
                      {item.timestamp
                        ? formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })
                        : ''}
                    </Text>
                  </View>
                  {!item.isActivity && !item.isRead && (
                    <View className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-2" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
