import { ScrollView, View, Text, TouchableOpacity, RefreshControl, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { trpc } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useTeamStore } from '@/store/teamStore';
import { useThemeStore } from '@/store/themeStore';
import { format, formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/Badge';
import { Avatar } from '@/components/Avatar';
import {
  StatRowSkeleton,
  MetricsRowSkeleton,
  ListRowSkeleton,
  MemberStripSkeleton,
  CardSkeleton,
} from '@/components/Skeleton';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const QUICK_ACTIONS: { label: string; icon: IconName; route: string; color: string }[] = [
  { label: 'Tasks',      icon: 'checkmark-circle', route: '/(app)/tasks',      color: '#10B981' },
  { label: 'Projects',   icon: 'folder',           route: '/(app)/projects',   color: '#8B5CF6' },
  { label: 'Calendar',   icon: 'calendar',         route: '/(app)/calendar',   color: '#F59E0B' },
  { label: 'Conference', icon: 'videocam',         route: '/(app)/conference', color: '#5B8DEF' },
];

const STAGE_COLORS: Record<string, 'primary' | 'warning' | 'success' | 'danger' | 'default'> = {
  ideation:    'primary',
  planning:    'default',
  development: 'warning',
  review:      'default',
  qa:          'warning',
  completed:   'success',
  archived:    'default',
};

function GradientFade({ isDark }: { isDark: boolean }) {
  const bg = isDark ? '#000000' : '#fafafa';
  const steps = [0, 0.12, 0.28, 0.48, 0.68, 0.84, 1];
  return (
    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 90 }} pointerEvents="none">
      {steps.map((opacity, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: bg, opacity }} />
      ))}
    </View>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function MemberAvatar({ name, avatarUrl, size = 38 }: { name?: string; avatarUrl?: string | null; size?: number }) {
  return <Avatar name={name} avatarUrl={avatarUrl} size={size} />;
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
      className="flex-1 bg-white dark:bg-neutral-900 rounded-2xl p-4 items-center border border-slate-200 dark:border-neutral-800"
    >
      <Ionicons name={icon} size={22} color={color} />
      <Text className="text-slate-900 dark:text-white text-xl font-bold mt-1">{value}</Text>
      <Text className="text-slate-400 dark:text-neutral-500 text-xs mt-0.5 text-center">{label}</Text>
    </TouchableOpacity>
  );
}

function MetricCard({
  label, value, unit, trend, direction, icon,
}: {
  label: string; value: string; unit: string; trend: string; direction: 'up' | 'down'; icon: IconName;
}) {
  const isUp = direction === 'up';
  const trendColor = isUp ? '#888888' : '#f87171';
  const trendIcon: IconName = isUp ? 'trending-up-outline' : 'trending-down-outline';
  return (
    <View
      className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-4"
      style={{ minWidth: 148 }}
    >
      <View className="flex-row justify-between items-start mb-3">
        <Text className="text-slate-500 dark:text-neutral-400 text-xs font-bold uppercase tracking-wider flex-1 mr-1" numberOfLines={2}>
          {label}
        </Text>
        <Ionicons name={icon} size={14} color="#94a3b8" />
      </View>
      <Text className="text-slate-900 dark:text-white text-2xl font-bold tracking-tight">
        {value}
        <Text className="text-slate-400 dark:text-neutral-500 text-xs font-normal"> {unit}</Text>
      </Text>
      <View className="flex-row items-center gap-1 mt-2">
        <Ionicons name={trendIcon} size={11} color={trendColor} />
        <Text style={{ color: trendColor }} className="text-xs font-medium">{trend}</Text>
      </View>
    </View>
  );
}

function activityIcon(type: string): { icon: IconName; color: string } {
  if (type.includes('task'))                             return { icon: 'checkmark-circle-outline', color: '#10B981' };
  if (type.includes('project'))                          return { icon: 'folder-outline',           color: '#8B5CF6' };
  if (type.includes('member') || type.includes('invite')) return { icon: 'person-add-outline',      color: '#5B8DEF' };
  if (type.includes('comment'))                          return { icon: 'chatbubble-outline',        color: '#F59E0B' };
  if (type.includes('repo'))                             return { icon: 'logo-github',               color: '#EC4899' };
  return                                                        { icon: 'radio-button-on-outline',   color: '#94a3b8' };
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
  const isDark = useThemeStore(state => state.isDark);

  const teamId = activeTeam?.id ?? 0;

  // Single round-trip: all home-screen data in one request
  const dashboardQuery = trpc.dashboard.get.useQuery(
    { teamId },
    { enabled: !!activeTeam?.id, staleTime: 1000 * 60 * 3 }
  );
  // Repos come from GitHub API — fetched separately with a longer staleTime
  const reposQuery = trpc.repositories.listFromAccount.useQuery(
    { teamId },
    { enabled: !!activeTeam?.id, staleTime: 1000 * 60 * 15 }
  );

  const isRefreshing = dashboardQuery.isFetching || reposQuery.isFetching;

  const refetch = () => {
    dashboardQuery.refetch();
    reposQuery.refetch();
  };

  const dashData   = dashboardQuery.data as any;
  const tasks      = (dashData?.tasks     as any[] ?? []);
  const projects   = (dashData?.projects  as any[] ?? []);
  const members    = (dashData?.members   as any[] ?? []);
  const metrics    = dashData?.metrics    as any;
  const activities = (dashData?.activities as any[] ?? []);
  const repos      = (reposQuery.data     as any[] ?? []);

  const myTasks        = tasks.filter((t) => t.assignedTo === user?.id && t.status !== 'done');
  const openTasks      = tasks.filter((t) => t.status !== 'done').length;
  const recentProjects = projects.slice(0, 5);

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-black">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refetch} tintColor={isDark ? '#FFFFFF' : '#0A0A0A'} />
        }
      >
        {/* ── Header ── */}
        <View className="px-5 pt-5 pb-2 flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-slate-900 dark:text-white">{greeting()}</Text>
            <Text className="text-slate-500 dark:text-neutral-400 text-sm mt-0.5">{user?.name ?? user?.email}</Text>
          </View>
          {activeTeam && (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(app)/teams' as any, params: { from: 'home' } })}
              className="bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-1.5 ml-3"
            >
              <Text className="text-neutral-700 dark:text-neutral-300 text-xs font-semibold">{activeTeam.name}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Hero Video ── */}
        <View style={{ marginTop: 12, marginHorizontal: 20, height: 186, overflow: 'hidden', borderRadius: 16 }}>
          <Video
            key={isDark ? 'dark' : 'light'}
            source={isDark
              ? require('../../../assets/mobile dash hero.mp4')
              : require('../../../assets/home hero vid white theme.mp4')}
            style={{ width: '100%', height: '100%' }}
            resizeMode={ResizeMode.COVER}
            isLooping
            isMuted
            shouldPlay
            useNativeControls={false}
          />
          {isDark && <GradientFade isDark={isDark} />}
        </View>

        {/* ── Stats ── */}
        {dashboardQuery.isLoading && !dashData ? (
          <StatRowSkeleton />
        ) : (
          <View className="flex-row gap-2.5 px-5 mt-4">
            <StatCard icon="checkmark-circle" label="Open Tasks" value={openTasks}      color="#10B981" onPress={() => router.push('/(app)/tasks' as any)} />
            <StatCard icon="folder"           label="Projects"   value={projects.length} color="#8B5CF6" onPress={() => router.push('/(app)/projects' as any)} />
            <StatCard icon="people"           label="Members"    value={members.length}  color="#5B8DEF" onPress={() => router.push({ pathname: '/(app)/teams' as any, params: { from: 'home' } })} />
            <StatCard icon="logo-github"      label="Repos"      value={repos.length}    color="#EC4899" onPress={() => router.push({ pathname: '/(app)/teams' as any, params: { from: 'home' } })} />
          </View>
        )}

        {/* ── Analytics Metrics ── */}
        {activeTeam?.id ? (
          <View className="mt-6 px-5">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-slate-900 dark:text-white font-bold text-lg">Performance</Text>
              {dashboardQuery.isFetching && !!dashData && <ActivityIndicator size="small" color="#888888" />}
            </View>
            {dashboardQuery.isLoading && !metrics ? (
              <MetricsRowSkeleton />
            ) : metrics ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                <MetricCard label="Sprint Velocity" value={String(metrics.sprintVelocity?.value ?? '—')} unit={metrics.sprintVelocity?.unit ?? ''} trend={metrics.sprintVelocity?.trend ?? ''} direction={metrics.sprintVelocity?.direction ?? 'up'} icon="flash-outline" />
                <MetricCard label="Open Tasks"      value={String(metrics.openTasks?.value ?? '—')}      unit={metrics.openTasks?.unit ?? ''}      trend={metrics.openTasks?.trend ?? ''}      direction={metrics.openTasks?.direction ?? 'down'}  icon="alert-circle-outline" />
                <MetricCard label="Active Members"  value={String(metrics.activeMembers?.value ?? '—')}  unit={metrics.activeMembers?.unit ?? ''}  trend={metrics.activeMembers?.trend ?? ''}  direction={metrics.activeMembers?.direction ?? 'up'}  icon="people-outline" />
                <MetricCard label="Cycle Time"      value={String(metrics.cycleTime?.value ?? '—')}      unit={metrics.cycleTime?.unit ?? ''}      trend={metrics.cycleTime?.trend ?? ''}      direction={metrics.cycleTime?.direction ?? 'up'}  icon="time-outline" />
              </ScrollView>
            ) : (
              <View className="bg-white dark:bg-neutral-900 rounded-2xl p-4 border border-slate-200 dark:border-neutral-800 items-center">
                <Text className="text-slate-400 dark:text-neutral-500 text-sm">No metrics available yet</Text>
              </View>
            )}
          </View>
        ) : null}

        {/* ── Quick Actions ── */}
        <View className="px-5 mt-6">
          <Text className="text-slate-500 dark:text-neutral-400 text-xs font-bold uppercase tracking-widest mb-3">
            Quick Access
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {QUICK_ACTIONS.map((item) => (
              <TouchableOpacity
                key={item.label}
                onPress={() => {
                  const needsFrom = item.route === '/(app)/calendar' || item.route === '/(app)/conference';
                  router.push(needsFrom ? { pathname: item.route as any, params: { from: 'home' } } : item.route as any);
                }}
                activeOpacity={0.75}
                className="bg-white dark:bg-neutral-900 rounded-2xl p-4 border border-slate-200 dark:border-neutral-800 flex-row items-center gap-3"
                style={{ width: '47%' }}
              >
                <View
                  className="rounded-xl p-2"
                  style={{ backgroundColor: item.color + '1a' }}
                >
                  <Ionicons name={item.icon} size={20} color={item.color} />
                </View>
                <Text className="text-slate-800 dark:text-neutral-100 font-semibold text-sm">{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Team Members ── */}
        {dashboardQuery.isLoading && !dashData ? (
          <View className="mt-6">
            <View className="flex-row justify-between items-center px-5 mb-3">
              <Text className="text-slate-900 dark:text-white font-bold text-lg">Team Members</Text>
            </View>
            <MemberStripSkeleton count={5} />
          </View>
        ) : members.length > 0 && (
          <View className="mt-6">
            <View className="flex-row justify-between items-center px-5 mb-3">
              <Text className="text-slate-900 dark:text-white font-bold text-lg">Team Members</Text>
              <TouchableOpacity onPress={() => router.push({ pathname: '/(app)/teams' as any, params: { from: 'home' } })}>
                <Text className="text-neutral-500 text-sm font-medium">See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            >
              {members.slice(0, 12).map((m: any) => {
                const memberName = m.member?.username ?? m.member?.name ?? m.member?.email ?? '?';
                const memberAvatar = (m as any).userAvatarUrl ?? null;
                const firstName  = memberName.split(' ')[0];
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => router.push({ pathname: '/(app)/teams' as any, params: { from: 'home' } })}
                    activeOpacity={0.75}
                    className="items-center gap-1.5"
                    style={{ width: 60 }}
                  >
                    <View className="relative">
                      <MemberAvatar name={memberName} avatarUrl={memberAvatar} size={48} />
                      {(m.role === 'admin' || m.role === 'owner') ? (
                        <View
                          className="absolute -bottom-0.5 -right-0.5 bg-neutral-800 rounded-full items-center justify-center"
                          style={{ width: 16, height: 16 }}
                        >
                          <Ionicons name="shield-checkmark" size={9} color="#fff" />
                        </View>
                      ) : null}
                    </View>
                    <Text className="text-slate-500 dark:text-neutral-400 text-xs text-center" numberOfLines={1}>
                      {firstName}
                    </Text>
                    {m.role && (
                      <Text className="text-slate-400 dark:text-neutral-600 text-center" numberOfLines={1} style={{ fontSize: 9 }}>
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
              <Text className="text-neutral-500 text-sm font-medium">See all</Text>
            </TouchableOpacity>
          </View>

          {dashboardQuery.isLoading && !dashData ? (
            <View style={{ marginHorizontal: -20 }}>
              <ListRowSkeleton count={3} />
            </View>
          ) : myTasks.length === 0 ? (
            <TouchableOpacity
              onPress={() => router.push('/(app)/tasks' as any)}
              activeOpacity={0.8}
              className="bg-white dark:bg-neutral-900 rounded-2xl p-6 items-center border border-slate-200 dark:border-neutral-800"
            >
              <Ionicons name="checkmark-done-circle" size={40} color="#888888" />
              <Text className="text-slate-700 dark:text-neutral-300 font-semibold mt-3">All caught up!</Text>
              <Text className="text-slate-400 dark:text-neutral-500 text-sm mt-1">No tasks assigned to you.</Text>
            </TouchableOpacity>
          ) : (
            myTasks.slice(0, 5).map((task: any) => (
              <TouchableOpacity
                key={task.id}
                onPress={() => router.push(`/(app)/tasks?taskId=${task.id}` as any)}
                activeOpacity={0.75}
                className="bg-white dark:bg-neutral-900 rounded-2xl p-4 mb-2.5 border border-slate-200 dark:border-neutral-800"
              >
                <View className="flex-row justify-between items-start mb-2">
                  <Text className="text-slate-900 dark:text-white font-semibold flex-1 mr-2" numberOfLines={1}>
                    {task.title}
                  </Text>
                  <Badge label={task.status} variant={statusVariant(task.status)} />
                </View>
                {task.description ? (
                  <Text className="text-slate-400 dark:text-neutral-500 text-sm mb-2" numberOfLines={2}>
                    {task.description}
                  </Text>
                ) : null}
                <View className="flex-row items-center gap-2">
                  <Badge label={task.priority} variant={priorityVariant(task.priority)} />
                  {task.dueDate && (
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="calendar-outline" size={11} color="#94a3b8" />
                      <Text className="text-slate-400 dark:text-neutral-500 text-xs">
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
              <Text className="text-neutral-500 text-sm font-medium">See all</Text>
            </TouchableOpacity>
          </View>

          {recentProjects.length === 0 ? (
            <TouchableOpacity
              onPress={() => router.push('/(app)/projects' as any)}
              activeOpacity={0.8}
              className="bg-white dark:bg-neutral-900 rounded-2xl p-6 items-center border border-slate-200 dark:border-neutral-800"
            >
              <Ionicons name="folder-open-outline" size={40} color="#94a3b8" />
              <Text className="text-slate-500 dark:text-neutral-400 font-medium mt-3">No projects yet</Text>
              <Text className="text-neutral-500 text-sm mt-2 font-semibold">+ Create one</Text>
            </TouchableOpacity>
          ) : (
            recentProjects.map((project: any) => (
              <TouchableOpacity
                key={project.id}
                onPress={() => router.push(`/(app)/projects?projectId=${project.id}` as any)}
                activeOpacity={0.75}
                className="bg-white dark:bg-neutral-900 rounded-2xl p-4 mb-2.5 border border-slate-200 dark:border-neutral-800"
              >
                <View className="flex-row items-center gap-3">
                  <View className="bg-neutral-100 dark:bg-neutral-800/40 rounded-xl p-2.5 border border-neutral-200 dark:border-neutral-700">
                    <Ionicons name="folder" size={18} color="#888888" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-900 dark:text-white font-semibold" numberOfLines={1}>
                      {project.name}
                    </Text>
                    {project.description ? (
                      <Text className="text-slate-400 dark:text-neutral-500 text-sm mt-0.5" numberOfLines={1}>
                        {project.description}
                      </Text>
                    ) : null}
                    {project.evaluationData?.overallScore != null && (
                      <View className="flex-row items-center gap-1 mt-0.5">
                        <Ionicons name="checkmark-circle" size={11} color="#888888" />
                        <Text className="text-neutral-600 dark:text-neutral-400 text-xs font-semibold">
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
                <Text className="text-slate-400 dark:text-neutral-500 text-xs">{repos.length} connected</Text>
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
                  className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-4"
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
                    <Text className="text-slate-400 dark:text-neutral-500 text-xs mb-2" numberOfLines={2}>
                      {repo.description}
                    </Text>
                  ) : null}
                  <View className="flex-row items-center gap-3 mt-auto">
                    {repo.language && (
                      <View className="flex-row items-center gap-1">
                        <View className="w-2 h-2 rounded-full bg-neutral-400" />
                        <Text className="text-slate-400 dark:text-neutral-500 text-xs">{repo.language}</Text>
                      </View>
                    )}
                    {repo.stargazers_count != null && (
                      <View className="flex-row items-center gap-1">
                        <Ionicons name="star-outline" size={11} color="#94a3b8" />
                        <Text className="text-slate-400 dark:text-neutral-500 text-xs">{repo.stargazers_count}</Text>
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
                {dashboardQuery.isFetching && <ActivityIndicator size="small" color="#64748b" />}
              </View>
              <View className="w-2 h-2 rounded-full bg-neutral-400" />
            </View>

            <View className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-800 overflow-hidden">
              {dashboardQuery.isLoading && !dashData ? (
                <ListRowSkeleton count={4} />
              ) : activities.length === 0 ? (
                <View className="p-6 items-center">
                  <Ionicons name="radio-outline" size={32} color="#94a3b8" />
                  <Text className="text-slate-400 dark:text-neutral-500 text-sm mt-2">No recent activity</Text>
                </View>
              ) : (
                activities.map((activity: any, index: number) => {
                  const { icon, color } = activityIcon(activity.type ?? '');
                  const isLast = index === activities.length - 1;
                  return (
                    <View
                      key={activity.id}
                      className={`flex-row items-start gap-3 px-4 py-3.5 ${
                        !isLast ? 'border-b border-slate-100 dark:border-neutral-800/60' : ''
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
                        <Text className="text-slate-700 dark:text-neutral-200 text-sm" numberOfLines={2}>
                          {activity.userName ? (
                            <Text className="text-slate-900 dark:text-white font-semibold">{activity.userName} </Text>
                          ) : null}
                          {activity.description}
                        </Text>
                        <Text className="text-slate-400 dark:text-neutral-600 text-xs mt-0.5">
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
            <View className="bg-white dark:bg-neutral-900/50 rounded-2xl p-8 items-center border border-dashed border-slate-200 dark:border-neutral-800/50">
              <Ionicons name="people-outline" size={40} color="#94a3b8" />
              <Text className="text-slate-500 dark:text-neutral-400 font-medium mt-3">No active team</Text>
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/(app)/teams' as any, params: { from: 'home' } })}
                className="mt-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl px-4 py-2"
              >
                <Text className="text-neutral-700 dark:text-neutral-300 text-sm font-semibold">Select a team</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
