import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Alert } from '@/components/CustomAlert';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
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

const AVATAR_COLORS = ['#5B8DEF', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#F97316', '#06B6D4', '#EF4444'];

const QUICK_LINKS: { label: string; icon: IconName; color: string; route: string; desc: string }[] = [
  { label: 'Files',          icon: 'folder-outline',    color: '#8B5CF6', route: '/(app)/files',      desc: 'Team assets & uploads' },
  { label: 'Calendar',       icon: 'calendar-outline',  color: '#F59E0B', route: '/(app)/calendar',   desc: 'Events & deadlines' },
  { label: 'Analytics',      icon: 'bar-chart-outline', color: '#06B6D4', route: '/(app)/analytics',  desc: 'Sprint metrics' },
  { label: 'Conference',     icon: 'videocam-outline',  color: '#5B8DEF', route: '/(app)/conference', desc: 'Approvals hub' },
  { label: 'Messages',       icon: 'mail-outline',      color: '#EC4899', route: '/(app)/messages',   desc: 'Client inquiries' },
];

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-slate-500 dark:text-neutral-400 text-xs font-bold uppercase tracking-widest mb-3 px-1">
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
  const isDark = useThemeStore(state => state.isDark);
  return (
    <View className="flex-row items-center justify-between py-4 border-b border-slate-100 dark:border-neutral-800">
      <Text className="text-slate-700 dark:text-neutral-200 text-sm">{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={loading}
        trackColor={{ false: isDark ? '#2A2A2A' : '#E0E0E0', true: isDark ? '#FFFFFF' : '#0A0A0A' }}
        thumbColor={value ? (isDark ? '#000000' : '#FFFFFF') : '#888888'}
      />
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, accessToken } = useAuthStore();
  const { activeTeam } = useTeamStore();
  const { isDark, toggle: toggleTheme } = useThemeStore();
  const [loggingOut, setLoggingOut] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);

  const teamId = useTeamStore().activeTeam?.id;

  const googleStatusQuery = trpc.googleDrive.googleConnectionStatus.useQuery();
  const disconnectGoogleMutation = trpc.googleDrive.disconnectGoogle.useMutation({
    onSuccess: () => googleStatusQuery.refetch(),
  });

  const isGoogleConnected = googleStatusQuery.data?.connected ?? false;

  const handleConnectGoogle = async () => {
    if (!accessToken) return;
    setConnectingGoogle(true);
    try {
      const mobileRedirectUri = Linking.createURL('/oauth-callback');
      const connectUrl = `${API_BASE_URL}/api/oauth/google/connect?token=${encodeURIComponent(accessToken)}&mobile=true&mobile_redirect=${encodeURIComponent(mobileRedirectUri)}`;
      const result = await WebBrowser.openAuthSessionAsync(connectUrl, mobileRedirectUri);
      if (result.type === 'success') {
        const parsed = Linking.parse(result.url);
        if (parsed.queryParams?.connected === 'google') {
          await googleStatusQuery.refetch();
          Alert.alert('Connected', 'Google account connected successfully. You can now upload files to Google Drive.');
        } else if (parsed.queryParams?.error) {
          Alert.alert('Error', 'Failed to connect Google account. Please try again.');
        }
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = () => {
    Alert.alert(
      'Disconnect Google',
      'This will remove your Google account connection. You will no longer be able to upload files to Google Drive.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => disconnectGoogleMutation.mutate(),
        },
      ]
    );
  };

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
  const avatarAccent = AVATAR_COLORS[(displayName.charCodeAt(0) ?? 63) % AVATAR_COLORS.length];

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-black">
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View className="px-5 pt-5 pb-2 flex-row justify-between items-center">
          <Text className="text-2xl font-bold text-slate-900 dark:text-white">Profile</Text>
          {/* Theme Toggle */}
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleTheme(); }}
            className="w-10 h-10 rounded-2xl bg-slate-200 dark:bg-neutral-900 items-center justify-center border border-slate-300 dark:border-neutral-800"
          >
            <Ionicons
              name={isDark ? 'sunny-outline' : 'moon-outline'}
              size={18}
              color={isDark ? '#AAAAAA' : '#888888'}
            />
          </TouchableOpacity>
        </View>

        {/* Avatar card */}
        <View className="mx-5 mt-4 mb-6 bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-slate-200 dark:border-neutral-800 items-center">
          {/* Avatar with ring */}
          <View className="mb-4">
            <View className="w-24 h-24 rounded-full items-center justify-center" style={{ backgroundColor: avatarAccent + '28', borderWidth: 3, borderColor: avatarAccent + '70', shadowColor: avatarAccent, shadowRadius: 12, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 } }}>
              <Text style={{ color: avatarAccent }} className="text-3xl font-bold">{initials}</Text>
            </View>
          </View>

          <Text className="text-slate-900 dark:text-white text-xl font-bold">{displayName}</Text>
          <Text className="text-slate-500 dark:text-neutral-400 text-sm mt-1">{user?.email}</Text>

          {activeTeam && (
            <View className="mt-3 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-1.5 flex-row items-center gap-2">
              <View className="w-2 h-2 rounded-full bg-black dark:bg-white" />
              <Text className="text-neutral-700 dark:text-neutral-300 text-xs font-semibold">{activeTeam.name}</Text>
            </View>
          )}
        </View>

        {/* Appearance */}
        <View className="mx-5 mb-6">
          <SectionHeader title="Appearance" />
          <View className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-800 overflow-hidden">
            <View className="flex-row items-center justify-between px-5 py-4">
              <View className="flex-row items-center gap-3">
                <View className="w-8 h-8 rounded-xl bg-neutral-100 dark:bg-neutral-800 items-center justify-center">
                  <Ionicons name={isDark ? 'moon' : 'sunny'} size={16} color={isDark ? '#AAAAAA' : '#555555'} />
                </View>
                <View>
                  <Text className="text-slate-800 dark:text-neutral-100 font-medium text-sm">
                    {isDark ? 'Dark Mode' : 'Light Mode'}
                  </Text>
                  <Text className="text-slate-400 dark:text-neutral-500 text-xs">
                    {isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                  </Text>
                </View>
              </View>
              <Switch
                value={isDark}
                onValueChange={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleTheme(); }}
                trackColor={{ false: '#E0E0E0', true: '#0A0A0A' }}
                thumbColor={isDark ? '#FFFFFF' : '#888888'}
              />
            </View>
          </View>
        </View>

        {/* Quick links */}
        <View className="mx-5 mb-6">
          <SectionHeader title="Tools" />
          <View className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-800 overflow-hidden">
            {QUICK_LINKS.map((item, idx) => (
              <TouchableOpacity
                key={item.label}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(item.route as any); }}
                className={`flex-row items-center px-5 py-4 gap-3 ${
                  idx > 0 ? 'border-t border-slate-100 dark:border-neutral-800' : ''
                }`}
              >
                <View
                  className="w-9 h-9 rounded-xl items-center justify-center"
                  style={{ backgroundColor: item.color + '1a' }}
                >
                  <Ionicons name={item.icon} size={18} color={item.color} />
                </View>
                <View className="flex-1">
                  <Text className="text-slate-800 dark:text-neutral-100 font-medium text-sm">{item.label}</Text>
                  <Text className="text-slate-400 dark:text-neutral-500 text-xs mt-0.5">{item.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color="#94a3b8" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notification preferences */}
        <View className="mx-5 mb-6">
          <SectionHeader title="Notifications" />
          <View className="bg-white dark:bg-neutral-900 rounded-2xl px-5 border border-slate-200 dark:border-neutral-800">
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

        {/* Connections */}
        <View className="mx-5 mb-6">
          <SectionHeader title="Connections" />
          <View className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-800 overflow-hidden">
            <View className="flex-row items-center px-5 py-4 gap-3">
              <View className="w-9 h-9 rounded-xl items-center justify-center"
                style={{ backgroundColor: '#88888818' }}
              >
                <Ionicons
                  name="logo-google"
                  size={18}
                  color={isGoogleConnected ? '#888888' : '#AAAAAA'}
                />
              </View>
              <View className="flex-1">
                <Text className="text-slate-800 dark:text-neutral-100 font-medium text-sm">Google Drive</Text>
                <Text className="text-xs mt-0.5" style={{ color: isGoogleConnected ? '#888888' : '#AAAAAA' }}>
                  {isGoogleConnected ? 'Connected' : 'Not connected'}
                </Text>
              </View>
              {googleStatusQuery.isLoading || connectingGoogle || disconnectGoogleMutation.isPending ? (
                <ActivityIndicator size="small" color="#94a3b8" />
              ) : isGoogleConnected ? (
                <TouchableOpacity
                  onPress={handleDisconnectGoogle}
                  className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-1.5"
                >
                  <Text className="text-red-500 text-xs font-semibold">Disconnect</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={handleConnectGoogle}
                  className="bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-1.5"
                >
                  <Text className="text-neutral-700 dark:text-neutral-400 text-xs font-semibold">Connect</Text>
                </TouchableOpacity>
              )}
            </View>
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
