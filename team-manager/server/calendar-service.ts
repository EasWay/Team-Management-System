import { getDb } from "./db";
import { calendarEvents, milestones, taskDependencies, userAvailability, tasks, projects } from "../drizzle/schema";
import { eq, and, gte, lte, desc, sql, or } from "drizzle-orm";

/**
 * Calendar Service
 * Handles calendar events, milestones, task dependencies, and user availability
 */

/**
 * Create calendar event
 */
export async function createCalendarEvent(data: {
  teamId: number;
  projectId?: number;
  taskId?: number;
  title: string;
  description?: string;
  eventType: string;
  startDate: Date;
  endDate: Date;
  allDay?: boolean;
  recurrence?: string;
  recurrenceEnd?: Date;
  location?: string;
  meetingUrl?: string;
  createdBy: number;
  assignedTo?: number[];
  status?: string;
  priority?: string;
  reminders?: any[];
  color?: string;
  metadata?: any;
}) {
  try {
    const [event] = await db.insert(calendarEvents).values(data).returning();
    return event;
  } catch (error) {
    console.error('Error creating calendar event:', error);
    throw new Error('Failed to create calendar event');
  }
}

/**
 * Get calendar events for a team
 */
export async function getCalendarEvents(
  teamId: number,
  filters?: {
    startDate?: Date;
    endDate?: Date;
    eventType?: string;
    projectId?: number;
    userId?: number;
  }
) {
  try {
    const conditions = [eq(calendarEvents.teamId, teamId)];
    
    if (filters?.startDate) {
      conditions.push(gte(calendarEvents.startDate, filters.startDate));
    }
    
    if (filters?.endDate) {
      conditions.push(lte(calendarEvents.endDate, filters.endDate));
    }
    
    if (filters?.eventType) {
      conditions.push(eq(calendarEvents.eventType, filters.eventType));
    }
    
    if (filters?.projectId) {
      conditions.push(eq(calendarEvents.projectId, filters.projectId));
    }
    
    const events = await db.select()
      .from(calendarEvents)
      .where(and(...conditions))
      .orderBy(calendarEvents.startDate);
    
    // Filter by assigned user if specified
    if (filters?.userId) {
      return events.filter(event => {
        const assignedTo = event.assignedTo as number[] | null;
        return assignedTo && assignedTo.includes(filters.userId);
      });
    }
    
    return events;
  } catch (error) {
    console.error('Error getting calendar events:', error);
    throw new Error('Failed to get calendar events');
  }
}

/**
 * Get calendar event by ID
 */
export async function getCalendarEventById(eventId: number) {
  try {
    const [event] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, eventId));
    return event;
  } catch (error) {
    console.error('Error getting calendar event:', error);
    throw new Error('Failed to get calendar event');
  }
}

/**
 * Update calendar event
 */
export async function updateCalendarEvent(eventId: number, data: Partial<{
  title: string;
  description: string;
  eventType: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  location: string;
  meetingUrl: string;
  assignedTo: number[];
  status: string;
  priority: string;
  color: string;
}>) {
  try {
    const [event] = await db.update(calendarEvents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(calendarEvents.id, eventId))
      .returning();
    
    return event;
  } catch (error) {
    console.error('Error updating calendar event:', error);
    throw new Error('Failed to update calendar event');
  }
}

/**
 * Delete calendar event
 */
export async function deleteCalendarEvent(eventId: number) {
  try {
    await db.delete(calendarEvents).where(eq(calendarEvents.id, eventId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    throw new Error('Failed to delete calendar event');
  }
}

/**
 * Create milestone
 */
export async function createMilestone(data: {
  teamId: number;
  projectId: number;
  name: string;
  description?: string;
  dueDate: Date;
  dependsOn?: number[];
  status?: string;
  progress?: number;
  color?: string;
  icon?: string;
  createdBy: number;
}) {
  try {
    const [milestone] = await db.insert(milestones).values(data).returning();
    return milestone;
  } catch (error) {
    console.error('Error creating milestone:', error);
    throw new Error('Failed to create milestone');
  }
}

/**
 * Get milestones for a project
 */
export async function getMilestones(projectId: number) {
  try {
    const projectMilestones = await db.select()
      .from(milestones)
      .where(eq(milestones.projectId, projectId))
      .orderBy(milestones.dueDate);
    
    return projectMilestones;
  } catch (error) {
    console.error('Error getting milestones:', error);
    throw new Error('Failed to get milestones');
  }
}

/**
 * Get milestones for a team
 */
export async function getTeamMilestones(teamId: number, filters?: {
  startDate?: Date;
  endDate?: Date;
  status?: string;
}) {
  try {
    const conditions = [eq(milestones.teamId, teamId)];
    
    if (filters?.startDate) {
      conditions.push(gte(milestones.dueDate, filters.startDate));
    }
    
    if (filters?.endDate) {
      conditions.push(lte(milestones.dueDate, filters.endDate));
    }
    
    if (filters?.status) {
      conditions.push(eq(milestones.status, filters.status));
    }
    
    const teamMilestones = await db.select()
      .from(milestones)
      .where(and(...conditions))
      .orderBy(milestones.dueDate);
    
    return teamMilestones;
  } catch (error) {
    console.error('Error getting team milestones:', error);
    throw new Error('Failed to get team milestones');
  }
}

/**
 * Update milestone
 */
export async function updateMilestone(milestoneId: number, data: Partial<{
  name: string;
  description: string;
  dueDate: Date;
  status: string;
  progress: number;
  completedAt: Date;
  completedBy: number;
}>) {
  try {
    const [milestone] = await db.update(milestones)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(milestones.id, milestoneId))
      .returning();
    
    return milestone;
  } catch (error) {
    console.error('Error updating milestone:', error);
    throw new Error('Failed to update milestone');
  }
}

/**
 * Delete milestone
 */
export async function deleteMilestone(milestoneId: number) {
  try {
    await db.delete(milestones).where(eq(milestones.id, milestoneId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting milestone:', error);
    throw new Error('Failed to delete milestone');
  }
}

/**
 * Create task dependency
 */
export async function createTaskDependency(data: {
  taskId: number;
  dependsOnTaskId: number;
  dependencyType?: string;
  lag?: number;
}) {
  try {
    // Check for circular dependencies
    const isCircular = await checkCircularDependency(data.taskId, data.dependsOnTaskId);
    if (isCircular) {
      throw new Error('Circular dependency detected');
    }
    
    const [dependency] = await db.insert(taskDependencies).values(data).returning();
    return dependency;
  } catch (error) {
    console.error('Error creating task dependency:', error);
    throw error;
  }
}

/**
 * Check for circular dependencies
 */
async function checkCircularDependency(taskId: number, dependsOnTaskId: number): Promise<boolean> {
  try {
    // Get all dependencies of the dependsOnTaskId
    const dependencies = await db.select()
      .from(taskDependencies)
      .where(eq(taskDependencies.taskId, dependsOnTaskId));
    
    // Check if any of them depend on taskId (direct circular)
    if (dependencies.some(dep => dep.dependsOnTaskId === taskId)) {
      return true;
    }
    
    // Check for indirect circular dependencies (recursive)
    for (const dep of dependencies) {
      const isCircular = await checkCircularDependency(taskId, dep.dependsOnTaskId);
      if (isCircular) return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking circular dependency:', error);
    return false;
  }
}

/**
 * Get task dependencies
 */
export async function getTaskDependencies(taskId: number) {
  try {
    const dependencies = await db.select()
      .from(taskDependencies)
      .where(eq(taskDependencies.taskId, taskId));
    
    return dependencies;
  } catch (error) {
    console.error('Error getting task dependencies:', error);
    throw new Error('Failed to get task dependencies');
  }
}

/**
 * Get all dependencies for a project (for Gantt chart)
 */
export async function getProjectDependencies(projectId: number) {
  try {
    // Get all tasks for the project
    const projectTasks = await db.select()
      .from(tasks)
      .where(eq(tasks.teamId, projectId));
    
    const taskIds = projectTasks.map(t => t.id);
    
    if (taskIds.length === 0) return [];
    
    // Get all dependencies for these tasks
    const dependencies = await db.select()
      .from(taskDependencies)
      .where(sql`${taskDependencies.taskId} = ANY(${taskIds})`);
    
    return dependencies;
  } catch (error) {
    console.error('Error getting project dependencies:', error);
    throw new Error('Failed to get project dependencies');
  }
}

/**
 * Delete task dependency
 */
export async function deleteTaskDependency(dependencyId: number) {
  try {
    await db.delete(taskDependencies).where(eq(taskDependencies.id, dependencyId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting task dependency:', error);
    throw new Error('Failed to delete task dependency');
  }
}

/**
 * Set user availability
 */
export async function setUserAvailability(data: {
  userId: number;
  teamId: number;
  startDate: Date;
  endDate: Date;
  status: string;
  reason?: string;
  isRecurring?: boolean;
  recurrencePattern?: string;
}) {
  try {
    const [availability] = await db.insert(userAvailability).values(data).returning();
    return availability;
  } catch (error) {
    console.error('Error setting user availability:', error);
    throw new Error('Failed to set user availability');
  }
}

/**
 * Get user availability
 */
export async function getUserAvailability(
  userId: number,
  filters?: {
    startDate?: Date;
    endDate?: Date;
  }
) {
  try {
    const conditions = [eq(userAvailability.userId, userId)];
    
    if (filters?.startDate) {
      conditions.push(gte(userAvailability.startDate, filters.startDate));
    }
    
    if (filters?.endDate) {
      conditions.push(lte(userAvailability.endDate, filters.endDate));
    }
    
    const availability = await db.select()
      .from(userAvailability)
      .where(and(...conditions))
      .orderBy(userAvailability.startDate);
    
    return availability;
  } catch (error) {
    console.error('Error getting user availability:', error);
    throw new Error('Failed to get user availability');
  }
}

/**
 * Get team availability (all members)
 */
export async function getTeamAvailability(
  teamId: number,
  filters?: {
    startDate?: Date;
    endDate?: Date;
  }
) {
  try {
    const conditions = [eq(userAvailability.teamId, teamId)];
    
    if (filters?.startDate) {
      conditions.push(gte(userAvailability.startDate, filters.startDate));
    }
    
    if (filters?.endDate) {
      conditions.push(lte(userAvailability.endDate, filters.endDate));
    }
    
    const availability = await db.select()
      .from(userAvailability)
      .where(and(...conditions))
      .orderBy(userAvailability.startDate);
    
    return availability;
  } catch (error) {
    console.error('Error getting team availability:', error);
    throw new Error('Failed to get team availability');
  }
}

/**
 * Update user availability
 */
export async function updateUserAvailability(availabilityId: number, data: Partial<{
  startDate: Date;
  endDate: Date;
  status: string;
  reason: string;
}>) {
  try {
    const [availability] = await db.update(userAvailability)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userAvailability.id, availabilityId))
      .returning();
    
    return availability;
  } catch (error) {
    console.error('Error updating user availability:', error);
    throw new Error('Failed to update user availability');
  }
}

/**
 * Delete user availability
 */
export async function deleteUserAvailability(availabilityId: number) {
  try {
    await db.delete(userAvailability).where(eq(userAvailability.id, availabilityId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting user availability:', error);
    throw new Error('Failed to delete user availability');
  }
}

/**
 * Get Gantt chart data for a project
 */
export async function getGanttChartData(projectId: number) {
  try {
    // Get all tasks for the project
    const projectTasks = await db.select()
      .from(tasks)
      .where(eq(tasks.teamId, projectId))
      .orderBy(tasks.createdAt);
    
    // Get all dependencies
    const taskIds = projectTasks.map(t => t.id);
    let dependencies: any[] = [];
    
    if (taskIds.length > 0) {
      dependencies = await db.select()
        .from(taskDependencies)
        .where(sql`${taskDependencies.taskId} = ANY(ARRAY[${taskIds.join(',')}])`);
    }
    
    // Get milestones
    const projectMilestones = await db.select()
      .from(milestones)
      .where(eq(milestones.projectId, projectId))
      .orderBy(milestones.dueDate);
    
    // Calculate critical path
    const criticalPath = calculateCriticalPath(projectTasks, dependencies);
    
    return {
      tasks: projectTasks,
      dependencies,
      milestones: projectMilestones,
      criticalPath,
    };
  } catch (error) {
    console.error('Error getting Gantt chart data:', error);
    throw new Error('Failed to get Gantt chart data');
  }
}

/**
 * Calculate critical path (simplified version)
 */
function calculateCriticalPath(tasks: any[], dependencies: any[]) {
  // Build dependency graph
  const graph: Record<number, number[]> = {};
  const inDegree: Record<number, number> = {};
  
  tasks.forEach(task => {
    graph[task.id] = [];
    inDegree[task.id] = 0;
  });
  
  dependencies.forEach(dep => {
    graph[dep.dependsOnTaskId].push(dep.taskId);
    inDegree[dep.taskId]++;
  });
  
  // Find tasks with no dependencies (starting points)
  const queue: number[] = [];
  tasks.forEach(task => {
    if (inDegree[task.id] === 0) {
      queue.push(task.id);
    }
  });
  
  // Topological sort to find longest path
  const longestPath: Record<number, number> = {};
  tasks.forEach(task => {
    longestPath[task.id] = 0;
  });
  
  while (queue.length > 0) {
    const taskId = queue.shift()!;
    
    graph[taskId].forEach(dependentId => {
      const task = tasks.find(t => t.id === taskId);
      const duration = task?.dueDate && task?.createdAt
        ? Math.ceil((new Date(task.dueDate).getTime() - new Date(task.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : 1;
      
      longestPath[dependentId] = Math.max(
        longestPath[dependentId],
        longestPath[taskId] + duration
      );
      
      inDegree[dependentId]--;
      if (inDegree[dependentId] === 0) {
        queue.push(dependentId);
      }
    });
  }
  
  // Find the critical path (tasks with longest path)
  const maxPath = Math.max(...Object.values(longestPath));
  const criticalTasks = Object.entries(longestPath)
    .filter(([_, path]) => path === maxPath)
    .map(([taskId, _]) => parseInt(taskId));
  
  return criticalTasks;
}

/**
 * Get upcoming deadlines
 */
export async function getUpcomingDeadlines(teamId: number, days: number = 7) {
  try {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    
    // Get calendar events
    const events = await db.select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.teamId, teamId),
          gte(calendarEvents.startDate, now),
          lte(calendarEvents.startDate, futureDate),
          eq(calendarEvents.eventType, 'deadline')
        )
      )
      .orderBy(calendarEvents.startDate);
    
    // Get milestones
    const upcomingMilestones = await db.select()
      .from(milestones)
      .where(
        and(
          eq(milestones.teamId, teamId),
          gte(milestones.dueDate, now),
          lte(milestones.dueDate, futureDate)
        )
      )
      .orderBy(milestones.dueDate);
    
    // Get tasks with due dates
    const upcomingTasks = await db.select()
      .from(tasks)
      .where(
        and(
          eq(tasks.teamId, teamId),
          sql`${tasks.dueDate} IS NOT NULL`,
          gte(tasks.dueDate, now),
          lte(tasks.dueDate, futureDate)
        )
      )
      .orderBy(tasks.dueDate);
    
    return {
      events,
      milestones: upcomingMilestones,
      tasks: upcomingTasks,
    };
  } catch (error) {
    console.error('Error getting upcoming deadlines:', error);
    throw new Error('Failed to get upcoming deadlines');
  }
}
