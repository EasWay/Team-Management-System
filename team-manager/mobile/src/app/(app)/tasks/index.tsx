import { useState, useEffect, useMemo } from 'react';
import { ListRowSkeleton } from '@/components/Skeleton';
import * as Haptics from 'expo-haptics';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Alert } from '@/components/CustomAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { trpc } from '@/lib/api';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { getSocket, joinTeamRoom, leaveTeamRoom } from '@/lib/socket';
import { Button } from '@/components/Button';
import { getAvatarColor } from '@/components/Avatar';
import { format, isAfter } from 'date-fns';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Status = 'todo' | 'in_progress' | 'review' | 'done';
type Priority = 'low' | 'medium' | 'high' | 'urgent';

const STATUSES: { key: Status; label: string; icon: IconName; color: string }[] = [
  { key: 'todo',        label: 'To Do',       icon: 'list-outline',             color: '#94a3b8' },
  { key: 'in_progress', label: 'In Progress', icon: 'flash-outline',            color: '#5B8DEF' },
  { key: 'review',      label: 'Review',      icon: 'eye-outline',              color: '#F59E0B' },
  { key: 'done',        label: 'Done',        icon: 'checkmark-circle-outline', color: '#10B981' },
];

const PRIORITY_META: Record<Priority, { label: string; color: string; bg: string; icon: IconName }> = {
  low:    { label: 'Low',    color: '#10B981', bg: '#10B98118', icon: 'remove-outline' },
  medium: { label: 'Med',    color: '#F59E0B', bg: '#F59E0B18', icon: 'reorder-two-outline' },
  high:   { label: 'High',   color: '#F97316', bg: '#F9731618', icon: 'arrow-up-outline' },
  urgent: { label: 'Urgent', color: '#EF4444', bg: '#EF444418', icon: 'warning-outline' },
};

const MOVE_TARGETS: Record<Status, { to: Status; label: string; color: string }[]> = {
  todo:        [{ to: 'in_progress', label: 'Start',   color: '#5B8DEF' }],
  in_progress: [{ to: 'review',      label: 'Review',  color: '#F59E0B' }, { to: 'done', label: 'Done', color: '#10B981' }],
  review:      [{ to: 'in_progress', label: 'Revise',  color: '#5B8DEF' }, { to: 'done', label: 'Approve', color: '#10B981' }],
  done:        [{ to: 'todo',        label: 'Reopen',  color: '#94a3b8' }],
};

// ─── Circular Progress Ring ────────────────────────────────────────────────────
function ProgressRing({ pct = 0, size = 46, color = '#888888', track }: {
  pct?: number; size?: number; color?: string; track?: string;
}) {
  const isDark = useThemeStore(state => state.isDark);
  const trackColor = track ?? (isDark ? '#1A1A1A' : '#E2E8F0');
  const filled = Math.min(Math.max(pct, 0), 100);
  const rightAngle = Math.min(filled * 3.6, 180);
  const leftAngle  = Math.max((filled - 50) * 3.6, 0);
  const holeSize   = size - 10;

  return (
    <View style={{ width: size, height: size }}>
      {/* Track */}
      <View style={{
        position: 'absolute', width: size, height: size,
        borderRadius: size / 2, backgroundColor: trackColor,
      }} />

      {/* Right half fill (0–50%) */}
      <View style={{ position: 'absolute', width: size / 2, height: size, right: 0, overflow: 'hidden' }}>
        <View style={{
          width: size, height: size, borderRadius: size / 2, overflow: 'hidden',
          position: 'absolute', left: -size / 2,
          transform: [{ rotate: `${rightAngle}deg` }],
        }}>
          <View style={{ width: size / 2, height: size, backgroundColor: color, position: 'absolute', left: 0 }} />
        </View>
      </View>

      {/* Left half fill (50–100%) */}
      <View style={{ position: 'absolute', width: size / 2, height: size, left: 0, overflow: 'hidden' }}>
        <View style={{
          width: size, height: size, borderRadius: size / 2, overflow: 'hidden',
          position: 'absolute', left: 0,
          transform: [{ rotate: `${leftAngle}deg` }],
        }}>
          <View style={{ width: size / 2, height: size, backgroundColor: color, position: 'absolute', right: 0 }} />
        </View>
      </View>

      {/* Inner hole */}
      <View style={{
        position: 'absolute',
        top: (size - holeSize) / 2,
        left: (size - holeSize) / 2,
        width: holeSize,
        height: holeSize,
        borderRadius: holeSize / 2,
        backgroundColor: isDark ? '#0D0D0D' : '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {filled >= 100
          ? <Ionicons name="checkmark" size={12} />
          : <Text style={{ color, fontSize: 9, fontWeight: '800', lineHeight: 12 }}>{filled}%</Text>
        }
      </View>
    </View>
  );
}

function avatarColor(name?: string | null) {
  return getAvatarColor(name);
}

// ─── Member Avatar ─────────────────────────────────────────────────────────────
function MemberAvatar({ name, size = 24 }: { name?: string | null; size?: number }) {
  const color = avatarColor(name);
  const initials = (name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color + '28', borderWidth: 1.5, borderColor: color + '80',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color, fontSize: size * 0.35, fontWeight: '800' }}>{initials}</Text>
    </View>
  );
}

// ─── Task Card ─────────────────────────────────────────────────────────────────
function TaskCard({
  task,
  onMove,
  onProgress,
  onViewDetail,
  canEdit,
}: {
  task: any;
  onMove: (taskId: number, to: Status) => void;
  onProgress: (taskId: number, pct: number) => void;
  onViewDetail: (task: any) => void;
  canEdit: boolean;
}) {
  const isDark = useThemeStore(state => state.isDark);
  const pct     = task.completionPercentage ?? 0;
  const priority = PRIORITY_META[task.priority as Priority] ?? PRIORITY_META.medium;
  const moves    = canEdit ? (MOVE_TARGETS[task.status as Status] ?? []) : [];
  const tags: string[] = Array.isArray(task.tags) ? task.tags : [];
  const isOverdue = task.dueDate && task.status !== 'done' && isAfter(new Date(), new Date(task.dueDate));
  const statusColor = STATUSES.find(s => s.key === task.status)?.color ?? '#94a3b8';

  return (
    <TouchableOpacity
      onPress={() => onViewDetail(task)}
      activeOpacity={0.88}
      style={{
        backgroundColor: isDark ? '#0D0D0D' : '#ffffff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: isDark ? '#1A1A1A' : '#D0D0D0',
        marginBottom: 8,
        overflow: 'hidden',
      }}
    >
      {/* Status stripe at top */}
      <View style={{ height: 2, backgroundColor: statusColor, opacity: 0.7 }} />

      <View style={{ padding: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          {/* Progress ring */}
          <ProgressRing pct={pct} size={38} color={statusColor} />

          {/* Content */}
          <View style={{ flex: 1 }}>
            {/* Title row */}
            <Text
              style={{ color: isDark ? '#F5F5F5' : '#0D0D0D', fontSize: 13, fontWeight: '700', lineHeight: 18, marginBottom: 4 }}
              numberOfLines={2}
            >
              {task.title}
            </Text>

            {/* Priority + Due date */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 3,
                backgroundColor: priority.bg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
              }}>
                <Ionicons name={priority.icon} size={9} color={priority.color} />
                <Text style={{ color: priority.color, fontSize: 9, fontWeight: '700' }}>{priority.label}</Text>
              </View>

              {task.dueDate && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="time-outline" size={10} color={isOverdue ? '#f87171' : (isDark ? '#555555' : '#64748b')} />
                  <Text style={{ color: isOverdue ? '#f87171' : (isDark ? '#555555' : '#64748b'), fontSize: 9, fontWeight: '500' }}>
                    {format(new Date(task.dueDate), 'MMM d')}
                  </Text>
                </View>
              )}
            </View>

            {/* Assignee row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {task.assignee && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <MemberAvatar name={task.assignee.name} size={18} />
                    <Text style={{ color: isDark ? '#555555' : '#64748b', fontSize: 10 }} numberOfLines={1}>
                      {task.assignee.name?.split(' ')[0]}
                    </Text>
                  </View>
                )}
              </View>

              {task.createdAt && (
                <Text style={{ color: isDark ? '#555555' : '#AAAAAA', fontSize: 9 }}>
                  {format(new Date(task.createdAt), 'MMM d')}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Move buttons — only shown when user can edit */}
        {moves.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: isDark ? '#1A1A1A' : '#D0D0D0' }}>
            {moves.map((m) => (
              <TouchableOpacity
                key={m.to}
                onPress={() => onMove(task.id, m.to)}
                style={{
                  flex: 1, paddingVertical: 6, borderRadius: 8,
                  backgroundColor: m.color + '18', borderWidth: 1, borderColor: m.color + '40',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: m.color, fontSize: 10, fontWeight: '700' }}>→ {m.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => {
                Alert.prompt
                  ? Alert.prompt('Update Progress', 'Enter 0–100:', (val) => {
                      const n = parseInt(val ?? '0');
                      if (!isNaN(n)) onProgress(task.id, Math.min(100, Math.max(0, n)));
                    })
                  : Alert.alert('Progress', `Current: ${pct}%`, [
                      { text: '+10%', onPress: () => onProgress(task.id, Math.min(100, pct + 10)) },
                      { text: '+25%', onPress: () => onProgress(task.id, Math.min(100, pct + 25)) },
                      { text: '100%', onPress: () => onProgress(task.id, 100) },
                      { text: 'Cancel', style: 'cancel' },
                    ]);
              }}
              style={{
                width: 30, paddingVertical: 6, borderRadius: 8,
                backgroundColor: isDark ? '#1A1A1A' : '#F5F5F5', alignItems: 'center',
              }}
            >
              <Ionicons name="stats-chart-outline" size={12} color={isDark ? '#555555' : '#64748b'} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Task Detail Sheet ─────────────────────────────────────────────────────────
function TaskDetailSheet({ task, onClose }: { task: any; onClose: () => void }) {
  if (!task) return null;
  const priority = PRIORITY_META[task.priority as Priority] ?? PRIORITY_META.medium;
  const tags: string[] = Array.isArray(task.tags) ? task.tags : [];
  const statusMeta = STATUSES.find(s => s.key === task.status);

  return (
    <View className="bg-white dark:bg-black rounded-t-3xl border-t border-slate-200 dark:border-neutral-800 px-5 pt-6 pb-12" style={{ maxHeight: '88%' }}>
      <View className="w-10 h-1 bg-slate-300 dark:bg-neutral-700 rounded-full self-center mb-5" />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-start justify-between mb-4">
          <View className="flex-1 pr-3">
            <Text className="text-slate-900 dark:text-white text-xl font-bold leading-tight">{task.title}</Text>
          </View>
          <TouchableOpacity onPress={onClose} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-neutral-900 items-center justify-center">
            <Ionicons name="close" size={16} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Status + Priority row */}
        <View className="flex-row gap-2 mb-4 flex-wrap">
          {statusMeta && (
            <View style={{ backgroundColor: statusMeta.color + '18', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: statusMeta.color, fontSize: 11, fontWeight: '700' }}>{statusMeta.label}</Text>
            </View>
          )}
          <View style={{ backgroundColor: priority.bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ color: priority.color, fontSize: 11, fontWeight: '700' }}>⚑ {priority.label}</Text>
          </View>
          {task.completionPercentage != null && (
            <View className="bg-slate-100 dark:bg-neutral-900 rounded-xl px-3 py-1 flex-row items-center gap-1">
              <Ionicons name="stats-chart-outline" size={11} />
              <Text className="text-neutral-700 dark:text-neutral-400 text-xs font-bold">{task.completionPercentage}% done</Text>
            </View>
          )}
        </View>

        {/* Description */}
        {task.description && (
          <View className="bg-slate-50 dark:bg-neutral-900 rounded-2xl p-4 mb-4 border border-slate-200 dark:border-neutral-800">
            <Text className="text-slate-500 dark:text-neutral-400 text-xs font-bold uppercase tracking-wider mb-2">Description</Text>
            <Text className="text-slate-700 dark:text-neutral-300 text-sm leading-5">{task.description}</Text>
          </View>
        )}

        {/* People */}
        <View className="flex-row gap-3 mb-4">
          {task.assignee && (
            <View className="flex-1 bg-slate-50 dark:bg-neutral-900 rounded-2xl p-3 border border-slate-200 dark:border-neutral-800">
              <Text className="text-slate-500 dark:text-neutral-400 text-xs font-bold uppercase mb-2">Assigned To</Text>
              <View className="flex-row items-center gap-2">
                <MemberAvatar name={task.assignee.name} size={28} />
                <Text className="text-slate-900 dark:text-white text-sm font-semibold" numberOfLines={1}>{task.assignee.name}</Text>
              </View>
            </View>
          )}
          {task.creator && (
            <View className="flex-1 bg-slate-50 dark:bg-neutral-900 rounded-2xl p-3 border border-slate-200 dark:border-neutral-800">
              <Text className="text-slate-500 dark:text-neutral-400 text-xs font-bold uppercase mb-2">Created By</Text>
              <View className="flex-row items-center gap-2">
                <MemberAvatar name={task.creator.name} size={28} />
                <Text className="text-slate-900 dark:text-white text-sm font-semibold" numberOfLines={1}>{task.creator.name}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Dates */}
        <View className="flex-row gap-3 mb-4">
          {task.createdAt && (
            <View className="flex-1 bg-slate-50 dark:bg-neutral-900 rounded-2xl p-3 border border-slate-200 dark:border-neutral-800">
              <Text className="text-slate-500 dark:text-neutral-400 text-xs font-bold uppercase mb-1">Created</Text>
              <Text className="text-slate-700 dark:text-neutral-300 text-sm">{format(new Date(task.createdAt), 'MMM d, yyyy')}</Text>
            </View>
          )}
          {task.dueDate && (
            <View className="flex-1 bg-slate-50 dark:bg-neutral-900 rounded-2xl p-3 border border-slate-200 dark:border-neutral-800">
              <Text className="text-slate-500 dark:text-neutral-400 text-xs font-bold uppercase mb-1">Due Date</Text>
              <Text className="text-slate-700 dark:text-neutral-300 text-sm">{format(new Date(task.dueDate), 'MMM d, yyyy')}</Text>
            </View>
          )}
        </View>

        {/* Tags */}
        {tags.length > 0 && (
          <View className="mb-4">
            <Text className="text-slate-500 dark:text-neutral-400 text-xs font-bold uppercase tracking-wider mb-2">Tags</Text>
            <View className="flex-row flex-wrap gap-2">
              {tags.map((tag) => (
                <View key={tag} className="bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl px-3 py-1.5">
                  <Text className="text-neutral-700 dark:text-neutral-400 text-xs font-semibold">#{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function TasksScreen() {
  const { activeTeam, teams } = useTeamStore();
  const { user } = useAuthStore();

  // Find current member record in the active team
  const currentMember = useMemo(() => {
    if (!activeTeam) return null;
    const found = (activeTeam as any).members?.find(
      (m: any) => m.member?.email === user?.email || m.member?.id === user?.id
    );
    return found?.member ?? null;
  }, [activeTeam, user]);

  const isProjectManager = useMemo(() => {
    const membership = (activeTeam as any)?.members?.find(
      (m: any) => m.member?.email === user?.email
    );
    return membership?.officeRole === 'project_manager';
  }, [activeTeam, user]);

  const [activeStatus, setActiveStatus]   = useState<Status>('todo');
  const [scopeMine, setScopeMine]         = useState(true);
  const [showCreate, setShowCreate]       = useState(false);
  const [showDetail, setShowDetail]       = useState(false);
  const [selectedTask, setSelectedTask]   = useState<any>(null);

  // Create form state
  const [title, setTitle]           = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority]     = useState<Priority>('medium');
  const [status, setStatus]         = useState<Status>('todo');
  const [dueDate, setDueDate]       = useState('');
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [tagInput, setTagInput]     = useState('');
  const [tags, setTags]             = useState<string[]>([]);
  const [completionPct, setCompletionPct] = useState(0);

  const utils = trpc.useUtils();

  // Members list for assignee picker
  const membersQuery = trpc.teams.getMembers.useQuery(
    { teamId: activeTeam?.id ?? 0 },
    { enabled: !!activeTeam?.id }
  );
  const membersList: any[] = (membersQuery.data as any[] ?? []);

  // Build query params based on scope
  // "All" = everyone sees all tasks (view-only); "Mine" = filtered to current member with edit rights
  const queryParams = useMemo(() => {
    const base = { teamId: activeTeam?.id ?? 0 };
    if (isProjectManager) return base; // PM always sees all tasks
    if (scopeMine && currentMember?.id) return { ...base, viewerMemberId: currentMember.id };
    return base; // "All" scope — no filter
  }, [activeTeam?.id, isProjectManager, scopeMine, currentMember?.id]);

  // Only allow editing when in "Mine" scope (or if PM)
  const canEditTasks = isProjectManager || scopeMine;

  const tasksQuery = trpc.tasks.list.useQuery(queryParams, { enabled: !!activeTeam?.id });

  const createMutation = trpc.tasks.create.useMutation({
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      utils.tasks.list.invalidate();
      setShowCreate(false);
      resetForm();
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const moveMutation = trpc.tasks.move.useMutation({
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      utils.tasks.list.invalidate();
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const progressMutation = trpc.tasks.updateProgress.useMutation({
    onSuccess: () => utils.tasks.list.invalidate(),
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  // Real-time socket
  useEffect(() => {
    if (!activeTeam?.id) return;
    let cleanup: (() => void) | null = null;
    getSocket().then((sock) => {
      joinTeamRoom(activeTeam.id);
      const refresh = () => utils.tasks.list.invalidate();
      sock.on('taskCreated', refresh);
      sock.on('taskUpdated', refresh);
      sock.on('taskMoved', refresh);
      sock.on('taskDeleted', refresh);
      cleanup = () => {
        leaveTeamRoom(activeTeam.id);
        sock.off('taskCreated', refresh);
        sock.off('taskUpdated', refresh);
        sock.off('taskMoved', refresh);
        sock.off('taskDeleted', refresh);
      };
    });
    return () => cleanup?.();
  }, [activeTeam?.id]);

  function resetForm() {
    setTitle(''); setDescription(''); setPriority('medium');
    setStatus('todo'); setDueDate(''); setAssigneeId(null);
    setTagInput(''); setTags([]); setCompletionPct(0);
  }

  const allTasks = (tasksQuery.data as any[] ?? []);
  const filtered = allTasks.filter((t) => t.status === activeStatus);

  const handleCreate = () => {
    if (!title.trim()) { Alert.alert('Required', 'Task title is required.'); return; }
    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      status,
      teamId: activeTeam!.id,
      assignedTo: assigneeId ?? undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      tags: tags.length > 0 ? tags : undefined,
      completionPercentage: completionPct,
    });
  };

  const addTag = () => {
    const cleaned = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (cleaned && !tags.includes(cleaned)) {
      setTags(prev => [...prev, cleaned]);
    }
    setTagInput('');
  };

  const isDark = useThemeStore(state => state.isDark);
  const currentStatusMeta = STATUSES.find(s => s.key === activeStatus)!;

  const dynamicInputStyle = {
    ...inputStyle,
    backgroundColor: isDark ? '#000000' : '#F5F5F5',
    borderColor: isDark ? '#1A1A1A' : '#D0D0D0',
    color: isDark ? '#F5F5F5' : '#0D0D0D',
  };

  const dynamicLabelStyle = {
    ...labelStyle,
    color: isDark ? '#555555' : '#64748b',
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#000000' : '#F5F5F5' }}>

      {/* ── Header ── */}
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <View>
            <Text style={{ color: isDark ? '#555555' : '#64748b', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 }}>
              {activeTeam?.name ?? 'Tasks'}
            </Text>
            <Text className="text-slate-900 dark:text-white" style={{ fontSize: 24, fontWeight: '800' }}>
              {scopeMine && !isProjectManager ? 'My Tasks' : 'All Tasks'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowCreate(true)}
            style={{
              backgroundColor: '#888888', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9,
              flexDirection: 'row', alignItems: 'center', gap: 6,
              shadowColor: '#888888', shadowRadius: 12, shadowOpacity: 0.4, shadowOffset: { width: 0, height: 4 },
            }}
          >
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>Task</Text>
          </TouchableOpacity>
        </View>

        {/* Scope toggle (only if not PM) */}
        {!isProjectManager && (
          <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#0D0D0D' : '#E8E8E8', borderRadius: 12, padding: 3, alignSelf: 'flex-start', marginBottom: 4 }}>
            {[{ v: true, l: 'Mine' }, { v: false, l: 'All' }].map(({ v, l }) => (
              <TouchableOpacity
                key={l}
                onPress={() => setScopeMine(v)}
                style={{
                  paddingHorizontal: 16, paddingVertical: 6, borderRadius: 10,
                  backgroundColor: scopeMine === v ? '#888888' : 'transparent',
                }}
              >
                <Text style={{ color: scopeMine === v ? '#fff' : (isDark ? '#555555' : '#64748b'), fontSize: 12, fontWeight: '700' }}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* ── Status tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 8 }}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
      >
        {STATUSES.map((s) => {
          const count   = allTasks.filter(t => t.status === s.key).length;
          const isActive = activeStatus === s.key;
          return (
            <TouchableOpacity
              key={s.key}
              onPress={() => setActiveStatus(s.key)}
              style={{
                paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14,
                flexDirection: 'row', alignItems: 'center', gap: 7,
                backgroundColor: isActive ? s.color + '22' : (isDark ? '#0D0D0D' : '#ffffff'),
                borderWidth: 1,
                borderColor: isActive ? s.color + '60' : (isDark ? '#1A1A1A' : '#D0D0D0'),
              }}
            >
              <Ionicons name={s.icon} size={13} color={isActive ? s.color : (isDark ? '#555555' : '#AAAAAA')} />
              <Text style={{ color: isActive ? s.color : (isDark ? '#555555' : '#64748b'), fontSize: 12, fontWeight: '700' }}>{s.label}</Text>
              {count > 0 && (
                <View style={{
                  minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
                  backgroundColor: isActive ? s.color + '30' : (isDark ? '#1A1A1A' : '#F5F5F5'),
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: isActive ? s.color : (isDark ? '#555555' : '#888888'), fontSize: 10, fontWeight: '800' }}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Section header ── */}
      <View style={{ paddingHorizontal: 20, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: currentStatusMeta.color }} />
        <Text style={{ color: isDark ? '#555555' : '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>
          {currentStatusMeta.label}
        </Text>
        <Text style={{ color: isDark ? '#555555' : '#AAAAAA', fontSize: 11 }}>· {filtered.length}</Text>
      </View>

      {/* ── Task list ── */}
      {tasksQuery.isLoading && !tasksQuery.data ? (
        <ListRowSkeleton count={8} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl refreshing={tasksQuery.isFetching} onRefresh={() => tasksQuery.refetch()} tintColor={isDark ? '#FFFFFF' : '#0A0A0A'} />
          }
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: isDark ? '#0D0D0D' : '#ffffff', borderWidth: 1, borderColor: isDark ? '#1A1A1A' : '#D0D0D0', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Ionicons name="checkmark-done-circle-outline" size={28} color={isDark ? '#555555' : '#AAAAAA'} />
              </View>
              <Text style={{ color: isDark ? '#555555' : '#1A1A1A', fontSize: 15, fontWeight: '600' }}>
                {scopeMine ? 'No tasks for you here' : `No ${currentStatusMeta.label} tasks`}
              </Text>
              <Text style={{ color: isDark ? '#555555' : '#888888', fontSize: 13, marginTop: 4, textAlign: 'center', paddingHorizontal: 40 }}>
                {scopeMine ? 'Tasks assigned to you or created by you will appear here.' : 'Create a task to get started.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TaskCard
              task={item}
              onMove={(id, to) => moveMutation.mutate({ id, status: to })}
              onProgress={(id, pct) => progressMutation.mutate({ id, completionPercentage: pct })}
              onViewDetail={(t) => { setSelectedTask(t); setShowDetail(true); }}
              canEdit={canEditTasks}
            />
          )}
        />
      )}

      {/* ── Task Detail Bottom Sheet ── */}
      <Modal visible={showDetail} animationType="slide" transparent onRequestClose={() => setShowDetail(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <TaskDetailSheet task={selectedTask} onClose={() => setShowDetail(false)} />
        </View>
      </Modal>

      {/* ── Create Task Modal ── */}
      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => { setShowCreate(false); resetForm(); }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: isDark ? '#0D0D0D' : '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: isDark ? '#1A1A1A' : '#D0D0D0', maxHeight: '92%' }}>
            <View style={{ width: 40, height: 4, backgroundColor: isDark ? '#1A1A1A' : '#D0D0D0', borderRadius: 2, alignSelf: 'center', marginTop: 14, marginBottom: 4 }} />
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ color: isDark ? '#F5F5F5' : '#0D0D0D', fontSize: 20, fontWeight: '800' }}>New Task</Text>
                <TouchableOpacity
                  onPress={() => { setShowCreate(false); resetForm(); }}
                  style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: isDark ? '#1A1A1A' : '#F5F5F5', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="close" size={16} color={isDark ? '#555555' : '#64748b'} />
                </TouchableOpacity>
              </View>

              {/* Title */}
              <Text style={dynamicLabelStyle}>Title *</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="What needs to be done?"
                placeholderTextColor={isDark ? '#555555' : '#AAAAAA'}
                style={dynamicInputStyle}
              />

              {/* Description */}
              <Text style={dynamicLabelStyle}>Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Add details..."
                placeholderTextColor={isDark ? '#555555' : '#AAAAAA'}
                multiline
                style={[dynamicInputStyle, { minHeight: 70, textAlignVertical: 'top' }]}
              />

              {/* Priority */}
              <Text style={dynamicLabelStyle}>Priority</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                {(Object.entries(PRIORITY_META) as [Priority, typeof PRIORITY_META[Priority]][]).map(([key, meta]) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setPriority(key)}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
                      backgroundColor: priority === key ? meta.color + '20' : (isDark ? '#0D0D0D' : '#F5F5F5'),
                      borderWidth: 1.5, borderColor: priority === key ? meta.color : (isDark ? '#1A1A1A' : '#D0D0D0'),
                      flexDirection: 'row', alignItems: 'center', gap: 5,
                    }}
                  >
                    <Ionicons name={meta.icon} size={12} color={priority === key ? meta.color : (isDark ? '#555555' : '#888888')} />
                    <Text style={{ color: priority === key ? meta.color : (isDark ? '#555555' : '#888888'), fontSize: 12, fontWeight: '700' }}>{meta.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Status */}
              <Text style={dynamicLabelStyle}>Status</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                {STATUSES.map((s) => (
                  <TouchableOpacity
                    key={s.key}
                    onPress={() => setStatus(s.key)}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
                      backgroundColor: status === s.key ? s.color + '20' : (isDark ? '#0D0D0D' : '#F5F5F5'),
                      borderWidth: 1.5, borderColor: status === s.key ? s.color : (isDark ? '#1A1A1A' : '#D0D0D0'),
                    }}
                  >
                    <Text style={{ color: status === s.key ? s.color : (isDark ? '#555555' : '#888888'), fontSize: 12, fontWeight: '700' }}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Assignee */}
              <Text style={dynamicLabelStyle}>Assign To</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                <TouchableOpacity
                  onPress={() => setAssigneeId(null)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
                    backgroundColor: assigneeId === null ? '#88888820' : (isDark ? '#0D0D0D' : '#F5F5F5'),
                    borderWidth: 1.5, borderColor: assigneeId === null ? '#888888' : (isDark ? '#1A1A1A' : '#D0D0D0'),
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: assigneeId === null ? '#888888' : (isDark ? '#555555' : '#888888'), fontSize: 12, fontWeight: '700' }}>Unassigned</Text>
                </TouchableOpacity>
                {membersList.map((m: any) => {
                  const member = m.member ?? m;
                  const selected = assigneeId === member.id;
                  return (
                    <TouchableOpacity
                      key={member.id}
                      onPress={() => setAssigneeId(member.id)}
                      style={{
                        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
                        backgroundColor: selected ? '#88888820' : (isDark ? '#0D0D0D' : '#F5F5F5'),
                        borderWidth: 1.5, borderColor: selected ? '#888888' : (isDark ? '#1A1A1A' : '#D0D0D0'),
                        flexDirection: 'row', alignItems: 'center', gap: 7,
                      }}
                    >
                      <MemberAvatar name={member.name} size={22} color={selected ? '#888888' : (isDark ? '#555555' : '#888888')} />
                      <Text style={{ color: selected ? '#888888' : (isDark ? '#555555' : '#64748b'), fontSize: 12, fontWeight: '600' }}>
                        {member.name?.split(' ')[0] ?? 'Member'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Due Date */}
              <Text style={dynamicLabelStyle}>Due Date (YYYY-MM-DD)</Text>
              <TextInput
                value={dueDate}
                onChangeText={setDueDate}
                placeholder="2025-12-31"
                placeholderTextColor={isDark ? '#555555' : '#AAAAAA'}
                style={dynamicInputStyle}
              />

              {/* Tags */}
              <Text style={dynamicLabelStyle}>Skill Tags</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <TextInput
                  value={tagInput}
                  onChangeText={setTagInput}
                  onSubmitEditing={addTag}
                  placeholder="e.g. frontend"
                  placeholderTextColor={isDark ? '#555555' : '#AAAAAA'}
                  style={[dynamicInputStyle, { flex: 1, marginBottom: 0 }]}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  onPress={addTag}
                  style={{ backgroundColor: isDark ? '#1A1A1A' : '#F5F5F5', borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center' }}
                >
                  <Ionicons name="add" size={18} />
                </TouchableOpacity>
              </View>
              {tags.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
                  {tags.map(tag => (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => setTags(prev => prev.filter(t => t !== tag))}
                      style={{ backgroundColor: isDark ? '#1A1A1A' : '#F5F5F5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    >
                      <Text style={{ color: '#888888', fontSize: 11, fontWeight: '600' }}>#{tag}</Text>
                      <Ionicons name="close-circle" size={12} color={isDark ? '#555555' : '#AAAAAA'} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Buttons */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <Button label="Cancel" onPress={() => { setShowCreate(false); resetForm(); }} variant="secondary" style={{ flex: 1 }} />
                <Button label="Create Task" onPress={handleCreate} loading={createMutation.isPending} style={{ flex: 1 }} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const labelStyle = {
  color: '#555555',
  fontSize: 11,
  fontWeight: '700' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.8,
  marginBottom: 8,
};

const inputStyle = {
  backgroundColor: '#000000',
  borderWidth: 1,
  borderColor: '#1A1A1A',
  borderRadius: 14,
  paddingHorizontal: 16,
  paddingVertical: 12,
  color: '#F5F5F5',
  fontSize: 14,
  marginBottom: 16,
};
