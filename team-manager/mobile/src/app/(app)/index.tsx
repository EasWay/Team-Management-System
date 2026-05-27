import { ScrollView, View, Text, TouchableOpacity, RefreshControl, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { trpc } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useTeamStore } from '@/store/teamStore';
import { format, formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/Badge';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const QUICK_ACTIONS: { label: string; icon: IconName; route: string; color: string }[] = [
  { label: 'Tasks',      icon: 'checkmark-circle', route: '/(app)/tasks',      color: '#38bdf8' },
  { label: 'Projects',   icon: 'folder',           route: '/(app)/projects',   color: '#a78bfa' },
  { label: 'Calendar',   icon: 'calendar',         route: '/(app)/calendar',   color: '#34d399' },
  { label: 'Conference', icon: 'videocam',         route: '/(app)/conference', color: '#fb923c' },
];

const AVATAR_COLORS = ['#0369a1', '#7c3aed', '#059669', '#b45309', '#be185d', '#0e7490'];

const STAGE_COLORS: Record<string, 'primary' | 'warning' | 'success' | 'danger' | 'default'> = {
  ideation:    'primary',
  planning:    'default',
  development: 'warning',
  review:      'default',
  qa:          'warning',
  completed:   'success',
  archived:    'default',
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function MemberAvatar({ name, size = 38 }: { name?: string; size?: number }) {
  const safeName = name ?? '?';
  const color = AVATAR_COLORS[(safeName.charCodeAt(0) ?? 63) % AVATAR_COLORS.length];
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }}
      className="items-center justify-center"
    >
      <Text style={{ fontSize: size * 0.38, color: '#fff', fontWeight: '700' }}>
        {safeName[0].toUpperCase()}
      </Text>
    </View>
  );
}

function StatCard({
  icon, label, value, color, onPress,
}: {
  icon: IconName; label: string; value: number | string; color: string; onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      className="flex-1 bg-white dark:bg-slate-800 rounded-2xl p-4 items-center border border-slate-200 dark:border-slate-700"
    >
      <Ionicons name={icon} size={22} color={color} />
      <Text className="text-slate-900 dark:text-white text-xl font-bold mt-1">{value}</Text>
      <Text className="text-slate-400 dark:text-slate-500 text-xs mt-0.5 text-center">{label}</Text>
    </TouchableOpacity>
  );
}

function MetricCard({
  label, value, unit, trend, direction, icon,
}: {
  label: string; value: string; unit: string; trend: string; direction: 'up' | 'down'; icon: IconName;
}) {
  const isUp = direction === 'up';
  const trendColor = isUp ? '#22c55e' : '#f87171';
  const trendIcon: IconName = isUp ? 'trending-up-outline' : 'trending-down-outline';
  return (
    <View
      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4"
      style={{ minWidth: 148 }}
    >
      <View className="flex-row justify-between items-start mb-3">
        <Text className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider flex-1 mr-1" numberOfLines={2}>
          {label}
        </Text>
        <Ionicons name={icon} size={14} color="#94a3b8" />
      </View>
      <Text className="text-slate-900 dark:text-white text-2xl font-bold tracking-tight">
        {value}
        <Text className="text-slate-400 dark:text-slate-500 text-xs font-normal"> {unit}</Text>
      </Text>
      <View className="flex-row items-center gap-1 mt-2">
        <Ionicons name={trendIcon} size={11} color={trendColor} />
        <Text style={{ color: trendColor }} className="text-xs font-medium">{trend}</Text>
      </View>
    </View>
  );
}

function activityIcon(type: string): { icon: IconName; color: string } {
  if (type.includes('task'))                        return { icon: 'checkmark-circle-outline', color: '#38bdf8' };
  if (type.includes('project'))                     return { icon: 'folder-outline',           color: '#a78bfa' };
  if (type.includes('member') || type.includes('invite')) return { icon: 'person-add-outline', color: '#34d399' };
  if (type.includes('comment'))                     return { icon: 'chatbubble-outline',        color: '#fb923c' };
  if (type.includes('repo'))                        return { icon: 'logo-github',               color: '#94a3b8' };
  return                                                   { icon: 'radio-button-on-outline',   color: '#64748b' };
}

function statusVariant(status: string): 'primary' | 'success' | 'warning' | 'danger' | 'default' {
  switch (status) {
    case 'todo':        return 'default';
    case 'in_progress': return 'primary';
    case 'done':        return 'success';
    case 'blocked':     return 'danger';
    default:            return 'default';
  }
}

function priorityVariant(priority: string): 'danger' | 'warning' | 'info' | 'default' {
  if (priority === 'urgent') return 'danger';
  if (priority === 'high')   return 'warning';
  if (priority === 'medium') return 'info';
  return 'default';
}

export default function MyOfficeScreen() {
  const { user } = useAuthStore();
  const { activeTeam } = useTeamStore();
  const router = useRouter();

  const teamId = activeTeam?.id ?? 0;

  const tasksQuery = trpc.tasks.list.useQuery(
    { teamId },
    { enabled: !!activeTeam?.id }
  );
  const projectsQuery = trpc.projects.list.useQuery(
    { teamId },
    { enabled: !!activeTeam?.id }
  );
  const membersQuery = trpc.teams.getMembers.useQuery(
    { teamId },
    { enabled: !!activeTeam?.id }
  );
  const reposQuery = trpc.repositories.listFromAccount.useQuery(
    { teamId },
    { enabled: !!activeTeam?.id }
  );
  const metricsQuery = trpc.analytics.getDashboardMetrics.useQuery(
    { teamId },
    { enabled: !!activeTeam?.id }
  );
  const activitiesQuery = trpc.activities.list.useQuery(
    { teamId, limit: 8 },
    { enabled: !!activeTeam?.id }
  );

  const isRefreshing =
    tasksQuery.isFetching ||
    projectsQuery.isFetching ||
    membersQuery.isFetching;

  const refetch = () => {
    tasksQuery.refetch();
    projectsQuery.refetch();
    membersQuery.refetch();
    reposQuery.refetch();
    metricsQuery.refetch();
    activitiesQuery.refetch();
  };

  const tasks      = (tasksQuery.data    as any[] ?? []);
  const projects   = (projectsQuery.data as any[] ?? []);
  const members    = (membersQuery.data  as any[] ?? []);
  const repos      = (reposQuery.data    as any[] ?? []);
  const metrics    = metricsQuery.data   as any;
  const activities = (activitiesQuery.data as any[] ?? []);

  const myTasks        = tasks.filter((t) => t.assignedTo === user?.id && t.status !== 'done');
  const openTasks      = tasks.filter((t) => t.status !== 'done').length;
  const recentProjects = projects.slice(0, 5);

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refetch} tintColor="#38bdf8" />
        }
      >
        {/* ── Header ── */}
        <View className="px-5 pt-5 pb-2 flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-slate-900 dark:text-white">{greeting()}</Text>
            <Text className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{user?.name ?? user?.email}</Text>
          </View>
          {activeTeam && (
            <TouchableOpacity
              onPress={() => router.push('/(app)/teams' as any)}
              className="bg-sky-50 dark:bg-sky-900/50 border border-sky-200 dark:border-sky-700 rounded-xl px-3 py-1.5 ml-3"
            >
              <Text className="text-sky-600 dark:text-sky-300 text-xs font-semibold">{activeTeam.name}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Stats ── */}
        <View className="flex-row gap-2.5 px-5 mt-4">
          <StatCard icon="checkmark-circle" label="Open Tasks" value={openTasks}      color="#38bdf8" onPress={() => router.push('/(app)/tasks' as any)} />
          <StatCard icon="folder"           label="Projects"   value={projects.length} color="#a78bfa" onPress={() => router.push('/(app)/projects' as any)} />
          <StatCard icon="people"           label="Members"    value={members.length}  color="#34d399" onPress={() => router.push('/(app)/teams' as any)} />
          <StatCard icon="logo-github"      label="Repos"      value={repos.length}    color="#94a3b8" onPress={() => router.push('/(app)/teams' as any)} />
        </View>

        {/* ── Analytics Metrics ── */}
        {activeTeam?.id ? (
          <View className="mt-6 px-5">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-slate-900 dark:text-white font-bold text-lg">Performance</Text>
              {metricsQuery.isLoading && <ActivityIndicator size="small" color="#38bdf8" />}
            </View>
            {metrics ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                <MetricCard label="Sprint Velocity" value={String(metrics.sprintVelocity?.value ?? '—')} unit={metrics.sprintVelocity?.unit ?? ''} trend={metrics.sprintVelocity?.trend ?? ''} direction={metrics.sprintVelocity?.direction ?? 'up'} icon="flash-outline" />
                <MetricCard label="Open Tasks"      value={String(metrics.openTasks?.value ?? '—')}      unit={metrics.openTasks?.unit ?? ''}      trend={metrics.openTasks?.trend ?? ''}      direction={metrics.openTasks?.direction ?? 'down'}  icon="alert-circle-outline" />
                <MetricCard label="Active Members"  value={String(metrics.activeMembers?.value ?? '—')}  unit={metrics.activeMembers?.unit ?? ''}  trend={metrics.activeMembers?.trend ?? ''}  direction={metrics.activeMembers?.direction ?? 'up'}  icon="people-outline" />
                <MetricCard label="Cycle Time"      value={String(metrics.cycleTime?.value ?? '—')}      unit={metrics.cycleTime?.unit ?? ''}      trend={metrics.cycleTime?.trend ?? ''}      direction={metrics.cycleTime?.direction ?? 'up'}  icon="time-outline" />
              </ScrollView>
            ) : !metricsQuery.isLoading && (
              <View className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 items-center">
                <Text className="text-slate-400 dark:text-slate-500 text-sm">No metrics available yet</Text>
              </View>
            )}
          </View>
        ) : null}

        {/* ── Quick Actions ── */}
        <View className="px-5 mt-6">
          <Text className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest mb-3">
            Quick Access
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {QUICK_ACTIONS.map((item) => (
              <TouchableOpacity
                key={item.label}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.75}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 flex-row items-center gap-3"
                style={{ width: '47%' }}
              >
                <View
                  className="rounded-xl p-2"
                  style={{ backgroundColor: item.color + '1a' }}
                >
                  <Ionicons name={item.icon} size={20} color={item.color} />
                </View>
                <Text className="text-slate-800 dark:text-slate-100 font-semibold text-sm">{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Team Members ── */}
        {members.length > 0 && (
          <View className="mt-6">
            <View className="flex-row justify-between items-center px-5 mb-3">
              <Text className="text-slate-900 dark:text-white font-bold text-lg">Team Members</Text>
              <TouchableOpacity onPress={() => router.push('/(app)/teams' as any)}>
                <Text className="text-sky-500 text-sm font-medium">See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            >
              {members.slice(0, 12).map((m: any) => {
                const memberName = m.member?.name ?? m.member?.email ?? '?';
                const firstName  = memberName.split(' ')[0];
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => router.push('/(app)/teams' as any)}
                    activeOpacity={0.75}
                    className="items-center gap-1.5"
                    style={{ width: 60 }}
                  >
                    <View className="relative">
                      <MemberAvatar name={memberName} size={48} />
                      {(m.role === 'admin' || m.role === 'owner') ? (
                        <View
                          className="absolute -bottom-0.5 -right-0.5 bg-amber-500 rounded-full items-center justify-center"
                          style={{ width: 16, height: 16 }}
                        >
                          <Ionicons name="shield-checkmark" size={9} color="#fff" />
                        </View>
                      ) : null}
                    </View>
                    <Text className="text-slate-500 dark:text-slate-400 text-xs text-center" numberOfLines={1}>
                      {firstName}
                    </Text>
                    {m.role && (
                      <Text className="text-slate-400 dark:text-slate-600 text-center" numberOfLines={1} style={{ fontSize: 9 }}>
                        {m.role}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── My Tasks ── */}
        <View className="px-5 mt-6">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-slate-900 dark:text-white font-bold text-lg">My Tasks</Text>
            <TouchableOpacity onPress={() => router.push('/(app)/tasks' as any)}>
              <Text className="text-sky-500 text-sm font-medium">See all</Text>
            </TouchableOpacity>
          </View>

          {myTasks.length === 0 ? (
            <TouchableOpacity
              onPress={() => router.push('/(app)/tasks' as any)}
              activeOpacity={0.8}
              className="bg-white dark:bg-slate-800 rounded-2xl p-6 items-center border border-slate-200 dark:border-slate-700"
            >
              <Ionicons name="checkmark-done-circle" size={40} color="#22c55e" />
              <Text className="text-slate-700 dark:text-slate-300 font-semibold mt-3">All caught up!</Text>
              <Text className="text-slate-400 dark:text-slate-500 text-sm mt-1">No tasks assigned to you.</Text>
            </TouchableOpacity>
          ) : (
            myTasks.slice(0, 5).map((task: any) => (
              <TouchableOpacity
                key={task.id}
                onPress={() => router.push(`/(app)/tasks?taskId=${task.id}` as any)}
                activeOpacity={0.75}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-2.5 border border-slate-200 dark:border-slate-700"
              >
                <View className="flex-row justify-between items-start mb-2">
                  <Text className="text-slate-900 dark:text-white font-semibold flex-1 mr-2" numberOfLines={1}>
                    {task.title}
                  </Text>
                  <Badge label={task.status} variant={statusVariant(task.status)} />
                </View>
                {task.description ? (
                  <Text className="text-slate-400 dark:text-slate-500 text-sm mb-2" numberOfLines={2}>
                    {task.description}
                  </Text>
                ) : null}
                <View className="flex-row items-center gap-2">
                  <Badge label={task.priority} variant={priorityVariant(task.priority)} />
                  {task.dueDate && (
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="calendar-outline" size={11} color="#94a3b8" />
                      <Text className="text-slate-400 dark:text-slate-500 text-xs">
                        {format(new Date(task.dueDate), 'MMM d')}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* ── Recent Projects ── */}
        <View className="px-5 mt-6">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-slate-900 dark:text-white font-bold text-lg">Projects</Text>
            <TouchableOpacity onPress={() => router.push('/(app)/projects' as any)}>
              <Text className="text-sky-500 text-sm font-medium">See all</Text>
            </TouchableOpacity>
          </View>

          {recentProjects.length === 0 ? (
            <TouchableOpacity
              onPress={() => router.push('/(app)/projects' as any)}
              activeOpacity={0.8}
              className="bg-white dark:bg-slate-800 rounded-2xl p-6 items-center border border-slate-200 dark:border-slate-700"
            >
              <Ionicons name="folder-open-outline" size={40} color="#94a3b8" />
              <Text className="text-slate-500 dark:text-slate-400 font-medium mt-3">No projects yet</Text>
              <Text className="text-sky-500 text-sm mt-2 font-semibold">+ Create one</Text>
            </TouchableOpacity>
          ) : (
            recentProjects.map((project: any) => (
              <TouchableOpacity
                key={project.id}
                onPress={() => router.push(`/(app)/projects?projectId=${project.id}` as any)}
                activeOpacity={0.75}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-2.5 border border-slate-200 dark:border-slate-700"
              >
                <View className="flex-row items-center gap-3">
                  <View className="bg-violet-50 dark:bg-violet-900/40 rounded-xl p-2.5 border border-violet-100 dark:border-violet-800/60">
                    <Ionicons name="folder" size={18} color="#a78bfa" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-900 dark:text-white font-semibold" numberOfLines={1}>
                      {project.name}
                    </Text>
                    {project.description ? (
                      <Text className="text-slate-400 dark:text-slate-500 text-sm mt-0.5" numberOfLines={1}>
                        {project.description}
                      </Text>
                    ) : null}
                    {project.evaluationData?.overallScore != null && (
                      <View className="flex-row items-center gap-1 mt-0.5">
                        <Ionicons name="checkmark-circle" size={11} color="#34d399" />
                        <Text className="text-emerald-500 dark:text-emerald-400 text-xs font-semibold">
                          {project.evaluationData.overallScore}% QA
                        </Text>
                      </View>
                    )}
                  </View>
                  <View className="items-end gap-1">
                    {project.workflowStage ? (
                      <Badge label={project.workflowStage} variant={STAGE_COLORS[project.workflowStage] ?? 'default'} />
                    ) : null}
                    <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* ── Connected Repos ── */}
        {repos.length > 0 && (
          <View className="mt-6">
            <View className="flex-row justify-between items-center px-5 mb-3">
              <Text className="text-slate-900 dark:text-white font-bold text-lg">Repositories</Text>
              <View className="flex-row items-center gap-1">
                <Ionicons name="logo-github" size={14} color="#94a3b8" />
                <Text className="text-slate-400 dark:text-slate-500 text-xs">{repos.length} connected</Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingLeft: 20, paddingRight: 8, gap: 12 }}
            >
              {repos.slice(0, 10).map((repo: any) => (
                <TouchableOpacity
                  key={repo.id ?? repo.name}
                  onPress={() => {
                    const url = repo.html_url ?? repo.url;
                    if (url) Linking.openURL(url).catch(() => {});
                  }}
                  activeOpacity={0.8}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4"
                  style={{ width: 200 }}
                >
                  <View className="flex-row items-center gap-2 mb-2">
                    <Ionicons name="logo-github" size={16} color="#94a3b8" />
                    <Text className="text-slate-900 dark:text-white font-semibold text-sm flex-1" numberOfLines={1}>
                      {repo.name}
                    </Text>
                    {repo.private && <Ionicons name="lock-closed" size={12} color="#94a3b8" />}
                  </View>
                  {repo.description ? (
                    <Text className="text-slate-400 dark:text-slate-500 text-xs mb-2" numberOfLines={2}>
                      {repo.description}
                    </Text>
                  ) : null}
                  <View className="flex-row items-center gap-3 mt-auto">
                    {repo.language && (
                      <View className="flex-row items-center gap-1">
                        <View className="w-2 h-2 rounded-full bg-sky-400" />
                        <Text className="text-slate-400 dark:text-slate-500 text-xs">{repo.language}</Text>
                      </View>
                    )}
                    {repo.stargazers_count != null && (
                      <View className="flex-row items-center gap-1">
                        <Ionicons name="star-outline" size={11} color="#94a3b8" />
                        <Text className="text-slate-400 dark:text-slate-500 text-xs">{repo.stargazers_count}</Text>
                      </View>
                    )}
                    <Ionicons name="open-outline" size={11} color="#94a3b8" style={{ marginLeft: 'auto' }} />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Activity Feed ── */}
        {activeTeam?.id ? (
          <View className="px-5 mt-6 mb-10">
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-row items-center gap-2">
                <Text className="text-slate-900 dark:text-white font-bold text-lg">Live Activity</Text>
                {activitiesQuery.isFetching && <ActivityIndicator size="small" color="#64748b" />}
              </View>
              <View className="w-2 h-2 rounded-full bg-emerald-400" />
            </View>

            <View className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {activitiesQuery.isLoading ? (
                <View className="p-6 items-center">
                  <ActivityIndicator color="#38bdf8" />
                </View>
              ) : activities.length === 0 ? (
                <View className="p-6 items-center">
                  <Ionicons name="radio-outline" size={32} color="#94a3b8" />
                  <Text className="text-slate-400 dark:text-slate-500 text-sm mt-2">No recent activity</Text>
                </View>
              ) : (
                activities.map((activity: any, index: number) => {
                  const { icon, color } = activityIcon(activity.type ?? '');
                  const isLast = index === activities.length - 1;
                  return (
                    <View
                      key={activity.id}
                      className={`flex-row items-start gap-3 px-4 py-3.5 ${
                        !isLast ? 'border-b border-slate-100 dark:border-slate-700/60' : ''
                      }`}
                    >
                      <View
                        className="rounded-full items-center justify-center mt-0.5"
                        style={{
                          width: 32, height: 32,
                          backgroundColor: color + '22',
                          borderWidth: 1,
                          borderColor: color + '44',
                        }}
                      >
                        <Ionicons name={icon} size={15} color={color} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-slate-700 dark:text-slate-200 text-sm" numberOfLines={2}>
                          {activity.userName ? (
                            <Text className="text-slate-900 dark:text-white font-semibold">{activity.userName} </Text>
                          ) : null}
                          {activity.description}
                        </Text>
                        <Text className="text-slate-400 dark:text-slate-600 text-xs mt-0.5">
                          {activity.createdAt
                            ? formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })
                            : ''}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        ) : (
          <View className="px-5 mt-6 mb-10">
            <View className="bg-white dark:bg-slate-800/50 rounded-2xl p-8 items-center border border-dashed border-slate-200 dark:border-slate-700/50">
              <Ionicons name="people-outline" size={40} color="#94a3b8" />
              <Text className="text-slate-500 dark:text-slate-400 font-medium mt-3">No active team</Text>
              <TouchableOpacity
                onPress={() => router.push('/(app)/teams' as any)}
                className="mt-3 bg-sky-50 dark:bg-sky-700/60 rounded-xl px-4 py-2"
              >
                <Text className="text-sky-600 dark:text-sky-300 text-sm font-semibold">Select a team</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
