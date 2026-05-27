/**
 * PM Ideas Inbox
 *
 * The project manager sees all ideas submitted via the Telegram bot,
 * can review them, add notes, contact the originator on WhatsApp,
 * and send a refined idea to the Conference Room.
 */

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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { trpc } from '@/lib/api';
import { useTeamStore } from '@/store/teamStore';
import { LoadingScreen } from '@/components/LoadingScreen';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { format } from 'date-fns';

type IdeaStatus = 'inbox' | 'reviewing' | 'sent_to_conference' | 'archived' | 'all';

const PRIORITY_VARIANT: Record<string, 'danger' | 'warning' | 'primary' | 'default'> = {
  critical: 'danger',
  high: 'warning',
  medium: 'primary',
  low: 'default',
};

const CATEGORY_EMOJI: Record<string, string> = {
  product: '🛒',
  process: '⚙️',
  marketing: '📣',
  technical: '💻',
  other: '💡',
};

const STATUS_TABS: { key: IdeaStatus; label: string }[] = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'reviewing', label: 'Reviewing' },
  { key: 'sent_to_conference', label: 'In Conference' },
  { key: 'archived', label: 'Archived' },
  { key: 'all', label: 'All' },
];

export default function IdeasInboxScreen() {
  const { activeTeam } = useTeamStore();
  const [statusFilter, setStatusFilter] = useState<IdeaStatus>('inbox');
  const [selectedIdea, setSelectedIdea] = useState<any>(null);
  const [pmNotes, setPmNotes] = useState('');
  const [conferenceNotes, setConferenceNotes] = useState('');
  const [showConferenceModal, setShowConferenceModal] = useState(false);

  const utils = trpc.useUtils();

  const ideasQuery = trpc.ideas.list.useQuery(
    { teamId: activeTeam?.id ?? 0, status: statusFilter },
    { enabled: !!activeTeam?.id }
  );

  const statsQuery = trpc.ideas.stats.useQuery(
    { teamId: activeTeam?.id ?? 0 },
    { enabled: !!activeTeam?.id }
  );

  const updateMutation = trpc.ideas.update.useMutation({
    onSuccess: () => {
      utils.ideas.list.invalidate();
      utils.ideas.stats.invalidate();
    },
  });

  const sendToConferenceMutation = trpc.ideas.sendToConference.useMutation({
    onSuccess: ({ approvalId }) => {
      utils.ideas.list.invalidate();
      utils.ideas.stats.invalidate();
      setShowConferenceModal(false);
      setSelectedIdea(null);
      setConferenceNotes('');
      Alert.alert(
        '🏛️ Sent to Conference Room!',
        'All team members have been notified. The idea is now in the Conference Room for deliberation.',
        [{ text: 'Great!' }]
      );
    },
    onError: (err) => Alert.alert('Error', err.message),
  });

  const whatsAppQuery = trpc.ideas.getWhatsAppLink.useQuery(
    { ideaId: selectedIdea?.id ?? 0 },
    { enabled: !!selectedIdea?.id && !!selectedIdea?.submitter?.whatsappNumber }
  );

  const handleOpenWhatsApp = () => {
    if (whatsAppQuery.data?.url) {
      // Mark as reviewing when PM contacts originator
      if (selectedIdea?.status === 'inbox') {
        updateMutation.mutate({ id: selectedIdea.id, status: 'reviewing' });
      }
      Linking.openURL(whatsAppQuery.data.url);
    }
  };

  const handleSaveNotes = () => {
    if (!selectedIdea) return;
    updateMutation.mutate({ id: selectedIdea.id, pmNotes, status: 'reviewing' });
    Alert.alert('Saved', 'Notes saved.');
  };

  const handleArchive = () => {
    if (!selectedIdea) return;
    Alert.alert('Archive', 'Remove this idea from your active inbox?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        onPress: () => {
          updateMutation.mutate({ id: selectedIdea.id, status: 'archived' });
          setSelectedIdea(null);
        },
      },
    ]);
  };

  const handleSendToConference = () => {
    if (!conferenceNotes.trim()) {
      Alert.alert('Required', 'Add your refined notes before sending to the Conference Room.');
      return;
    }
    sendToConferenceMutation.mutate({
      ideaId: selectedIdea.id,
      pmNotes: conferenceNotes,
    });
  };

  const ideas = (ideasQuery.data as any[] ?? []);
  const stats = statsQuery.data as any;

  if (ideasQuery.isLoading && !ideasQuery.data) return <LoadingScreen />;

  return (
    <SafeAreaView className="flex-1 bg-slate-900">
      {/* Header */}
      <View className="px-5 pt-4 pb-3">
        <Text className="text-2xl font-bold text-white">💡 Ideas Inbox</Text>
        {activeTeam && <Text className="text-slate-400 text-sm">{activeTeam.name}</Text>}
      </View>

      {/* Stats row */}
      {stats && (
        <View className="flex-row gap-3 px-5 mb-4">
          {[
            { label: 'Inbox', value: stats.inbox, color: 'text-sky-400' },
            { label: 'Reviewing', value: stats.reviewing, color: 'text-amber-400' },
            { label: 'Conference', value: stats.sentToConference, color: 'text-purple-400' },
          ].map((s) => (
            <View key={s.label} className="flex-1 bg-slate-800 rounded-xl p-3 border border-slate-700 items-center">
              <Text className={`text-xl font-bold ${s.color}`}>{s.value}</Text>
              <Text className="text-slate-400 text-xs mt-0.5">{s.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Status filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-3"
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
      >
        {STATUS_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setStatusFilter(tab.key)}
            className={`px-4 py-2 rounded-xl border ${
              statusFilter === tab.key
                ? 'bg-sky-600 border-sky-500'
                : 'bg-slate-800 border-slate-700'
            }`}
          >
            <Text className={`text-sm font-medium ${statusFilter === tab.key ? 'text-white' : 'text-slate-300'}`}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Ideas list */}
      <FlatList
        data={ideas}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={ideasQuery.isFetching}
            onRefresh={() => { ideasQuery.refetch(); statsQuery.refetch(); }}
            tintColor="#0ea5e9"
          />
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        ListEmptyComponent={
          <EmptyState
            title="No ideas here"
            description="Ideas submitted via the Telegram bot will appear here."
            icon="💡"
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => { setSelectedIdea(item); setPmNotes(item.pmNotes ?? ''); }}
            className="bg-slate-800 rounded-xl p-4 mb-3 border border-slate-700"
          >
            <View className="flex-row justify-between items-start mb-2">
              <View className="flex-row items-center gap-2 flex-1 mr-2">
                <Text className="text-lg">{CATEGORY_EMOJI[item.category] ?? '💡'}</Text>
                <Text className="text-white font-semibold text-base flex-1" numberOfLines={2}>
                  {item.title}
                </Text>
              </View>
              <Badge label={item.priority} variant={PRIORITY_VARIANT[item.priority] ?? 'default'} />
            </View>

            <Text className="text-slate-400 text-sm mb-3" numberOfLines={2}>{item.summary}</Text>

            <View className="flex-row justify-between items-center">
              <View className="flex-row gap-2 flex-wrap">
                <Badge label={item.category} variant="default" />
                {item.submitter && (
                  <Text className="text-slate-500 text-xs self-center">
                    by {item.submitter.telegramFirstName ?? item.submitter.telegramUsername ?? 'Unknown'}
                  </Text>
                )}
              </View>
              <Text className="text-slate-600 text-xs">
                {item.createdAt ? format(new Date(item.createdAt), 'MMM d') : ''}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* ─── Idea Detail Modal ─────────────────────────────────────────────── */}
      <Modal visible={!!selectedIdea} animationType="slide" transparent>
        <View className="flex-1 bg-black/60 justify-end">
          <View
            className="bg-slate-900 rounded-t-3xl px-5 pt-6 border-t border-slate-700"
            style={{ maxHeight: '92%' }}
          >
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {/* Header */}
              <View className="flex-row justify-between items-start mb-4">
                <View className="flex-1 mr-3">
                  <Text className="text-xl font-bold text-white">{selectedIdea?.title}</Text>
                  <View className="flex-row gap-2 mt-2 flex-wrap">
                    <Badge label={selectedIdea?.priority ?? ''} variant={PRIORITY_VARIANT[selectedIdea?.priority] ?? 'default'} />
                    <Badge label={selectedIdea?.category ?? ''} variant="default" />
                  </View>
                </View>
                <TouchableOpacity onPress={() => setSelectedIdea(null)}>
                  <Text className="text-slate-400 text-xl">✕</Text>
                </TouchableOpacity>
              </View>

              {/* Submitter info + WhatsApp */}
              {selectedIdea?.submitter && (
                <View className="bg-slate-800 rounded-xl p-4 mb-4 border border-slate-700">
                  <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                    Submitted by
                  </Text>
                  <View className="flex-row justify-between items-center">
                    <View>
                      <Text className="text-white font-semibold">
                        {selectedIdea.submitter.telegramFirstName ?? selectedIdea.submitter.telegramUsername ?? 'Unknown'}
                      </Text>
                      {selectedIdea.submitter.telegramUsername && (
                        <Text className="text-slate-400 text-sm">@{selectedIdea.submitter.telegramUsername}</Text>
                      )}
                    </View>
                    {selectedIdea.submitter.whatsappNumber ? (
                      <TouchableOpacity
                        onPress={handleOpenWhatsApp}
                        className="bg-emerald-600 rounded-xl px-4 py-2 flex-row items-center gap-2"
                      >
                        <Text className="text-white text-sm font-bold">💬 WhatsApp</Text>
                      </TouchableOpacity>
                    ) : (
                      <View className="bg-slate-700 rounded-xl px-3 py-2">
                        <Text className="text-slate-400 text-xs">No WhatsApp</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* AI Summary */}
              <View className="bg-slate-800 rounded-xl p-4 mb-4 border border-purple-500/20">
                <Text className="text-purple-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  🧠 AI Summary
                </Text>
                <Text className="text-slate-300 text-sm leading-relaxed">{selectedIdea?.summary}</Text>
              </View>

              {/* Refined description */}
              <View className="mb-4">
                <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Refined Description
                </Text>
                <Text className="text-slate-200 text-sm leading-relaxed">{selectedIdea?.refinedDescription}</Text>
              </View>

              {/* Estimated impact */}
              {selectedIdea?.estimatedImpact && (
                <View className="bg-emerald-900/20 border border-emerald-700/30 rounded-xl p-3 mb-4">
                  <Text className="text-emerald-400 text-xs font-semibold mb-1">Estimated Impact</Text>
                  <Text className="text-slate-300 text-sm">{selectedIdea.estimatedImpact}</Text>
                </View>
              )}

              {/* Suggested next steps */}
              {selectedIdea?.suggestedNextSteps?.length > 0 && (
                <View className="mb-4">
                  <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                    Suggested Next Steps
                  </Text>
                  {(selectedIdea.suggestedNextSteps as string[]).map((step, i) => (
                    <View key={i} className="flex-row gap-2 mb-1.5">
                      <Text className="text-sky-400 text-sm">{i + 1}.</Text>
                      <Text className="text-slate-300 text-sm flex-1">{step}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* PM Notes */}
              <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                Your Notes
              </Text>
              <TextInput
                value={pmNotes}
                onChangeText={setPmNotes}
                placeholder="Add your thoughts, questions, or decisions..."
                placeholderTextColor="#475569"
                multiline
                numberOfLines={4}
                className="bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white mb-4"
                style={{ textAlignVertical: 'top', minHeight: 100 }}
              />

              {/* Actions */}
              <View className="gap-3">
                <Button
                  label="💾 Save Notes"
                  onPress={handleSaveNotes}
                  loading={updateMutation.isPending}
                  variant="secondary"
                  fullWidth
                />

                {selectedIdea?.status !== 'sent_to_conference' && (
                  <Button
                    label="🏛️ Send to Conference Room"
                    onPress={() => { setConferenceNotes(pmNotes); setShowConferenceModal(true); }}
                    fullWidth
                    style={{ backgroundColor: '#7c3aed' }}
                  />
                )}

                <Button
                  label="📦 Archive"
                  onPress={handleArchive}
                  variant="ghost"
                  fullWidth
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── Send to Conference Modal ───────────────────────────────────────── */}
      <Modal visible={showConferenceModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl px-5 pt-6 pb-10 border-t border-slate-700">
            <Text className="text-xl font-bold text-white mb-2">🏛️ Send to Conference Room</Text>
            <Text className="text-slate-400 text-sm mb-5">
              Write your refined summary. The whole team will be notified and able to deliberate.
            </Text>

            <Text className="text-slate-400 text-sm mb-1">Your refined position *</Text>
            <TextInput
              value={conferenceNotes}
              onChangeText={setConferenceNotes}
              placeholder="Summarize your take on this idea and what you'd like to discuss..."
              placeholderTextColor="#475569"
              multiline
              numberOfLines={5}
              className="bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white mb-6"
              style={{ textAlignVertical: 'top', minHeight: 120 }}
            />

            <View className="flex-row gap-3">
              <Button
                label="Cancel"
                onPress={() => setShowConferenceModal(false)}
                variant="secondary"
                style={{ flex: 1 }}
              />
              <Button
                label="Send 🚀"
                onPress={handleSendToConference}
                loading={sendToConferenceMutation.isPending}
                style={{ flex: 1, backgroundColor: '#7c3aed' }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
