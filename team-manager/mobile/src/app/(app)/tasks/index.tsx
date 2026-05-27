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
  StyleSheet,
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

const PRIORITY_ACCENT: Record<string, string> = {
  urgent: '#f43f5e',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#475569',
};

const PRIORITY_DOT: Record<string, string> = {
  urgent: '#f43f5e',
  high: '#f59e0b',
  medium: '#0ea5e9',
  low: '#64748b',
};

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
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Tasks</Text>
          {activeTeam && (
            <Text style={styles.headerSubtext}>{activeTeam.name}</Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => setShowCreate(true)}
          style={styles.newButton}
          activeOpacity={0.8}
        >
          <Text style={styles.newButtonText}>＋ New</Text>
        </TouchableOpacity>
      </View>

      {/* Status filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsContent}
      >
        {STATUSES.map((s) => {
          const count = allTasks.filter((t) => t.status === s.key).length;
          const isActive = activeStatus === s.key;
          return (
            <TouchableOpacity
              key={s.key}
              onPress={() => setActiveStatus(s.key)}
              style={[styles.tab, isActive ? styles.tabActive : styles.tabInactive]}
              activeOpacity={0.75}
            >
              <Text style={styles.tabEmoji}>{s.emoji}</Text>
              <Text style={[styles.tabLabel, isActive ? styles.tabLabelActive : styles.tabLabelInactive]}>
                {s.label}
              </Text>
              <View style={[styles.tabBadge, isActive ? styles.tabBadgeActive : styles.tabBadgeInactive]}>
                <Text style={styles.tabBadgeText}>{count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

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
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            title={`No ${activeStatus} tasks`}
            description="All clear here!"
            icon={STATUSES.find((s) => s.key === activeStatus)?.emoji}
          />
        }
        renderItem={({ item }) => {
          const accentColor = PRIORITY_ACCENT[item.priority] ?? '#475569';
          return (
            <View style={[styles.taskCard, { borderLeftColor: accentColor }]}>
              {/* Title row */}
              <View style={styles.taskTitleRow}>
                <Text style={styles.taskTitle} numberOfLines={2}>
                  {item.title}
                </Text>
              </View>

              {/* Description */}
              {item.description ? (
                <Text style={styles.taskDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}

              {/* Due date */}
              {item.dueDate && (
                <Text style={styles.taskDueDate}>
                  📅 {format(new Date(item.dueDate), 'MMM d, yyyy')}
                </Text>
              )}

              {/* Footer: priority badge + move actions */}
              <View style={styles.taskFooter}>
                <Badge label={item.priority} variant={priorityVariant(item.priority)} />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.moveActionsContent}
                  style={styles.moveActionsScroll}
                >
                  {STATUSES.filter((s) => s.key !== item.status).map((s) => (
                    <TouchableOpacity
                      key={s.key}
                      onPress={() => handleMoveTask(item.id, s.key)}
                      style={styles.moveButton}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.moveButtonText}>→ {s.label}</Text>
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
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Drag handle */}
            <View style={styles.dragHandle} />

            <Text style={styles.modalTitle}>New Task</Text>

            {/* Title field */}
            <Text style={styles.fieldLabel}>TITLE *</Text>
            <TextInput
              value={form.title}
              onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
              placeholder="Task title"
              placeholderTextColor="#475569"
              style={styles.textInput}
            />

            {/* Description field */}
            <Text style={styles.fieldLabel}>DESCRIPTION</Text>
            <TextInput
              value={form.description}
              onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
              placeholder="Optional description"
              placeholderTextColor="#475569"
              multiline
              numberOfLines={3}
              style={[styles.textInput, styles.textInputMultiline]}
            />

            {/* Priority selector */}
            <Text style={styles.fieldLabel}>PRIORITY</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.priorityPickerContent}
              style={styles.priorityPickerScroll}
            >
              {(['low', 'medium', 'high', 'urgent'] as const).map((p) => {
                const isSelected = form.priority === p;
                return (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setForm((f) => ({ ...f, priority: p }))}
                    style={[
                      styles.priorityPill,
                      isSelected ? styles.priorityPillActive : styles.priorityPillInactive,
                    ]}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.priorityDot, { backgroundColor: PRIORITY_DOT[p] }]} />
                    <Text
                      style={[
                        styles.priorityPillText,
                        isSelected ? styles.priorityPillTextActive : styles.priorityPillTextInactive,
                      ]}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Actions */}
            <View style={styles.modalActions}>
              <Button
                label="Cancel"
                onPress={() => setShowCreate(false)}
                variant="secondary"
                style={{ flex: 1 }}
              />
              <Button
                label="Create Task"
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
  newButton: {
    backgroundColor: '#0ea5e9',
    borderRadius: 100,
    paddingHorizontal: 18,
    paddingVertical: 11,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },

  // Status tabs
  tabsScroll: {
    marginBottom: 12,
  },
  tabsContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
    minHeight: 44,
  },
  tabActive: {
    backgroundColor: '#0ea5e9',
    borderColor: '#38bdf8',
  },
  tabInactive: {
    backgroundColor: '#1e293b',
    borderColor: 'rgba(51,65,85,0.6)',
  },
  tabEmoji: {
    fontSize: 14,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#ffffff',
  },
  tabLabelInactive: {
    color: '#94a3b8',
  },
  tabBadge: {
    borderRadius: 100,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tabBadgeInactive: {
    backgroundColor: '#334155',
  },
  tabBadgeText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '700',
  },

  // Task list
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },

  // Task card
  taskCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    // subtle overall border
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  taskTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  taskTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    lineHeight: 22,
  },
  taskDescription: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  taskDueDate: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 12,
  },
  taskFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'nowrap',
  },
  moveActionsScroll: {
    flex: 1,
  },
  moveActionsContent: {
    gap: 6,
    alignItems: 'center',
  },
  moveButton: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(51,65,85,0.8)',
  },
  moveButtonText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '500',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
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

  // Priority picker
  priorityPickerScroll: {
    marginBottom: 20,
  },
  priorityPickerContent: {
    gap: 8,
    paddingVertical: 2,
  },
  priorityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1,
    minHeight: 40,
  },
  priorityPillActive: {
    backgroundColor: '#0c4a6e',
    borderColor: '#0ea5e9',
  },
  priorityPillInactive: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityPillText: {
    fontSize: 13,
    fontWeight: '500',
  },
  priorityPillTextActive: {
    color: '#e0f2fe',
  },
  priorityPillTextInactive: {
    color: '#94a3b8',
  },

  // Modal actions
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
});
