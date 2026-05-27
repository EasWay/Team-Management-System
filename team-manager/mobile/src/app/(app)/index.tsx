import { ScrollView, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { trpc } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useTeamStore } from '@/store/teamStore';
import { LoadingScreen } from '@/components/LoadingScreen';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/Badge';
import { format } from 'date-fns';

function statusVariant(status: string): 'primary' | 'success' | 'warning' | 'danger' | 'default' {
  switch (status) {
    case 'todo': return 'default';
    case 'in_progress': return 'primary';
    case 'done': return 'success';
    case 'blocked': return 'danger';
    default: return 'default';
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
  const refetch = () => {
    tasksQuery.refetch();
    projectsQuery.refetch();
  };

  const myTasks = (tasksQuery.data as any[] ?? []).filter(
    (t: any) => t.assignedTo === user?.id && t.status !== 'done'
  );

  const recentProjects = (projectsQuery.data as any[] ?? []).slice(0, 5);

  if (isLoading && !tasksQuery.data) return <LoadingScreen />;

  return (
    <SafeAreaView className="flex-1 bg-slate-900">
      <ScrollView
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#0ea5e9" />}
      >
        {/* Header */}
        <View className="px-5 pt-4 pb-2">
          <Text className="text-2xl font-bold text-white">Good morning 👋</Text>
          <Text className="text-slate-400 text-sm mt-1">{user?.name}</Text>
        </View>

        {/* Quick links */}
        <View className="flex-row gap-3 px-5 mt-4">
          {[
            { label: '📋 Tasks', route: '/(app)/tasks' },
            { label: '📁 Projects', route: '/(app)/projects' },
            { label: '📅 Calendar', route: '/(app)/calendar' },
            { label: '🏛️ Conference', route: '/(app)/conference' },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              onPress={() => router.push(item.route as any)}
              className="flex-1 bg-slate-800 rounded-xl p-3 items-center border border-slate-700"
            >
              <Text className="text-xs text-slate-300 text-center font-medium">{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* My Tasks */}
        <View className="px-5 mt-6">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-bold text-white">My Tasks</Text>
            <TouchableOpacity onPress={() => router.push('/(app)/tasks')}>
              <Text className="text-sky-400 text-sm">See all</Text>
            </TouchableOpacity>
          </View>

          {myTasks.length === 0 ? (
            <View className="bg-slate-800 rounded-xl p-6 items-center border border-slate-700">
              <Text className="text-2xl mb-2">✅</Text>
              <Text className="text-slate-300 font-medium">All caught up!</Text>
              <Text className="text-slate-500 text-sm mt-1">No tasks assigned to you.</Text>
            </View>
          ) : (
            myTasks.slice(0, 5).map((task: any) => (
              <TouchableOpacity
                key={task.id}
                onPress={() => router.push(`/(app)/tasks?taskId=${task.id}` as any)}
                className="bg-slate-800 rounded-xl p-4 mb-2 border border-slate-700"
              >
                <View className="flex-row justify-between items-start mb-2">
                  <Text className="text-white font-semibold flex-1 mr-2">{task.title}</Text>
                  <Badge label={task.status} variant={statusVariant(task.status)} />
                </View>
                {task.description ? (
                  <Text className="text-slate-400 text-sm mb-2" numberOfLines={2}>
                    {task.description}
                  </Text>
                ) : null}
                <View className="flex-row gap-2">
                  <Badge label={task.priority} variant={priorityVariant(task.priority)} />
                  {task.dueDate && (
                    <Text className="text-slate-500 text-xs self-center">
                      Due {format(new Date(task.dueDate), 'MMM d')}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Recent Projects */}
        <View className="px-5 mt-6 mb-8">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-bold text-white">Projects</Text>
            <TouchableOpacity onPress={() => router.push('/(app)/projects')}>
              <Text className="text-sky-400 text-sm">See all</Text>
            </TouchableOpacity>
          </View>

          {recentProjects.length === 0 ? (
            <EmptyState title="No projects yet" icon="📁" />
          ) : (
            recentProjects.map((project: any) => (
              <TouchableOpacity
                key={project.id}
                onPress={() => router.push(`/(app)/projects?projectId=${project.id}` as any)}
                className="bg-slate-800 rounded-xl p-4 mb-2 border border-slate-700"
              >
                <Text className="text-white font-semibold">{project.name}</Text>
                {project.description ? (
                  <Text className="text-slate-400 text-sm mt-1" numberOfLines={2}>
                    {project.description}
                  </Text>
                ) : null}
                {project.workflowStage ? (
                  <View className="mt-2">
                    <Badge label={project.workflowStage} variant="primary" />
                  </View>
                ) : null}
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
