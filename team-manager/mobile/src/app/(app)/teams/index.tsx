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
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { trpc } from '@/lib/api';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';
import { LoadingScreen } from '@/components/LoadingScreen';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';

// Deterministic avatar color per first letter
const AVATAR_COLORS: Record<string, string> = {
  A: '#0284c7', B: '#7c3aed', C: '#059669', D: '#d97706', E: '#e11d48',
  F: '#0284c7', G: '#7c3aed', H: '#059669', I: '#d97706', J: '#e11d48',
  K: '#0284c7', L: '#7c3aed', M: '#059669', N: '#d97706', O: '#e11d48',
  P: '#0284c7', Q: '#7c3aed', R: '#059669', S: '#d97706', T: '#e11d48',
  U: '#0284c7', V: '#7c3aed', W: '#059669', X: '#d97706', Y: '#e11d48',
  Z: '#0284c7',
};

function avatarColor(name: string): string {
  const letter = (name || 'U')[0].toUpperCase();
  return AVATAR_COLORS[letter] ?? '#0284c7';
}

export default function TeamsScreen() {
  const { activeTeam, setActiveTeam } = useTeamStore();
  const { user } = useAuthStore();
  const [showCreate, setShowCreate] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  const utils = trpc.useUtils();

  const teamsQuery = trpc.teams.listAll.useQuery();
  const membersQuery = trpc.teams.getMembers.useQuery(
    { teamId: activeTeam?.id ?? 0 },
    { enabled: !!activeTeam?.id && showMembers }
  );

  const createMutation = trpc.teams.create.useMutation({
    onSuccess: () => {
      utils.teams.listAll.invalidate();
      setShowCreate(false);
      setTeamName('');
      setTeamDescription('');
    },
    onError: (err) => Alert.alert('Error', err.message),
  });

  const inviteMutation = trpc.teams.createInvitation.useMutation({
    onSuccess: () => {
      Alert.alert('Success', `Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
    },
    onError: (err) => Alert.alert('Error', err.message),
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
    <SafeAreaView style={styles.root}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Workspaces</Text>
          <Text style={styles.headerSub}>{teams.length} workspace{teams.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowCreate(true)}
          style={styles.createBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.createBtnText}>+ Create</Text>
        </TouchableOpacity>
      </View>

      {/* ── Active workspace banner ── */}
      {activeTeam && (
        <View style={styles.activeBanner}>
          <View style={styles.activeBannerAccent} />
          <View style={styles.activeBannerBody}>
            <Text style={styles.activeBannerLabel}>ACTIVE WORKSPACE</Text>
            <Text style={styles.activeBannerName}>{activeTeam.name}</Text>
            {activeTeam.description ? (
              <Text style={styles.activeBannerDesc} numberOfLines={2}>
                {activeTeam.description}
              </Text>
            ) : null}
            <TouchableOpacity
              onPress={() => setShowMembers(true)}
              style={styles.viewMembersBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.viewMembersBtnText}>👥 View Members</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Team list ── */}
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
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            title="No workspaces yet"
            description="Create your first workspace to get started."
            icon="👥"
          />
        }
        renderItem={({ item }) => {
          const isActive = activeTeam?.id === item.id;
          return (
            <TouchableOpacity
              onPress={() => setActiveTeam(item)}
              activeOpacity={0.75}
              style={[styles.teamCard, isActive && styles.teamCardActive]}
            >
              {/* Left content */}
              <View style={styles.teamCardInner}>
                <View style={styles.teamCardText}>
                  <Text style={styles.teamCardName}>{item.name}</Text>
                  {item.description ? (
                    <Text style={styles.teamCardDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                  {item.role ? (
                    <View style={styles.teamCardBadgeRow}>
                      <Badge label={item.role} variant="primary" />
                    </View>
                  ) : null}
                </View>

                {/* Right indicator */}
                <View style={styles.teamCardIndicator}>
                  {isActive ? (
                    <Text style={styles.checkActive}>✓</Text>
                  ) : (
                    <Text style={styles.checkInactive}>○</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* ── Create Workspace Modal ── */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* drag handle */}
            <View style={styles.dragHandle} />

            <Text style={styles.modalTitle}>New Workspace</Text>
            <Text style={styles.modalSubtitle}>Organize your team around a shared space.</Text>

            <Text style={styles.inputLabel}>WORKSPACE NAME *</Text>
            <TextInput
              value={teamName}
              onChangeText={setTeamName}
              placeholder="e.g. Design Team"
              placeholderTextColor="#475569"
              style={styles.input}
            />

            <Text style={styles.inputLabel}>DESCRIPTION</Text>
            <TextInput
              value={teamDescription}
              onChangeText={setTeamDescription}
              placeholder="What does this workspace work on?"
              placeholderTextColor="#475569"
              multiline
              numberOfLines={3}
              style={[styles.input, styles.inputMultiline]}
            />

            <View style={styles.modalActions}>
              <Button
                label="Cancel"
                onPress={() => setShowCreate(false)}
                variant="secondary"
                style={{ flex: 1 }}
              />
              <Button
                label="Create"
                onPress={handleCreate}
                loading={createMutation.isPending}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Members Modal ── */}
      <Modal visible={showMembers} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, styles.membersSheet]}>
            {/* drag handle */}
            <View style={styles.dragHandle} />

            <View style={styles.membersHeader}>
              <View>
                <Text style={styles.modalTitle}>{activeTeam?.name}</Text>
                <Text style={styles.membersSubtitle}>Team Members</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowMembers(false)}
                style={styles.doneBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>

            {/* Invite row */}
            <View style={styles.inviteRow}>
              <TextInput
                value={inviteEmail}
                onChangeText={setInviteEmail}
                placeholder="Invite by email address"
                placeholderTextColor="#475569"
                keyboardType="email-address"
                autoCapitalize="none"
                style={[styles.input, styles.inviteInput]}
              />
              <TouchableOpacity
                onPress={handleInvite}
                disabled={!inviteEmail.trim()}
                style={[
                  styles.inviteBtn,
                  !inviteEmail.trim() && styles.inviteBtnDisabled,
                ]}
                activeOpacity={0.8}
              >
                <Text style={styles.inviteBtnText}>Invite</Text>
              </TouchableOpacity>
            </View>

            {/* Members list */}
            <ScrollView showsVerticalScrollIndicator={false}>
              {(membersQuery.data as any[] ?? []).map((member: any) => {
                const displayName = member.name || member.email || 'U';
                const initials = displayName[0].toUpperCase();
                const bgColor = avatarColor(displayName);
                return (
                  <View key={member.id} style={styles.memberRow}>
                    <View style={[styles.avatar, { backgroundColor: bgColor }]}>
                      <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{member.name || member.email}</Text>
                      <Text style={styles.memberEmail}>{member.email}</Text>
                    </View>
                    <Badge label={member.role || 'member'} variant="default" />
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020617',
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  createBtn: {
    backgroundColor: '#0ea5e9',
    borderRadius: 999,
    paddingHorizontal: 18,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },

  // Active banner
  activeBanner: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.4)',
    backgroundColor: 'rgba(109,40,217,0.1)',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  activeBannerAccent: {
    width: 4,
    backgroundColor: '#8b5cf6',
  },
  activeBannerBody: {
    flex: 1,
    padding: 16,
  },
  activeBannerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#a78bfa',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  activeBannerName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  activeBannerDesc: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
    lineHeight: 18,
  },
  viewMembersBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.5)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  viewMembersBtnText: {
    color: '#c4b5fd',
    fontSize: 13,
    fontWeight: '600',
  },

  // Team list
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  teamCard: {
    backgroundColor: 'rgba(30,41,59,0.8)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(51,65,85,0.6)',
    padding: 20,
    marginBottom: 12,
  },
  teamCardActive: {
    borderColor: '#0ea5e9',
    backgroundColor: 'rgba(14,165,233,0.06)',
  },
  teamCardInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  teamCardText: {
    flex: 1,
  },
  teamCardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  teamCardDesc: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
    lineHeight: 18,
  },
  teamCardBadgeRow: {
    marginTop: 10,
    flexDirection: 'row',
  },
  teamCardIndicator: {
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
    width: 28,
  },
  checkActive: {
    fontSize: 20,
    color: '#38bdf8',
    fontWeight: '700',
  },
  checkInactive: {
    fontSize: 20,
    color: '#334155',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderColor: 'rgba(51,65,85,0.8)',
  },
  membersSheet: {
    maxHeight: '80%',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 20,
  },

  // Inputs
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: '#ffffff',
    fontSize: 15,
    marginBottom: 16,
  },
  inputMultiline: {
    textAlignVertical: 'top',
    minHeight: 90,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },

  // Members modal specifics
  membersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  membersSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  doneBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(14,165,233,0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.3)',
  },
  doneBtnText: {
    color: '#38bdf8',
    fontWeight: '700',
    fontSize: 14,
  },
  inviteRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    alignItems: 'center',
  },
  inviteInput: {
    flex: 1,
    marginBottom: 0,
  },
  inviteBtn: {
    backgroundColor: '#0ea5e9',
    borderRadius: 14,
    paddingHorizontal: 18,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteBtnDisabled: {
    backgroundColor: '#1e293b',
  },
  inviteBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,41,59,0.8)',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  memberEmail: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 1,
  },
});
