import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { trpc } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useTeamStore } from '@/store/teamStore';
import { disconnectSocket } from '@/lib/socket';
import { Button } from '@/components/Button';

function SettingRow({ label, value, onToggle }: { label: string; value: boolean; onToggle: (v: boolean) => void }) {
  return (
    <View className="flex-row items-center justify-between py-4 border-b border-slate-800">
      <Text className="text-slate-200 text-base">{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#334155', true: '#0369a1' }}
        thumbColor={value ? '#0ea5e9' : '#64748b'}
      />
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { activeTeam } = useTeamStore();
  const [loggingOut, setLoggingOut] = useState(false);

  const teamId = useTeamStore().activeTeam?.id;

  const prefsQuery = trpc.notificationPreferences.get.useQuery(
    { teamId: teamId ?? 0 },
    { enabled: !!teamId }
  );
  const updatePrefsMutation = trpc.notificationPreferences.update.useMutation({
    onSuccess: () => prefsQuery.refetch(),
  });

  const prefs = prefsQuery.data as any ?? {};

  const handleTogglePref = (key: string, value: boolean) => {
    if (!teamId) return;
    updatePrefsMutation.mutate({ teamId, [key]: value });
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          disconnectSocket();
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-900">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View className="px-5 pt-4 pb-6">
          <Text className="text-2xl font-bold text-white mb-1">Profile</Text>
        </View>

        {/* Avatar & user info */}
        <View className="mx-5 bg-slate-800 rounded-2xl p-5 mb-5 border border-slate-700 items-center">
          <View className="w-20 h-20 rounded-full bg-sky-700 items-center justify-center mb-3">
            <Text className="text-white text-3xl font-bold">
              {(user?.name ?? user?.email ?? 'U')[0].toUpperCase()}
            </Text>
          </View>
          <Text className="text-white text-xl font-bold">{user?.name ?? 'User'}</Text>
          <Text className="text-slate-400 text-sm mt-1">{user?.email}</Text>
          {activeTeam && (
            <View className="mt-2 bg-sky-700/30 border border-sky-600 rounded-lg px-3 py-1">
              <Text className="text-sky-300 text-xs font-medium">{activeTeam.name}</Text>
            </View>
          )}
        </View>

        {/* Quick links */}
        <View className="mx-5 bg-slate-800 rounded-2xl mb-5 border border-slate-700 overflow-hidden">
          {[
            { label: '📁 Files', route: '/(app)/files' },
            { label: '📅 Calendar', route: '/(app)/calendar' },
            { label: '📊 Analytics', route: '/(app)/analytics' },
            { label: '🏛️ Conference Room', route: '/(app)/conference' },
          ].map((item, idx) => (
            <TouchableOpacity
              key={item.label}
              onPress={() => router.push(item.route as any)}
              className={`flex-row items-center justify-between px-5 py-4 ${idx > 0 ? 'border-t border-slate-700' : ''}`}
            >
              <Text className="text-slate-200 text-base">{item.label}</Text>
              <Text className="text-slate-500">›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Notification preferences */}
        <View className="mx-5 mb-5">
          <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 px-1">
            Notifications
          </Text>
          <View className="bg-slate-800 rounded-2xl px-5 border border-slate-700">
            <SettingRow
              label="Push Notifications"
              value={prefs.pushEnabled ?? true}
              onToggle={(v) => handleTogglePref('pushEnabled', v)}
            />
            <SettingRow
              label="Email Notifications"
              value={prefs.emailEnabled ?? true}
              onToggle={(v) => handleTogglePref('emailEnabled', v)}
            />
            <SettingRow
              label="Task Assignments"
              value={prefs.taskAssignments ?? true}
              onToggle={(v) => handleTogglePref('taskAssignments', v)}
            />
            <SettingRow
              label="Task Deadlines"
              value={prefs.taskDeadlines ?? true}
              onToggle={(v) => handleTogglePref('taskDeadlines', v)}
            />
            <SettingRow
              label="Approval Requests"
              value={prefs.approvalRequests ?? true}
              onToggle={(v) => handleTogglePref('approvalRequests', v)}
            />
            <SettingRow
              label="Mentions"
              value={prefs.mentions ?? true}
              onToggle={(v) => handleTogglePref('mentions', v)}
            />
          </View>
        </View>

        {/* Sign out */}
        <View className="mx-5">
          <Button
            label="Sign Out"
            onPress={handleLogout}
            variant="danger"
            loading={loggingOut}
            fullWidth
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
