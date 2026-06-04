import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { trpc } from '@/lib/api';
import { useTeamStore } from '@/store/teamStore';
import { useThemeStore } from '@/store/themeStore';
import { LoadingScreen } from '@/components/LoadingScreen';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function MetricCard({
  label,
  value,
  unit,
  trend,
  direction,
  icon,
  iconColor = '#888888',
}: {
  label: string;
  value: string | number;
  unit?: string;
  trend?: string;
  direction?: string;
  icon: IconName;
  iconColor?: string;
}) {
  const isUp = direction === 'up';
  return (
    <View
      className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-slate-200 dark:border-neutral-800 flex-1"
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 }}
    >
      <View className="flex-row justify-between items-start mb-3">
        <View
          className="w-9 h-9 rounded-xl items-center justify-center"
          style={{ backgroundColor: iconColor + '1a' }}
        >
          <Ionicons name={icon} size={17} color={iconColor} />
        </View>
        {trend && (
          <View className={`flex-row items-center gap-1 rounded-xl px-2 py-0.5 ${isUp ? 'bg-neutral-50 dark:bg-neutral-800' : 'bg-red-50 dark:bg-red-900/30'}`}>
            <Ionicons
              name={isUp ? 'trending-up' : 'trending-down'}
              size={10}
              color={isUp ? '#888888' : '#f87171'}
            />
            <Text className={`text-xs font-bold ${isUp ? 'text-neutral-600' : 'text-red-400'}`}>
              {trend}
            </Text>
          </View>
        )}
      </View>
      <Text className="text-slate-900 dark:text-white text-2xl font-bold tracking-tight">
        {value}
        {unit && <Text className="text-slate-400 dark:text-neutral-500 text-xs font-normal ml-1"> {unit}</Text>}
      </Text>
      <Text className="text-slate-400 dark:text-neutral-500 text-xs mt-1">{label}</Text>
    </View>
  );
}

function BurndownChart({ data }: { data: Array<{ day: string; actual: number; ideal: number }> }) {
  if (!data?.length) return null;
  const maxVal = Math.max(...data.map((d) => Math.max(d.actual, d.ideal)), 1);

  return (
    <View className="bg-white dark:bg-neutral-900 rounded-2xl p-5 mb-4 border border-slate-200 dark:border-neutral-800">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-slate-900 dark:text-white font-semibold text-base">Sprint Burndown</Text>
        <View className="flex-row gap-3">
          <View className="flex-row items-center gap-1.5">
            <View className="w-2 h-2 rounded-sm bg-black dark:bg-white" />
            <Text className="text-slate-400 dark:text-neutral-500 text-xs">Actual</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <View className="w-2 h-2 rounded-sm bg-slate-300 dark:bg-neutral-600" />
            <Text className="text-slate-400 dark:text-neutral-500 text-xs">Ideal</Text>
          </View>
        </View>
      </View>

      <View className="flex-row items-end gap-1" style={{ height: 96 }}>
        {data.slice(0, 12).map((point, idx) => {
          const actualH = Math.max(4, (point.actual / maxVal) * 96);
          const idealH = Math.max(4, (point.ideal / maxVal) * 96);
          const isBehind = point.actual > point.ideal;
          return (
            <View key={idx} className="flex-1 flex-row items-end gap-px justify-center">
              <View
                className="rounded-t-sm flex-1"
                style={{ height: actualH, backgroundColor: isBehind ? '#f87171' : '#888888' }}
              />
              <View
                className="rounded-t-sm flex-1 bg-slate-300 dark:bg-neutral-600"
                style={{ height: idealH }}
              />
            </View>
          );
        })}
      </View>

      {/* Day labels */}
      <View className="flex-row mt-2 overflow-hidden">
        {data.slice(0, 12).filter((_, i) => i % 3 === 0).map((point, i) => (
          <View key={i} className="flex-1">
            <Text className="text-slate-400 dark:text-neutral-600 text-xs text-center">{point.day}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const goBack = () => from === 'profile' ? router.navigate('/(app)/profile' as any) : (router.canGoBack() ? router.back() : router.navigate('/(app)' as any));
  const { activeTeam } = useTeamStore();
  const isDark = useThemeStore(state => state.isDark);

  const dashQuery = trpc.analytics.getDashboardMetrics.useQuery(
    { teamId: activeTeam?.id ?? 0 },
    { enabled: !!activeTeam?.id }
  );

  const perfQuery = trpc.analytics.getTeamPerformance.useQuery(
    { teamId: activeTeam?.id ?? 0 },
    { enabled: !!activeTeam?.id }
  );

  const isLoading = dashQuery.isLoading && perfQuery.isLoading && !dashQuery.data && !perfQuery.data;
  if (isLoading) return <LoadingScreen />;

  const dash = dashQuery.data as any;
  const perf = perfQuery.data as any;

  const refetch = () => {
    dashQuery.refetch();
    perfQuery.refetch();
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-black">
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={dashQuery.isFetching || perfQuery.isFetching}
            onRefresh={refetch}
            tintColor={isDark ? '#FFFFFF' : '#0A0A0A'}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-5 pt-5 pb-4 flex-row items-center gap-3">
          <TouchableOpacity
            onPress={goBack}
            className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-neutral-900 items-center justify-center"
          >
            <Ionicons name="arrow-back" size={18} color="#64748b" />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-bold text-slate-900 dark:text-white">Analytics</Text>
            {activeTeam && <Text className="text-slate-500 dark:text-neutral-400 text-xs mt-0.5">{activeTeam.name}</Text>}
          </View>
        </View>

        {/* KPI cards 2×2 grid */}
        {dash && (
          <View className="px-5 mb-5">
            <Text className="text-slate-500 dark:text-neutral-400 text-xs font-bold uppercase tracking-widest mb-3">
              Sprint Overview
            </Text>
            <View className="flex-row gap-3 mb-3">
              <MetricCard
                icon="flash-outline"
                iconColor="#888888"
                label="Sprint Velocity"
                value={dash.sprintVelocity?.value ?? '—'}
                unit={dash.sprintVelocity?.unit}
                trend={dash.sprintVelocity?.trend}
                direction={dash.sprintVelocity?.direction}
              />
              <MetricCard
                icon="list-outline"
                iconColor="#888888"
                label="Open Tasks"
                value={dash.openTasks?.value ?? '—'}
                unit={dash.openTasks?.unit}
                trend={dash.openTasks?.trend}
                direction={dash.openTasks?.direction}
              />
            </View>
            <View className="flex-row gap-3">
              <MetricCard
                icon="people-outline"
                iconColor="#888888"
                label="Active Members"
                value={dash.activeMembers?.value ?? '—'}
                unit={dash.activeMembers?.unit}
                trend={dash.activeMembers?.trend}
                direction={dash.activeMembers?.direction}
              />
              <MetricCard
                icon="time-outline"
                iconColor="#888888"
                label="Cycle Time"
                value={dash.cycleTime?.value ?? '—'}
                unit={dash.cycleTime?.unit}
                trend={dash.cycleTime?.trend}
                direction={dash.cycleTime?.direction}
              />
            </View>
          </View>
        )}

        {/* Burndown chart */}
        {dash?.burndown?.length > 0 && (
          <View className="px-5">
            <BurndownChart data={dash.burndown} />
          </View>
        )}

        {/* Member performance */}
        {perf?.memberMetrics?.length > 0 && (
          <View className="mx-5 bg-white dark:bg-neutral-900 rounded-2xl p-5 mb-8 border border-slate-200 dark:border-neutral-800">
            <Text className="text-slate-900 dark:text-white font-semibold text-base mb-4">Member Performance</Text>
            {perf.memberMetrics.slice(0, 8).map((m: any) => {
              const total = m.totalTasks ?? 1;
              const completed = m.completedTasks ?? 0;
              const pct = Math.min(total > 0 ? (completed / total) * 100 : 0, 100);
              const barColor =
                pct >= 80 ? '#888888' : pct >= 50 ? '#AAAAAA' : '#f87171';
              const name = m.memberName ?? `Member ${m.memberId}`;
              return (
                <View key={m.memberId} className="mb-4 last:mb-0">
                  <View className="flex-row justify-between items-center mb-1.5">
                    <View className="flex-row items-center gap-2">
                      <View className="w-7 h-7 rounded-full bg-slate-100 dark:bg-neutral-800 items-center justify-center">
                        <Text className="text-slate-500 dark:text-neutral-300 text-xs font-bold">
                          {name[0].toUpperCase()}
                        </Text>
                      </View>
                      <Text className="text-slate-700 dark:text-neutral-200 text-sm font-medium">{name}</Text>
                    </View>
                    <Text className="text-slate-400 dark:text-neutral-500 text-xs">
                      {completed}/{total}
                    </Text>
                  </View>
                  <View className="h-2 bg-slate-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <View
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: barColor }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {!dash && !perf?.memberMetrics?.length && (
          <View className="mx-5 bg-white dark:bg-neutral-900 rounded-2xl p-8 items-center border border-slate-200 dark:border-neutral-800">
            <Ionicons name="bar-chart-outline" size={40} color="#94a3b8" />
            <Text className="text-slate-500 dark:text-neutral-400 font-medium mt-3">No data yet</Text>
            <Text className="text-slate-400 dark:text-neutral-500 text-xs mt-1 text-center">
              Analytics will appear once your team has tasks and activity.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
