import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  RefreshControl,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { trpc } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { LoadingScreen } from '@/components/LoadingScreen';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { format } from 'date-fns';

const C = {
  bg: '#020617',
  surface: '#0f172a',
  card: '#1e293b',
  border: 'rgba(51,65,85,0.7)',
  text: '#f8fafc',
  muted: '#94a3b8',
  subtle: '#475569',
  amber: '#f59e0b',
  emerald: '#10b981',
  rose: '#f43f5e',
};

export default function ConferenceRoomScreen() {
  const { user } = useAuthStore();
  const [selectedApproval, setSelectedApproval] = useState<any>(null);

  const utils = trpc.useUtils();

  const approvalsQuery = trpc.approvals.getPending.useQuery(undefined, { enabled: !!user?.id });

  const approveMutation = trpc.approvals.approve.useMutation({
    onSuccess: () => { utils.approvals.getPending.invalidate(); setSelectedApproval(null); },
    onError: (err) => Alert.alert('Error', err.message),
  });

  const rejectMutation = trpc.approvals.reject.useMutation({
    onSuccess: () => { utils.approvals.getPending.invalidate(); setSelectedApproval(null); },
    onError: (err) => Alert.alert('Error', err.message),
  });

  const handleDecision = (approved: boolean) => {
    if (!selectedApproval) return;
    Alert.alert(
      approved ? 'Approve' : 'Reject',
      `${approved ? 'Approve' : 'Reject'} "${selectedApproval.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: approved ? 'Approve ✅' : 'Reject ❌',
          style: approved ? 'default' : 'destructive',
          onPress: () => {
            approved
              ? approveMutation.mutate({ approvalId: selectedApproval.id })
              : rejectMutation.mutate({ approvalId: selectedApproval.id });
          },
        },
      ]
    );
  };

  const approvals = (approvalsQuery.data as any[] ?? []);

  if (approvalsQuery.isLoading && !approvalsQuery.data) return <LoadingScreen />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
        <Text style={{ color: C.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.3 }}>
          Conference Room
        </Text>
        <Text style={{ color: C.muted, fontSize: 13, marginTop: 3 }}>
          Pending approvals awaiting your decision
        </Text>
      </View>

      {/* Pending count banner */}
      {approvals.length > 0 ? (
        <View style={{
          marginHorizontal: 20,
          marginBottom: 16,
          backgroundColor: 'rgba(217,119,6,0.1)',
          borderWidth: 1,
          borderColor: 'rgba(245,158,11,0.35)',
          borderRadius: 16,
          padding: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}>
          <Text style={{ fontSize: 24 }}>⏳</Text>
          <View>
            <Text style={{ color: C.amber, fontWeight: '700', fontSize: 15 }}>
              {approvals.length} pending {approvals.length === 1 ? 'approval' : 'approvals'}
            </Text>
            <Text style={{ color: 'rgba(245,158,11,0.6)', fontSize: 12, marginTop: 1 }}>
              Review each item and vote to proceed
            </Text>
          </View>
        </View>
      ) : null}

      {/* Approvals list */}
      <FlatList
        data={approvals}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={approvalsQuery.isFetching} onRefresh={() => approvalsQuery.refetch()} tintColor="#0ea5e9" />
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        ListEmptyComponent={
          <EmptyState title="All clear!" description="No pending approvals. The team is in sync." icon="🏛️" />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setSelectedApproval(item)}
            activeOpacity={0.8}
            style={{
              backgroundColor: C.card,
              borderRadius: 16,
              padding: 16,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: 'rgba(245,158,11,0.2)',
              borderLeftWidth: 3,
              borderLeftColor: C.amber,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 15, flex: 1, marginRight: 8 }} numberOfLines={2}>
                {item.title}
              </Text>
              <Badge label="Pending" variant="warning" />
            </View>
            {item.description ? (
              <Text style={{ color: C.muted, fontSize: 13, marginBottom: 10 }} numberOfLines={2}>{item.description}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {(item.fromStage || item.toStage) ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: C.subtle, fontSize: 12 }}>{item.fromStage}</Text>
                  <Text style={{ color: C.subtle, fontSize: 12 }}>→</Text>
                  <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600' }}>{item.toStage}</Text>
                </View>
              ) : null}
              {item.createdAt ? (
                <Text style={{ color: C.subtle, fontSize: 11 }}>
                  {format(new Date(item.createdAt), 'MMM d, yyyy')}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Detail Modal */}
      <Modal visible={!!selectedApproval} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: C.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 20,
            paddingTop: 24,
            paddingBottom: 32,
            borderTopWidth: 1,
            borderTopColor: C.border,
            maxHeight: '88%',
          }}>
            {/* Drag handle */}
            <View style={{ width: 36, height: 4, backgroundColor: C.card, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header row */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <Text style={{ color: C.text, fontSize: 20, fontWeight: '800', flex: 1, marginRight: 12, letterSpacing: -0.3 }}>
                  {selectedApproval?.title}
                </Text>
                <TouchableOpacity onPress={() => setSelectedApproval(null)} style={{ padding: 4 }}>
                  <Text style={{ color: C.subtle, fontSize: 18 }}>✕</Text>
                </TouchableOpacity>
              </View>

              {selectedApproval?.description ? (
                <Text style={{ color: C.muted, fontSize: 14, lineHeight: 20, marginBottom: 20 }}>
                  {selectedApproval.description}
                </Text>
              ) : null}

              {/* Stage transition */}
              {(selectedApproval?.fromStage || selectedApproval?.toStage) ? (
                <View style={{
                  backgroundColor: C.card,
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  borderWidth: 1,
                  borderColor: C.border,
                }}>
                  <Text style={{ fontSize: 20 }}>🔀</Text>
                  <View>
                    <Text style={{ color: C.subtle, fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                      Stage Transition
                    </Text>
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '600', marginTop: 3 }}>
                      {selectedApproval.fromStage} → {selectedApproval.toStage}
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Deliverables */}
              {selectedApproval?.deliverables?.length > 0 ? (
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ color: C.text, fontWeight: '700', fontSize: 15, marginBottom: 10 }}>
                    📎 Deliverables
                  </Text>
                  {selectedApproval.deliverables.map((d: any, idx: number) => (
                    <View key={d.id ?? idx} style={{
                      backgroundColor: C.card,
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      borderWidth: 1,
                      borderColor: C.border,
                    }}>
                      <Text style={{ color: C.muted, flex: 1, fontSize: 13 }}>{d.title ?? d.name}</Text>
                      {d.url ? (
                        <TouchableOpacity onPress={() => Linking.openURL(d.url)} style={{ paddingVertical: 4 }}>
                          <Text style={{ color: '#38bdf8', fontSize: 13, fontWeight: '600' }}>View →</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Handoff notes */}
              {selectedApproval?.notes ? (
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ color: C.text, fontWeight: '700', fontSize: 15, marginBottom: 10 }}>
                    📝 Notes
                  </Text>
                  <View style={{
                    backgroundColor: C.card,
                    borderRadius: 14,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: C.border,
                  }}>
                    <Text style={{ color: C.muted, fontSize: 14, lineHeight: 20 }}>
                      {selectedApproval.notes}
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Decision buttons */}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 4, paddingBottom: 8 }}>
                <Button
                  label="Reject"
                  onPress={() => handleDecision(false)}
                  variant="danger"
                  loading={rejectMutation.isPending}
                  style={{ flex: 1 }}
                />
                <Button
                  label="Approve ✅"
                  onPress={() => handleDecision(true)}
                  loading={approveMutation.isPending}
                  style={{ flex: 1, backgroundColor: '#059669' }}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
