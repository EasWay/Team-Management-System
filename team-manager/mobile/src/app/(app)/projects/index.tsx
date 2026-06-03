import { useState, useMemo } from 'react';
import { ProjectGridSkeleton } from '@/components/Skeleton';
import * as Haptics from 'expo-haptics';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import { Alert } from '@/components/CustomAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { trpc } from '@/lib/api';
import { useTeamStore } from '@/store/teamStore';
import { useThemeStore } from '@/store/themeStore';
import { Button } from '@/components/Button';
import { format } from 'date-fns';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - 20 * 2 - 12) / 2;

const COVER_PALETTES = [
  { bg: '#111111', accent: '#AAAAAA', icon: 'layers-outline'        as IconName },
  { bg: '#1A1A1A', accent: '#888888', icon: 'analytics-outline'     as IconName },
  { bg: '#111111', accent: '#CCCCCC', icon: 'code-slash-outline'    as IconName },
  { bg: '#1A1A1A', accent: '#888888', icon: 'bulb-outline'          as IconName },
  { bg: '#111111', accent: '#AAAAAA', icon: 'color-palette-outline' as IconName },
  { bg: '#1A1A1A', accent: '#CCCCCC', icon: 'globe-outline'         as IconName },
  { bg: '#111111', accent: '#888888', icon: 'bar-chart-outline'     as IconName },
  { bg: '#1A1A1A', accent: '#f87171', icon: 'shield-outline'        as IconName },
];

function coverPalette(name: string) {
  const idx = (name?.charCodeAt(0) ?? 0) % COVER_PALETTES.length;
  return COVER_PALETTES[idx];
}

const STAGE_META: Record<string, { label: string; color: string; bg: string }> = {
  ideation:    { label: 'Ideation',   color: '#AAAAAA', bg: '#AAAAAA20' },
  planning:    { label: 'Planning',   color: '#888888', bg: '#88888820' },
  development: { label: 'In Dev',     color: '#888888', bg: '#88888820' },
  review:      { label: 'In Review',  color: '#888888', bg: '#88888820' },
  qa:          { label: 'QA',         color: '#888888', bg: '#88888820' },
  completed:   { label: 'Completed',  color: '#AAAAAA', bg: '#AAAAAA20' },
  archived:    { label: 'Archived',   color: '#555555', bg: '#55555520' },
};

function StageBadge({ stage }: { stage?: string }) {
  if (!stage) return null;
  const meta = STAGE_META[stage] ?? { label: stage, color: '#888888', bg: '#88888820' };
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
  const isDark = useThemeStore(state => state.isDark);
  const palette = coverPalette(item.name ?? '');
  const dateStr = item.createdAt ? format(new Date(item.createdAt), 'MMM d, yyyy') : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        width: CARD_WIDTH,
        backgroundColor: isDark ? '#111111' : '#FFFFFF',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: isDark ? '#1A1A1A' : '#E2E8F0',
        marginBottom: 12,
      }}
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
          <View className="absolute top-2 right-2 bg-neutral-800/80 rounded-lg px-1.5 py-0.5 flex-row items-center gap-1">
            <Ionicons name="checkmark-circle" size={10} color="#888888" />
            <Text style={{ color: '#888888', fontSize: 9, fontWeight: '700' }}>
              {item.evaluationData.overallScore}%
            </Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={{ padding: 12 }}>
        <Text
          style={{ color: isDark ? '#FFFFFF' : '#0A0A0A', fontWeight: '700', fontSize: 14, marginBottom: 4 }}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        {dateStr && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 }}>
            <Ionicons name="calendar-outline" size={10} color="#888888" />
            <Text style={{ color: isDark ? '#555555' : '#94a3b8', fontSize: 10 }}>{dateStr}</Text>
          </View>
        )}
        <StageBadge stage={item.workflowStage} />
      </View>
    </TouchableOpacity>
  );
}

export default function ProjectsScreen() {
  const { activeTeam } = useTeamStore();
  const isDark = useThemeStore(state => state.isDark);
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

  // ─── Shared palette ────────────────────────────────────────────────────────
  const bg       = isDark ? '#000000' : '#F5F5F5';
  const surface  = isDark ? '#111111' : '#FFFFFF';
  const border   = isDark ? '#1A1A1A' : '#E2E8F0';
  const fg       = isDark ? '#FFFFFF' : '#0A0A0A';
  const muted    = isDark ? '#555555' : '#94a3b8';
  const handle   = isDark ? '#333333' : '#D0D0D0';
  const inputBg  = isDark ? '#0D0D0D' : '#F5F5F5';
  const inputBdr = isDark ? '#2A2A2A' : '#D0D0D0';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['top']}>

      {/* ── Header ── */}
      <View className="px-5 pt-5 pb-3 flex-row justify-between items-center">
        <View>
          <Text style={{ color: muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 }}>
            {activeTeam?.name ?? 'No team'}
          </Text>
          <Text style={{ color: fg, fontSize: 24, fontWeight: '800', marginTop: 2 }}>Projects Library</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => setShowIdeation(true)}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0',
              borderWidth: 1, borderColor: border,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="bulb-outline" size={18} color="#c084fc" />
          </TouchableOpacity>
          <TouchableOpacity style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0',
            borderWidth: 1, borderColor: border,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="notifications-outline" size={18} color={muted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Search ── */}
      <View style={{
        marginHorizontal: 20, marginBottom: 16,
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: surface, borderWidth: 1, borderColor: border,
        borderRadius: 16, paddingHorizontal: 16, height: 44, gap: 8,
      }}>
        <Ionicons name="search-outline" size={16} color={muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search projects..."
          placeholderTextColor={muted}
          style={{ flex: 1, color: fg, fontSize: 14 }}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={muted} />
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
              style={{
                paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16,
                flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1,
                backgroundColor: active ? (isDark ? '#FFFFFF' : '#0A0A0A') : surface,
                borderColor: active ? (isDark ? '#FFFFFF' : '#0A0A0A') : border,
              }}
            >
              <Text style={{
                fontSize: 14, fontWeight: '600',
                color: active ? (isDark ? '#000000' : '#FFFFFF') : muted,
              }}>
                {f.label}
              </Text>
              {count > 0 && (
                <View style={{
                  borderRadius: 100, minWidth: 20, height: 20,
                  alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
                  backgroundColor: active ? 'rgba(128,128,128,0.25)' : (isDark ? '#1A1A1A' : '#F0F0F0'),
                }}>
                  <Text style={{
                    fontSize: 12, fontWeight: '700',
                    color: active ? (isDark ? '#333333' : '#DDDDDD') : muted,
                  }}>
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
              tintColor={isDark ? '#FFFFFF' : '#0A0A0A'}
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-16 px-8">
              <View style={{
                width: 64, height: 64, borderRadius: 16,
                backgroundColor: surface, borderWidth: 1, borderColor: border,
                alignItems: 'center', justifyContent: 'center', marginBottom: 16,
              }}>
                <Ionicons name="folder-open-outline" size={32} color={muted} />
              </View>
              <Text style={{ color: fg, fontWeight: '600', fontSize: 18, marginBottom: 4 }}>
                {search ? 'No results' : 'No projects yet'}
              </Text>
              <Text style={{ color: muted, fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
                {search
                  ? `No projects matching "${search}"`
                  : 'Create a project or use the AI Idea Lab to brainstorm one.'}
              </Text>
              {!search && (
                <TouchableOpacity
                  onPress={() => setShowCreate(true)}
                  style={{ backgroundColor: isDark ? '#FFFFFF' : '#0A0A0A', borderRadius: 16, paddingHorizontal: 24, paddingVertical: 12 }}
                >
                  <Text style={{ color: isDark ? '#000000' : '#FFFFFF', fontWeight: '700' }}>+ New Project</Text>
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
          style={{
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: isDark ? '#FFFFFF' : '#000000',
            alignItems: 'center', justifyContent: 'center',
            shadowColor: '#888888',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.45,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          <Ionicons name="add" size={28} color={isDark ? '#000000' : '#FFFFFF'} />
        </TouchableOpacity>
      </View>

      {/* ── Create Modal ── */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: isDark ? '#0D0D0D' : '#FFFFFF',
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48,
            borderTopWidth: 1, borderColor: border,
          }}>
            <View style={{ width: 40, height: 4, backgroundColor: handle, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
            <View className="flex-row items-center justify-between mb-5">
              <Text style={{ color: fg, fontSize: 20, fontWeight: '800' }}>New Project</Text>
              <TouchableOpacity
                onPress={() => setShowCreate(false)}
                style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={16} color={muted} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Title *</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Project name"
              placeholderTextColor={muted}
              style={{
                backgroundColor: inputBg, borderWidth: 1, borderColor: inputBdr,
                borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
                color: fg, fontSize: 14, marginBottom: 16,
              }}
            />

            <Text style={{ color: muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What is this project about?"
              placeholderTextColor={muted}
              multiline
              numberOfLines={3}
              style={{
                backgroundColor: inputBg, borderWidth: 1, borderColor: inputBdr,
                borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
                color: fg, fontSize: 14, marginBottom: 24,
                textAlignVertical: 'top', minHeight: 80,
              }}
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
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: isDark ? '#0D0D0D' : '#FFFFFF',
              borderTopLeftRadius: 28, borderTopRightRadius: 28,
              borderTopWidth: 1, borderColor: border,
              maxHeight: '92%',
            }}
          >
            {/* Handle */}
            <View style={{ width: 40, height: 4, backgroundColor: handle, borderRadius: 2, alignSelf: 'center', marginTop: 16, marginBottom: 8 }} />

            {projectDetailQuery.isLoading ? (
              <View className="items-center justify-center py-16">
                <ActivityIndicator color="#888888" size="large" />
                <Text style={{ color: muted, marginTop: 12, fontSize: 14 }}>Loading project…</Text>
              </View>
            ) : (() => {
              const p = projectDetailQuery.data as any;
              if (!p) return (
                <View className="items-center justify-center py-16">
                  <Text style={{ color: muted }}>Project not found</Text>
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
                      <View className="absolute top-3 right-3 flex-row items-center gap-1 bg-neutral-800/80 rounded-xl px-2.5 py-1">
                        <Ionicons name="star" size={11} color="#888888" />
                        <Text style={{ color: '#888888', fontSize: 12, fontWeight: '700' }}>{evalScore}%</Text>
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
                      <Text style={{ color: fg, fontSize: 20, fontWeight: '800', flex: 1, lineHeight: 28 }}>{p.name}</Text>
                      <View style={{ backgroundColor: stageMeta.bg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <Text style={{ color: stageMeta.color, fontSize: 11, fontWeight: '700' }}>{stageMeta.label}</Text>
                      </View>
                    </View>

                    {/* Dates */}
                    <View className="flex-row gap-4 mb-4">
                      {p.dateReceived && (
                        <View className="flex-row items-center gap-1.5">
                          <Ionicons name="calendar-outline" size={13} color={muted} />
                          <Text style={{ color: muted, fontSize: 12 }}>
                            Started {format(new Date(p.dateReceived), 'MMM d, yyyy')}
                          </Text>
                        </View>
                      )}
                      {p.dateEnded && (
                        <View className="flex-row items-center gap-1.5">
                          <Ionicons name="flag-outline" size={13} color={muted} />
                          <Text style={{ color: muted, fontSize: 12 }}>
                            Due {format(new Date(p.dateEnded), 'MMM d, yyyy')}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Description */}
                    {(p.description || p.definition) && (
                      <View style={{ backgroundColor: surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: border }}>
                        <Text style={{ color: muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>About</Text>
                        <Text style={{ color: isDark ? '#CCCCCC' : '#374151', fontSize: 14, lineHeight: 20 }}>
                          {p.definition || p.description}
                        </Text>
                      </View>
                    )}

                    {/* Evaluation scores */}
                    {p.evaluationData && (
                      <View style={{ backgroundColor: isDark ? '#0D0D0D' : '#F9F9F9', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: border }}>
                        <Text style={{ color: muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>QA Evaluation</Text>
                        {[
                          { label: 'Design', value: p.evaluationData.designAlignment },
                          { label: 'Business', value: p.evaluationData.businessAlignment },
                          { label: 'Technical', value: p.evaluationData.technicalQuality },
                          { label: 'Testing', value: p.evaluationData.testingProtocol },
                        ].filter(x => x.value != null).map((item) => (
                          <View key={item.label} className="mb-2">
                            <View className="flex-row justify-between mb-1">
                              <Text style={{ color: muted, fontSize: 12 }}>{item.label}</Text>
                              <Text style={{ color: '#888888', fontSize: 12, fontWeight: '700' }}>{item.value}%</Text>
                            </View>
                            <View style={{ height: 6, backgroundColor: isDark ? '#1A1A1A' : '#E0E0E0', borderRadius: 3, overflow: 'hidden' }}>
                              <View
                                style={{ height: '100%', backgroundColor: '#888888', borderRadius: 3, width: `${item.value}%` }}
                              />
                            </View>
                          </View>
                        ))}
                        {p.evaluationData.readyForLaunch && (
                          <View className="flex-row items-center gap-1.5 mt-2">
                            <Ionicons name="checkmark-circle" size={14} color="#888888" />
                            <Text style={{ color: '#888888', fontSize: 12, fontWeight: '700' }}>Ready for Launch</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Deliverables */}
                    {deliverablesList.length > 0 && (
                      <View className="mb-4">
                        <Text style={{ color: muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Deliverables</Text>
                        {deliverablesList.map((d: any, i: number) => (
                          <View key={i} style={{
                            flexDirection: 'row', alignItems: 'center', gap: 12,
                            backgroundColor: surface, borderRadius: 12, padding: 12, marginBottom: 8,
                            borderWidth: 1, borderColor: border,
                          }}>
                            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0', alignItems: 'center', justifyContent: 'center' }}>
                              <Ionicons
                                name={d.type === 'github' ? 'logo-github' : d.type === 'figma' ? 'color-palette-outline' : 'link-outline'}
                                size={14}
                                color="#888888"
                              />
                            </View>
                            <View className="flex-1">
                              <Text style={{ color: fg, fontSize: 14, fontWeight: '500' }}>{d.description || d.type}</Text>
                              {d.url && <Text style={{ color: '#888888', fontSize: 12, marginTop: 2 }} numberOfLines={1}>{d.url}</Text>}
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Handoff history */}
                    {handoffList.length > 0 && (
                      <View className="mb-4">
                        <Text style={{ color: muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Handoff History</Text>
                        {handoffList.map((h: any, i: number) => (
                          <View key={i} className="flex-row items-start gap-3 mb-3">
                            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                              <Ionicons name="arrow-forward" size={11} color="#888888" />
                            </View>
                            <View className="flex-1">
                              <Text style={{ color: isDark ? '#CCCCCC' : '#374151', fontSize: 14, fontWeight: '500' }}>
                                {h.from} → {h.to}
                              </Text>
                              {h.comments && (
                                <Text style={{ color: muted, fontSize: 12, marginTop: 2 }}>{h.comments}</Text>
                              )}
                              {h.timestamp && (
                                <Text style={{ color: isDark ? '#333333' : '#CCCCCC', fontSize: 12, marginTop: 2 }}>
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
                      <View style={{ backgroundColor: isDark ? '#0D0D0D' : '#F9F9F9', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: border }}>
                        <Text style={{ color: muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                          AI Ideation Report
                        </Text>
                        <Text style={{ color: isDark ? '#CCCCCC' : '#374151', fontSize: 14, lineHeight: 20 }}>
                          {p.ideationData.finalDecisionReport.executiveSummary || 'No summary available.'}
                        </Text>
                        {p.ideationData.speakers?.length > 0 && (
                          <View className="flex-row flex-wrap gap-1.5 mt-3">
                            {p.ideationData.speakers.map((s: any, i: number) => (
                              <View key={i} style={{ backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 }}>
                                <Text style={{ color: isDark ? '#AAAAAA' : '#555555', fontSize: 12, fontWeight: '500' }}>
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
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <ScrollView
            contentContainerStyle={{ justifyContent: 'flex-end', flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{
              backgroundColor: isDark ? '#0D0D0D' : '#FFFFFF',
              borderTopLeftRadius: 28, borderTopRightRadius: 28,
              paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48,
              borderTopWidth: 1, borderColor: border,
            }}>
              <View style={{ width: 40, height: 4, backgroundColor: handle, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
              <View className="flex-row items-center justify-between mb-1">
                <View className="flex-row items-center gap-2">
                  <View style={{
                    width: 32, height: 32, borderRadius: 16,
                    backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0',
                    borderWidth: 1, borderColor: border,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name="bulb" size={15} color="#c084fc" />
                  </View>
                  <Text style={{ color: fg, fontSize: 20, fontWeight: '800' }}>Idea Lab</Text>
                </View>
                <TouchableOpacity
                  onPress={() => { setShowIdeation(false); setAiResult(null); }}
                  style={{
                    width: 32, height: 32, borderRadius: 16,
                    backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name="close" size={16} color={muted} />
                </TouchableOpacity>
              </View>
              <Text style={{ color: muted, fontSize: 14, marginBottom: 20, marginTop: 4 }}>
                Paste your WhatsApp / Slack brainstorming chat and let AI extract a project plan.
              </Text>

              {!aiResult ? (
                <>
                  <TextInput
                    value={chatLogs}
                    onChangeText={setChatLogs}
                    placeholder="Paste chat logs here..."
                    placeholderTextColor={muted}
                    multiline
                    numberOfLines={8}
                    style={{
                      backgroundColor: inputBg, borderWidth: 1, borderColor: inputBdr,
                      borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
                      color: fg, fontSize: 14, marginBottom: 20,
                      minHeight: 150, textAlignVertical: 'top',
                    }}
                  />
                  {processingAI && (
                    <View className="items-center py-4 mb-4">
                      <ActivityIndicator color="#888888" size="large" />
                      <Text style={{ color: muted, marginTop: 12, fontWeight: '500' }}>AI is thinking…</Text>
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
                      style={{ flex: 1 }}
                    />
                  </View>
                </>
              ) : (
                <>
                  <View style={{
                    backgroundColor: isDark ? '#111111' : '#F5F5F5',
                    borderRadius: 16, padding: 16, marginBottom: 16,
                    borderWidth: 1, borderColor: border,
                  }}>
                    <Text style={{ color: '#888888', fontWeight: '700', marginBottom: 8 }}>AI Analysis</Text>
                    <Text style={{ color: fg, fontWeight: '600', marginBottom: 4 }}>{aiResult.projectName ?? 'Unnamed Project'}</Text>
                    {aiResult.summary && (
                      <Text style={{ color: isDark ? '#AAAAAA' : '#555555', fontSize: 14, marginBottom: 12 }}>{aiResult.summary}</Text>
                    )}
                    {aiResult.speakers?.length > 0 && (
                      <Text style={{ color: muted, fontSize: 12 }}>
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
