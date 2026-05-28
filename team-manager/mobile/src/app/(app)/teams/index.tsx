import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Alert } from '@/components/CustomAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { trpc } from '@/lib/api';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';
import { LoadingScreen } from '@/components/LoadingScreen';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';

const ROLE_COLORS: Record<string, { color: string; bg: string }> = {
  admin:     { color: '#fbbf24', bg: '#fbbf2420' },
  owner:     { color: '#f97316', bg: '#f9731620' },
  team_lead: { color: '#a78bfa', bg: '#a78bfa20' },
  developer: { color: '#38bdf8', bg: '#38bdf820' },
  viewer:    { color: '#94a3b8', bg: '#94a3b820' },
};

function getRoleStyle(role: string) {
  return ROLE_COLORS[role?.toLowerCase()] ?? ROLE_COLORS.viewer;
}

export default function TeamsScreen() {
  const { activeTeam, setActiveTeam } = useTeamStore();
  const { user } = useAuthStore();
  const [showCreate, setShowCreate] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  const { isAuthenticated } = useAuthStore();
  const utils = trpc.useUtils();

  const teamsQuery = trpc.teams.list.useQuery(undefined, { enabled: isAuthenticated });
  const membersQuery = trpc.teams.getMembers.useQuery(
    { teamId: activeTeam?.id ?? 0 },
    { enabled: !!activeTeam?.id && showMembers }
  );

  const createMutation = trpc.teams.create.useMutation({
    onSuccess: () => {
      utils.teams.list.invalidate();
      setShowCreate(false);
      setTeamName('');
      setTeamDescription('');
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const inviteMutation = trpc.teams.createInvitation.useMutation({
    onSuccess: () => {
      Alert.alert('Sent!', `Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const handleCreate = () => {
    if (!teamName.trim()) {
      Alert.alert('Required', 'Team name is required.');
      return;
    }
    createMutation.mutate({ name: teamName.trim(), description: teamDescription.trim() });
  };

  const handleInvite = () => {
    if (!inviteEmail.trim() || !activeTeam) return;
    inviteMutation.mutate({ teamId: activeTeam.id, email: inviteEmail.trim(), role: 'developer' });
  };

  const teams = (teamsQuery.data as any[] ?? []);

  if (teamsQuery.isLoading && !teamsQuery.data) return <LoadingScreen />;

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">

      {/* Header */}
      <View className="px-5 pt-5 pb-4 flex-row justify-between items-center">
        <View>
          <Text className="text-2xl font-bold text-slate-900 dark:text-white">Teams</Text>
          <Text className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Your memberships</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowCreate(true)}
          className="bg-sky-500 rounded-2xl px-4 py-2.5 flex-row items-center gap-1.5"
          style={{ shadowColor: '#0ea5e9', shadowRadius: 8, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 3 } }}
        >
          <Ionicons name="add" size={16} color="#fff" />
          <Text className="text-white font-bold text-sm">New Team</Text>
        </TouchableOpacity>
      </View>

      {/* Active team banner */}
      {activeTeam && (
        <View className="mx-5 mb-4 bg-sky-50 dark:bg-sky-900/30 border border-sky-200 dark:border-sky-700 rounded-2xl p-4">
          <View className="flex-row items-center gap-2 mb-1">
            <View className="w-5 h-5 rounded-full bg-sky-500 items-center justify-center">
              <Ionicons name="checkmark" size={12} color="#fff" />
            </View>
            <Text className="text-sky-600 dark:text-sky-400 text-xs font-bold uppercase tracking-widest">Active Team</Text>
          </View>
          <Text className="text-slate-900 dark:text-white font-bold text-lg mt-0.5">{activeTeam.name}</Text>
          <View className="flex-row gap-2 mt-3">
            <TouchableOpacity
              onPress={() => setShowMembers(true)}
              className="bg-white dark:bg-sky-800/40 border border-sky-200 dark:border-sky-600 rounded-xl px-3 py-1.5 flex-row items-center gap-1.5"
            >
              <Ionicons name="people-outline" size={13} color="#0ea5e9" />
              <Text className="text-sky-600 dark:text-sky-200 text-xs font-semibold">Members</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Connection error banner */}
      {teamsQuery.error && !teamsQuery.isFetching && (
        <View className="mx-5 mb-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-2xl p-4">
          <View className="flex-row items-center gap-2 mb-1">
            <Ionicons name="cloud-offline-outline" size={15} color="#f87171" />
            <Text className="text-red-500 dark:text-red-400 text-sm font-semibold">Connection failed</Text>
          </View>
          <Text className="text-red-400 dark:text-red-300 text-xs mb-3" numberOfLines={2}>
            {(teamsQuery.error as any)?.message ?? 'Could not reach the server.'}
          </Text>
          <TouchableOpacity
            onPress={() => teamsQuery.refetch()}
            className="bg-red-100 dark:bg-red-700/40 rounded-xl px-3 py-2 self-start"
          >
            <Text className="text-red-500 dark:text-red-200 text-xs font-bold">Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Team list */}
      <FlatList
        data={teams}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={teamsQuery.isFetching}
            onRefresh={() => teamsQuery.refetch()}
            tintColor="#0ea5e9"
          />
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        ListEmptyComponent={
          teamsQuery.isLoading ? null : (
            <EmptyState
              title="No teams yet"
              description="Create a team or ask someone to invite you."
              icon="people-outline"
              iconColor="#38bdf8"
            />
          )
        }
        renderItem={({ item }) => {
          const isActive = activeTeam?.id === item.id;
          const role = item.memberRole || item.role || '';
          const rStyle = getRoleStyle(role);
          return (
            <TouchableOpacity
              onPress={() => setActiveTeam(item)}
              className={`rounded-2xl p-4 mb-3 border ${
                isActive
                  ? 'bg-sky-50 dark:bg-sky-900/30 border-sky-300 dark:border-sky-600'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
              }`}
              style={isActive
                ? { shadowColor: '#0ea5e9', shadowRadius: 8, shadowOpacity: 0.2, shadowOffset: { width: 0, height: 2 } }
                : undefined
              }
            >
              <View className="flex-row justify-between items-start mb-2">
                <View className="flex-row items-center gap-2 flex-1">
                  {/* Team initial badge */}
                  <View className="w-10 h-10 rounded-2xl items-center justify-center"
                    style={{ backgroundColor: isActive ? '#0ea5e920' : '#64748b20' }}>
                    <Text className="font-bold text-base"
                      style={{ color: isActive ? '#0ea5e9' : '#64748b' }}>
                      {(item.name?.[0] ?? 'T').toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-slate-900 dark:text-white font-semibold text-base" numberOfLines={1}>{item.name}</Text>
                    {item.description ? (
                      <Text className="text-slate-400 dark:text-slate-500 text-xs mt-0.5" numberOfLines={1}>{item.description}</Text>
                    ) : null}
                  </View>
                </View>
                {isActive && (
                  <View className="bg-sky-500 rounded-full px-2.5 py-0.5">
                    <Text className="text-white text-xs font-bold">Active</Text>
                  </View>
                )}
              </View>

              <View className="flex-row items-center gap-2 mt-1 pl-12">
                {role ? (
                  <View
                    className="rounded-xl px-2.5 py-1"
                    style={{ backgroundColor: rStyle.bg }}
                  >
                    <Text className="text-xs font-semibold capitalize" style={{ color: rStyle.color }}>
                      {role}
                    </Text>
                  </View>
                ) : null}
                {item.memberCount != null && (
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="people-outline" size={11} color="#94a3b8" />
                    <Text className="text-slate-400 dark:text-slate-500 text-xs">{item.memberCount} members</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Create Team Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white dark:bg-slate-900 rounded-t-3xl px-5 pt-6 pb-12 border-t border-slate-200 dark:border-slate-700">
            <View className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full self-center mb-5" />
            <Text className="text-xl font-bold text-slate-900 dark:text-white mb-5">Create Team</Text>

            <Text className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Team Name *</Text>
            <TextInput
              value={teamName}
              onChangeText={setTeamName}
              placeholder="e.g. Design Team"
              placeholderTextColor="#94a3b8"
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl px-4 py-3.5 text-slate-900 dark:text-white mb-4"
            />

            <Text className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Description</Text>
            <TextInput
              value={teamDescription}
              onChangeText={setTeamDescription}
              placeholder="What does this team work on?"
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl px-4 py-3.5 text-slate-900 dark:text-white mb-6"
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />

            <View className="flex-row gap-3">
              <Button label="Cancel" onPress={() => setShowCreate(false)} variant="secondary" style={{ flex: 1 }} />
              <Button label="Create" onPress={handleCreate} loading={createMutation.isPending} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Members Modal */}
      <Modal visible={showMembers} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View
            className="bg-white dark:bg-slate-900 rounded-t-3xl px-5 pt-6 pb-12 border-t border-slate-200 dark:border-slate-700"
            style={{ maxHeight: '80%' }}
          >
            <View className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full self-center mb-5" />
            <View className="flex-row justify-between items-center mb-5">
              <View>
                <Text className="text-xl font-bold text-slate-900 dark:text-white">{activeTeam?.name}</Text>
                <Text className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Team members</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowMembers(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center"
              >
                <Ionicons name="close" size={16} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Invite row */}
            <View className="flex-row gap-2 mb-5">
              <TextInput
                value={inviteEmail}
                onChangeText={setInviteEmail}
                placeholder="Invite by email"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl px-4 py-3 text-slate-900 dark:text-white flex-1"
              />
              <TouchableOpacity
                onPress={handleInvite}
                disabled={!inviteEmail.trim() || inviteMutation.isPending}
                className="bg-sky-500 rounded-2xl px-4 py-3 justify-center"
              >
                <Text className="text-white font-bold text-sm">
                  {inviteMutation.isPending ? '…' : 'Invite'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Members list */}
            <ScrollView showsVerticalScrollIndicator={false}>
              {membersQuery.isLoading ? (
                <Text className="text-slate-400 dark:text-slate-500 text-center py-6">Loading members…</Text>
              ) : (membersQuery.data as any[] ?? []).length === 0 ? (
                <Text className="text-slate-400 dark:text-slate-500 text-center py-6">No members yet</Text>
              ) : (
                (membersQuery.data as any[] ?? []).map((member: any) => {
                  const displayName = member.member?.name || member.member?.email || 'Unknown';
                  const displayEmail = member.member?.email || '';
                  const rStyle = getRoleStyle(member.role);
                  return (
                    <View key={member.id} className="flex-row items-center py-3.5 border-b border-slate-100 dark:border-slate-800">
                      <View className="w-10 h-10 rounded-full bg-sky-100 dark:bg-sky-900/40 items-center justify-center mr-3">
                        <Text className="text-sky-600 dark:text-sky-300 font-bold text-base">
                          {displayName[0].toUpperCase()}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-slate-900 dark:text-white font-medium text-sm">{displayName}</Text>
                        {displayEmail ? (
                          <Text className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">{displayEmail}</Text>
                        ) : null}
                      </View>
                      <View
                        className="rounded-xl px-2.5 py-1"
                        style={{ backgroundColor: rStyle.bg }}
                      >
                        <Text className="text-xs font-semibold capitalize" style={{ color: rStyle.color }}>
                          {member.role || 'member'}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
