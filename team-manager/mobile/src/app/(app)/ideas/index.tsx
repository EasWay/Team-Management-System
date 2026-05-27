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
  StyleSheet,
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

// Left border accent color per priority
const PRIORITY_BORDER: Record<string, string> = {
  critical: '#f43f5e',
  high: '#f59e0b',
  medium: '#0ea5e9',
  low: '#334155',
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
    <SafeAreaView style={styles.root}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>💡 Ideas Inbox</Text>
        {activeTeam && (
          <Text style={styles.headerSub}>{activeTeam.name}</Text>
        )}
      </View>

      {/* ── Stats row ── */}
      {stats && (
        <View style={styles.statsRow}>
          {([
            { label: 'Inbox', value: stats.inbox, color: '#38bdf8', bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.2)' },
            { label: 'Reviewing', value: stats.reviewing, color: '#fbbf24', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
            { label: 'Conference', value: stats.sentToConference, color: '#a78bfa', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.2)' },
          ] as const).map((s) => (
            <View
              key={s.label}
              style={[styles.statCard, { backgroundColor: s.bg, borderColor: s.border }]}
            >
              <Text style={[styles.statValue, { color: s.color }]}>{s.value ?? 0}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Status filter tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsContent}
      >
        {STATUS_TABS.map((tab) => {
          const isActive = statusFilter === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setStatusFilter(tab.key)}
              style={[styles.tab, isActive && styles.tabActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Ideas list ── */}
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
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            title="No ideas here"
            description="Ideas submitted via the Telegram bot will appear here."
            icon="💡"
          />
        }
        renderItem={({ item }) => {
          const borderColor = PRIORITY_BORDER[item.priority] ?? '#334155';
          return (
            <TouchableOpacity
              onPress={() => { setSelectedIdea(item); setPmNotes(item.pmNotes ?? ''); }}
              activeOpacity={0.75}
              style={styles.ideaCardWrapper}
            >
              {/* Priority left accent */}
              <View style={[styles.ideaCardAccent, { backgroundColor: borderColor }]} />

              <View style={styles.ideaCardBody}>
                {/* Title row */}
                <View style={styles.ideaTitleRow}>
                  <Text style={styles.ideaEmoji}>{CATEGORY_EMOJI[item.category] ?? '💡'}</Text>
                  <Text style={styles.ideaTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                </View>

                {/* Summary */}
                <Text style={styles.ideaSummary} numberOfLines={2}>
                  {item.summary}
                </Text>

                {/* Footer */}
                <View style={styles.ideaFooter}>
                  <View style={styles.ideaFooterLeft}>
                    <Badge label={item.category} variant="default" />
                    {item.submitter && (
                      <Text style={styles.ideaSubmitter}>
                        {item.submitter.telegramFirstName ?? item.submitter.telegramUsername ?? 'Unknown'}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.ideaDate}>
                    {item.createdAt ? format(new Date(item.createdAt), 'MMM d') : ''}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* ─── Idea Detail Modal ─────────────────────────────────────────────── */}
      <Modal visible={!!selectedIdea} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, styles.detailSheet]}>
            <View style={styles.dragHandle} />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailScroll}>
              {/* Header */}
              <View style={styles.detailHeader}>
                <View style={styles.detailHeaderLeft}>
                  <Text style={styles.detailTitle}>{selectedIdea?.title}</Text>
                  <View style={styles.detailBadgeRow}>
                    <Badge
                      label={selectedIdea?.priority ?? ''}
                      variant={PRIORITY_VARIANT[selectedIdea?.priority] ?? 'default'}
                    />
                    <View style={{ width: 6 }} />
                    <Badge label={selectedIdea?.category ?? ''} variant="default" />
                  </View>
                </View>
                <TouchableOpacity onPress={() => setSelectedIdea(null)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Submitter info + WhatsApp */}
              {selectedIdea?.submitter && (
                <View style={styles.submitterCard}>
                  <Text style={styles.sectionLabel}>SUBMITTED BY</Text>
                  <View style={styles.submitterRow}>
                    <View>
                      <Text style={styles.submitterName}>
                        {selectedIdea.submitter.telegramFirstName ?? selectedIdea.submitter.telegramUsername ?? 'Unknown'}
                      </Text>
                      {selectedIdea.submitter.telegramUsername && (
                        <Text style={styles.submitterHandle}>
                          @{selectedIdea.submitter.telegramUsername}
                        </Text>
                      )}
                    </View>
                    {selectedIdea.submitter.whatsappNumber ? (
                      <TouchableOpacity
                        onPress={handleOpenWhatsApp}
                        style={styles.whatsappBtn}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.whatsappBtnText}>💬 WhatsApp</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.noWhatsapp}>
                        <Text style={styles.noWhatsappText}>No WhatsApp</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* AI Summary */}
              <View style={styles.aiSummaryCard}>
                <Text style={styles.aiSummaryLabel}>🧠 AI SUMMARY</Text>
                <Text style={styles.aiSummaryText}>{selectedIdea?.summary}</Text>
              </View>

              {/* Refined description */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>REFINED DESCRIPTION</Text>
                <Text style={styles.sectionText}>{selectedIdea?.refinedDescription}</Text>
              </View>

              {/* Estimated impact */}
              {selectedIdea?.estimatedImpact && (
                <View style={styles.impactCard}>
                  <Text style={styles.impactLabel}>Estimated Impact</Text>
                  <Text style={styles.impactText}>{selectedIdea.estimatedImpact}</Text>
                </View>
              )}

              {/* Suggested next steps */}
              {selectedIdea?.suggestedNextSteps?.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>SUGGESTED NEXT STEPS</Text>
                  {(selectedIdea.suggestedNextSteps as string[]).map((step: string, i: number) => (
                    <View key={i} style={styles.stepRow}>
                      <Text style={styles.stepNum}>{i + 1}.</Text>
                      <Text style={styles.stepText}>{step}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* PM Notes */}
              <Text style={[styles.sectionLabel, { marginBottom: 8 }]}>YOUR NOTES</Text>
              <TextInput
                value={pmNotes}
                onChangeText={setPmNotes}
                placeholder="Add your thoughts, questions, or decisions..."
                placeholderTextColor="#475569"
                multiline
                numberOfLines={4}
                style={styles.notesInput}
              />

              {/* Actions */}
              <View style={styles.detailActions}>
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
                    style={{ backgroundColor: '#7c3aed', marginTop: 10 }}
                  />
                )}

                <Button
                  label="📦 Archive"
                  onPress={handleArchive}
                  variant="ghost"
                  fullWidth
                  style={{ marginTop: 10 }}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── Send to Conference Modal ───────────────────────────────────────── */}
      <Modal visible={showConferenceModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.dragHandle} />

            <Text style={styles.conferenceTitle}>🏛️ Send to Conference Room</Text>
            <Text style={styles.conferenceSubtitle}>
              Write your refined summary. The whole team will be notified and able to deliberate.
            </Text>

            <Text style={styles.inputLabel}>YOUR REFINED POSITION *</Text>
            <TextInput
              value={conferenceNotes}
              onChangeText={setConferenceNotes}
              placeholder="Summarize your take on this idea and what you'd like to discuss..."
              placeholderTextColor="#475569"
              multiline
              numberOfLines={6}
              style={[styles.input, styles.conferenceInput]}
            />

            <View style={styles.conferenceActions}>
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020617',
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 3,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 3,
    fontWeight: '600',
  },

  // Tabs
  tabsScroll: {
    marginBottom: 12,
  },
  tabsContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 40,
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: '#ffffff',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#0f172a',
  },

  // Ideas list
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  ideaCardWrapper: {
    backgroundColor: 'rgba(30,41,59,0.8)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(51,65,85,0.6)',
    marginBottom: 12,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  ideaCardAccent: {
    width: 3,
  },
  ideaCardBody: {
    flex: 1,
    padding: 16,
  },
  ideaTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  ideaEmoji: {
    fontSize: 17,
    lineHeight: 22,
  },
  ideaTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.2,
    lineHeight: 21,
  },
  ideaSummary: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 19,
    marginBottom: 12,
  },
  ideaFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ideaFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
  },
  ideaSubmitter: {
    fontSize: 12,
    color: '#64748b',
  },
  ideaDate: {
    fontSize: 11,
    color: '#475569',
    marginLeft: 8,
  },

  // Modals shared
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
  detailSheet: {
    maxHeight: '92%',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
    alignSelf: 'center',
    marginBottom: 20,
  },

  // Detail modal
  detailScroll: {
    paddingBottom: 40,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  detailHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.4,
    lineHeight: 26,
    marginBottom: 10,
  },
  detailBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#64748b',
    fontSize: 16,
  },

  // Section helpers
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  sectionText: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 21,
  },
  section: {
    marginBottom: 20,
  },

  // Submitter card
  submitterCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(51,65,85,0.6)',
  },
  submitterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  submitterName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  submitterHandle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  whatsappBtn: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  whatsappBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  noWhatsapp: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  noWhatsappText: {
    color: '#475569',
    fontSize: 12,
  },

  // AI Summary
  aiSummaryCard: {
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.3)',
  },
  aiSummaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#a78bfa',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  aiSummaryText: {
    fontSize: 14,
    color: '#c4b5fd',
    lineHeight: 22,
  },

  // Impact
  impactCard: {
    backgroundColor: 'rgba(5,150,105,0.1)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.25)',
  },
  impactLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#34d399',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  impactText: {
    fontSize: 14,
    color: '#a7f3d0',
    lineHeight: 20,
  },

  // Steps
  stepRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  stepNum: {
    fontSize: 14,
    color: '#38bdf8',
    fontWeight: '700',
    width: 20,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 20,
  },

  // PM Notes input
  notesInput: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 110,
    marginBottom: 20,
  },
  detailActions: {
    marginBottom: 4,
  },

  // Conference modal
  conferenceTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  conferenceSubtitle: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 19,
    marginBottom: 24,
  },
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
  conferenceInput: {
    textAlignVertical: 'top',
    minHeight: 140,
  },
  conferenceActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
});
