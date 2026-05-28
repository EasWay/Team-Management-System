import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  RefreshControl,
  Linking,
} from 'react-native';
import { Alert } from '@/components/CustomAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { trpc } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { LoadingScreen } from '@/components/LoadingScreen';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/Button';
import { format } from 'date-fns';

function StageChip({ label, variant }: { label: string; variant?: 'from' | 'to' }) {
  const isTo = variant === 'to';
  return (
    <View
      className={`rounded-xl px-3 py-1 ${
        isTo ? 'bg-sky-100 dark:bg-sky-900/40' : 'bg-slate-100 dark:bg-slate-700'
      }`}
    >
      <Text
        className={`text-xs font-semibold capitalize ${
          isTo ? 'text-sky-600 dark:text-sky-300' : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {label}
      </Text>
    </View>
  );
}

export default function ConferenceRoomScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [selectedApproval, setSelectedApproval] = useState<any>(null);

  const utils = trpc.useUtils();
  const approvalsQuery = trpc.approvals.getPending.useQuery(undefined, { enabled: !!user?.id });

  const approveMutation = trpc.approvals.approve.useMutation({
    onSuccess: () => {
      utils.approvals.getPending.invalidate();
      setSelectedApproval(null);
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const rejectMutation = trpc.approvals.reject.useMutation({
    onSuccess: () => {
      utils.approvals.getPending.invalidate();
      setSelectedApproval(null);
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const handleDecision = (approved: boolean) => {
    if (!selectedApproval) return;
    Alert.alert(
      approved ? 'Approve' : 'Reject',
      `${approved ? 'Approve' : 'Reject'} "${selectedApproval.title}"?`,
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
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">

      {/* Header */}
      <View className="px-5 pt-5 pb-4 flex-row items-center gap-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={18} color="#64748b" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-2xl font-bold text-slate-900 dark:text-white">Approvals</Text>
          <Text className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Stage gate decisions</Text>
        </View>
      </View>

      {/* Pending banner */}
      {approvals.length > 0 && (
        <View className="mx-5 mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-600/50 rounded-2xl p-4 flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-800/40 items-center justify-center">
            <Ionicons name="hourglass-outline" size={20} color="#f59e0b" />
          </View>
          <View>
            <Text className="text-amber-700 dark:text-amber-300 font-bold text-base">
              {approvals.length} awaiting decision
            </Text>
            <Text className="text-amber-500 dark:text-amber-400 text-xs mt-0.5">Review and approve or reject</Text>
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
            title="All caught up!"
            description="No pending approvals right now."
            icon="checkmark-done-circle-outline"
            iconColor="#34d399"
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setSelectedApproval(item)}
            className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-3 border border-slate-200 dark:border-slate-700"
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 }}
          >
            <View className="flex-row items-start justify-between gap-2 mb-3">
              <Text className="text-slate-900 dark:text-white font-semibold text-base flex-1 leading-snug">
                {item.title}
              </Text>
              <View className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-600/50 rounded-xl px-2.5 py-0.5">
                <Text className="text-amber-600 dark:text-amber-300 text-xs font-bold">Pending</Text>
              </View>
            </View>

            {item.description && (
              <Text className="text-slate-500 dark:text-slate-400 text-sm mb-3 leading-5" numberOfLines={2}>
                {item.description}
              </Text>
            )}

            <View className="flex-row items-center gap-2">
              {item.fromStage && <StageChip label={item.fromStage} variant="from" />}
              {item.fromStage && item.toStage && (
                <Ionicons name="arrow-forward" size={12} color="#94a3b8" />
              )}
              {item.toStage && <StageChip label={item.toStage} variant="to" />}
              {item.createdAt && (
                <Text className="text-slate-400 dark:text-slate-500 text-xs ml-auto">
                  {format(new Date(item.createdAt), 'MMM d')}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Detail Modal */}
      <Modal visible={!!selectedApproval} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View
            className="bg-white dark:bg-slate-900 rounded-t-3xl px-5 pt-6 pb-12 border-t border-slate-200 dark:border-slate-700"
            style={{ maxHeight: '88%' }}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full self-center mb-5" />

              {/* Title row */}
              <View className="flex-row justify-between items-start mb-4">
                <Text className="text-xl font-bold text-slate-900 dark:text-white flex-1 mr-3 leading-snug">
                  {selectedApproval?.title}
                </Text>
                <TouchableOpacity
                  onPress={() => setSelectedApproval(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center"
                >
                  <Ionicons name="close" size={16} color="#64748b" />
                </TouchableOpacity>
              </View>

              {selectedApproval?.description && (
                <Text className="text-slate-600 dark:text-slate-300 text-sm leading-6 mb-5">
                  {selectedApproval.description}
                </Text>
              )}

              {/* Stage transition card */}
              {(selectedApproval?.fromStage || selectedApproval?.toStage) && (
                <View className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 mb-5 border border-slate-100 dark:border-slate-700">
                  <Text className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">
                    Stage Transition
                  </Text>
                  <View className="flex-row items-center gap-3">
                    {selectedApproval?.fromStage && <StageChip label={selectedApproval.fromStage} variant="from" />}
                    <Ionicons name="arrow-forward" size={16} color="#94a3b8" />
                    {selectedApproval?.toStage && <StageChip label={selectedApproval.toStage} variant="to" />}
                  </View>
                </View>
              )}

              {/* Deliverables */}
              {selectedApproval?.deliverables?.length > 0 && (
                <View className="mb-5">
                  <Text className="text-slate-900 dark:text-white font-semibold text-sm mb-3">
                    Deliverables ({selectedApproval.deliverables.length})
                  </Text>
                  {selectedApproval.deliverables.map((d: any, idx: number) => (
                    <View
                      key={d.id ?? idx}
                      className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-3.5 mb-2 flex-row items-center gap-3 border border-slate-100 dark:border-slate-700"
                    >
                      <View className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-900/30 items-center justify-center">
                        <Ionicons name="document-outline" size={15} color="#38bdf8" />
                      </View>
                      <Text className="text-slate-700 dark:text-slate-200 flex-1 text-sm">{d.title ?? d.name}</Text>
                      {d.url && (
                        <TouchableOpacity onPress={() => Linking.openURL(d.url)}>
                          <Text className="text-sky-500 text-sm font-semibold">View</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Handoff notes */}
              {selectedApproval?.notes && (
                <View className="mb-5">
                  <Text className="text-slate-900 dark:text-white font-semibold text-sm mb-3">Handoff Notes</Text>
                  <View className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                    <Text className="text-slate-600 dark:text-slate-300 text-sm leading-6">{selectedApproval.notes}</Text>
                  </View>
                </View>
              )}

              {/* Action buttons */}
              <View className="flex-row gap-3 pt-2">
                <TouchableOpacity
                  onPress={() => handleDecision(false)}
                  disabled={rejectMutation.isPending || approveMutation.isPending}
                  className="flex-1 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-600/50 rounded-2xl py-4 items-center"
                >
                  <Text className="text-red-500 dark:text-red-300 font-bold text-sm">
                    {rejectMutation.isPending ? '…' : 'Reject'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDecision(true)}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                  className="flex-1 bg-emerald-500 rounded-2xl py-4 items-center"
                  style={{ shadowColor: '#10b981', shadowRadius: 8, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 3 } }}
                >
                  <Text className="text-white font-bold text-sm">
                    {approveMutation.isPending ? '…' : 'Approve'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
