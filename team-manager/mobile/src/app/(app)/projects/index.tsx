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
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { trpc } from '@/lib/api';
import { useTeamStore } from '@/store/teamStore';
import { LoadingScreen } from '@/components/LoadingScreen';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';

const STAGE_COLORS: Record<string, 'primary' | 'warning' | 'success' | 'danger' | 'default'> = {
  ideation: 'primary',
  planning: 'info' as any,
  development: 'warning',
  review: 'info' as any,
  qa: 'warning',
  completed: 'success',
  archived: 'default',
};

// Dot color per workflow stage
const STAGE_DOT_COLOR: Record<string, string> = {
  ideation: '#8b5cf6',    // violet
  planning: '#0ea5e9',    // sky
  development: '#f59e0b', // amber
  review: '#f97316',      // orange
  qa: '#a855f7',          // purple
  completed: '#10b981',   // emerald
  archived: '#64748b',    // slate
};

export default function ProjectsScreen() {
  const { activeTeam } = useTeamStore();
  const [showCreate, setShowCreate] = useState(false);
  const [showIdeation, setShowIdeation] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [chatLogs, setChatLogs] = useState('');
  const [processingAI, setProcessingAI] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  const utils = trpc.useUtils();

  const projectsQuery = trpc.projects.list.useQuery(
    { teamId: activeTeam?.id ?? 0 },
    { enabled: !!activeTeam?.id }
  );

  const createMutation = trpc.projects.create.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      setShowCreate(false);
      setTitle('');
      setDescription('');
    },
    onError: (err) => Alert.alert('Error', err.message),
  });

  const ideationMutation = trpc.projects.processIdeation.useMutation({
    onSuccess: (data) => {
      setAiResult(data);
      setProcessingAI(false);
    },
    onError: (err) => {
      Alert.alert('AI Error', err.message);
      setProcessingAI(false);
    },
  });

  const activateMutation = trpc.projects.activateProject.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      setShowIdeation(false);
      setAiResult(null);
      setChatLogs('');
      Alert.alert('Success', 'Project activated from your brainstorming session!');
    },
    onError: (err) => Alert.alert('Error', err.message),
  });

  const handleCreate = () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Project title is required.');
      return;
    }
    createMutation.mutate({
      name: title.trim(),
      description: description.trim(),
      teamId: activeTeam!.id,
    });
  };

  const handleProcessIdeation = () => {
    if (!chatLogs.trim()) {
      Alert.alert('Required', 'Paste your brainstorming chat first.');
      return;
    }
    setProcessingAI(true);
    setAiResult(null);
    ideationMutation.mutate({ chatLogs: chatLogs.trim() });
  };

  const handleActivate = () => {
    if (!aiResult || !activeTeam?.id) return;
    activateMutation.mutate({
      teamId: activeTeam.id,
      ideationResult: {
        chatLogs: chatLogs,
        speakers: aiResult.speakers ?? [],
        aiAnalysis: aiResult.aiAnalysis ?? null,
        finalDecisionReport: aiResult.finalDecisionReport ?? null,
      },
    });
  };

  const projects = (projectsQuery.data as any[] ?? []);

  if (projectsQuery.isLoading && !projectsQuery.data) return <LoadingScreen />;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Projects</Text>
          {activeTeam && (
            <Text style={styles.headerSubtext}>{activeTeam.name}</Text>
          )}
        </View>
        <View style={styles.headerActions}>
          {/* Idea Lab icon button */}
          <TouchableOpacity
            onPress={() => setShowIdeation(true)}
            style={styles.ideaButton}
            activeOpacity={0.8}
          >
            <Text style={styles.ideaButtonIcon}>💡</Text>
          </TouchableOpacity>
          {/* New project pill */}
          <TouchableOpacity
            onPress={() => setShowCreate(true)}
            style={styles.newButton}
            activeOpacity={0.8}
          >
            <Text style={styles.newButtonText}>+ New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Project list */}
      <FlatList
        data={projects}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={projectsQuery.isFetching}
            onRefresh={() => projectsQuery.refetch()}
            tintColor="#0ea5e9"
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            title="No projects yet"
            description="Create a project or use the AI Idea Lab."
            icon="📁"
          />
        }
        renderItem={({ item }) => {
          const dotColor = STAGE_DOT_COLOR[item.workflowStage] ?? '#64748b';
          return (
            <View style={styles.projectCard}>
              {/* Top row: name + chevron */}
              <View style={styles.projectTopRow}>
                <Text style={styles.projectName} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.projectChevron}>›</Text>
              </View>

              {/* Stage indicator */}
              {item.workflowStage && (
                <View style={styles.stageRow}>
                  <View style={[styles.stageDot, { backgroundColor: dotColor }]} />
                  <Text style={[styles.stageText, { color: dotColor }]}>
                    {item.workflowStage.charAt(0).toUpperCase() + item.workflowStage.slice(1)}
                  </Text>
                </View>
              )}

              {/* Description */}
              {item.description ? (
                <Text style={styles.projectDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}

              {/* QA Score badge */}
              {item.evaluationData?.overallScore != null && (
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreBadgeLabel}>QA Score</Text>
                  <Text style={styles.scoreBadgeValue}>
                    {item.evaluationData.overallScore}%
                  </Text>
                </View>
              )}
            </View>
          );
        }}
      />

      {/* Create Project Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.dragHandle} />

            <Text style={styles.modalTitle}>New Project</Text>

            <Text style={styles.fieldLabel}>NAME *</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Project name"
              placeholderTextColor="#475569"
              style={styles.textInput}
            />

            <Text style={styles.fieldLabel}>DESCRIPTION</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What is this project about?"
              placeholderTextColor="#475569"
              multiline
              numberOfLines={3}
              style={[styles.textInput, styles.textInputMultiline]}
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

      {/* Idea Lab Modal */}
      <Modal visible={showIdeation} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={{ justifyContent: 'flex-end', flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.ideaModalSheet}>
              <View style={styles.dragHandle} />

              {/* Idea Lab header */}
              <View style={styles.ideaLabHeader}>
                <Text style={styles.ideaLabTitle}>💡 Idea Lab</Text>
                <View style={styles.ideaLabBadge}>
                  <Text style={styles.ideaLabBadgeText}>AI</Text>
                </View>
              </View>
              <Text style={styles.ideaLabSubtext}>
                Paste your WhatsApp / Slack brainstorming chat and let AI extract a project plan.
              </Text>

              {!aiResult ? (
                <>
                  <Text style={styles.fieldLabel}>CHAT LOGS</Text>
                  <TextInput
                    value={chatLogs}
                    onChangeText={setChatLogs}
                    placeholder="Paste chat logs here..."
                    placeholderTextColor="#475569"
                    multiline
                    numberOfLines={8}
                    style={[styles.textInput, styles.chatLogsInput]}
                  />

                  {processingAI && (
                    <View style={styles.aiLoadingContainer}>
                      <ActivityIndicator color="#8b5cf6" size="large" />
                      <Text style={styles.aiLoadingText}>AI is thinking...</Text>
                    </View>
                  )}

                  <View style={styles.modalActions}>
                    <Button
                      label="Cancel"
                      onPress={() => { setShowIdeation(false); setAiResult(null); }}
                      variant="secondary"
                      style={{ flex: 1 }}
                    />
                    <Button
                      label="Process"
                      onPress={handleProcessIdeation}
                      loading={processingAI}
                      style={[{ flex: 1 }, styles.processButton]}
                    />
                  </View>
                </>
              ) : (
                <>
                  {/* AI Result card */}
                  <View style={styles.aiResultCard}>
                    <View style={styles.aiResultHeader}>
                      <View style={styles.aiResultDot} />
                      <Text style={styles.aiResultLabel}>AI Analysis</Text>
                    </View>
                    <Text style={styles.aiResultProjectName}>
                      {aiResult.projectName ?? 'Unnamed Project'}
                    </Text>
                    {aiResult.summary && (
                      <Text style={styles.aiResultSummary}>{aiResult.summary}</Text>
                    )}
                    {aiResult.speakers?.length > 0 && (
                      <View style={styles.aiResultParticipants}>
                        <Text style={styles.aiResultParticipantsLabel}>Participants: </Text>
                        <Text style={styles.aiResultParticipantsValue}>
                          {aiResult.speakers.join(', ')}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.modalActions}>
                    <Button
                      label="Discard"
                      onPress={() => setAiResult(null)}
                      variant="secondary"
                      style={{ flex: 1 }}
                    />
                    <Button
                      label="Activate Project"
                      onPress={handleActivate}
                      loading={activateMutation.isPending}
                      style={[{ flex: 1 }, styles.activateButton]}
                    />
                  </View>
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#020617',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f8fafc',
    letterSpacing: -0.5,
  },
  headerSubtext: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ideaButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#5b21b6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ideaButtonIcon: {
    fontSize: 20,
  },
  newButton: {
    backgroundColor: '#0ea5e9',
    borderRadius: 100,
    paddingHorizontal: 18,
    paddingVertical: 11,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },

  // Project list
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },

  // Project card
  projectCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(51,65,85,0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  projectTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  projectName: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
    lineHeight: 24,
  },
  projectChevron: {
    color: '#475569',
    fontSize: 22,
    fontWeight: '300',
    marginTop: 1,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  stageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stageText: {
    fontSize: 12,
    fontWeight: '500',
  },
  projectDescription: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: 'rgba(16,185,129,0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
  },
  scoreBadgeLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '500',
  },
  scoreBadgeValue: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '700',
  },

  // Modal shared
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: 'rgba(51,65,85,0.6)',
  },
  ideaModalSheet: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: 'rgba(51,65,85,0.6)',
  },
  dragHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },

  // Idea Lab header
  ideaLabHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  ideaLabTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
    letterSpacing: -0.3,
  },
  ideaLabBadge: {
    backgroundColor: 'rgba(139,92,246,0.2)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.4)',
  },
  ideaLabBadgeText: {
    color: '#a78bfa',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  ideaLabSubtext: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },

  // Form fields
  fieldLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: '#f8fafc',
    fontSize: 15,
    marginBottom: 16,
  },
  textInputMultiline: {
    minHeight: 88,
    textAlignVertical: 'top',
    paddingTop: 13,
  },
  chatLogsInput: {
    minHeight: 150,
    textAlignVertical: 'top',
    paddingTop: 13,
  },

  // AI processing
  aiLoadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 8,
  },
  aiLoadingText: {
    color: '#a78bfa',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 12,
  },

  // AI result card
  aiResultCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#8b5cf6',
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: 'rgba(51,65,85,0.6)',
    borderRightColor: 'rgba(51,65,85,0.6)',
    borderBottomColor: 'rgba(51,65,85,0.6)',
  },
  aiResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 10,
  },
  aiResultDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8b5cf6',
  },
  aiResultLabel: {
    color: '#a78bfa',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  aiResultProjectName: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    lineHeight: 22,
  },
  aiResultSummary: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  aiResultParticipants: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  aiResultParticipantsLabel: {
    color: '#64748b',
    fontSize: 12,
  },
  aiResultParticipantsValue: {
    color: '#94a3b8',
    fontSize: 12,
  },

  // Special buttons
  processButton: {
    backgroundColor: '#7c3aed',
  },
  activateButton: {
    backgroundColor: '#059669',
  },
});
