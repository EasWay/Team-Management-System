import { getDb } from "./db";
import { clientPortalAccess, clientFeedback, clientActivityLog, clientProjectVisibility, clients, projects, files, teamMembers } from "../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import crypto from "crypto";
import bcrypt from "bcrypt";

/**
 * Client Portal Service
 * Handles client portal access, feedback, and activity tracking
 */

/**
 * Create client portal access
 */
export async function createClientPortalAccess(data: {
  clientId: number;
  teamId: number;
  email: string;
  password: string;
  canViewProjects?: boolean;
  canViewDeliverables?: boolean;
  canLeaveFeedback?: boolean;
  canApprove?: boolean;
  customLogo?: string;
  brandColor?: string;
  whiteLabel?: boolean;
}) {
  try {
    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    const [access] = await db.insert(clientPortalAccess).values({
      ...data,
      passwordHash,
      password: undefined,
    }).returning();

    return access;
  } catch (error) {
    console.error('Error creating client portal access:', error);
    throw new Error('Failed to create client portal access');
  }
}

/**
 * Client login
 */
export async function clientLogin(email: string, password: string) {
  try {
    const [access] = await db.select()
      .from(clientPortalAccess)
      .where(eq(clientPortalAccess.email, email));

    if (!access || !access.isActive) {
      throw new Error('Invalid credentials or account inactive');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, access.passwordHash || '');
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Generate login token
    const loginToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Update last login and token
    await db.update(clientPortalAccess)
      .set({
        lastLogin: new Date(),
        loginToken,
        tokenExpiresAt,
      })
      .where(eq(clientPortalAccess.id, access.id));

    // Log activity
    await logClientActivity({
      clientId: access.clientId,
      teamId: access.teamId,
      activityType: 'login',
      description: 'Client logged in to portal',
    });

    return {
      ...access,
      loginToken,
      tokenExpiresAt,
    };
  } catch (error) {
    console.error('Error during client login:', error);
    throw error;
  }
}

/**
 * Verify client token
 */
export async function verifyClientToken(token: string) {
  try {
    const [access] = await db.select()
      .from(clientPortalAccess)
      .where(
        and(
          eq(clientPortalAccess.loginToken, token),
          eq(clientPortalAccess.isActive, true)
        )
      );

    if (!access) {
      throw new Error('Invalid token');
    }

    // Check if token is expired
    if (access.tokenExpiresAt && new Date() > new Date(access.tokenExpiresAt)) {
      throw new Error('Token expired');
    }

    return access;
  } catch (error) {
    console.error('Error verifying client token:', error);
    throw error;
  }
}

/**
 * Get client portal access
 */
export async function getClientPortalAccess(clientId: number) {
  try {
    const [access] = await db.select()
      .from(clientPortalAccess)
      .where(eq(clientPortalAccess.clientId, clientId));

    return access;
  } catch (error) {
    console.error('Error getting client portal access:', error);
    throw new Error('Failed to get client portal access');
  }
}

/**
 * Update client portal access
 */
export async function updateClientPortalAccess(clientId: number, data: Partial<{
  isActive: boolean;
  canViewProjects: boolean;
  canViewDeliverables: boolean;
  canLeaveFeedback: boolean;
  canApprove: boolean;
  customLogo: string;
  brandColor: string;
  whiteLabel: boolean;
}>) {
  try {
    const [access] = await db.update(clientPortalAccess)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clientPortalAccess.clientId, clientId))
      .returning();

    return access;
  } catch (error) {
    console.error('Error updating client portal access:', error);
    throw new Error('Failed to update client portal access');
  }
}

/**
 * Get client projects (with visibility control)
 */
export async function getClientProjects(clientId: number) {
  try {
    // Get client's visible projects
    const visibleProjects = await db.select({
      project: projects,
      visibility: clientProjectVisibility,
    })
    .from(projects)
    .leftJoin(
      clientProjectVisibility,
      and(
        eq(clientProjectVisibility.projectId, projects.id),
        eq(clientProjectVisibility.clientId, clientId)
      )
    )
    .where(eq(projects.clientId, clientId));

    // Filter to only visible projects (or all if no visibility record exists)
    const filtered = visibleProjects.filter(
      (p) => !p.visibility || p.visibility.isVisible
    );

    return filtered.map((p) => ({
      ...p.project,
      visibility: p.visibility,
    }));
  } catch (error) {
    console.error('Error getting client projects:', error);
    throw new Error('Failed to get client projects');
  }
}

/**
 * Get client project details
 */
export async function getClientProjectDetails(clientId: number, projectId: number) {
  try {
    // Check visibility
    const [visibility] = await db.select()
      .from(clientProjectVisibility)
      .where(
        and(
          eq(clientProjectVisibility.clientId, clientId),
          eq(clientProjectVisibility.projectId, projectId)
        )
      );

    if (visibility && !visibility.isVisible) {
      throw new Error('Project not visible to client');
    }

    // Get project details
    const [project] = await db.select()
      .from(projects)
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.clientId, clientId)
        )
      );

    if (!project) {
      throw new Error('Project not found');
    }

    // Get project files if allowed
    let projectFiles = [];
    if (!visibility || visibility.canViewFiles) {
      projectFiles = await db.select()
        .from(files)
        .where(eq(files.projectId, projectId));
    }

    // Log activity
    await logClientActivity({
      clientId,
      teamId: project.teamId!,
      activityType: 'view_project',
      description: `Viewed project: ${project.name}`,
      projectId,
    });

    return {
      ...project,
      files: projectFiles,
      visibility,
    };
  } catch (error) {
    console.error('Error getting client project details:', error);
    throw error;
  }
}

/**
 * Create client feedback
 */
export async function createClientFeedback(data: {
  clientId: number;
  projectId: number;
  teamId: number;
  feedbackType: string;
  subject: string;
  message: string;
  rating?: number;
  deliverableId?: number;
  fileId?: number;
  attachments?: any;
}) {
  try {
    const [feedback] = await db.insert(clientFeedback).values(data).returning();

    // Log activity
    await logClientActivity({
      clientId: data.clientId,
      teamId: data.teamId,
      activityType: 'leave_feedback',
      description: `Left feedback: ${data.subject}`,
      projectId: data.projectId,
    });

    return feedback;
  } catch (error) {
    console.error('Error creating client feedback:', error);
    throw new Error('Failed to create client feedback');
  }
}

/**
 * Get client feedback
 */
export async function getClientFeedback(clientId: number, filters?: {
  projectId?: number;
  status?: string;
}) {
  try {
    const conditions = [eq(clientFeedback.clientId, clientId)];

    if (filters?.projectId) {
      conditions.push(eq(clientFeedback.projectId, filters.projectId));
    }

    if (filters?.status) {
      conditions.push(eq(clientFeedback.status, filters.status));
    }

    const feedback = await db.select()
      .from(clientFeedback)
      .where(and(...conditions))
      .orderBy(desc(clientFeedback.createdAt));

    return feedback;
  } catch (error) {
    console.error('Error getting client feedback:', error);
    throw new Error('Failed to get client feedback');
  }
}

/**
 * Get team feedback (for team members to review)
 */
export async function getTeamFeedback(teamId: number, filters?: {
  projectId?: number;
  status?: string;
  clientId?: number;
}) {
  try {
    const conditions = [eq(clientFeedback.teamId, teamId)];

    if (filters?.projectId) {
      conditions.push(eq(clientFeedback.projectId, filters.projectId));
    }

    if (filters?.status) {
      conditions.push(eq(clientFeedback.status, filters.status));
    }

    if (filters?.clientId) {
      conditions.push(eq(clientFeedback.clientId, filters.clientId));
    }

    const feedback = await db.select()
      .from(clientFeedback)
      .where(and(...conditions))
      .orderBy(desc(clientFeedback.createdAt));

    return feedback;
  } catch (error) {
    console.error('Error getting team feedback:', error);
    throw new Error('Failed to get team feedback');
  }
}

/**
 * Respond to client feedback
 */
export async function respondToFeedback(feedbackId: number, response: string, reviewedBy: number) {
  try {
    const [feedback] = await db.update(clientFeedback)
      .set({
        response,
        reviewedBy,
        reviewedAt: new Date(),
        status: 'reviewed',
        updatedAt: new Date(),
      })
      .where(eq(clientFeedback.id, feedbackId))
      .returning();

    return feedback;
  } catch (error) {
    console.error('Error responding to feedback:', error);
    throw new Error('Failed to respond to feedback');
  }
}

/**
 * Log client activity
 */
export async function logClientActivity(data: {
  clientId: number;
  teamId: number;
  activityType: string;
  description: string;
  projectId?: number;
  fileId?: number;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
}) {
  try {
    await db.insert(clientActivityLog).values(data);
  } catch (error) {
    console.error('Error logging client activity:', error);
    // Don't throw error for logging failures
  }
}

/**
 * Get client activity log
 */
export async function getClientActivityLog(clientId: number, limit?: number) {
  try {
    let query = db.select()
      .from(clientActivityLog)
      .where(eq(clientActivityLog.clientId, clientId))
      .orderBy(desc(clientActivityLog.createdAt));

    if (limit) {
      query = query.limit(limit) as any;
    }

    const activities = await query;
    return activities;
  } catch (error) {
    console.error('Error getting client activity log:', error);
    throw new Error('Failed to get client activity log');
  }
}

/**
 * Set project visibility for client
 */
export async function setProjectVisibility(data: {
  clientId: number;
  projectId: number;
  teamId: number;
  isVisible?: boolean;
  canViewFiles?: boolean;
  canDownloadFiles?: boolean;
  canViewTasks?: boolean;
  canViewTimeline?: boolean;
  customStatus?: string;
  customDescription?: string;
}) {
  try {
    // Check if visibility record exists
    const [existing] = await db.select()
      .from(clientProjectVisibility)
      .where(
        and(
          eq(clientProjectVisibility.clientId, data.clientId),
          eq(clientProjectVisibility.projectId, data.projectId)
        )
      );

    if (existing) {
      // Update existing
      const [visibility] = await db.update(clientProjectVisibility)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(clientProjectVisibility.id, existing.id))
        .returning();
      return visibility;
    } else {
      // Create new
      const [visibility] = await db.insert(clientProjectVisibility)
        .values(data)
        .returning();
      return visibility;
    }
  } catch (error) {
    console.error('Error setting project visibility:', error);
    throw new Error('Failed to set project visibility');
  }
}

/**
 * Get project visibility settings
 */
export async function getProjectVisibility(clientId: number, projectId: number) {
  try {
    const [visibility] = await db.select()
      .from(clientProjectVisibility)
      .where(
        and(
          eq(clientProjectVisibility.clientId, clientId),
          eq(clientProjectVisibility.projectId, projectId)
        )
      );

    return visibility;
  } catch (error) {
    console.error('Error getting project visibility:', error);
    throw new Error('Failed to get project visibility');
  }
}

/**
 * Get client dashboard data
 */
export async function getClientDashboard(clientId: number) {
  try {
    // Get client info
    const [client] = await db.select()
      .from(clients)
      .where(eq(clients.id, clientId));

    if (!client) {
      throw new Error('Client not found');
    }

    // Get portal access
    const access = await getClientPortalAccess(clientId);

    // Get projects
    const clientProjects = await getClientProjects(clientId);

    // Get recent feedback
    const recentFeedback = await getClientFeedback(clientId);

    // Get recent activity
    const recentActivity = await getClientActivityLog(clientId, 10);

    // Calculate statistics
    const stats = {
      totalProjects: clientProjects.length,
      activeProjects: clientProjects.filter((p) => p.status === 'active').length,
      completedProjects: clientProjects.filter((p) => p.status === 'completed').length,
      pendingFeedback: recentFeedback.filter((f) => f.status === 'pending').length,
    };

    return {
      client,
      access,
      projects: clientProjects,
      recentFeedback: recentFeedback.slice(0, 5),
      recentActivity,
      stats,
    };
  } catch (error) {
    console.error('Error getting client dashboard:', error);
    throw error;
  }
}

/**
 * Change client password
 */
export async function changeClientPassword(clientId: number, oldPassword: string, newPassword: string) {
  try {
    const [access] = await db.select()
      .from(clientPortalAccess)
      .where(eq(clientPortalAccess.clientId, clientId));

    if (!access) {
      throw new Error('Client portal access not found');
    }

    // Verify old password
    const isValid = await bcrypt.compare(oldPassword, access.passwordHash || '');
    if (!isValid) {
      throw new Error('Invalid current password');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.update(clientPortalAccess)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(clientPortalAccess.id, access.id));

    return { success: true };
  } catch (error) {
    console.error('Error changing client password:', error);
    throw error;
  }
}

/**
 * Get client statistics
 */
export async function getClientStatistics(teamId: number) {
  try {
    const stats = await db.select({
      totalClients: sql<number>`count(DISTINCT ${clientPortalAccess.clientId})`,
      activeClients: sql<number>`count(DISTINCT ${clientPortalAccess.clientId}) FILTER (WHERE ${clientPortalAccess.isActive} = true)`,
      totalLogins: sql<number>`count(${clientActivityLog.id}) FILTER (WHERE ${clientActivityLog.activityType} = 'login')`,
      totalFeedback: sql<number>`count(${clientFeedback.id})`,
      pendingFeedback: sql<number>`count(${clientFeedback.id}) FILTER (WHERE ${clientFeedback.status} = 'pending')`,
    })
    .from(clientPortalAccess)
    .leftJoin(clientActivityLog, eq(clientActivityLog.clientId, clientPortalAccess.clientId))
    .leftJoin(clientFeedback, eq(clientFeedback.clientId, clientPortalAccess.clientId))
    .where(eq(clientPortalAccess.teamId, teamId));

    return stats[0];
  } catch (error) {
    console.error('Error getting client statistics:', error);
    throw new Error('Failed to get client statistics');
  }
}
