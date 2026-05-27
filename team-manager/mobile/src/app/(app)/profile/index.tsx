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

function SectionLabel({ title }: { title: string }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 8,
        paddingHorizontal: 4,
      }}
    >
      {title}
    </Text>
  );
}

function SettingRow({
  label,
  value,
  onToggle,
  isLast,
}: {
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  isLast?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 56,
        paddingHorizontal: 16,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: 'rgba(51, 65, 85, 0.6)',
      }}
    >
      <Text style={{ color: '#e2e8f0', fontSize: 15, fontWeight: '500', flex: 1 }}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#1e293b', true: '#0369a1' }}
        thumbColor={value ? '#0ea5e9' : '#475569'}
      />
    </View>
  );
}

const NAV_ITEMS = [
  { emoji: '📁', label: 'Files', route: '/(app)/files' },
  { emoji: '📅', label: 'Calendar', route: '/(app)/calendar' },
  { emoji: '📊', label: 'Analytics', route: '/(app)/analytics' },
  { emoji: '🏛️', label: 'Conference Room', route: '/(app)/conference' },
];

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

  const prefs = (prefsQuery.data as any) ?? {};

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
          router.replace('/(auth)/login' as any);
        },
      },
    ]);
  };

  const initials = (user?.name ?? user?.email ?? 'U')
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const NOTIFICATION_ROWS = [
    { key: 'pushEnabled', label: 'Push Notifications', default: true },
    { key: 'emailEnabled', label: 'Email Notifications', default: true },
    { key: 'taskAssignments', label: 'Task Assignments', default: true },
    { key: 'taskDeadlines', label: 'Deadlines', default: true },
    { key: 'approvalRequests', label: 'Approvals', default: true },
    { key: 'mentions', label: 'Mentions', default: true },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#020617' }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >

        {/* ── Header ── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 }}>
          <Text style={{ fontSize: 26, fontWeight: '700', color: '#f8fafc', letterSpacing: -0.5 }}>
            Settings
          </Text>
        </View>

        {/* ── Avatar Card ── */}
        <View
          style={{
            marginHorizontal: 20,
            marginTop: 20,
            backgroundColor: '#0f172a',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: 'rgba(51, 65, 85, 0.6)',
            padding: 24,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: '#0369a1',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
              shadowColor: '#0ea5e9',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700', letterSpacing: -0.5 }}>
              {initials}
            </Text>
          </View>

          <Text style={{ color: '#f8fafc', fontSize: 18, fontWeight: '700', marginBottom: 4, letterSpacing: -0.3 }}>
            {user?.name ?? 'User'}
          </Text>
          <Text style={{ color: '#64748b', fontSize: 13, fontWeight: '500', marginBottom: 12 }}>
            {user?.email}
          </Text>

          {activeTeam && (
            <View
              style={{
                backgroundColor: 'rgba(14, 165, 233, 0.12)',
                borderColor: 'rgba(14, 165, 233, 0.35)',
                borderWidth: 1,
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 6,
              }}
            >
              <Text style={{ color: '#38bdf8', fontSize: 12, fontWeight: '600' }}>
                {activeTeam.name}
              </Text>
            </View>
          )}
        </View>

        {/* ── Quick Navigation ── */}
        <View style={{ marginHorizontal: 20, marginTop: 28 }}>
          <SectionLabel title="Navigate" />
          <View
            style={{
              backgroundColor: '#0f172a',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(51, 65, 85, 0.6)',
              overflow: 'hidden',
            }}
          >
            {NAV_ITEMS.map((item, idx) => (
              <TouchableOpacity
                key={item.route}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.75}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  minHeight: 56,
                  paddingHorizontal: 16,
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: 'rgba(51, 65, 85, 0.6)',
                }}
              >
                <Text style={{ fontSize: 18, marginRight: 14 }}>{item.emoji}</Text>
                <Text style={{ color: '#e2e8f0', fontSize: 15, fontWeight: '500', flex: 1 }}>
                  {item.label}
                </Text>
                <Text style={{ color: '#334155', fontSize: 20, fontWeight: '300' }}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Notifications ── */}
        <View style={{ marginHorizontal: 20, marginTop: 28 }}>
          <SectionLabel title="Notifications" />
          <View
            style={{
              backgroundColor: '#0f172a',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(51, 65, 85, 0.6)',
              overflow: 'hidden',
            }}
          >
            {NOTIFICATION_ROWS.map((row, idx) => (
              <SettingRow
                key={row.key}
                label={row.label}
                value={prefs[row.key] ?? row.default}
                onToggle={(v) => handleTogglePref(row.key, v)}
                isLast={idx === NOTIFICATION_ROWS.length - 1}
              />
            ))}
          </View>
        </View>

        {/* ── Account ── */}
        <View style={{ marginHorizontal: 20, marginTop: 28 }}>
          <SectionLabel title="Account" />
          <View
            style={{
              backgroundColor: '#0f172a',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(51, 65, 85, 0.6)',
              overflow: 'hidden',
              marginBottom: 24,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: 56,
                paddingHorizontal: 16,
              }}
            >
              <Text style={{ color: '#94a3b8', fontSize: 15, fontWeight: '500' }}>App Version</Text>
              <Text style={{ color: '#475569', fontSize: 14, fontWeight: '500' }}>v1.0.0</Text>
            </View>
          </View>

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
