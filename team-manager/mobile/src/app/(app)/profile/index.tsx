import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { trpc } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useTeamStore } from '@/store/teamStore';
import { useThemeStore } from '@/store/themeStore';
import { disconnectSocket } from '@/lib/socket';
import { Button } from '@/components/Button';
import { API_BASE_URL } from '@/lib/constants';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const QUICK_LINKS: { label: string; icon: IconName; color: string; route: string; desc: string }[] = [
  { label: 'Files',          icon: 'folder-outline',    color: '#38bdf8', route: '/(app)/files',      desc: 'Team assets & uploads' },
  { label: 'Calendar',       icon: 'calendar-outline',  color: '#34d399', route: '/(app)/calendar',   desc: 'Events & deadlines' },
  { label: 'Analytics',      icon: 'bar-chart-outline', color: '#a78bfa', route: '/(app)/analytics',  desc: 'Sprint metrics' },
  { label: 'Conference',     icon: 'videocam-outline',  color: '#fb923c', route: '/(app)/conference', desc: 'Approvals hub' },
  { label: 'Messages',       icon: 'mail-outline',      color: '#f472b6', route: '/(app)/messages',   desc: 'Client inquiries' },
];

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest mb-3 px-1">
      {title}
    </Text>
  );
}

function SettingRow({
  label,
  value,
  onToggle,
  loading = false,
}: {
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  loading?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between py-4 border-b border-slate-100 dark:border-slate-800">
      <Text className="text-slate-700 dark:text-slate-200 text-sm">{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={loading}
        trackColor={{ false: '#cbd5e1', true: '#0369a1' }}
        thumbColor={value ? '#0ea5e9' : '#94a3b8'}
      />
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { activeTeam } = useTeamStore();
  const { isDark, toggle: toggleTheme } = useThemeStore();
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

  const displayName = user?.name ?? user?.email ?? 'User';
  const initials = displayName.split(' ').map((n: string) => n[0] ?? '').slice(0, 2).join('').toUpperCase();

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View className="px-5 pt-5 pb-2 flex-row justify-between items-center">
          <Text className="text-2xl font-bold text-slate-900 dark:text-white">Profile</Text>
          {/* Theme Toggle */}
          <TouchableOpacity
            onPress={() => toggleTheme()}
            className="w-10 h-10 rounded-2xl bg-slate-200 dark:bg-slate-800 items-center justify-center border border-slate-300 dark:border-slate-700"
          >
            <Ionicons
              name={isDark ? 'sunny-outline' : 'moon-outline'}
              size={18}
              color={isDark ? '#fbbf24' : '#6366f1'}
            />
          </TouchableOpacity>
        </View>

        {/* Avatar card */}
        <View className="mx-5 mt-4 mb-6 bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 items-center">
          {/* Avatar with ring */}
          <View className="mb-4">
            <View className="w-24 h-24 rounded-full bg-sky-600 items-center justify-center" style={{ shadowColor: '#0ea5e9', shadowRadius: 12, shadowOpacity: 0.4, shadowOffset: { width: 0, height: 4 } }}>
              <Text className="text-white text-3xl font-bold">{initials}</Text>
            </View>
          </View>

          <Text className="text-slate-900 dark:text-white text-xl font-bold">{displayName}</Text>
          <Text className="text-slate-500 dark:text-slate-400 text-sm mt-1">{user?.email}</Text>

          {activeTeam && (
            <View className="mt-3 bg-sky-50 dark:bg-sky-900/30 border border-sky-200 dark:border-sky-700 rounded-xl px-4 py-1.5 flex-row items-center gap-2">
              <View className="w-2 h-2 rounded-full bg-sky-500" />
              <Text className="text-sky-600 dark:text-sky-300 text-xs font-semibold">{activeTeam.name}</Text>
            </View>
          )}
        </View>

        {/* Appearance */}
        <View className="mx-5 mb-6">
          <SectionHeader title="Appearance" />
          <View className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <View className="flex-row items-center justify-between px-5 py-4">
              <View className="flex-row items-center gap-3">
                <View className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 items-center justify-center">
                  <Ionicons name={isDark ? 'moon' : 'sunny'} size={16} color={isDark ? '#818cf8' : '#f59e0b'} />
                </View>
                <View>
                  <Text className="text-slate-800 dark:text-slate-100 font-medium text-sm">
                    {isDark ? 'Dark Mode' : 'Light Mode'}
                  </Text>
                  <Text className="text-slate-400 dark:text-slate-500 text-xs">
                    {isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                  </Text>
                </View>
              </View>
              <Switch
                value={isDark}
                onValueChange={() => toggleTheme()}
                trackColor={{ false: '#cbd5e1', true: '#4338ca' }}
                thumbColor={isDark ? '#818cf8' : '#94a3b8'}
              />
            </View>
          </View>
        </View>

        {/* Quick links */}
        <View className="mx-5 mb-6">
          <SectionHeader title="Tools" />
          <View className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {QUICK_LINKS.map((item, idx) => (
              <TouchableOpacity
                key={item.label}
                onPress={() => router.push(item.route as any)}
                className={`flex-row items-center px-5 py-4 gap-3 ${
                  idx > 0 ? 'border-t border-slate-100 dark:border-slate-700' : ''
                }`}
              >
                <View
                  className="w-9 h-9 rounded-xl items-center justify-center"
                  style={{ backgroundColor: item.color + '1a' }}
                >
                  <Ionicons name={item.icon} size={18} color={item.color} />
                </View>
                <View className="flex-1">
                  <Text className="text-slate-800 dark:text-slate-100 font-medium text-sm">{item.label}</Text>
                  <Text className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">{item.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color="#94a3b8" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notification preferences */}
        <View className="mx-5 mb-6">
          <SectionHeader title="Notifications" />
          <View className="bg-white dark:bg-slate-800 rounded-2xl px-5 border border-slate-200 dark:border-slate-700">
            <SettingRow
              label="Push Notifications"
              value={prefs.pushEnabled ?? true}
              onToggle={(v) => handleTogglePref('pushEnabled', v)}
              loading={updatePrefsMutation.isPending}
            />
            <SettingRow
              label="Email Notifications"
              value={prefs.emailEnabled ?? true}
              onToggle={(v) => handleTogglePref('emailEnabled', v)}
              loading={updatePrefsMutation.isPending}
            />
            <SettingRow
              label="Task Assignments"
              value={prefs.taskAssignments ?? true}
              onToggle={(v) => handleTogglePref('taskAssignments', v)}
              loading={updatePrefsMutation.isPending}
            />
            <SettingRow
              label="Task Deadlines"
              value={prefs.taskDeadlines ?? true}
              onToggle={(v) => handleTogglePref('taskDeadlines', v)}
              loading={updatePrefsMutation.isPending}
            />
            <SettingRow
              label="Approval Requests"
              value={prefs.approvalRequests ?? true}
              onToggle={(v) => handleTogglePref('approvalRequests', v)}
              loading={updatePrefsMutation.isPending}
            />
            <SettingRow
              label="Mentions"
              value={prefs.mentions ?? true}
              onToggle={(v) => handleTogglePref('mentions', v)}
              loading={updatePrefsMutation.isPending}
            />
          </View>
        </View>

        {/* Connection info */}
        <View className="mx-5 mb-6">
          <SectionHeader title="Connection" />
          <View className="bg-white dark:bg-slate-800 rounded-2xl px-5 py-4 border border-slate-200 dark:border-slate-700">
            <View className="flex-row items-center gap-2 mb-1.5">
              <Ionicons name="server-outline" size={13} color="#64748b" />
              <Text className="text-slate-400 dark:text-slate-500 text-xs font-medium">Server URL</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                Clipboard.setString(API_BASE_URL);
                Alert.alert('Copied', 'Server URL copied to clipboard.');
              }}
              className="flex-row items-center gap-2"
            >
              <Text className="text-slate-600 dark:text-slate-300 text-sm flex-1" numberOfLines={1}>{API_BASE_URL}</Text>
              <Ionicons name="copy-outline" size={14} color="#64748b" />
            </TouchableOpacity>
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
