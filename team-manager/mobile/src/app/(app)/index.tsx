import { ScrollView, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { trpc } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useTeamStore } from '@/store/teamStore';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Badge } from '@/components/Badge';
import { format } from 'date-fns';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function priorityBorderColor(priority: string): string {
  switch (priority) {
    case 'urgent': return '#f43f5e';
    case 'high': return '#f59e0b';
    case 'medium': return '#0ea5e9';
    default: return '#475569';
  }
}

function priorityVariant(priority: string): 'danger' | 'warning' | 'info' | 'default' {
  switch (priority) {
    case 'urgent': return 'danger';
    case 'high': return 'warning';
    case 'medium': return 'info';
    default: return 'default';
  }
}

function statusVariant(status: string): 'primary' | 'success' | 'warning' | 'danger' | 'default' {
  switch (status) {
    case 'todo': return 'default';
    case 'in_progress': return 'primary';
    case 'done': return 'success';
    case 'blocked': return 'danger';
    default: return 'default';
  }
}

function projectAccentColor(status: string): string {
  switch (status) {
    case 'active': return '#7c3aed';
    case 'done':
    case 'completed': return '#059669';
    default: return '#475569';
  }
}

const QUICK_TOOLS = [
  { emoji: '✅', label: 'Tasks', desc: 'View & manage', route: '/(app)/tasks' },
  { emoji: '📁', label: 'Projects', desc: 'Track progress', route: '/(app)/projects' },
  { emoji: '📅', label: 'Calendar', desc: 'Schedule & events', route: '/(app)/calendar' },
  { emoji: '🏛️', label: 'Conference', desc: 'Rooms & meetings', route: '/(app)/conference' },
];

export default function MyOfficeScreen() {
  const { user } = useAuthStore();
  const { activeTeam } = useTeamStore();
  const router = useRouter();

  const tasksQuery = trpc.tasks.list.useQuery(
    { teamId: activeTeam?.id ?? 0 },
    { enabled: !!activeTeam?.id }
  );

  const projectsQuery = trpc.projects.list.useQuery(
    { teamId: activeTeam?.id ?? 0 },
    { enabled: !!activeTeam?.id }
  );

  const isLoading = tasksQuery.isLoading || projectsQuery.isLoading;
  const isRefreshing = tasksQuery.isFetching || projectsQuery.isFetching;

  const refetch = () => {
    tasksQuery.refetch();
    projectsQuery.refetch();
  };

  const allTasks: any[] = tasksQuery.data as any[] ?? [];
  const focusTasks = allTasks
    .filter((t: any) =>
      t.assignedTo === user?.id &&
      t.status !== 'done' &&
      (t.status === 'in_progress' || t.priority === 'high' || t.priority === 'urgent')
    )
    .slice(0, 3);

  const recentProjects: any[] = (projectsQuery.data as any[] ?? []).slice(0, 3);

  if (isLoading && !tasksQuery.data && !projectsQuery.data) return <LoadingScreen />;

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#020617' }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refetch}
            tintColor="#0ea5e9"
            colors={['#0ea5e9']}
          />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      >

        {/* ── Header ── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: '#64748b', fontWeight: '500', letterSpacing: 0.4, marginBottom: 4 }}>
                {getGreeting()}
              </Text>
              <Text style={{ fontSize: 26, fontWeight: '700', color: '#f8fafc', letterSpacing: -0.5 }}>
                {firstName}
              </Text>
            </View>
            {activeTeam && (
              <View
                style={{
                  backgroundColor: 'rgba(14, 165, 233, 0.12)',
                  borderColor: 'rgba(14, 165, 233, 0.35)',
                  borderWidth: 1,
                  borderRadius: 20,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  minHeight: 32,
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#38bdf8', fontSize: 12, fontWeight: '600' }}>
                  {activeTeam.name}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Today's Focus ── */}
        <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748b', letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Today's Focus
            </Text>
            {focusTasks.length > 0 && (
              <TouchableOpacity
                onPress={() => router.push('/(app)/tasks' as any)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ minHeight: 24, justifyContent: 'center' }}
              >
                <Text style={{ color: '#0ea5e9', fontSize: 12, fontWeight: '600' }}>View all</Text>
              </TouchableOpacity>
            )}
          </View>

          {focusTasks.length === 0 ? (
            <View
              style={{
                backgroundColor: '#0f172a',
                borderRadius: 16,
                padding: 24,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: 'rgba(51, 65, 85, 0.6)',
              }}
            >
              <Text style={{ fontSize: 32, marginBottom: 8 }}>🎉</Text>
              <Text style={{ color: '#e2e8f0', fontSize: 15, fontWeight: '600', marginBottom: 4 }}>
                You're all caught up
              </Text>
              <Text style={{ color: '#475569', fontSize: 13 }}>No urgent tasks right now</Text>
            </View>
          ) : (
            focusTasks.map((task: any) => (
              <TouchableOpacity
                key={task.id}
                onPress={() => router.push(`/(app)/tasks?taskId=${task.id}` as any)}
                activeOpacity={0.75}
                style={{
                  backgroundColor: '#0f172a',
                  borderRadius: 14,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: 'rgba(51, 65, 85, 0.6)',
                  borderLeftWidth: 3,
                  borderLeftColor: priorityBorderColor(task.priority),
                  minHeight: 72,
                  paddingVertical: 14,
                  paddingRight: 16,
                  paddingLeft: 16,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <Text
                    style={{ color: '#f1f5f9', fontSize: 14, fontWeight: '600', flex: 1, marginRight: 10, lineHeight: 20 }}
                    numberOfLines={2}
                  >
                    {task.title}
                  </Text>
                  <Badge label={task.status.replace('_', ' ')} variant={statusVariant(task.status)} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Badge label={task.priority} variant={priorityVariant(task.priority)} />
                  {task.dueDate && (
                    <Text style={{ color: '#475569', fontSize: 11, fontWeight: '500' }}>
                      Due {format(new Date(task.dueDate), 'MMM d')}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* ── Quick Tools ── */}
        <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748b', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 }}>
            Quick Tools
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {QUICK_TOOLS.map((tool) => (
              <TouchableOpacity
                key={tool.label}
                onPress={() => router.push(tool.route as any)}
                activeOpacity={0.72}
                style={{
                  width: '47%',
                  backgroundColor: '#1e293b',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(51, 65, 85, 0.6)',
                  minHeight: 88,
                  padding: 16,
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 28, marginBottom: 8 }}>{tool.emoji}</Text>
                <Text style={{ color: '#f1f5f9', fontSize: 14, fontWeight: '700', marginBottom: 2 }}>{tool.label}</Text>
                <Text style={{ color: '#475569', fontSize: 11, fontWeight: '500' }}>{tool.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Active Projects ── */}
        <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748b', letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Active Projects
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(app)/projects' as any)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ minHeight: 24, justifyContent: 'center' }}
            >
              <Text style={{ color: '#0ea5e9', fontSize: 12, fontWeight: '600' }}>View all</Text>
            </TouchableOpacity>
          </View>

          {recentProjects.length === 0 ? (
            <View
              style={{
                backgroundColor: '#0f172a',
                borderRadius: 16,
                padding: 20,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: 'rgba(51, 65, 85, 0.6)',
              }}
            >
              <Text style={{ color: '#475569', fontSize: 13 }}>No projects yet</Text>
            </View>
          ) : (
            recentProjects.map((project: any) => (
              <TouchableOpacity
                key={project.id}
                onPress={() => router.push(`/(app)/projects?projectId=${project.id}` as any)}
                activeOpacity={0.75}
                style={{
                  backgroundColor: '#0f172a',
                  borderRadius: 14,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: 'rgba(51, 65, 85, 0.6)',
                  minHeight: 64,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: projectAccentColor(project.status ?? 'active'),
                    marginRight: 14,
                    flexShrink: 0,
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#f1f5f9', fontSize: 14, fontWeight: '600', marginBottom: 2 }} numberOfLines={1}>
                    {project.name}
                  </Text>
                  {project.description ? (
                    <Text style={{ color: '#475569', fontSize: 12 }} numberOfLines={1}>
                      {project.description}
                    </Text>
                  ) : null}
                </View>
                <Text style={{ color: '#334155', fontSize: 18, marginLeft: 8 }}>›</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
