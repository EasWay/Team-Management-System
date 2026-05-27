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
    <SafeAreaView className="flex-1 bg-slate-900">
      {/* Header */}
      <View className="px-5 pt-4 pb-3">
        <View className="flex-row justify-between items-center mb-3">
          <View>
            <Text className="text-2xl font-bold text-white">Projects</Text>
            {activeTeam && <Text className="text-slate-400 text-sm">{activeTeam.name}</Text>}
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => setShowIdeation(true)}
              className="bg-purple-600 rounded-xl px-3 py-2"
            >
              <Text className="text-white font-semibold text-sm">💡 Ideate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowCreate(true)}
              className="bg-sky-600 rounded-xl px-3 py-2"
            >
              <Text className="text-white font-semibold text-sm">+ New</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={projects}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={projectsQuery.isFetching} onRefresh={() => projectsQuery.refetch()} tintColor="#0ea5e9" />
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        ListEmptyComponent={
          <EmptyState title="No projects yet" description="Create a project or use the AI Idea Lab." icon="📁" />
        }
        renderItem={({ item }) => (
          <View className="bg-slate-800 rounded-xl p-4 mb-3 border border-slate-700">
            <View className="flex-row justify-between items-start mb-2">
              <Text className="text-white font-semibold text-base flex-1 mr-2">{item.name}</Text>
              {item.workflowStage && (
                <Badge
                  label={item.workflowStage}
                  variant={STAGE_COLORS[item.workflowStage] ?? 'default'}
                />
              )}
            </View>
            {item.description ? (
              <Text className="text-slate-400 text-sm mb-3" numberOfLines={2}>{item.description}</Text>
            ) : null}
            {/* Evaluation score */}
            {item.evaluationData?.overallScore != null && (
              <View className="flex-row items-center gap-2">
                <Text className="text-slate-500 text-xs">QA Score:</Text>
                <Text className="text-emerald-400 text-xs font-bold">
                  {item.evaluationData.overallScore}%
                </Text>
              </View>
            )}
          </View>
        )}
      />

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl px-5 pt-6 pb-10 border-t border-slate-700">
            <Text className="text-xl font-bold text-white mb-5">New Project</Text>

            <Text className="text-slate-400 text-sm mb-1">Title *</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Project name"
              placeholderTextColor="#475569"
              className="bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white mb-4"
            />

            <Text className="text-slate-400 text-sm mb-1">Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What is this project about?"
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

      {/* Idea Lab Modal */}
      <Modal visible={showIdeation} animationType="slide" transparent>
        <View className="flex-1 bg-black/60 justify-end">
          <ScrollView
            contentContainerStyle={{ justifyContent: 'flex-end', flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="bg-slate-900 rounded-t-3xl px-5 pt-6 pb-10 border-t border-slate-700 max-h-screen">
              <Text className="text-xl font-bold text-white mb-1">💡 Idea Lab</Text>
              <Text className="text-slate-400 text-sm mb-4">
                Paste your WhatsApp / Slack brainstorming chat and let AI extract a project plan.
              </Text>

              {!aiResult ? (
                <>
                  <TextInput
                    value={chatLogs}
                    onChangeText={setChatLogs}
                    placeholder="Paste chat logs here..."
                    placeholderTextColor="#475569"
                    multiline
                    numberOfLines={8}
                    className="bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white mb-5"
                    style={{ minHeight: 150, textAlignVertical: 'top' }}
                  />

                  {processingAI && (
                    <View className="items-center py-4 mb-4">
                      <ActivityIndicator color="#a78bfa" size="large" />
                      <Text className="text-purple-400 mt-3 font-medium">AI is thinking...</Text>
                    </View>
                  )}

                  <View className="flex-row gap-3">
                    <Button label="Cancel" onPress={() => { setShowIdeation(false); setAiResult(null); }} variant="secondary" style={{ flex: 1 }} />
                    <Button
                      label="Process"
                      onPress={handleProcessIdeation}
                      loading={processingAI}
                      style={{ flex: 1, backgroundColor: '#7c3aed' }}
                    />
                  </View>
                </>
              ) : (
                <>
                  <View className="bg-slate-800 rounded-xl p-4 mb-4 border border-purple-500/30">
                    <Text className="text-purple-400 font-bold mb-2">AI Analysis</Text>
                    <Text className="text-white font-semibold mb-1">{aiResult.projectName ?? 'Unnamed Project'}</Text>
                    {aiResult.summary && (
                      <Text className="text-slate-300 text-sm mb-3">{aiResult.summary}</Text>
                    )}
                    {aiResult.speakers?.length > 0 && (
                      <Text className="text-slate-400 text-xs">
                        Participants: {aiResult.speakers.join(', ')}
                      </Text>
                    )}
                  </View>

                  <View className="flex-row gap-3">
                    <Button label="Discard" onPress={() => setAiResult(null)} variant="secondary" style={{ flex: 1 }} />
                    <Button
                      label="Activate Project"
                      onPress={handleActivate}
                      loading={activateMutation.isPending}
                      style={{ flex: 1, backgroundColor: '#059669' }}
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
