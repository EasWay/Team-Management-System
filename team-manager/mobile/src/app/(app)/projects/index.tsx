import { useState, useMemo } from 'react';
import { ProjectGridSkeleton } from '@/components/Skeleton';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { trpc } from '@/lib/api';
import { useTeamStore } from '@/store/teamStore';
import { Button } from '@/components/Button';
import { format } from 'date-fns';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - 20 * 2 - 12) / 2;

const COVER_PALETTES = [
  { bg: '#0c2340', accent: '#38bdf8', icon: 'layers-outline'       as IconName },
  { bg: '#1a0a2e', accent: '#a78bfa', icon: 'analytics-outline'    as IconName },
  { bg: '#0a2318', accent: '#34d399', icon: 'code-slash-outline'   as IconName },
  { bg: '#2a1200', accent: '#fb923c', icon: 'bulb-outline'         as IconName },
  { bg: '#1c0a1c', accent: '#f472b6', icon: 'color-palette-outline' as IconName },
  { bg: '#0f1f2a', accent: '#67e8f9', icon: 'globe-outline'        as IconName },
  { bg: '#1e1a00', accent: '#fbbf24', icon: 'bar-chart-outline'    as IconName },
  { bg: '#120a0a', accent: '#f87171', icon: 'shield-outline'       as IconName },
];

function coverPalette(name: string) {
  const idx = (name?.charCodeAt(0) ?? 0) % COVER_PALETTES.length;
  return COVER_PALETTES[idx];
}

const STAGE_META: Record<string, { label: string; color: string; bg: string }> = {
  ideation:    { label: 'Ideation',   color: '#a78bfa', bg: '#4c1d9520' },
  planning:    { label: 'Planning',   color: '#67e8f9', bg: '#0e748020' },
  development: { label: 'In Dev',     color: '#fb923c', bg: '#c2410c20' },
  review:      { label: 'In Review',  color: '#38bdf8', bg: '#0369a120' },
  qa:          { label: 'QA',         color: '#fbbf24', bg: '#92400e20' },
  completed:   { label: 'Completed',  color: '#34d399', bg: '#06503020' },
  archived:    { label: 'Archived',   color: '#64748b', bg: '#1e293b40' },
};

function StageBadge({ stage }: { stage?: string }) {
  if (!stage) return null;
  const meta = STAGE_META[stage] ?? { label: stage, color: '#94a3b8', bg: '#1e293b40' };
  return (
    <View style={{ backgroundColor: meta.bg, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color: meta.color, fontSize: 10, fontWeight: '700' }}>{meta.label}</Text>
    </View>
  );
}

type FilterKey = 'all' | 'active' | 'completed' | 'archived';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'active',    label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'archived',  label: 'Archived' },
];

function filterProjects(projects: any[], filter: FilterKey, search: string) {
  let list = projects;
  if (search.trim()) {
    const q = search.toLowerCase();
    list = list.filter((p) => p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
  }
  switch (filter) {
    case 'active':    return list.filter((p) => !['completed', 'archived'].includes(p.workflowStage));
    case 'completed': return list.filter((p) => p.workflowStage === 'completed');
    case 'archived':  return list.filter((p) => p.workflowStage === 'archived');
    default:          return list;
  }
}

function ProjectCard({ item, onPress }: { item: any; onPress: () => void }) {
  const palette = coverPalette(item.name ?? '');
  const dateStr = item.createdAt ? format(new Date(item.createdAt), 'MMM d, yyyy') : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{ width: CARD_WIDTH }}
      className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 mb-3"
    >
      {/* Cover — intentionally dark/branded regardless of theme */}
      <View style={{ height: 110, backgroundColor: palette.bg }} className="items-center justify-center">
        <View style={{
          width: '65%', height: '70%', borderRadius: 8,
          borderWidth: 1, borderColor: palette.accent + '40',
          backgroundColor: palette.accent + '0a',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name={palette.icon} size={28} color={palette.accent} />
        </View>
        {item.evaluationData?.overallScore != null && (
          <View className="absolute top-2 right-2 bg-emerald-900/80 rounded-lg px-1.5 py-0.5 flex-row items-center gap-1">
            <Ionicons name="checkmark-circle" size={10} color="#34d399" />
            <Text style={{ color: '#34d399', fontSize: 9, fontWeight: '700' }}>
              {item.evaluationData.overallScore}%
            </Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View className="p-3">
        <Text className="text-slate-900 dark:text-white font-bold text-sm mb-1" numberOfLines={1}>
          {item.name}
        </Text>
        {dateStr && (
          <View className="flex-row items-center gap-1 mb-2">
            <Ionicons name="calendar-outline" size={10} color="#94a3b8" />
            <Text className="text-slate-400 dark:text-slate-500" style={{ fontSize: 10 }}>{dateStr}</Text>
          </View>
        )}
        <StageBadge stage={item.workflowStage} />
      </View>
    </TouchableOpacity>
  );
}

export default function ProjectsScreen() {
  const { activeTeam } = useTeamStore();
  const [filter, setFilter]           = useState<FilterKey>('all');
  const [search, setSearch]           = useState('');
  const [showCreate, setShowCreate]     = useState(false);
  const [showIdeation, setShowIdeation] = useState(false);
  const [showDetail, setShowDetail]     = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [chatLogs, setChatLogs]       = useState('');
  const [processingAI, setProcessingAI] = useState(false);
  const [aiResult, setAiResult]       = useState<any>(null);

  const utils = trpc.useUtils();

  const projectDetailQuery = trpc.projects.getById.useQuery(
    { id: selectedProjectId ?? 0 },
    { enabled: !!selectedProjectId && showDetail }
  );

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
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const ideationMutation = trpc.projects.processIdeation.useMutation({
    onSuccess: (data: any) => { setAiResult(data); setProcessingAI(false); },
    onError: (err: any) => { Alert.alert('AI Error', err.message); setProcessingAI(false); },
  });

  const activateMutation = trpc.projects.activateProject.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      setShowIdeation(false);
      setAiResult(null);
      setChatLogs('');
      Alert.alert('Success', 'Project activated from your brainstorming session!');
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const allProjects = (projectsQuery.data as any[] ?? []);
  const displayed   = useMemo(() => filterProjects(allProjects, filter, search), [allProjects, filter, search]);

  const handleCreate = () => {
    if (!title.trim()) { Alert.alert('Required', 'Project title is required.'); return; }
    createMutation.mutate({ name: title.trim(), description: description.trim(), teamId: activeTeam!.id });
  };

  const handleProcessIdeation = () => {
    if (!chatLogs.trim()) { Alert.alert('Required', 'Paste your brainstorming chat first.'); return; }
    setProcessingAI(true);
    setAiResult(null);
    ideationMutation.mutate({ chatLogs: chatLogs.trim() });
  };

  const handleActivate = () => {
    if (!aiResult || !activeTeam?.id) return;
    activateMutation.mutate({
      teamId: activeTeam.id,
      ideationResult: {
        chatLogs,
        speakers: aiResult.speakers ?? [],
        aiAnalysis: aiResult.aiAnalysis ?? null,
        finalDecisionReport: aiResult.finalDecisionReport ?? null,
      },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900" edges={['top']}>

      {/* ── Header ── */}
      <View className="px-5 pt-5 pb-3 flex-row justify-between items-center">
        <View>
          <Text className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">
            {activeTeam?.name ?? 'No team'}
          </Text>
          <Text className="text-slate-900 dark:text-white text-2xl font-bold mt-0.5">Projects Library</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => setShowIdeation(true)}
            className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/60 border border-purple-200 dark:border-purple-700/60 items-center justify-center"
          >
            <Ionicons name="bulb-outline" size={18} color="#c084fc" />
          </TouchableOpacity>
          <TouchableOpacity className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 items-center justify-center">
            <Ionicons name="notifications-outline" size={18} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Search ── */}
      <View className="mx-5 mb-4 flex-row items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 h-11 gap-2">
        <Ionicons name="search-outline" size={16} color="#94a3b8" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search projects..."
          placeholderTextColor="#94a3b8"
          className="flex-1 text-slate-900 dark:text-white text-sm"
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Filter Tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-4"
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count = f.key === 'all'
            ? allProjects.length
            : filterProjects(allProjects, f.key, '').length;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-2xl flex-row items-center gap-1.5 border ${
                active
                  ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  active ? 'text-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {f.label}
              </Text>
              {count > 0 && (
                <View
                  className={`rounded-full min-w-5 h-5 items-center justify-center px-1 ${
                    active ? 'bg-white/20 dark:bg-slate-900/20' : 'bg-slate-100 dark:bg-slate-700'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      active ? 'text-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Grid ── */}
      {projectsQuery.isLoading && !projectsQuery.data ? (
        <View style={{ paddingTop: 12 }}>
          <ProjectGridSkeleton count={6} />
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 20 }}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={projectsQuery.isFetching}
              onRefresh={() => projectsQuery.refetch()}
              tintColor="#0ea5e9"
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-16 px-8">
              <View className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 items-center justify-center mb-4">
                <Ionicons name="folder-open-outline" size={32} color="#94a3b8" />
              </View>
              <Text className="text-slate-900 dark:text-white font-semibold text-lg mb-1">
                {search ? 'No results' : 'No projects yet'}
              </Text>
              <Text className="text-slate-400 dark:text-slate-500 text-sm text-center mb-6">
                {search
                  ? `No projects matching "${search}"`
                  : 'Create a project or use the AI Idea Lab to brainstorm one.'}
              </Text>
              {!search && (
                <TouchableOpacity
                  onPress={() => setShowCreate(true)}
                  className="bg-sky-500 rounded-2xl px-6 py-3"
                >
                  <Text className="text-white font-bold">+ New Project</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <ProjectCard
              item={item}
              onPress={() => {
                setSelectedProjectId(item.id);
                setShowDetail(true);
              }}
            />
          )}
        />
      )}

      {/* ── FAB ── */}
      <View className="absolute right-5" style={{ bottom: 90 }} pointerEvents="box-none">
        <TouchableOpacity
          onPress={() => setShowCreate(true)}
          activeOpacity={0.85}
          className="w-14 h-14 bg-sky-500 rounded-full items-center justify-center"
          style={{
            shadowColor: '#38bdf8',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.45,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Create Modal ── */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white dark:bg-slate-900 rounded-t-3xl px-5 pt-6 pb-12 border-t border-slate-200 dark:border-slate-700">
            <View className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full self-center mb-5" />
            <View className="flex-row items-center justify-between mb-5">
              <Text className="text-xl font-bold text-slate-900 dark:text-white">New Project</Text>
              <TouchableOpacity
                onPress={() => setShowCreate(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center"
              >
                <Ionicons name="close" size={16} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Title *</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Project name"
              placeholderTextColor="#94a3b8"
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl px-4 py-3.5 text-slate-900 dark:text-white mb-4"
            />

            <Text className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What is this project about?"
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl px-4 py-3.5 text-slate-900 dark:text-white mb-6"
              style={{ textAlignVertical: 'top', minHeight: 80 }}
            />

            <View className="flex-row gap-3">
              <Button label="Cancel" onPress={() => setShowCreate(false)} variant="secondary" style={{ flex: 1 }} />
              <Button label="Create" onPress={handleCreate} loading={createMutation.isPending} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Project Detail Modal ── */}
      <Modal visible={showDetail} animationType="slide" transparent onRequestClose={() => setShowDetail(false)}>
        <View className="flex-1 bg-black/60 justify-end">
          <View
            className="bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-700"
            style={{ maxHeight: '92%' }}
          >
            {/* Handle */}
            <View className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full self-center mt-4 mb-2" />

            {projectDetailQuery.isLoading ? (
              <View className="items-center justify-center py-16">
                <ActivityIndicator color="#38bdf8" size="large" />
                <Text className="text-slate-400 mt-3 text-sm">Loading project…</Text>
              </View>
            ) : (() => {
              const p = projectDetailQuery.data as any;
              if (!p) return (
                <View className="items-center justify-center py-16">
                  <Text className="text-slate-400">Project not found</Text>
                </View>
              );
              const palette = coverPalette(p.name ?? '');
              const stageMeta = STAGE_META[p.workflowStage] ?? STAGE_META.ideation;
              const evalScore = p.evaluationData?.overallScore;
              const deliverablesList: any[] = Array.isArray(p.deliverables) ? p.deliverables : [];
              const handoffList: any[] = Array.isArray(p.handoffHistory) ? p.handoffHistory : [];

              return (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                  {/* Cover header */}
                  <View style={{ height: 130, backgroundColor: palette.bg, borderRadius: 0 }} className="items-center justify-center relative">
                    <View style={{
                      width: 80, height: 80, borderRadius: 20,
                      borderWidth: 1, borderColor: palette.accent + '50',
                      backgroundColor: palette.accent + '15',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Ionicons name={palette.icon} size={36} color={palette.accent} />
                    </View>
                    {evalScore != null && (
                      <View className="absolute top-3 right-3 flex-row items-center gap-1 bg-emerald-900/80 rounded-xl px-2.5 py-1">
                        <Ionicons name="star" size={11} color="#34d399" />
                        <Text style={{ color: '#34d399', fontSize: 12, fontWeight: '700' }}>{evalScore}%</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      onPress={() => setShowDetail(false)}
                      className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/30 items-center justify-center"
                    >
                      <Ionicons name="close" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>

                  {/* Main info */}
                  <View className="px-5 pt-5">
                    <View className="flex-row items-start justify-between gap-2 mb-3">
                      <Text className="text-slate-900 dark:text-white text-xl font-bold flex-1 leading-tight">{p.name}</Text>
                      <View style={{ backgroundColor: stageMeta.bg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <Text style={{ color: stageMeta.color, fontSize: 11, fontWeight: '700' }}>{stageMeta.label}</Text>
                      </View>
                    </View>

                    {/* Dates */}
                    <View className="flex-row gap-4 mb-4">
                      {p.dateReceived && (
                        <View className="flex-row items-center gap-1.5">
                          <Ionicons name="calendar-outline" size={13} color="#94a3b8" />
                          <Text className="text-slate-400 dark:text-slate-500 text-xs">
                            Started {format(new Date(p.dateReceived), 'MMM d, yyyy')}
                          </Text>
                        </View>
                      )}
                      {p.dateEnded && (
                        <View className="flex-row items-center gap-1.5">
                          <Ionicons name="flag-outline" size={13} color="#94a3b8" />
                          <Text className="text-slate-400 dark:text-slate-500 text-xs">
                            Due {format(new Date(p.dateEnded), 'MMM d, yyyy')}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Description */}
                    {(p.description || p.definition) && (
                      <View className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 mb-4 border border-slate-200 dark:border-slate-700">
                        <Text className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">About</Text>
                        <Text className="text-slate-700 dark:text-slate-300 text-sm leading-5">
                          {p.definition || p.description}
                        </Text>
                      </View>
                    )}

                    {/* Evaluation scores */}
                    {p.evaluationData && (
                      <View className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-4 mb-4 border border-emerald-200 dark:border-emerald-700/40">
                        <Text className="text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3">QA Evaluation</Text>
                        {[
                          { label: 'Design', value: p.evaluationData.designAlignment },
                          { label: 'Business', value: p.evaluationData.businessAlignment },
                          { label: 'Technical', value: p.evaluationData.technicalQuality },
                          { label: 'Testing', value: p.evaluationData.testingProtocol },
                        ].filter(x => x.value != null).map((item) => (
                          <View key={item.label} className="mb-2">
                            <View className="flex-row justify-between mb-1">
                              <Text className="text-slate-600 dark:text-slate-400 text-xs">{item.label}</Text>
                              <Text className="text-emerald-600 dark:text-emerald-400 text-xs font-bold">{item.value}%</Text>
                            </View>
                            <View className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <View
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${item.value}%` }}
                              />
                            </View>
                          </View>
                        ))}
                        {p.evaluationData.readyForLaunch && (
                          <View className="flex-row items-center gap-1.5 mt-2">
                            <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                            <Text className="text-emerald-600 dark:text-emerald-400 text-xs font-bold">Ready for Launch</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Deliverables */}
                    {deliverablesList.length > 0 && (
                      <View className="mb-4">
                        <Text className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Deliverables</Text>
                        {deliverablesList.map((d: any, i: number) => (
                          <View key={i} className="flex-row items-center gap-3 bg-white dark:bg-slate-800 rounded-xl p-3 mb-2 border border-slate-200 dark:border-slate-700">
                            <View className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900/30 items-center justify-center">
                              <Ionicons
                                name={d.type === 'github' ? 'logo-github' : d.type === 'figma' ? 'color-palette-outline' : 'link-outline'}
                                size={14}
                                color="#38bdf8"
                              />
                            </View>
                            <View className="flex-1">
                              <Text className="text-slate-900 dark:text-white text-sm font-medium">{d.description || d.type}</Text>
                              {d.url && <Text className="text-sky-500 text-xs mt-0.5" numberOfLines={1}>{d.url}</Text>}
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Handoff history */}
                    {handoffList.length > 0 && (
                      <View className="mb-4">
                        <Text className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Handoff History</Text>
                        {handoffList.map((h: any, i: number) => (
                          <View key={i} className="flex-row items-start gap-3 mb-3">
                            <View className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/40 items-center justify-center mt-0.5">
                              <Ionicons name="arrow-forward" size={11} color="#a78bfa" />
                            </View>
                            <View className="flex-1">
                              <Text className="text-slate-700 dark:text-slate-300 text-sm font-medium">
                                {h.from} → {h.to}
                              </Text>
                              {h.comments && (
                                <Text className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">{h.comments}</Text>
                              )}
                              {h.timestamp && (
                                <Text className="text-slate-300 dark:text-slate-600 text-xs mt-0.5">
                                  {format(new Date(h.timestamp), 'MMM d, yyyy')}
                                </Text>
                              )}
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* AI ideation summary */}
                    {p.ideationData?.finalDecisionReport?.projectName && (
                      <View className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-4 mb-4 border border-purple-200 dark:border-purple-700/40">
                        <Text className="text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider mb-2">
                          AI Ideation Report
                        </Text>
                        <Text className="text-slate-700 dark:text-slate-300 text-sm leading-5">
                          {p.ideationData.finalDecisionReport.executiveSummary || 'No summary available.'}
                        </Text>
                        {p.ideationData.speakers?.length > 0 && (
                          <View className="flex-row flex-wrap gap-1.5 mt-3">
                            {p.ideationData.speakers.map((s: any, i: number) => (
                              <View key={i} className="bg-purple-100 dark:bg-purple-800/40 rounded-full px-2.5 py-1">
                                <Text className="text-purple-600 dark:text-purple-300 text-xs font-medium">
                                  {typeof s === 'string' ? s : s.name}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* ── Idea Lab Modal ── */}
      <Modal visible={showIdeation} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <ScrollView
            contentContainerStyle={{ justifyContent: 'flex-end', flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="bg-white dark:bg-slate-900 rounded-t-3xl px-5 pt-6 pb-12 border-t border-slate-200 dark:border-slate-700">
              <View className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full self-center mb-5" />
              <View className="flex-row items-center justify-between mb-1">
                <View className="flex-row items-center gap-2">
                  <View className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/60 border border-purple-200 dark:border-purple-700 items-center justify-center">
                    <Ionicons name="bulb" size={15} color="#c084fc" />
                  </View>
                  <Text className="text-xl font-bold text-slate-900 dark:text-white">Idea Lab</Text>
                </View>
                <TouchableOpacity
                  onPress={() => { setShowIdeation(false); setAiResult(null); }}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center"
                >
                  <Ionicons name="close" size={16} color="#64748b" />
                </TouchableOpacity>
              </View>
              <Text className="text-slate-500 dark:text-slate-400 text-sm mb-5">
                Paste your WhatsApp / Slack brainstorming chat and let AI extract a project plan.
              </Text>

              {!aiResult ? (
                <>
                  <TextInput
                    value={chatLogs}
                    onChangeText={setChatLogs}
                    placeholder="Paste chat logs here..."
                    placeholderTextColor="#94a3b8"
                    multiline
                    numberOfLines={8}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl px-4 py-3.5 text-slate-900 dark:text-white mb-5"
                    style={{ minHeight: 150, textAlignVertical: 'top' }}
                  />
                  {processingAI && (
                    <View className="items-center py-4 mb-4">
                      <ActivityIndicator color="#a78bfa" size="large" />
                      <Text className="text-purple-500 dark:text-purple-400 mt-3 font-medium">AI is thinking…</Text>
                    </View>
                  )}
                  <View className="flex-row gap-3">
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
                      style={{ flex: 1, backgroundColor: '#7c3aed' }}
                    />
                  </View>
                </>
              ) : (
                <>
                  <View className="bg-purple-50 dark:bg-slate-800 rounded-2xl p-4 mb-4 border border-purple-200 dark:border-purple-500/30">
                    <Text className="text-purple-600 dark:text-purple-400 font-bold mb-2">AI Analysis</Text>
                    <Text className="text-slate-900 dark:text-white font-semibold mb-1">{aiResult.projectName ?? 'Unnamed Project'}</Text>
                    {aiResult.summary && (
                      <Text className="text-slate-600 dark:text-slate-300 text-sm mb-3">{aiResult.summary}</Text>
                    )}
                    {aiResult.speakers?.length > 0 && (
                      <Text className="text-slate-400 dark:text-slate-400 text-xs">
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
