import { db } from "./db";
import { tasks, projects, teamMembers, teamMembersCollaborative, approvals, activities } from "../drizzle/schema";
import { eq, and, sql, desc, gte, lte, count, avg } from "drizzle-orm";

/**
 * Analytics Service
 * Provides comprehensive analytics for team performance, project health, and workflow metrics
 */

// Office role mapping for workflow stages
const OFFICE_ROLES = {
  'project_manager': 'Project Manager',
  'lead_researcher': 'Lead Researcher',
  'systems_architect': 'Systems Architect',
  'backend_engineer': 'Backend Engineer',
  'fullstack_engineer': 'Full Stack Engineer',
  'ai_engineer': 'AI Engineer',
  'qa_tester': 'QA Tester',
  'designer': 'Designer'
} as const;

interface TimeRange {
  startDate?: Date;
  endDate?: Date;
}

/**
 * Get team performance metrics
 */
export async function getTeamPerformanceMetrics(teamId: number, timeRange?: TimeRange) {
  try {
    const conditions = [eq(tasks.teamId, teamId)];
    
    if (timeRange?.startDate) {
      conditions.push(gte(tasks.createdAt, timeRange.startDate));
    }
    if (timeRange?.endDate) {
      conditions.push(lte(tasks.createdAt, timeRange.endDate));
    }

    // Get all tasks for the team
    const allTasks = await db
      .select()
      .from(tasks)
      .where(and(...conditions));

    // Calculate average time per workflow stage
    const stageMetrics = await calculateStageMetrics(allTasks);

    // Calculate completion rates per team member
    const memberMetrics = await calculateMemberMetrics(teamId, allTasks);

    // Calculate quality scores over time
    const qualityMetrics = await calculateQualityMetrics(teamId, timeRange);

    return {
      stageMetrics,
      memberMetrics,
      qualityMetrics,
      totalTasks: allTasks.length,
      completedTasks: allTasks.filter(t => t.status === 'done').length,
      inProgressTasks: allTasks.filter(t => t.status === 'in_progress').length,
    };
  } catch (error) {
    console.error('Error getting team performance metrics:', error);
    throw new Error('Failed to get team performance metrics');
  }
}

/**
 * Calculate average time spent in each workflow stage
 */
async function calculateStageMetrics(allTasks: any[]) {
  const stageData: Record<string, { totalTime: number; count: number; tasks: number }> = {};

  for (const task of allTasks) {
    if (task.handoffHistory && Array.isArray(task.handoffHistory)) {
      for (let i = 0; i < task.handoffHistory.length; i++) {
        const handoff = task.handoffHistory[i];
        const stage = handoff.fromStage || handoff.toStage || 'unknown';
        
        if (!stageData[stage]) {
          stageData[stage] = { totalTime: 0, count: 0, tasks: 0 };
        }

        // Calculate time spent in this stage
        if (i < task.handoffHistory.length - 1) {
          const nextHandoff = task.handoffHistory[i + 1];
          const timeSpent = new Date(nextHandoff.timestamp).getTime() - new Date(handoff.timestamp).getTime();
          stageData[stage].totalTime += timeSpent;
          stageData[stage].count += 1;
        }
        stageData[stage].tasks += 1;
      }
    }
  }

  // Convert to average times in hours
  const stageMetrics = Object.entries(stageData).map(([stage, data]) => ({
    stage,
    averageTimeHours: data.count > 0 ? (data.totalTime / data.count) / (1000 * 60 * 60) : 0,
    taskCount: data.tasks,
    handoffCount: data.count,
  }));

  return stageMetrics.sort((a, b) => b.averageTimeHours - a.averageTimeHours);
}

/**
 * Calculate completion rates and performance per team member
 */
async function calculateMemberMetrics(teamId: number, allTasks: any[]) {
  // Get team members
  const members = await db
    .select({
      id: teamMembers.id,
      name: teamMembers.name,
      officeRole: teamMembersCollaborative.officeRole,
    })
    .from(teamMembersCollaborative)
    .innerJoin(teamMembers, eq(teamMembersCollaborative.memberId, teamMembers.id))
    .where(eq(teamMembersCollaborative.teamId, teamId));

  const memberMetrics = members.map(member => {
    const assignedTasks = allTasks.filter(t => t.assignedTo === member.id);
    const completedTasks = assignedTasks.filter(t => t.status === 'done');
    const inProgressTasks = assignedTasks.filter(t => t.status === 'in_progress');
    
    // Calculate average completion time
    let totalCompletionTime = 0;
    let completedCount = 0;
    
    for (const task of completedTasks) {
      if (task.createdAt && task.updatedAt) {
        const completionTime = new Date(task.updatedAt).getTime() - new Date(task.createdAt).getTime();
        totalCompletionTime += completionTime;
        completedCount += 1;
      }
    }

    const avgCompletionTimeHours = completedCount > 0 
      ? (totalCompletionTime / completedCount) / (1000 * 60 * 60) 
      : 0;

    return {
      memberId: member.id,
      memberName: member.name,
      officeRole: member.officeRole,
      totalTasks: assignedTasks.length,
      completedTasks: completedTasks.length,
      inProgressTasks: inProgressTasks.length,
      completionRate: assignedTasks.length > 0 
        ? (completedTasks.length / assignedTasks.length) * 100 
        : 0,
      avgCompletionTimeHours,
    };
  });

  return memberMetrics.sort((a, b) => b.completionRate - a.completionRate);
}

/**
 * Calculate quality scores over time from project evaluations
 */
async function calculateQualityMetrics(teamId: number, timeRange?: TimeRange) {
  try {
    const conditions = [eq(projects.teamId, teamId)];
    
    if (timeRange?.startDate) {
      conditions.push(gte(projects.evaluatedAt, timeRange.startDate));
    }
    if (timeRange?.endDate) {
      conditions.push(lte(projects.evaluatedAt, timeRange.endDate));
    }

    const evaluatedProjects = await db
      .select()
      .from(projects)
      .where(and(...conditions, sql`${projects.evaluationData} IS NOT NULL`))
      .orderBy(desc(projects.evaluatedAt));

    const qualityData = evaluatedProjects.map(project => {
      const evalData = project.evaluationData as any;
      return {
        projectId: project.id,
        projectName: project.name,
        evaluatedAt: project.evaluatedAt,
        overallScore: evalData?.overallScore || 0,
        designAlignment: evalData?.designAlignment || 0,
        businessAlignment: evalData?.businessAlignment || 0,
        technicalQuality: evalData?.technicalQuality || 0,
      };
    });

    // Calculate average scores
    const avgScores = qualityData.length > 0 ? {
      avgOverallScore: qualityData.reduce((sum, p) => sum + p.overallScore, 0) / qualityData.length,
      avgDesignAlignment: qualityData.reduce((sum, p) => sum + p.designAlignment, 0) / qualityData.length,
      avgBusinessAlignment: qualityData.reduce((sum, p) => sum + p.businessAlignment, 0) / qualityData.length,
      avgTechnicalQuality: qualityData.reduce((sum, p) => sum + p.technicalQuality, 0) / qualityData.length,
    } : {
      avgOverallScore: 0,
      avgDesignAlignment: 0,
      avgBusinessAlignment: 0,
      avgTechnicalQuality: 0,
    };

    return {
      projects: qualityData,
      averages: avgScores,
    };
  } catch (error) {
    console.error('Error calculating quality metrics:', error);
    return {
      projects: [],
      averages: {
        avgOverallScore: 0,
        avgDesignAlignment: 0,
        avgBusinessAlignment: 0,
        avgTechnicalQuality: 0,
      },
    };
  }
}

/**
 * Get project analytics
 */
export async function getProjectAnalytics(teamId: number, timeRange?: TimeRange) {
  try {
    const conditions = [eq(projects.teamId, teamId)];
    
    if (timeRange?.startDate) {
      conditions.push(gte(projects.createdAt, timeRange.startDate));
    }
    if (timeRange?.endDate) {
      conditions.push(lte(projects.createdAt, timeRange.endDate));
    }

    const allProjects = await db
      .select()
      .from(projects)
      .where(and(...conditions));

    // Success rate (projects that pass QA vs fail)
    const evaluatedProjects = allProjects.filter(p => p.evaluationData);
    const passedQA = evaluatedProjects.filter(p => {
      const evalData = p.evaluationData as any;
      return evalData?.overallScore >= 90;
    });

    const successRate = evaluatedProjects.length > 0 
      ? (passedQA.length / evaluatedProjects.length) * 100 
      : 0;

    // Timeline adherence (on-time vs delayed)
    const completedProjects = allProjects.filter(p => p.status === 'completed' || p.dateEnded);
    let onTimeCount = 0;
    let delayedCount = 0;

    for (const project of completedProjects) {
      if (project.dateEnded && project.createdAt) {
        // Assuming 30 days is the expected timeline (can be customized)
        const expectedDays = 30;
        const actualDays = (new Date(project.dateEnded).getTime() - new Date(project.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        
        if (actualDays <= expectedDays) {
          onTimeCount++;
        } else {
          delayedCount++;
        }
      }
    }

    const timelineAdherence = completedProjects.length > 0 
      ? (onTimeCount / completedProjects.length) * 100 
      : 0;

    // Resource utilization (projects per stage)
    const stageDistribution: Record<string, number> = {};
    allProjects.forEach(project => {
      const stage = project.workflowStage || 'unknown';
      stageDistribution[stage] = (stageDistribution[stage] || 0) + 1;
    });

    return {
      totalProjects: allProjects.length,
      activeProjects: allProjects.filter(p => p.status === 'active').length,
      completedProjects: completedProjects.length,
      evaluatedProjects: evaluatedProjects.length,
      passedQA: passedQA.length,
      successRate,
      onTimeCount,
      delayedCount,
      timelineAdherence,
      stageDistribution,
    };
  } catch (error) {
    console.error('Error getting project analytics:', error);
    throw new Error('Failed to get project analytics');
  }
}

/**
 * Get bottleneck analysis - identify which offices have longest delays
 */
export async function getBottleneckAnalysis(teamId: number) {
  try {
    // Get all tasks and projects with handoff history
    const allTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.teamId, teamId));

    const allProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.teamId, teamId));

    const officeMetrics: Record<string, { totalTime: number; count: number; items: number }> = {};

    // Analyze task handoffs
    for (const task of allTasks) {
      if (task.handoffHistory && Array.isArray(task.handoffHistory)) {
        for (let i = 0; i < task.handoffHistory.length - 1; i++) {
          const handoff = task.handoffHistory[i];
          const nextHandoff = task.handoffHistory[i + 1];
          const office = handoff.toRole || handoff.fromRole || 'unknown';
          
          if (!officeMetrics[office]) {
            officeMetrics[office] = { totalTime: 0, count: 0, items: 0 };
          }

          const timeSpent = new Date(nextHandoff.timestamp).getTime() - new Date(handoff.timestamp).getTime();
          officeMetrics[office].totalTime += timeSpent;
          officeMetrics[office].count += 1;
        }
      }
    }

    // Analyze project handoffs
    for (const project of allProjects) {
      if (project.handoffHistory && Array.isArray(project.handoffHistory)) {
        for (let i = 0; i < project.handoffHistory.length - 1; i++) {
          const handoff = project.handoffHistory[i];
          const nextHandoff = project.handoffHistory[i + 1];
          const office = handoff.toRole || handoff.fromRole || 'unknown';
          
          if (!officeMetrics[office]) {
            officeMetrics[office] = { totalTime: 0, count: 0, items: 0 };
          }

          const timeSpent = new Date(nextHandoff.timestamp).getTime() - new Date(handoff.timestamp).getTime();
          officeMetrics[office].totalTime += timeSpent;
          officeMetrics[office].count += 1;
        }
      }
    }

    // Convert to bottleneck analysis
    const bottlenecks = Object.entries(officeMetrics).map(([office, data]) => ({
      office,
      officeName: OFFICE_ROLES[office as keyof typeof OFFICE_ROLES] || office,
      averageTimeHours: data.count > 0 ? (data.totalTime / data.count) / (1000 * 60 * 60) : 0,
      totalHandoffs: data.count,
      isBottleneck: data.count > 0 && (data.totalTime / data.count) > (7 * 24 * 60 * 60 * 1000), // More than 7 days
    }));

    return bottlenecks.sort((a, b) => b.averageTimeHours - a.averageTimeHours);
  } catch (error) {
    console.error('Error getting bottleneck analysis:', error);
    throw new Error('Failed to get bottleneck analysis');
  }
}

/**
 * Get velocity tracking data (tasks completed over time)
 */
export async function getVelocityTracking(teamId: number, weeks: number = 12) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (weeks * 7));

    const completedTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.teamId, teamId),
          eq(tasks.status, 'done'),
          gte(tasks.updatedAt, startDate)
        )
      )
      .orderBy(tasks.updatedAt);

    // Group by week
    const weeklyData: Record<string, number> = {};
    
    completedTasks.forEach(task => {
      if (task.updatedAt) {
        const weekStart = getWeekStart(new Date(task.updatedAt));
        const weekKey = weekStart.toISOString().split('T')[0];
        weeklyData[weekKey] = (weeklyData[weekKey] || 0) + 1;
      }
    });

    // Convert to array format
    const velocityData = Object.entries(weeklyData).map(([week, count]) => ({
      week,
      tasksCompleted: count,
    })).sort((a, b) => a.week.localeCompare(b.week));

    // Calculate average velocity
    const avgVelocity = velocityData.length > 0
      ? velocityData.reduce((sum, d) => sum + d.tasksCompleted, 0) / velocityData.length
      : 0;

    return {
      velocityData,
      avgVelocity,
      totalWeeks: weeks,
    };
  } catch (error) {
    console.error('Error getting velocity tracking:', error);
    throw new Error('Failed to get velocity tracking');
  }
}

/**
 * Get office workload distribution
 */
export async function getOfficeWorkloadDistribution(teamId: number) {
  try {
    // Get all active tasks and projects
    const activeTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.teamId, teamId),
          sql`${tasks.status} != 'done'`
        )
      );

    const activeProjects = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.teamId, teamId),
          sql`${projects.status} = 'active'`
        )
      );

    // Count items per office role
    const workloadByOffice: Record<string, { tasks: number; projects: number; total: number }> = {};

    activeTasks.forEach(task => {
      const role = task.assignedRole || 'unassigned';
      if (!workloadByOffice[role]) {
        workloadByOffice[role] = { tasks: 0, projects: 0, total: 0 };
      }
      workloadByOffice[role].tasks += 1;
      workloadByOffice[role].total += 1;
    });

    activeProjects.forEach(project => {
      const role = project.assignedRole || 'unassigned';
      if (!workloadByOffice[role]) {
        workloadByOffice[role] = { tasks: 0, projects: 0, total: 0 };
      }
      workloadByOffice[role].projects += 1;
      workloadByOffice[role].total += 1;
    });

    // Convert to array format
    const workloadData = Object.entries(workloadByOffice).map(([role, data]) => ({
      office: role,
      officeName: OFFICE_ROLES[role as keyof typeof OFFICE_ROLES] || role,
      tasks: data.tasks,
      projects: data.projects,
      total: data.total,
    })).sort((a, b) => b.total - a.total);

    return workloadData;
  } catch (error) {
    console.error('Error getting office workload distribution:', error);
    throw new Error('Failed to get office workload distribution');
  }
}

/**
 * Get burndown chart data
 */
export async function getBurndownData(teamId: number, sprintDays: number = 14) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - sprintDays);

    const allTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.teamId, teamId),
          gte(tasks.createdAt, startDate)
        )
      );

    const totalTasks = allTasks.length;
    const dailyData: { day: string; remaining: number; ideal: number }[] = [];

    for (let i = 0; i <= sprintDays; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + i);
      
      const completedByDate = allTasks.filter(task => 
        task.status === 'done' && 
        task.updatedAt && 
        new Date(task.updatedAt) <= currentDate
      ).length;

      const remaining = totalTasks - completedByDate;
      const ideal = totalTasks - (totalTasks / sprintDays) * i;

      dailyData.push({
        day: `Day ${i + 1}`,
        remaining,
        ideal: Math.max(0, Math.round(ideal)),
      });
    }

    return dailyData;
  } catch (error) {
    console.error('Error getting burndown data:', error);
    throw new Error('Failed to get burndown data');
  }
}

// Helper function to get the start of the week (Monday)
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}
