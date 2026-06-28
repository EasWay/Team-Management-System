import { getDb } from './db.js';
import { tasks } from '../drizzle/schema.js';
import { eq, and, gt, asc, ne } from 'drizzle-orm';
import { sendNotification } from './db.js';

let currentTimer: NodeJS.Timeout | null = null;
let currentScheduledTaskId: number | null = null;

export async function scheduleNextDeadline() {
  try {
    const db = await getDb();
    if (!db) return;

    // Find the closest future task deadline that is not done
    const now = new Date();
    const upcomingTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          ne(tasks.status, 'done'),
          gt(tasks.dueDate, now)
        )
      )
      .orderBy(asc(tasks.dueDate))
      .limit(1);

    const nextTask = upcomingTasks[0];

    // Clear existing timer if any
    if (currentTimer) {
      clearTimeout(currentTimer);
      currentTimer = null;
      currentScheduledTaskId = null;
    }

    if (!nextTask || !nextTask.dueDate) {
      console.log('[DeadlineTracker] No upcoming deadlines found.');
      return;
    }

    const timeUntilDeadline = nextTask.dueDate.getTime() - Date.now();
    
    // setTimeout has a max limit of 24.8 days (2,147,483,647 ms).
    const MAX_TIMEOUT = 2147483647;
    const timeoutDuration = Math.min(timeUntilDeadline, MAX_TIMEOUT);

    console.log(`[DeadlineTracker] Scheduling notification for Task #${nextTask.id} in ${Math.round(timeoutDuration / 60000)} minutes.`);
    
    currentScheduledTaskId = nextTask.id;
    currentTimer = setTimeout(async () => {
      // If the timeout is the max limit and the deadline is still further out, just reschedule.
      if (timeoutDuration === MAX_TIMEOUT && timeUntilDeadline > MAX_TIMEOUT) {
        scheduleNextDeadline();
        return;
      }

      console.log(`[DeadlineTracker] Deadline reached for Task #${nextTask.id}. Dispatching notification.`);
      
      // Dispatch notification
      if (nextTask.assignedTo) {
        await sendNotification({
          userId: nextTask.assignedTo,
          teamId: nextTask.teamId,
          type: 'task_deadline',
          title: 'Task Deadline Reached',
          message: `The deadline for your task "${nextTask.title}" is now!`,
          priority: 'high',
          taskId: nextTask.id,
          actionUrl: '/tasks',
          actionLabel: 'View Task'
        }, db).catch(e => console.error('Error sending deadline notification:', e));
      }

      // Schedule the next one!
      scheduleNextDeadline();
    }, timeoutDuration);

  } catch (error) {
    console.error('[DeadlineTracker] Error scheduling next deadline:', error);
  }
}

// Call this function whenever a task is created, updated, or deleted
export function notifyTaskChanged() {
  scheduleNextDeadline();
}
