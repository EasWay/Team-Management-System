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

export default function ConferenceRoomScreen() {
  const { user } = useAuthStore();
  const [selectedApproval, setSelectedApproval] = useState<any>(null);

  const utils = trpc.useUtils();

  const approvalsQuery = trpc.approvals.getPending.useQuery(undefined, { enabled: !!user?.id });

  const approveMutation = trpc.approvals.approve.useMutation({
    onSuccess: () => {
      utils.approvals.getPending.invalidate();
      setSelectedApproval(null);
    },
    onError: (err) => Alert.alert('Error', err.message),
  });

  const rejectMutation = trpc.approvals.reject.useMutation({
    onSuccess: () => {
      utils.approvals.getPending.invalidate();
      setSelectedApproval(null);
    },
    onError: (err) => Alert.alert('Error', err.message),
  });

  const handleDecision = (approved: boolean) => {
    if (!selectedApproval) return;
    Alert.alert(
      approved ? 'Approve' : 'Reject',
      `Are you sure you want to ${approved ? 'approve' : 'reject'} "${selectedApproval.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: approved ? 'Approve' : 'Reject',
          style: approved ? 'default' : 'destructive',
          onPress: () => {
            if (approved) {
              approveMutation.mutate({ approvalId: selectedApproval.id });
            } else {
              rejectMutation.mutate({ approvalId: selectedApproval.id });
            }
          },
        },
      ]
    );
  };

  const approvals = (approvalsQuery.data as any[] ?? []);

  if (approvalsQuery.isLoading && !approvalsQuery.data) return <LoadingScreen />;

  return (
    <SafeAreaView className="flex-1 bg-slate-900">
      {/* Header */}
      <View className="px-5 pt-4 pb-3">
        <Text className="text-2xl font-bold text-white">Conference Room</Text>
        <Text className="text-slate-400 text-sm mt-1">Pending approvals awaiting your decision</Text>
      </View>

      {/* Count badge */}
      {approvals.length > 0 && (
        <View className="mx-5 mb-4 bg-amber-900/30 border border-amber-600 rounded-xl p-3 flex-row items-center gap-3">
          <Text className="text-2xl">⏳</Text>
          <View>
            <Text className="text-amber-300 font-bold">{approvals.length} pending</Text>
            <Text className="text-amber-500 text-xs">Review and make decisions</Text>
          </View>
        </View>
      )}

      {/* Approvals list */}
      <FlatList
        data={approvals}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={approvalsQuery.isFetching}
            onRefresh={() => approvalsQuery.refetch()}
            tintColor="#0ea5e9"
          />
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        ListEmptyComponent={
          <EmptyState
            title="No pending approvals"
            description="You're all caught up! No decisions needed right now."
            icon="🏛️"
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setSelectedApproval(item)}
            className="bg-slate-800 rounded-xl p-4 mb-3 border border-amber-600/30"
          >
            <View className="flex-row justify-between items-start mb-2">
              <Text className="text-white font-semibold text-base flex-1 mr-2">{item.title}</Text>
              <Badge label="Pending" variant="warning" />
            </View>
            {item.description && (
              <Text className="text-slate-400 text-sm mb-3" numberOfLines={2}>{item.description}</Text>
            )}
            <View className="flex-row gap-3 items-center">
              <Text className="text-slate-500 text-xs">
                {item.fromStage} → {item.toStage}
              </Text>
              {item.createdAt && (
                <Text className="text-slate-600 text-xs">
                  {format(new Date(item.createdAt), 'MMM d')}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Detail Modal */}
      <Modal visible={!!selectedApproval} animationType="slide" transparent>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl px-5 pt-6 pb-10 border-t border-slate-700" style={{ maxHeight: '85%' }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Title */}
              <View className="flex-row justify-between items-start mb-4">
                <Text className="text-xl font-bold text-white flex-1 mr-2">
                  {selectedApproval?.title}
                </Text>
                <TouchableOpacity onPress={() => setSelectedApproval(null)}>
                  <Text className="text-slate-400 text-lg">✕</Text>
                </TouchableOpacity>
              </View>

              {selectedApproval?.description && (
                <Text className="text-slate-300 text-sm mb-5">{selectedApproval.description}</Text>
              )}

              {/* Stage info */}
              <View className="bg-slate-800 rounded-xl p-4 mb-4 flex-row items-center gap-3">
                <View className="flex-1">
                  <Text className="text-slate-400 text-xs mb-1">Stage Transition</Text>
                  <Text className="text-white font-medium">
                    {selectedApproval?.fromStage} → {selectedApproval?.toStage}
                  </Text>
                </View>
              </View>

              {/* Deliverables */}
              {selectedApproval?.deliverables?.length > 0 && (
                <View className="mb-5">
                  <Text className="text-white font-semibold mb-3">📎 Deliverables</Text>
                  {selectedApproval.deliverables.map((d: any, idx: number) => (
                    <View key={d.id ?? idx} className="bg-slate-800 rounded-xl p-3 mb-2 flex-row items-center gap-3">
                      <Text className="text-slate-300 flex-1 text-sm">{d.title ?? d.name}</Text>
                      {d.url && (
                        <TouchableOpacity onPress={() => Linking.openURL(d.url)}>
                          <Text className="text-sky-400 text-sm">View →</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Handoff notes */}
              {selectedApproval?.notes && (
                <View className="mb-5">
                  <Text className="text-white font-semibold mb-2">📝 Handoff Notes</Text>
                  <Text className="text-slate-300 text-sm bg-slate-800 rounded-xl p-4">
                    {selectedApproval.notes}
                  </Text>
                </View>
              )}

              {/* Actions */}
              <View className="flex-row gap-3 pt-2">
                <Button
                  label="❌ Reject"
                  onPress={() => handleDecision(false)}
                  variant="danger"
                  loading={approveMutation.isPending || rejectMutation.isPending}
                  style={{ flex: 1 }}
                />
                <Button
                  label="✅ Approve"
                  onPress={() => handleDecision(true)}
                  loading={approveMutation.isPending || rejectMutation.isPending}
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
