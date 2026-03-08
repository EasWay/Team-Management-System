import { Link } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { History, Edit2, MessageSquare, Zap, AlertCircle, Users, Activity, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTeamContext } from "../contexts/TeamContext";

export default function Home() {
  const { selectedTeamId, teams } = useTeamContext();

  const { data: metrics, isLoading: metricsLoading } = trpc.analytics.getDashboardMetrics.useQuery(
    { teamId: selectedTeamId || 0 },
    { enabled: !!selectedTeamId }
  );

  const { data: activities, isLoading: activitiesLoading } = trpc.activities.list.useQuery(
    { teamId: selectedTeamId || 0, limit: 10 },
    { enabled: !!selectedTeamId }
  );

  const currentTeamName = teams?.find((t: any) => t.id === selectedTeamId)?.name || 'Select a Team';

  // Dashboard metrics will show empty states if no team is selected
  return (
    <DashboardLayout>
      <div className="flex-1 max-w-7xl mx-auto w-full p-8 space-y-12 pb-20 overflow-y-auto custom-scrollbar">

        {/* Header Section */}
        <section className="flex flex-col md:flex-row justify-between items-end gap-6 pt-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
              <span>{currentTeamName}</span>
              <span className="size-1 bg-foreground/20 rounded-full"></span>
              <span>HOME</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="px-6 py-2.5 bg-foreground text-background text-[10px] font-bold tracking-widest uppercase hover:bg-foreground/80 transition-colors rounded">Export Data</button>
            <Link href="/reports">
              <button className="px-6 py-2.5 border border-border text-foreground text-[10px] font-bold tracking-widest uppercase hover:bg-foreground/5 transition-colors rounded">Reports</button>
            </Link>
          </div>
        </section>

        {/* Metrics Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metricsLoading ? (
            <div className="col-span-full flex justify-center py-8 text-muted-foreground"><RefreshCw className="animate-spin size-6" /></div>
          ) : (
            <>
              {/* Sprint Velocity */}
              <div className="liquid-glass p-8 space-y-4 rounded-xl">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">Sprint Velocity</span>
                  <Zap className="text-muted-foreground size-4" />
                </div>
                <div>
                  <div className="text-4xl font-light tracking-tighter text-foreground">
                    {metrics?.sprintVelocity.value || '0'}<span className="text-[10px] ml-1 text-muted-foreground uppercase tracking-widest">{metrics?.sprintVelocity.unit}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {metrics?.sprintVelocity.direction === 'up' ? <TrendingUp className="text-muted-foreground/60 size-3" /> : <TrendingDown className="text-muted-foreground/60 size-3" />}
                    <span className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-widest">{metrics?.sprintVelocity.trend}</span>
                  </div>
                </div>
              </div>

              {/* Open Tasks */}
              <div className="liquid-glass p-8 space-y-4 rounded-xl">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">Open Tasks</span>
                  <AlertCircle className="text-muted-foreground size-4" />
                </div>
                <div>
                  <div className="text-4xl font-light tracking-tighter text-foreground">
                    {metrics?.openTasks.value || '0'}<span className="text-[10px] ml-1 text-muted-foreground uppercase tracking-widest">{metrics?.openTasks.unit}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {metrics?.openTasks.direction === 'up' ? <TrendingUp className="text-muted-foreground/60 size-3" /> : <TrendingDown className="text-muted-foreground/60 size-3" />}
                    <span className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-widest">{metrics?.openTasks.trend}</span>
                  </div>
                </div>
              </div>

              {/* Active Members */}
              <div className="liquid-glass p-8 space-y-4 rounded-xl">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">Active Members</span>
                  <Users className="text-muted-foreground size-4" />
                </div>
                <div>
                  <div className="text-4xl font-light tracking-tighter text-foreground">
                    {metrics?.activeMembers.value || '0'}<span className="text-[10px] ml-1 text-muted-foreground uppercase tracking-widest">{metrics?.activeMembers.unit}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {metrics?.activeMembers.direction === 'up' ? <TrendingUp className="text-muted-foreground/60 size-3" /> : <TrendingDown className="text-muted-foreground/60 size-3" />}
                    <span className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-widest">{metrics?.activeMembers.trend}</span>
                  </div>
                </div>
              </div>

              {/* Cycle Time */}
              <div className="liquid-glass p-8 space-y-4 rounded-xl">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">Cycle Time</span>
                  <Activity className="text-muted-foreground size-4" />
                </div>
                <div>
                  <div className="text-4xl font-light tracking-tighter text-foreground">
                    {metrics?.cycleTime.value || '0'}<span className="text-[10px] ml-1 text-muted-foreground uppercase tracking-widest">{metrics?.cycleTime.unit}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {metrics?.cycleTime.direction === 'up' ? <TrendingUp className="text-muted-foreground/60 size-3" /> : <TrendingDown className="text-muted-foreground/60 size-3" />}
                    <span className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-widest">{metrics?.cycleTime.trend}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Main Content Area */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Burndown Chart Area */}
          <div className="lg:col-span-2 liquid-glass p-8 space-y-8 rounded-xl">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <h3 className="text-foreground text-lg font-light tracking-tight">Sprint Burndown</h3>
                <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">Q4 Performance Index</p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="size-1.5 bg-foreground rounded-full"></div>
                  <span className="text-[10px] text-muted-foreground font-bold uppercase">Actual</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-1.5 border border-foreground/40 rounded-full"></div>
                  <span className="text-[10px] text-muted-foreground font-bold uppercase">Ideal</span>
                </div>
              </div>
            </div>

            <div className="h-64 flex items-end justify-between gap-1 relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center opacity-10">
                <div className="w-full h-full border-b border-foreground/20"></div>
                <div className="absolute w-full h-px bg-foreground/20 top-1/4"></div>
                <div className="absolute w-full h-px bg-foreground/20 top-2/4"></div>
                <div className="absolute w-full h-px bg-foreground/20 top-3/4"></div>
              </div>

              {/* Visual bars */}
              <div className="relative w-full h-full flex items-end justify-between px-2">
                {metrics?.burndown?.map((point: any, i: number) => (
                  <div key={i} className={`w-8 ${point.actual > point.ideal ? 'bg-foreground/50' : 'bg-foreground/15'} hover:bg-foreground/70 transition-all cursor-pointer rounded-t-sm`} style={{ height: `${point.actual}%` }}></div>
                )) || <span className="text-muted-foreground m-auto">No data</span>}
              </div>
            </div>

            <div className="flex justify-between text-[10px] text-muted-foreground font-bold tracking-widest uppercase pt-4 border-t border-border/50">
              {metrics?.burndown?.filter((_: any, i: number) => i % 2 === 0).map((point: any, i: number) => (
                <span key={i}>{point.day}</span>
              ))}
            </div>
          </div>

          {/* Live Feed */}
          <div className="liquid-glass flex flex-col rounded-xl">
            <div className="p-6 border-b border-border/50">
              <h3 className="text-foreground text-xs font-bold tracking-widest uppercase">Live System Feed</h3>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[400px] p-6 space-y-6 custom-scrollbar">
              {activitiesLoading ? (
                <div className="flex justify-center py-4 text-muted-foreground"><RefreshCw className="animate-spin size-5" /></div>
              ) : activities && activities.length > 0 ? (
                activities.map((activity: any) => (
                  <div key={activity.id} className="flex gap-4">
                    <div className="flex-shrink-0 size-8 rounded-full border border-border flex items-center justify-center">
                      {activity.type.includes('created') ? <Edit2 className="text-muted-foreground size-4" /> : <History className="text-muted-foreground size-4" />}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-foreground/80 font-medium">{activity.userName ? `${activity.userName} ` : ''}{activity.description}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{new Date(activity.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground text-center">No recent activity.</p>
              )}
            </div>
            <div className="p-4 border-t border-border/50 text-center">
              <button className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase hover:text-foreground transition-colors">View all activity</button>
            </div>
          </div>
        </section>

      </div>
    </DashboardLayout>
  );
}
