import { getDb } from "./db";
import { notifications, notificationPreferences, notificationRules, dailyDigestQueue, tasks, fileFolders, teamMembers } from "../drizzle/schema";
import { eq, and, desc, sql, lt, gte, isNull } from "drizzle-orm";

/**
 * Notification Service
 * Handles smart notifications, reminders, and daily digests
 */

/**
 * Create or update notification preferences
 */
export async function upsertNotificationPreferences(data: {
  userId: number;
  teamId: number;
  emailEnabled?: boolean;
  pushEnabled?: boolean;
  inAppEnabled?: boolean;
  taskAssignments?: boolean;
  taskDeadlines?: boolean;
  mentions?: boolean;
  approvalRequests?: boolean;
  folderAlerts?: boolean;
  projectUpdates?: boolean;
  teamMessages?: boolean;
  highPriorityOnly?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  quietHoursTimezone?: string;
  dailyDigestEnabled?: boolean;
  dailyDigestTime?: string;
  dailyDigestTimezone?: string;
}) {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    // Check if preferences exist
    const [existing] = await db.select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.userId, data.userId),
          eq(notificationPreferences.teamId, data.teamId)
        )
      );

    if (existing) {
      // Update existing preferences
      const [updated] = await db.update(notificationPreferences)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(notificationPreferences.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new preferences
      const [created] = await db.insert(notificationPreferences)
        .values(data)
        .returning();
      return created;
    }
  } catch (error) {
    console.error('Error upserting notification preferences:', error);
    throw new Error('Failed to save notification preferences');
  }
}

/**
 * Get notification preferences for a user
 */
export async function getNotificationPreferences(userId: number, teamId: number) {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    const [prefs] = await db.select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.userId, userId),
          eq(notificationPreferences.teamId, teamId)
        )
      );

    // Return default preferences if none exist
    if (!prefs) {
      return {
        userId,
        teamId,
        emailEnabled: true,
        pushEnabled: true,
        inAppEnabled: true,
        taskAssignments: true,
        taskDeadlines: true,
        mentions: true,
        approvalRequests: true,
        folderAlerts: true,
        projectUpdates: true,
        teamMessages: true,
        highPriorityOnly: false,
        quietHoursEnabled: false,
        dailyDigestEnabled: true,
        dailyDigestTime: "08:00",
        dailyDigestTimezone: "UTC",
      };
    }

    return prefs;
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    throw new Error('Failed to get notification preferences');
  }
}

/**
 * Create a notification
 */
export async function createNotification(data: {
  userId: number;
  teamId: number;
  type: string;
  title: string;
  message: string;
  priority?: string;
  taskId?: number;
  projectId?: number;
  fileId?: number;
  folderId?: number;
  actionUrl?: string;
  actionLabel?: string;
}) {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    // Get user preferences
    const prefs = await getNotificationPreferences(data.userId, data.teamId);

    // Check if user wants this type of notification
    const typeEnabled = checkNotificationTypeEnabled(data.type, prefs);
    if (!typeEnabled) {
      return null; // User has disabled this notification type
    }

    // Check quiet hours
    if (prefs.quietHoursEnabled && isInQuietHours(prefs)) {
      // Queue for later or skip
      return null;
    }

    // Check priority filter
    if (prefs.highPriorityOnly && data.priority !== 'high' && data.priority !== 'urgent') {
      return null;
    }

    // Create notification
    const [notification] = await db.insert(notifications).values({
      ...data,
      sentViaEmail: prefs.emailEnabled,
      sentViaPush: prefs.pushEnabled,
      sentInApp: prefs.inAppEnabled,
    }).returning();

    // TODO: Send actual email/push notifications here
    // For now, we just mark them as sent

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw new Error('Failed to create notification');
  }
}

/**
 * Check if notification type is enabled
 */
function checkNotificationTypeEnabled(type: string, prefs: any): boolean {
  const typeMap: Record<string, string> = {
    'task_assignment': 'taskAssignments',
    'deadline_approaching': 'taskDeadlines',
    'mention': 'mentions',
    'approval_request': 'approvalRequests',
    'folder_alert': 'folderAlerts',
    'project_update': 'projectUpdates',
    'team_message': 'teamMessages',
  };

  const prefKey = typeMap[type];
  return prefKey ? prefs[prefKey] !== false : true;
}

/**
 * Check if current time is in quiet hours
 */
function isInQuietHours(prefs: any): boolean {
  if (!prefs.quietHoursStart || !prefs.quietHoursEnd) {
    return false;
  }

  // TODO: Implement proper timezone-aware quiet hours check
  // For now, return false
  return false;
}

/**
 * Get notifications for a user
 */
export async function getNotifications(userId: number, teamId: number, filters?: {
  isRead?: boolean;
  type?: string;
  limit?: number;
}) {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    const conditions = [
      eq(notifications.userId, userId),
      eq(notifications.teamId, teamId),
    ];

    if (filters?.isRead !== undefined) {
      conditions.push(eq(notifications.isRead, filters.isRead));
    }

    if (filters?.type) {
      conditions.push(eq(notifications.type, filters.type));
    }

    let query = db.select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt));

    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }

    const result = await query;
    return result;
  } catch (error) {
    console.error('Error getting notifications:', error);
    throw new Error('Failed to get notifications');
  }
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: number, teamId: number) {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    const result = await db.select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.teamId, teamId),
          eq(notifications.isRead, false)
        )
      );

    return result[0]?.count || 0;
  } catch (error) {
    console.error('Error getting unread count:', error);
    throw new Error('Failed to get unread count');
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: number, userId: number) {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    const [notification] = await db.update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId)
        )
      )
      .returning();

    return notification;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw new Error('Failed to mark notification as read');
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(userId: number, teamId: number) {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    await db.update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.teamId, teamId),
          eq(notifications.isRead, false)
        )
      );

    return { success: true };
  } catch (error) {
    console.error('Error marking all as read:', error);
    throw new Error('Failed to mark all as read');
  }
}

/**
 * Delete notification
 */
export async function deleteNotification(notificationId: number, userId: number) {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    await db.delete(notifications)
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId)
        )
      );

    return { success: true };
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw new Error('Failed to delete notification');
  }
}

/**
 * Create notification rule
 */
export async function createNotificationRule(data: {
  teamId: number;
  name: string;
  description?: string;
  ruleType: string;
  conditions?: any;
  thresholdHours?: number;
  thresholdDays?: number;
  notificationType: string;
  notificationPriority?: string;
  createdBy: number;
}) {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    const [rule] = await db.insert(notificationRules).values(data).returning();
    return rule;
  } catch (error) {
    console.error('Error creating notification rule:', error);
    throw new Error('Failed to create notification rule');
  }
}

/**
 * Get notification rules for a team
 */
export async function getNotificationRules(teamId: number, filters?: {
  isActive?: boolean;
  ruleType?: string;
}) {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    const conditions = [eq(notificationRules.teamId, teamId)];

    if (filters?.isActive !== undefined) {
      conditions.push(eq(notificationRules.isActive, filters.isActive));
    }

    if (filters?.ruleType) {
      conditions.push(eq(notificationRules.ruleType, filters.ruleType));
    }

    const rules = await db.select()
      .from(notificationRules)
      .where(and(...conditions))
      .orderBy(notificationRules.name);

    return rules;
  } catch (error) {
    console.error('Error getting notification rules:', error);
    throw new Error('Failed to get notification rules');
  }
}

/**
 * Update notification rule
 */
export async function updateNotificationRule(ruleId: number, data: Partial<{
  name: string;
  description: string;
  conditions: any;
  thresholdHours: number;
  thresholdDays: number;
  notificationPriority: string;
  isActive: boolean;
}>) {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    const [rule] = await db.update(notificationRules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(notificationRules.id, ruleId))
      .returning();

    return rule;
  } catch (error) {
    console.error('Error updating notification rule:', error);
    throw new Error('Failed to update notification rule');
  }
}

/**
 * Delete notification rule
 */
export async function deleteNotificationRule(ruleId: number) {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    await db.delete(notificationRules).where(eq(notificationRules.id, ruleId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting notification rule:', error);
    throw new Error('Failed to delete notification rule');
  }
}

/**
 * Check for idle folders (sitting in inbox > threshold hours)
 */
export async function checkIdleFolders(teamId: number, thresholdHours: number = 24) {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    const thresholdDate = new Date(Date.now() - thresholdHours * 60 * 60 * 1000);

    const idleFolders = await db.select()
      .from(fileFolders)
      .where(
        and(
          eq(fileFolders.teamId, teamId),
          lt(fileFolders.createdAt, thresholdDate),
          // Add more conditions as needed
        )
      );

    return idleFolders;
  } catch (error) {
    console.error('Error checking idle folders:', error);
    throw new Error('Failed to check idle folders');
  }
}

/**
 * Check for approaching deadlines
 */
export async function checkApproachingDeadlines(teamId: number, thresholdDays: number = 3) {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    const thresholdDate = new Date(Date.now() + thresholdDays * 24 * 60 * 60 * 1000);
    const now = new Date();

    const approachingTasks = await db.select()
      .from(tasks)
      .where(
        and(
          eq(tasks.teamId, teamId),
          gte(tasks.dueDate, now),
          lt(tasks.dueDate, thresholdDate),
          sql`${tasks.status} != 'completed'`
        )
      );

    return approachingTasks;
  } catch (error) {
    console.error('Error checking approaching deadlines:', error);
    throw new Error('Failed to check approaching deadlines');
  }
}

/**
 * Generate daily digest data
 */
export async function generateDailyDigest(userId: number, teamId: number) {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);

    // Tasks due today
    const tasksDueToday = await db.select()
      .from(tasks)
      .where(
        and(
          eq(tasks.teamId, teamId),
          eq(tasks.assignedTo, userId),
          gte(tasks.dueDate, todayStart),
          lt(tasks.dueDate, today),
          sql`${tasks.status} != 'completed'`
        )
      );

    // Overdue tasks
    const tasksOverdue = await db.select()
      .from(tasks)
      .where(
        and(
          eq(tasks.teamId, teamId),
          eq(tasks.assignedTo, userId),
          lt(tasks.dueDate, todayStart),
          sql`${tasks.status} != 'completed'`
        )
      );

    // Unread mentions (notifications with type 'mention')
    const unreadMentions = await db.select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.teamId, teamId),
          eq(notifications.type, 'mention'),
          eq(notifications.isRead, false)
        )
      )
      .limit(10);

    // Idle folders
    const idleFolders = await checkIdleFolders(teamId, 24);

    return {
      tasksDueToday,
      tasksOverdue,
      unreadMentions,
      foldersIdle: idleFolders,
      approvalsPending: [], // TODO: Implement approval system
    };
  } catch (error) {
    console.error('Error generating daily digest:', error);
    throw new Error('Failed to generate daily digest');
  }
}

/**
 * Queue daily digest
 */
export async function queueDailyDigest(userId: number, teamId: number, scheduledTime: Date) {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    const digestData = await generateDailyDigest(userId, teamId);

    const [digest] = await db.insert(dailyDigestQueue).values({
      userId,
      teamId,
      digestDate: new Date().toISOString().split('T')[0],
      scheduledTime,
      tasksDueToday: digestData.tasksDueToday as any,
      tasksOverdue: digestData.tasksOverdue as any,
      approvalsPending: digestData.approvalsPending as any,
      foldersIdle: digestData.foldersIdle as any,
      unreadMentions: digestData.unreadMentions as any,
      status: 'pending',
    }).returning();

    return digest;
  } catch (error) {
    console.error('Error queueing daily digest:', error);
    throw new Error('Failed to queue daily digest');
  }
}

/**
 * Get pending daily digests
 */
export async function getPendingDigests() {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    const now = new Date();

    const digests = await db.select()
      .from(dailyDigestQueue)
      .where(
        and(
          eq(dailyDigestQueue.status, 'pending'),
          lt(dailyDigestQueue.scheduledTime, now)
        )
      );

    return digests;
  } catch (error) {
    console.error('Error getting pending digests:', error);
    throw new Error('Failed to get pending digests');
  }
}

/**
 * Mark digest as sent
 */
export async function markDigestAsSent(digestId: number) {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    await db.update(dailyDigestQueue)
      .set({
        status: 'sent',
        sentAt: new Date(),
      })
      .where(eq(dailyDigestQueue.id, digestId));

    return { success: true };
  } catch (error) {
    console.error('Error marking digest as sent:', error);
    throw new Error('Failed to mark digest as sent');
  }
}

/**
 * Get notification statistics
 */
export async function getNotificationStatistics(userId: number, teamId: number) {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    const stats = await db.select({
      total: sql<number>`count(*)`,
      unread: sql<number>`count(*) FILTER (WHERE ${notifications.isRead} = false)`,
      byType: sql<any>`json_object_agg(${notifications.type}, count(*))`,
      byPriority: sql<any>`json_object_agg(${notifications.priority}, count(*))`,
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.teamId, teamId)
      )
    );

    return stats[0];
  } catch (error) {
    console.error('Error getting notification statistics:', error);
    throw new Error('Failed to get notification statistics');
  }
}
