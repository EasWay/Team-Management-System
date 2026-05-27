import { useState, useEffect, useCallback } from 'react';
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
import { trpc } from '@/lib/api';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';
import { LoadingScreen } from '@/components/LoadingScreen';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { getSocket, joinTeamRoom, leaveTeamRoom } from '@/lib/socket';
import { format } from 'date-fns';

type Status = 'todo' | 'in_progress' | 'review' | 'done';

const STATUSES: { key: Status; label: string; emoji: string }[] = [
  { key: 'todo', label: 'To Do', emoji: '📋' },
  { key: 'in_progress', label: 'In Progress', emoji: '⚡' },
  { key: 'review', label: 'Review', emoji: '🔍' },
  { key: 'done', label: 'Done', emoji: '✅' },
];

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
  const { user } = useAuthStore();
  const [activeStatus, setActiveStatus] = useState<Status>('todo');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateTaskForm>({
    title: '',
    description: '',
    priority: 'medium',
    status: 'todo' as Status,
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
    onError: (err) => Alert.alert('Error', err.message),
  });

  const moveMutation = trpc.tasks.move.useMutation({
    onSuccess: () => utils.tasks.list.invalidate(),
  });

  // Real-time socket updates
  useEffect(() => {
    if (!activeTeam?.id) return;
    getSocket().then((sock) => {
      joinTeamRoom(activeTeam.id);
      const refresh = () => utils.tasks.list.invalidate();
      sock.on('taskCreated', refresh);
      sock.on('taskUpdated', refresh);
      sock.on('taskMoved', refresh);
      sock.on('taskDeleted', refresh);
      return () => {
        leaveTeamRoom(activeTeam.id);
        sock.off('taskCreated', refresh);
        sock.off('taskUpdated', refresh);
        sock.off('taskMoved', refresh);
        sock.off('taskDeleted', refresh);
      };
    });
  }, [activeTeam?.id]);

  const allTasks = (tasksQuery.data as Task[] ?? []);
  const filtered = allTasks.filter((t) => t.status === activeStatus);

  const handleMoveTask = (taskId: number, newStatus: Status) => {
    moveMutation.mutate({ id: taskId, status: newStatus });
  };

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

  if (tasksQuery.isLoading && !tasksQuery.data) return <LoadingScreen />;

  return (
    <SafeAreaView className="flex-1 bg-slate-900">
      {/* Header */}
      <View className="px-5 pt-4 pb-3 flex-row justify-between items-center">
        <View>
          <Text className="text-2xl font-bold text-white">Tasks</Text>
          {activeTeam && <Text className="text-slate-400 text-sm">{activeTeam.name}</Text>}
        </View>
        <TouchableOpacity
          onPress={() => setShowCreate(true)}
          className="bg-sky-600 rounded-xl px-4 py-2"
        >
          <Text className="text-white font-semibold">+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Status tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="px-5 mb-3"
        contentContainerStyle={{ gap: 8 }}
      >
        {STATUSES.map((s) => {
          const count = allTasks.filter((t) => t.status === s.key).length;
          return (
            <TouchableOpacity
              key={s.key}
              onPress={() => setActiveStatus(s.key)}
              className={`px-4 py-2 rounded-xl border flex-row items-center gap-2 ${
                activeStatus === s.key
                  ? 'bg-sky-600 border-sky-500'
                  : 'bg-slate-800 border-slate-700'
              }`}
            >
              <Text className="text-base">{s.emoji}</Text>
              <Text className={`font-medium text-sm ${activeStatus === s.key ? 'text-white' : 'text-slate-300'}`}>
                {s.label}
              </Text>
              {count > 0 && (
                <View className={`rounded-full min-w-5 h-5 items-center justify-center px-1 ${activeStatus === s.key ? 'bg-sky-500' : 'bg-slate-700'}`}>
                  <Text className="text-xs text-white font-bold">{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Task list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={tasksQuery.isFetching} onRefresh={() => tasksQuery.refetch()} tintColor="#0ea5e9" />
        }
        contentContainerStyle={{ padding: 20, paddingTop: 0 }}
        ListEmptyComponent={
          <EmptyState title={`No ${activeStatus} tasks`} description="All clear here!" icon={STATUSES.find(s => s.key === activeStatus)?.emoji} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity className="bg-slate-800 rounded-xl p-4 mb-3 border border-slate-700">
            <View className="flex-row justify-between items-start mb-2">
              <Text className="text-white font-semibold flex-1 mr-2 text-base">{item.title}</Text>
              <Badge label={item.priority} variant={priorityVariant(item.priority)} />
            </View>
            {item.description ? (
              <Text className="text-slate-400 text-sm mb-3" numberOfLines={2}>{item.description}</Text>
            ) : null}
            {item.dueDate && (
              <Text className="text-slate-500 text-xs mb-3">
                Due {format(new Date(item.dueDate), 'MMM d, yyyy')}
              </Text>
            )}
            {/* Move actions */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {STATUSES.filter((s) => s.key !== item.status).map((s) => (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => handleMoveTask(item.id, s.key)}
                  className="bg-slate-700 rounded-lg px-3 py-1.5"
                >
                  <Text className="text-slate-300 text-xs">Move → {s.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        )}
      />

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl px-5 pt-6 pb-10 border-t border-slate-700">
            <Text className="text-xl font-bold text-white mb-5">New Task</Text>

            <Text className="text-slate-400 text-sm mb-1">Title *</Text>
            <TextInput
              value={form.title}
              onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
              placeholder="Task title"
              placeholderTextColor="#475569"
              className="bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white mb-4"
            />

            <Text className="text-slate-400 text-sm mb-1">Description</Text>
            <TextInput
              value={form.description}
              onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
              placeholder="Optional description"
              placeholderTextColor="#475569"
              multiline
              numberOfLines={3}
              className="bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white mb-4"
            />

            <Text className="text-slate-400 text-sm mb-2">Priority</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
              {['low', 'medium', 'high', 'urgent'].map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setForm((f) => ({ ...f, priority: p }))}
                  className={`px-4 py-2 rounded-xl border ${form.priority === p ? 'bg-sky-600 border-sky-500' : 'bg-slate-800 border-slate-600'}`}
                >
                  <Text className={form.priority === p ? 'text-white font-semibold' : 'text-slate-300'}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View className="flex-row gap-3">
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
    </SafeAreaView>
  );
}
