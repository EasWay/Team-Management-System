import { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { trpc } from '@/lib/api';
import { useTeamStore } from '@/store/teamStore';
import { LoadingScreen } from '@/components/LoadingScreen';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { getSocket, joinTeamRoom, leaveTeamRoom } from '@/lib/socket';
import { format } from 'date-fns';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Status = 'todo' | 'in_progress' | 'review' | 'done';

const STATUSES: {
  key: Status;
  label: string;
  icon: IconName;
  emptyIcon: IconName;
  color: string;
  bg: string;
}[] = [
  { key: 'todo',        label: 'To Do',      icon: 'list-outline',             emptyIcon: 'checkmark-done-circle-outline', color: '#94a3b8', bg: '#94a3b8' },
  { key: 'in_progress', label: 'In Progress', icon: 'flash-outline',           emptyIcon: 'flash-off-outline',             color: '#38bdf8', bg: '#0ea5e9' },
  { key: 'review',      label: 'Review',     icon: 'eye-outline',              emptyIcon: 'eye-off-outline',               color: '#a78bfa', bg: '#8b5cf6' },
  { key: 'done',        label: 'Done',       icon: 'checkmark-circle-outline', emptyIcon: 'checkmark-done-circle',         color: '#34d399', bg: '#10b981' },
];

const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

const PRIORITY_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  low:    { color: '#94a3b8', bg: '#94a3b822', label: 'Low' },
  medium: { color: '#38bdf8', bg: '#38bdf822', label: 'Medium' },
  high:   { color: '#fb923c', bg: '#fb923c22', label: 'High' },
  urgent: { color: '#f87171', bg: '#f8717122', label: 'Urgent' },
};

function priorityVariant(p: string): 'danger' | 'warning' | 'info' | 'default' {
  if (p === 'urgent') return 'danger';
  if (p === 'high') return 'warning';
  if (p === 'medium') return 'info';
  return 'default';
}

interface Task {
  id: number;
  title: string;
  description?: string;
  status: Status;
  priority: string;
  assignedTo?: number;
  dueDate?: string;
}

interface CreateTaskForm {
  title: string;
  description: string;
  priority: string;
  status: Status;
}

export default function TasksScreen() {
  const { activeTeam } = useTeamStore();
  const [activeStatus, setActiveStatus] = useState<Status>('todo');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateTaskForm>({
    title: '',
    description: '',
    priority: 'medium',
    status: 'todo',
  });

  const utils = trpc.useUtils();

  const tasksQuery = trpc.tasks.list.useQuery(
    { teamId: activeTeam?.id ?? 0 },
    { enabled: !!activeTeam?.id }
  );

  const createMutation = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      setShowCreate(false);
      setForm({ title: '', description: '', priority: 'medium', status: 'todo' });
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const moveMutation = trpc.tasks.move.useMutation({
    onSuccess: () => utils.tasks.list.invalidate(),
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  // Real-time socket updates
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

  const allTasks = (tasksQuery.data as Task[] ?? []);
  const filtered = allTasks.filter((t) => t.status === activeStatus);

  const handleCreate = () => {
    if (!form.title.trim()) {
      Alert.alert('Required', 'Task title is required.');
      return;
    }
    createMutation.mutate({
      title: form.title.trim(),
      description: form.description.trim(),
      priority: form.priority as any,
      status: form.status,
      teamId: activeTeam!.id,
    });
  };

  const currentStatus = STATUSES.find((s) => s.key === activeStatus)!;

  if (tasksQuery.isLoading && !tasksQuery.data) return <LoadingScreen />;

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">

      {/* Header */}
      <View className="px-5 pt-5 pb-4 flex-row justify-between items-start">
        <View>
          <Text className="text-2xl font-bold text-slate-900 dark:text-white">Tasks</Text>
          {activeTeam && (
            <Text className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{activeTeam.name}</Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => setShowCreate(true)}
          className="bg-sky-500 rounded-2xl px-4 py-2.5 flex-row items-center gap-1.5"
          style={{ shadowColor: '#0ea5e9', shadowRadius: 8, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 3 } }}
        >
          <Ionicons name="add" size={16} color="#fff" />
          <Text className="text-white font-bold text-sm">New Task</Text>
        </TouchableOpacity>
      </View>

      {/* Status tab strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-3"
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
      >
        {STATUSES.map((s) => {
          const count = allTasks.filter((t) => t.status === s.key).length;
          const isActive = activeStatus === s.key;
          return (
            <TouchableOpacity
              key={s.key}
              onPress={() => setActiveStatus(s.key)}
              className={`px-4 py-2.5 rounded-2xl flex-row items-center gap-2 border ${
                isActive
                  ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
              }`}
            >
              <Ionicons
                name={s.icon}
                size={14}
                color={isActive ? (s.color) : '#94a3b8'}
              />
              <Text
                className={`font-semibold text-xs ${
                  isActive ? 'text-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {s.label}
              </Text>
              {count > 0 && (
                <View
                  className={`rounded-full min-w-5 h-5 items-center justify-center px-1.5 ${
                    isActive ? 'bg-white/20 dark:bg-slate-900/20' : 'bg-slate-100 dark:bg-slate-700'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      isActive ? 'text-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-400'
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

      {/* Status label bar */}
      <View className="px-5 mb-3 flex-row items-center gap-2">
        <View className="w-2 h-2 rounded-full" style={{ backgroundColor: currentStatus.color }} />
        <Text className="text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
          {currentStatus.label}
        </Text>
        <Text className="text-slate-400 dark:text-slate-500 text-xs">
          · {filtered.length} task{filtered.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Task list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={tasksQuery.isFetching}
            onRefresh={() => tasksQuery.refetch()}
            tintColor="#0ea5e9"
          />
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        ListEmptyComponent={
          <EmptyState
            title={`No ${currentStatus.label} tasks`}
            description="All clear here!"
            icon={currentStatus.emptyIcon}
            iconColor={currentStatus.color}
          />
        }
        renderItem={({ item }) => {
          const pStyle = PRIORITY_STYLES[item.priority] ?? PRIORITY_STYLES.medium;
          return (
            <View
              className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-3 border border-slate-200 dark:border-slate-700"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 }}
            >
              {/* Priority stripe */}
              <View className="flex-row items-start justify-between mb-2 gap-2">
                <Text className="text-slate-900 dark:text-white font-semibold text-base flex-1 leading-snug">
                  {item.title}
                </Text>
                <View
                  className="rounded-xl px-2.5 py-1 flex-shrink-0"
                  style={{ backgroundColor: pStyle.bg }}
                >
                  <Text className="text-xs font-bold" style={{ color: pStyle.color }}>
                    {pStyle.label}
                  </Text>
                </View>
              </View>

              {item.description ? (
                <Text className="text-slate-500 dark:text-slate-400 text-sm mb-3 leading-5" numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}

              {item.dueDate && (
                <View className="flex-row items-center gap-1.5 mb-3">
                  <Ionicons name="calendar-outline" size={12} color="#64748b" />
                  <Text className="text-slate-400 dark:text-slate-500 text-xs">
                    Due {format(new Date(item.dueDate), 'MMM d, yyyy')}
                  </Text>
                </View>
              )}

              {/* Move actions */}
              <View className="border-t border-slate-100 dark:border-slate-700 pt-3 mt-1">
                <Text className="text-slate-400 dark:text-slate-500 text-xs mb-2 uppercase font-semibold tracking-wider">Move to</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {STATUSES.filter((s) => s.key !== item.status).map((s) => (
                    <TouchableOpacity
                      key={s.key}
                      onPress={() => moveMutation.mutate({ id: item.id, status: s.key })}
                      className="rounded-xl px-3 py-1.5 border flex-row items-center gap-1.5"
                      style={{ borderColor: s.color + '60', backgroundColor: s.color + '12' }}
                    >
                      <Ionicons name={s.icon} size={11} color={s.color} />
                      <Text className="text-xs font-semibold" style={{ color: s.color }}>
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          );
        }}
      />

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white dark:bg-slate-900 rounded-t-3xl px-5 pt-6 pb-10 border-t border-slate-200 dark:border-slate-700">
            <View className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full self-center mb-5" />
            <Text className="text-xl font-bold text-slate-900 dark:text-white mb-5">New Task</Text>

            <Text className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Title *</Text>
            <TextInput
              value={form.title}
              onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
              placeholder="What needs to be done?"
              placeholderTextColor="#94a3b8"
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl px-4 py-3.5 text-slate-900 dark:text-white mb-4"
            />

            <Text className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Description</Text>
            <TextInput
              value={form.description}
              onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
              placeholder="Add details (optional)"
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl px-4 py-3.5 text-slate-900 dark:text-white mb-4"
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />

            <Text className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Priority</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
              {PRIORITIES.map((p) => {
                const ps = PRIORITY_STYLES[p];
                const isSelected = form.priority === p;
                return (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setForm((f) => ({ ...f, priority: p }))}
                    className="px-4 py-2 rounded-2xl border"
                    style={{
                      backgroundColor: isSelected ? ps.color : 'transparent',
                      borderColor: isSelected ? ps.color : '#cbd5e1',
                    }}
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: isSelected ? '#fff' : ps.color }}
                    >
                      {ps.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View className="flex-row gap-3">
              <Button label="Cancel" onPress={() => setShowCreate(false)} variant="secondary" style={{ flex: 1 }} />
              <Button label="Create Task" onPress={handleCreate} loading={createMutation.isPending} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
