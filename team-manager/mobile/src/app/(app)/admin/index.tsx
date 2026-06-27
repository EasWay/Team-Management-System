import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Alert } from '@/components/CustomAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { trpc } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { LoadingScreen } from '@/components/LoadingScreen';
import { EmptyState } from '@/components/EmptyState';
import { Avatar } from '@/components/Avatar';

export default function AdminScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const utils = trpc.useUtils();

  const usersQuery = trpc.admin.listUsers.useQuery(undefined, {
    enabled: (user as any)?.role === 'admin',
  });

  const removeUserMutation = trpc.admin.removeUser.useMutation({
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      utils.admin.listUsers.invalidate();
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const goBack = () => {
    router.canGoBack() ? router.back() : router.navigate('/(app)/profile' as any);
  };

  if ((user as any)?.role !== 'admin') {
    return (
      <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-black items-center justify-center p-5">
        <Ionicons name="shield-outline" size={48} color="#ef4444" />
        <Text className="text-slate-900 dark:text-white text-xl font-bold mt-4">Access Denied</Text>
        <Text className="text-slate-500 dark:text-neutral-400 text-center mt-2 mb-6">
          You need administrator privileges to access this page.
        </Text>
        <TouchableOpacity
          onPress={goBack}
          className="bg-black dark:bg-white rounded-2xl px-6 py-3"
        >
          <Text className="text-white dark:text-black font-bold">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const allUsers = (usersQuery.data as any[] ?? []);

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-black">
      {/* Header */}
      <View className="px-5 pt-5 pb-4 flex-row justify-between items-center">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={goBack}
            className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-neutral-900 items-center justify-center"
          >
            <Ionicons name="arrow-back" size={18} color="#64748b" />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-bold text-slate-900 dark:text-white">Admin Panel</Text>
            <Text className="text-slate-500 dark:text-neutral-400 text-xs mt-0.5">Manage system users</Text>
          </View>
        </View>
      </View>

      {/* Connection error banner */}
      {usersQuery.error && !usersQuery.isFetching && (
        <View className="mx-5 mb-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-2xl p-4">
          <View className="flex-row items-center gap-2 mb-1">
            <Ionicons name="cloud-offline-outline" size={15} color="#f87171" />
            <Text className="text-red-500 dark:text-red-400 text-sm font-semibold">Connection failed</Text>
          </View>
          <Text className="text-red-400 dark:text-red-300 text-xs mb-3" numberOfLines={2}>
            {(usersQuery.error as any)?.message ?? 'Could not reach the server.'}
          </Text>
          <TouchableOpacity
            onPress={() => usersQuery.refetch()}
            className="bg-red-100 dark:bg-red-700/40 rounded-xl px-3 py-2 self-start"
          >
            <Text className="text-red-500 dark:text-red-200 text-xs font-bold">Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Users list */}
      <FlatList
        data={allUsers}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={usersQuery.isFetching}
            onRefresh={() => usersQuery.refetch()}
            tintColor="#888888"
          />
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        ListEmptyComponent={
          usersQuery.isLoading ? <LoadingScreen /> : (
            <EmptyState
              title="No users found"
              description="There are no users registered in the system."
              icon="people-outline"
              iconColor="#888888"
            />
          )
        }
        renderItem={({ item }) => {
          const isMe = item.id === user?.id;
          const isAdmin = item.role === 'admin';
          const displayName = item.name || item.email || 'Unknown';
          
          return (
            <View className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-2xl p-4 mb-3 flex-row items-center justify-between">
              <View className="flex-row items-center gap-3 flex-1 mr-2">
                <Avatar name={displayName} avatarUrl={item.avatarUrl ?? null} size={40} />
                <View className="flex-1 min-w-0">
                  <View className="flex-row items-center gap-1.5 flex-wrap">
                    <Text className="text-slate-900 dark:text-white font-semibold text-base truncate">
                      {displayName}
                    </Text>
                    {isMe && (
                      <View className="bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 rounded-full px-2 py-0.5">
                        <Text className="text-blue-600 dark:text-blue-400 text-[10px] font-bold">You</Text>
                      </View>
                    )}
                    {isAdmin && (
                      <View className="bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-200 dark:border-yellow-800 rounded-full px-2 py-0.5">
                        <Text className="text-yellow-600 dark:text-yellow-400 text-[10px] font-bold">Admin</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-slate-400 dark:text-neutral-500 text-xs mt-0.5 truncate">{item.email}</Text>
                  
                  {item.memberships && item.memberships.length > 0 && (
                    <Text className="text-slate-400 dark:text-neutral-500 text-[10px] mt-1">
                      In {item.memberships.length} team(s)
                    </Text>
                  )}
                </View>
              </View>

              {!isMe && (
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(
                      'Remove User',
                      `Are you sure you want to permanently delete ${displayName} from the system? This action cannot be undone.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { 
                          text: 'Delete', 
                          style: 'destructive',
                          onPress: () => removeUserMutation.mutate({ userId: item.id })
                        }
                      ]
                    );
                  }}
                  disabled={removeUserMutation.isPending}
                  className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 items-center justify-center border border-red-100 dark:border-red-900/30"
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
