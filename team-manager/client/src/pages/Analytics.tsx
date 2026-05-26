import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useTeamContext } from "../contexts/TeamContext";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  Users,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Calendar,
  RefreshCw,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function Analytics() {
  const { selectedTeamId, teams } = useTeamContext();
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");

  // Calculate date range
  const getDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (timeRange) {
      case "7d":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(startDate.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(startDate.getDate() - 90);
        break;
    }
    
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  };

  const dateRange = getDateRange();

  // Fetch analytics data
  const { data: teamPerformance, isLoading: loadingPerformance } = trpc.analytics.getTeamPerformance.useQuery(
    { teamId: selectedTeamId || 0, ...dateRange },
    { enabled: !!selectedTeamId }
  );

  const { data: projectAnalytics, isLoading: loadingProjects } = trpc.analytics.getProjectAnalytics.useQuery(
    { teamId: selectedTeamId || 0, ...dateRange },
    { enabled: !!selectedTeamId }
  );

  const { data: bottlenecks, isLoading: loadingBottlenecks } = trpc.analytics.getBottlenecks.useQuery(
    { teamId: selectedTeamId || 0 },
    { enabled: !!selectedTeamId }
  );

  const { data: velocity, isLoading: loadingVelocity } = trpc.analytics.getVelocity.useQuery(
    { teamId: selectedTeamId || 0, weeks: 12 },
    { enabled: !!selectedTeamId }
  );

  const { data: workloadDistribution, isLoading: loadingWorkload } = trpc.analytics.getWorkloadDistribution.useQuery(
    { teamId: selectedTeamId || 0 },
    { enabled: !!selectedTeamId }
  );

  const { data: burndown, isLoading: loadingBurndown } = trpc.analytics.getBurndown.useQuery(
    { teamId: selectedTeamId || 0, sprintDays: 14 },
    { enabled: !!selectedTeamId }
  );

  const currentTeamName = teams?.find((t: any) => t.id === selectedTeamId)?.name || "Select a Team";
  const isLoading = loadingPerformance || loadingProjects || loadingBottlenecks || loadingVelocity || loadingWorkload || loadingBurndown;

  // Chart colors
  const COLORS = ["#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#6366f1", "#14b8a6"];

  return (
    <DashboardLayout>
      <div className="flex-1 max-w-7xl mx-auto w-full p-8 space-y-8 pb-20 overflow-y-auto custom-scrollbar">
        {/* Header Section */}
        <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pt-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
              <span>{currentTeamName}</span>
              <span className="size-1 bg-foreground/20 rounded-full"></span>
              <span>Analytics & Reporting</span>
            </div>
            <h1 className="text-3xl font-light tracking-tight text-foreground">
              Performance Dashboard
            </h1>
          </div>
          
          {/* Time Range Selector */}
          <div className="flex gap-2">
            {(["7d", "30d", "90d"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 text-[10px] font-bold tracking-widest uppercase rounded transition-colors ${
                  timeRange === range
                    ? "bg-foreground text-background"
                    : "border border-border text-foreground hover:bg-foreground/5"
                }`}
              >
                {range === "7d" ? "7 Days" : range === "30d" ? "30 Days" : "90 Days"}
              </button>
            ))}
          </div>
        </section>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <RefreshCw className="animate-spin size-8 text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Key Metrics Grid */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Tasks */}
              <div className="liquid-glass p-6 space-y-3 rounded-xl">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">
                    Total Tasks
                  </span>
                  <Target className="text-muted-foreground size-4" />
                </div>
                <div className="text-3xl font-light tracking-tighter text-foreground">
                  {teamPerformance?.totalTasks || 0}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {teamPerformance?.completedTasks || 0} completed
                </div>
              </div>

              {/* Completion Rate */}
              <div className="liquid-glass p-6 space-y-3 rounded-xl">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">
                    Completion Rate
                  </span>
                  <CheckCircle2 className="text-muted-foreground size-4" />
                </div>
                <div className="text-3xl font-light tracking-tighter text-foreground">
                  {teamPerformance?.totalTasks
                    ? Math.round((teamPerformance.completedTasks / teamPerformance.totalTasks) * 100)
                    : 0}
                  %
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {teamPerformance?.inProgressTasks || 0} in progress
                </div>
              </div>

              {/* Success Rate */}
              <div className="liquid-glass p-6 space-y-3 rounded-xl">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">
                    QA Success Rate
                  </span>
                  <Activity className="text-muted-foreground size-4" />
                </div>
                <div className="text-3xl font-light tracking-tighter text-foreground">
                  {projectAnalytics?.successRate?.toFixed(1) || 0}%
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {projectAnalytics?.passedQA || 0} / {projectAnalytics?.evaluatedProjects || 0} passed
                </div>
              </div>

              {/* Timeline Adherence */}
              <div className="liquid-glass p-6 space-y-3 rounded-xl">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">
                    On-Time Delivery
                  </span>
                  <Calendar className="text-muted-foreground size-4" />
                </div>
                <div className="text-3xl font-light tracking-tighter text-foreground">
                  {projectAnalytics?.timelineAdherence?.toFixed(1) || 0}%
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {projectAnalytics?.onTimeCount || 0} on time, {projectAnalytics?.delayedCount || 0} delayed
                </div>
              </div>
            </section>

            {/* Charts Row 1: Burndown & Velocity */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Burndown Chart */}
              <div className="liquid-glass p-6 space-y-6 rounded-xl">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-foreground text-lg font-light tracking-tight">Sprint Burndown</h3>
                    <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mt-1">
                      14-Day Sprint Progress
                    </p>
                  </div>
                  <BarChart3 className="text-muted-foreground size-5" />
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={burndown || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="day" stroke="rgba(255,255,255,0.5)" style={{ fontSize: "10px" }} />
                    <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: "10px" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(0,0,0,0.8)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="remaining" stroke="#8b5cf6" strokeWidth={2} name="Actual" />
                    <Line type="monotone" dataKey="ideal" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" name="Ideal" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Velocity Tracking */}
              <div className="liquid-glass p-6 space-y-6 rounded-xl">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-foreground text-lg font-light tracking-tight">Velocity Tracking</h3>
                    <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mt-1">
                      Tasks Completed Per Week
                    </p>
                  </div>
                  <TrendingUp className="text-muted-foreground size-5" />
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={velocity?.velocityData || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="week" stroke="rgba(255,255,255,0.5)" style={{ fontSize: "10px" }} />
                    <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: "10px" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(0,0,0,0.8)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="tasksCompleted" fill="#10b981" name="Tasks Completed" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="text-center text-sm text-muted-foreground">
                  Average: {velocity?.avgVelocity?.toFixed(1) || 0} tasks/week
                </div>
              </div>
            </section>

            {/* Charts Row 2: Workload Distribution & Stage Metrics */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Office Workload Distribution */}
              <div className="liquid-glass p-6 space-y-6 rounded-xl">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-foreground text-lg font-light tracking-tight">Office Workload</h3>
                    <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mt-1">
                      Current Distribution
                    </p>
                  </div>
                  <Users className="text-muted-foreground size-5" />
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={workloadDistribution || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.officeName}: ${entry.total}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="total"
                    >
                      {(workloadDistribution || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(0,0,0,0.8)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: "8px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Average Time Per Stage */}
              <div className="liquid-glass p-6 space-y-6 rounded-xl">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-foreground text-lg font-light tracking-tight">Stage Performance</h3>
                    <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mt-1">
                      Average Time Per Stage (Hours)
                    </p>
                  </div>
                  <Clock className="text-muted-foreground size-5" />
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={teamPerformance?.stageMetrics || []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis type="number" stroke="rgba(255,255,255,0.5)" style={{ fontSize: "10px" }} />
                    <YAxis dataKey="stage" type="category" stroke="rgba(255,255,255,0.5)" style={{ fontSize: "10px" }} width={100} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(0,0,0,0.8)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="averageTimeHours" fill="#f59e0b" name="Hours" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Bottleneck Analysis */}
            <section className="liquid-glass p-6 space-y-6 rounded-xl">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-foreground text-lg font-light tracking-tight">Bottleneck Analysis</h3>
                  <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mt-1">
                    Identify Workflow Delays
                  </p>
                </div>
                <AlertTriangle className="text-muted-foreground size-5" />
              </div>
              
              <div className="space-y-3">
                {bottlenecks && bottlenecks.length > 0 ? (
                  bottlenecks.map((bottleneck, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        bottleneck.isBottleneck
                          ? "border-red-500/30 bg-red-500/5"
                          : "border-border/50 bg-background/5"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {bottleneck.isBottleneck ? (
                          <AlertTriangle className="size-5 text-red-500" />
                        ) : (
                          <CheckCircle2 className="size-5 text-green-500" />
                        )}
                        <div>
                          <div className="font-medium text-foreground">{bottleneck.officeName}</div>
                          <div className="text-xs text-muted-foreground">
                            {bottleneck.totalHandoffs} handoffs processed
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-light text-foreground">
                          {bottleneck.averageTimeHours.toFixed(1)}h
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                          Avg Time
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No bottleneck data available
                  </div>
                )}
              </div>
            </section>

            {/* Team Member Performance */}
            <section className="liquid-glass p-6 space-y-6 rounded-xl">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-foreground text-lg font-light tracking-tight">Team Member Performance</h3>
                  <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mt-1">
                    Individual Metrics
                  </p>
                </div>
                <Users className="text-muted-foreground size-5" />
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-3 px-4 text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                        Member
                      </th>
                      <th className="text-left py-3 px-4 text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                        Office Role
                      </th>
                      <th className="text-right py-3 px-4 text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                        Total Tasks
                      </th>
                      <th className="text-right py-3 px-4 text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                        Completed
                      </th>
                      <th className="text-right py-3 px-4 text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                        Completion Rate
                      </th>
                      <th className="text-right py-3 px-4 text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                        Avg Time (hrs)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamPerformance?.memberMetrics && teamPerformance.memberMetrics.length > 0 ? (
                      teamPerformance.memberMetrics.map((member, index) => (
                        <tr key={index} className="border-b border-border/30 hover:bg-foreground/5">
                          <td className="py-3 px-4 text-foreground">{member.memberName}</td>
                          <td className="py-3 px-4 text-muted-foreground text-sm">
                            {member.officeRole || "Unassigned"}
                          </td>
                          <td className="py-3 px-4 text-right text-foreground">{member.totalTasks}</td>
                          <td className="py-3 px-4 text-right text-foreground">{member.completedTasks}</td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`inline-flex items-center gap-1 ${
                                member.completionRate >= 75
                                  ? "text-green-500"
                                  : member.completionRate >= 50
                                  ? "text-yellow-500"
                                  : "text-red-500"
                              }`}
                            >
                              {member.completionRate.toFixed(1)}%
                              {member.completionRate >= 75 ? (
                                <TrendingUp className="size-3" />
                              ) : (
                                <TrendingDown className="size-3" />
                              )}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-foreground">
                            {member.avgCompletionTimeHours.toFixed(1)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground">
                          No team member data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Quality Scores Over Time */}
            {teamPerformance?.qualityMetrics?.projects && teamPerformance.qualityMetrics.projects.length > 0 && (
              <section className="liquid-glass p-6 space-y-6 rounded-xl">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-foreground text-lg font-light tracking-tight">Quality Scores</h3>
                    <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mt-1">
                      Project Evaluation Trends
                    </p>
                  </div>
                  <Activity className="text-muted-foreground size-5" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 rounded-lg bg-background/5 border border-border/50">
                    <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mb-2">
                      Overall Score
                    </div>
                    <div className="text-2xl font-light text-foreground">
                      {teamPerformance.qualityMetrics.averages.avgOverallScore.toFixed(1)}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-background/5 border border-border/50">
                    <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mb-2">
                      Design Alignment
                    </div>
                    <div className="text-2xl font-light text-foreground">
                      {teamPerformance.qualityMetrics.averages.avgDesignAlignment.toFixed(1)}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-background/5 border border-border/50">
                    <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mb-2">
                      Business Alignment
                    </div>
                    <div className="text-2xl font-light text-foreground">
                      {teamPerformance.qualityMetrics.averages.avgBusinessAlignment.toFixed(1)}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-background/5 border border-border/50">
                    <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mb-2">
                      Technical Quality
                    </div>
                    <div className="text-2xl font-light text-foreground">
                      {teamPerformance.qualityMetrics.averages.avgTechnicalQuality.toFixed(1)}
                    </div>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={teamPerformance.qualityMetrics.projects}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="projectName" stroke="rgba(255,255,255,0.5)" style={{ fontSize: "10px" }} />
                    <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: "10px" }} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(0,0,0,0.8)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="overallScore" stroke="#8b5cf6" strokeWidth={2} name="Overall" />
                    <Line type="monotone" dataKey="designAlignment" stroke="#ec4899" strokeWidth={2} name="Design" />
                    <Line type="monotone" dataKey="businessAlignment" stroke="#f59e0b" strokeWidth={2} name="Business" />
                    <Line type="monotone" dataKey="technicalQuality" stroke="#10b981" strokeWidth={2} name="Technical" />
                  </LineChart>
                </ResponsiveContainer>
              </section>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
