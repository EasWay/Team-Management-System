import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { trpc } from '@/lib/api';
import { useTeamStore } from '@/store/teamStore';
import { LoadingScreen } from '@/components/LoadingScreen';

const C = {
  bg: '#020617',
  surface: '#0f172a',
  card: '#1e293b',
  border: 'rgba(51,65,85,0.7)',
  text: '#f8fafc',
  muted: '#94a3b8',
  subtle: '#475569',
};

function SectionLabel({ label }: { label: string }) {
  return (
    <Text style={{
      color: C.subtle,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: 12,
    }}>
      {label}
    </Text>
  );
}

function MetricCard({
  label, value, unit, trend, emoji, accentColor,
}: {
  label: string; value: string | number; unit?: string;
  trend?: string; emoji: string; accentColor: string;
}) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: C.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: C.border,
      borderTopWidth: 3,
      borderTopColor: accentColor,
    }}>
      <Text style={{ fontSize: 22, marginBottom: 8 }}>{emoji}</Text>
      <Text style={{ fontSize: 26, fontWeight: '800', color: C.text, letterSpacing: -0.5 }}>
        {value}
      </Text>
      {unit ? (
        <Text style={{ color: accentColor, fontSize: 11, fontWeight: '600', marginTop: 2 }}>{unit}</Text>
      ) : null}
      <Text style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{label}</Text>
      {trend ? (
        <Text style={{ color: '#10b981', fontSize: 11, marginTop: 4, fontWeight: '600' }}>{trend}</Text>
      ) : null}
    </View>
  );
}

function BurndownChart({ data }: { data: Array<{ day: string; actual: number; ideal: number }> }) {
  if (!data?.length) return null;
  const maxVal = Math.max(...data.map((d) => Math.max(d.actual, d.ideal)), 1);

  return (
    <View style={{
      backgroundColor: C.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: C.border,
    }}>
      <SectionLabel label="Sprint Burndown" />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 96, gap: 3 }}>
        {data.slice(0, 10).map((point, idx) => {
          const actualH = Math.max(4, (point.actual / maxVal) * 96);
          const idealH = Math.max(4, (point.ideal / maxVal) * 96);
          return (
            <View key={idx} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 1, width: '100%', justifyContent: 'center' }}>
                <View style={{ flex: 1, height: actualH, backgroundColor: '#0ea5e9', borderRadius: 3 }} />
                <View style={{ flex: 1, height: idealH, backgroundColor: '#334155', borderRadius: 3 }} />
              </View>
              <Text style={{ color: C.subtle, fontSize: 9, marginTop: 4 }}>{point.day?.slice(-2) ?? idx + 1}</Text>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#0ea5e9' }} />
          <Text style={{ color: C.muted, fontSize: 12 }}>Actual</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#334155' }} />
          <Text style={{ color: C.muted, fontSize: 12 }}>Ideal</Text>
        </View>
      </View>
    </View>
  );
}

function MemberRow({ member }: { member: any }) {
  const total = member.totalTasks ?? 1;
  const completed = member.completedTasks ?? 0;
  const pct = Math.min(Math.round((completed / total) * 100), 100);
  const barColor = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#f43f5e';
  const initials = (member.name ?? member.email ?? 'U').slice(0, 2).toUpperCase();

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <View style={{
          width: 32, height: 32, borderRadius: 16,
          backgroundColor: '#0c4a6e', alignItems: 'center', justifyContent: 'center', marginRight: 10,
        }}>
          <Text style={{ color: '#7dd3fc', fontSize: 12, fontWeight: '700' }}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 14, fontWeight: '600' }}>
            {member.name ?? member.email ?? `Member ${member.userId}`}
          </Text>
        </View>
        <Text style={{ color: C.muted, fontSize: 13, fontWeight: '600' }}>{pct}%</Text>
      </View>
      <View style={{ height: 5, backgroundColor: '#1e293b', borderRadius: 4, overflow: 'hidden', marginLeft: 42 }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: barColor, borderRadius: 4 }} />
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

  if (isLoading) return <LoadingScreen />;

  const dash = dashQuery.data as any;
  const perf = perfQuery.data as any;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={dashQuery.isFetching || perfQuery.isFetching}
            onRefresh={() => { dashQuery.refetch(); perfQuery.refetch(); }}
            tintColor="#0ea5e9"
          />
        }
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
          <Text style={{ color: C.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.3 }}>Analytics</Text>
          {activeTeam ? (
            <Text style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{activeTeam.name}</Text>
          ) : null}
        </View>

        {/* KPI cards */}
        {dash ? (
          <View style={{ paddingHorizontal: 20, marginTop: 16, marginBottom: 8 }}>
            <SectionLabel label="Sprint Overview" />
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
              <MetricCard
                emoji="⚡"
                label="Sprint Velocity"
                value={dash.sprintVelocity?.value ?? '—'}
                unit={dash.sprintVelocity?.unit}
                trend={dash.sprintVelocity?.trend}
                accentColor="#0ea5e9"
              />
              <MetricCard
                emoji="📋"
                label="Open Tasks"
                value={dash.openTasks?.value ?? '—'}
                unit={dash.openTasks?.unit}
                trend={dash.openTasks?.trend}
                accentColor="#8b5cf6"
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <MetricCard
                emoji="👥"
                label="Active Members"
                value={dash.activeMembers?.value ?? '—'}
                unit={dash.activeMembers?.unit}
                trend={dash.activeMembers?.trend}
                accentColor="#10b981"
              />
              <MetricCard
                emoji="⏱️"
                label="Cycle Time"
                value={dash.cycleTime?.value ?? '—'}
                unit={dash.cycleTime?.unit}
                trend={dash.cycleTime?.trend}
                accentColor="#f59e0b"
              />
            </View>
          </View>
        ) : null}

        {/* Burndown chart */}
        {dash?.burndown?.length > 0 ? (
          <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
            <BurndownChart data={dash.burndown} />
          </View>
        ) : null}

        {/* Team performance */}
        {perf?.members?.length > 0 ? (
          <View style={{
            marginHorizontal: 20,
            backgroundColor: C.card,
            borderRadius: 16,
            padding: 16,
            marginBottom: 32,
            borderWidth: 1,
            borderColor: C.border,
          }}>
            <SectionLabel label="Member Performance" />
            {perf.members.slice(0, 8).map((m: any) => (
              <MemberRow key={m.userId ?? m.id} member={m} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
