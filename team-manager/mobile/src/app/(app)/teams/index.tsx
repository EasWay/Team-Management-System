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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { trpc } from '@/lib/api';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';
import { LoadingScreen } from '@/components/LoadingScreen';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';

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

  // My teams only — so switching team always stays within user's memberships
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
      Alert.alert('Success', `Invitation sent to ${inviteEmail}`);
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
    <SafeAreaView className="flex-1 bg-slate-900">
      {/* Header */}
      <View className="px-5 pt-4 pb-3 flex-row justify-between items-center">
        <View>
          <Text className="text-2xl font-bold text-white">Teams</Text>
          <Text className="text-slate-400 text-sm mt-0.5">Your team memberships</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowCreate(true)}
          className="bg-sky-600 rounded-xl px-4 py-2"
        >
          <Text className="text-white font-semibold">+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Active team banner */}
      {activeTeam && (
        <View className="mx-5 mb-4 bg-sky-900/40 border border-sky-700 rounded-2xl p-4">
          <View className="flex-row items-center gap-2 mb-1">
            <View className="w-6 h-6 rounded-full bg-sky-500 items-center justify-center">
              <Ionicons name="checkmark" size={14} color="#fff" />
            </View>
            <Text className="text-sky-300 text-xs font-semibold uppercase tracking-wider">Active Team</Text>
          </View>
          <Text className="text-white font-bold text-lg">{activeTeam.name}</Text>
          <View className="flex-row gap-2 mt-3">
            <TouchableOpacity
              onPress={() => setShowMembers(true)}
              className="bg-sky-700/60 border border-sky-600 rounded-lg px-3 py-1.5 flex-row items-center gap-1.5"
            >
              <Ionicons name="people-outline" size={13} color="#7dd3fc" />
              <Text className="text-sky-200 text-xs font-medium">Members</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Connection error banner */}
      {teamsQuery.error && !teamsQuery.isFetching && (
        <View className="mx-5 mb-3 bg-red-900/40 border border-red-700 rounded-2xl p-4">
          <View className="flex-row items-center gap-2 mb-1">
            <Ionicons name="cloud-offline-outline" size={16} color="#f87171" />
            <Text className="text-red-400 text-sm font-semibold">Connection failed</Text>
          </View>
          <Text className="text-red-300 text-xs mb-3" numberOfLines={2}>
            {(teamsQuery.error as any)?.message ?? 'Could not reach the server.'}
          </Text>
          <TouchableOpacity
            onPress={() => teamsQuery.refetch()}
            className="bg-red-700/50 rounded-lg px-3 py-2 self-start"
          >
            <Text className="text-red-200 text-xs font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Team list */}
      <FlatList
        data={teams}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={teamsQuery.isFetching} onRefresh={() => teamsQuery.refetch()} tintColor="#0ea5e9" />
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        ListEmptyComponent={
          teamsQuery.isLoading ? null : (
            <EmptyState
              title="No teams yet"
              description="Create a team or ask someone to invite you."
              icon="people-outline"
              iconColor="#475569"
            />
          )
        }
        renderItem={({ item }) => {
          const isActive = activeTeam?.id === item.id;
          return (
            <TouchableOpacity
              onPress={() => setActiveTeam(item)}
              className={`rounded-2xl p-4 mb-3 border ${
                isActive ? 'bg-sky-900/40 border-sky-600' : 'bg-slate-800 border-slate-700'
              }`}
            >
              <View className="flex-row justify-between items-start">
                <View className="flex-1">
                  <Text className="text-white font-semibold text-base">{item.name}</Text>
                  {item.description ? (
                    <Text className="text-slate-400 text-sm mt-1" numberOfLines={2}>{item.description}</Text>
                  ) : null}
                </View>
                {isActive && (
                  <View className="bg-sky-600 rounded-full px-2 py-0.5 ml-2">
                    <Text className="text-white text-xs font-bold">Active</Text>
                  </View>
                )}
              </View>
              <View className="flex-row items-center gap-2 mt-2">
                {(item.memberRole || item.role) && (
                  <Badge label={item.memberRole || item.role} variant="primary" />
                )}
                {item.memberCount != null && (
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="people-outline" size={12} color="#64748b" />
                    <Text className="text-slate-500 text-xs">{item.memberCount}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Create Team Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl px-5 pt-6 pb-10 border-t border-slate-700">
            <Text className="text-xl font-bold text-white mb-5">Create Team</Text>

            <Text className="text-slate-400 text-sm mb-1">Team Name *</Text>
            <TextInput
              value={teamName}
              onChangeText={setTeamName}
              placeholder="e.g. Design Team"
              placeholderTextColor="#475569"
              className="bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white mb-4"
            />

            <Text className="text-slate-400 text-sm mb-1">Description</Text>
            <TextInput
              value={teamDescription}
              onChangeText={setTeamDescription}
              placeholder="What does this team work on?"
              placeholderTextColor="#475569"
              multiline
              numberOfLines={3}
              className="bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white mb-6"
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
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl px-5 pt-6 pb-10 border-t border-slate-700" style={{ maxHeight: '80%' }}>
            <View className="flex-row justify-between items-center mb-5">
              <Text className="text-xl font-bold text-white">{activeTeam?.name} Members</Text>
              <TouchableOpacity onPress={() => setShowMembers(false)}>
                <Text className="text-sky-400 font-semibold">Done</Text>
              </TouchableOpacity>
            </View>

            {/* Invite */}
            <View className="flex-row gap-2 mb-5">
              <TextInput
                value={inviteEmail}
                onChangeText={setInviteEmail}
                placeholder="Invite by email"
                placeholderTextColor="#475569"
                keyboardType="email-address"
                autoCapitalize="none"
                className="bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white flex-1"
              />
              <TouchableOpacity
                onPress={handleInvite}
                disabled={!inviteEmail.trim()}
                className="bg-sky-600 rounded-xl px-4 py-3 justify-center"
              >
                <Text className="text-white font-semibold">Invite</Text>
              </TouchableOpacity>
            </View>

            {/* Members list */}
            <ScrollView>
              {(membersQuery.data as any[] ?? []).map((member: any) => (
                <View key={member.id} className="flex-row items-center py-3 border-b border-slate-800">
                  <View className="w-10 h-10 rounded-full bg-sky-700 items-center justify-center mr-3">
                    <Text className="text-white font-bold text-base">
                      {(member.name || member.email || 'U')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-medium">{member.name || member.email}</Text>
                    <Text className="text-slate-400 text-sm">{member.email}</Text>
                  </View>
                  <Badge label={member.role || 'member'} variant="default" />
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
