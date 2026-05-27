import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { trpc } from '@/lib/api';
import { useTeamStore } from '@/store/teamStore';
import { LoadingScreen } from '@/components/LoadingScreen';

function MetricCard({
  label,
  value,
  unit,
  trend,
  emoji,
}: {
  label: string;
  value: string | number;
  unit?: string;
  trend?: string;
  emoji: string;
}) {
  return (
    <View className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex-1">
      <Text className="text-2xl mb-2">{emoji}</Text>
      <Text className="text-2xl font-bold text-white">{value}</Text>
      {unit && <Text className="text-slate-400 text-xs mt-0.5">{unit}</Text>}
      <Text className="text-slate-500 text-xs mt-1">{label}</Text>
      {trend && <Text className="text-emerald-400 text-xs mt-1">{trend}</Text>}
    </View>
  );
}

function BurndownChart({ data }: { data: Array<{ day: string; actual: number; ideal: number }> }) {
  if (!data?.length) return null;
  const maxVal = 100;

  return (
    <View className="bg-slate-800 rounded-xl p-4 mb-5 border border-slate-700">
      <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-4">
        Sprint Burndown
      </Text>
      <View className="flex-row items-end gap-1" style={{ height: 80 }}>
        {data.slice(0, 10).map((point, idx) => {
          const actualH = Math.max(4, (point.actual / maxVal) * 80);
          const idealH = Math.max(4, (point.ideal / maxVal) * 80);
          return (
            <View key={idx} className="flex-1 items-center justify-end gap-0.5">
              <View className="flex-row items-end gap-0.5 w-full justify-center">
                <View
                  className="bg-sky-500 rounded-sm flex-1"
                  style={{ height: actualH }}
                />
                <View
                  className="bg-slate-600 rounded-sm flex-1"
                  style={{ height: idealH }}
                />
              </View>
            </View>
          );
        })}
      </View>
      <View className="flex-row gap-4 mt-3">
        <View className="flex-row items-center gap-1.5">
          <View className="w-3 h-3 rounded-sm bg-sky-500" />
          <Text className="text-slate-400 text-xs">Actual</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="w-3 h-3 rounded-sm bg-slate-600" />
          <Text className="text-slate-400 text-xs">Ideal</Text>
        </View>
      </View>
    </View>
  );
}

export default function AnalyticsScreen() {
  const { activeTeam } = useTeamStore();

  const dashQuery = trpc.analytics.getDashboardMetrics.useQuery(
    { teamId: activeTeam?.id ?? 0 },
    { enabled: !!activeTeam?.id }
  );

  const perfQuery = trpc.analytics.getTeamPerformance.useQuery(
    { teamId: activeTeam?.id ?? 0 },
    { enabled: !!activeTeam?.id }
  );

  const isLoading = dashQuery.isLoading && perfQuery.isLoading;
  const refetch = () => {
    dashQuery.refetch();
    perfQuery.refetch();
  };

  if (isLoading) return <LoadingScreen />;

  const dash = dashQuery.data as any;
  const perf = perfQuery.data as any;

  return (
    <SafeAreaView className="flex-1 bg-slate-900">
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={dashQuery.isFetching || perfQuery.isFetching}
            onRefresh={refetch}
            tintColor="#0ea5e9"
          />
        }
      >
        {/* Header */}
        <View className="px-5 pt-4 pb-3">
          <Text className="text-2xl font-bold text-white">Analytics</Text>
          {activeTeam && <Text className="text-slate-400 text-sm">{activeTeam.name}</Text>}
        </View>

        {/* KPI cards */}
        {dash && (
          <View className="px-5 mb-5">
            <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
              Sprint Overview
            </Text>
            <View className="flex-row gap-3 mb-3">
              <MetricCard
                emoji="⚡"
                label="Sprint Velocity"
                value={dash.sprintVelocity?.value ?? '—'}
                unit={dash.sprintVelocity?.unit}
                trend={dash.sprintVelocity?.trend}
              />
              <MetricCard
                emoji="📋"
                label="Open Tasks"
                value={dash.openTasks?.value ?? '—'}
                unit={dash.openTasks?.unit}
                trend={dash.openTasks?.trend}
              />
            </View>
            <View className="flex-row gap-3">
              <MetricCard
                emoji="👥"
                label="Active Members"
                value={dash.activeMembers?.value ?? '—'}
                unit={dash.activeMembers?.unit}
                trend={dash.activeMembers?.trend}
              />
              <MetricCard
                emoji="⏱️"
                label="Cycle Time"
                value={dash.cycleTime?.value ?? '—'}
                unit={dash.cycleTime?.unit}
                trend={dash.cycleTime?.trend}
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

        {/* Team performance */}
        {perf?.members?.length > 0 && (
          <View className="mx-5 bg-slate-800 rounded-xl p-4 mb-8 border border-slate-700">
            <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-4">
              Member Performance
            </Text>
            {perf.members.slice(0, 6).map((m: any) => {
              const total = m.totalTasks ?? 1;
              const completed = m.completedTasks ?? 0;
              const pct = Math.min((completed / total) * 100, 100);
              const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
              return (
                <View key={m.userId ?? m.id} className="mb-4">
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-slate-300 text-sm">{m.name ?? m.email ?? `Member ${m.userId}`}</Text>
                    <Text className="text-slate-400 text-sm">
                      {completed} / {total}
                    </Text>
                  </View>
                  <View className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <View className={`${barColor} h-full rounded-full`} style={{ width: `${pct}%` }} />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
