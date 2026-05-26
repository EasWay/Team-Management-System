import { db } from "./db";
import { 
  resourcePermissions, 
  officeAccessControl, 
  securityAuditTrail, 
  twoFactorAuth, 
  ipWhitelist, 
  userSessions, 
  permissionRoles, 
  userRoleAssignments,
  teamMembers 
} from "../drizzle/schema";
import { eq, and, desc, sql, or, gte, lt } from "drizzle-orm";
import crypto from "crypto";
import speakeasy from "speakeasy";

/**
 * Security Service
 * Handles permissions, 2FA, IP whitelisting, session management, and audit trails
 */

// ============================================================================
// GRANULAR PERMISSIONS
// ============================================================================

/**
 * Grant resource permission to user
 */
export async function grantResourcePermission(data: {
  teamId: number;
  userId: number;
  resourceType: string;
  resourceId: number;
  permission: string;
  grantedBy: number;
  expiresAt?: Date;
  reason?: string;
}) {
  try {
    // Check if permission already exists
    const [existing] = await db.select()
      .from(resourcePermissions)
      .where(
        and(
          eq(resourcePermissions.userId, data.userId),
          eq(resourcePermissions.resourceType, data.resourceType),
          eq(resourcePermissions.resourceId, data.resourceId)
        )
      );

    if (existing) {
      // Update existing permission
      const [updated] = await db.update(resourcePermissions)
        .set({
          permission: data.permission,
          grantedBy: data.grantedBy,
          expiresAt: data.expiresAt,
          reason: data.reason,
          updatedAt: new Date(),
        })
        .where(eq(resourcePermissions.id, existing.id))
        .returning();

      // Log audit trail
      await logSecurityAudit({
        teamId: data.teamId,
        userId: data.grantedBy,
        action: 'permission_change',
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        status: 'success',
        description: `Updated ${data.permission} permission for user ${data.userId}`,
        changes: { old: existing.permission, new: data.permission },
      });

      return updated;
    } else {
      // Create new permission
      const [permission] = await db.insert(resourcePermissions)
        .values(data)
        .returning();

      // Log audit trail
      await logSecurityAudit({
        teamId: data.teamId,
        userId: data.grantedBy,
        action: 'permission_change',
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        status: 'success',
        description: `Granted ${data.permission} permission to user ${data.userId}`,
      });

      return permission;
    }
  } catch (error) {
    console.error('Error granting resource permission:', error);
    throw new Error('Failed to grant resource permission');
  }
}

/**
 * Revoke resource permission
 */
export async function revokeResourcePermission(permissionId: number, revokedBy: number) {
  try {
    const [permission] = await db.select()
      .from(resourcePermissions)
      .where(eq(resourcePermissions.id, permissionId));

    if (!permission) {
      throw new Error('Permission not found');
    }

    await db.delete(resourcePermissions)
      .where(eq(resourcePermissions.id, permissionId));

    // Log audit trail
    await logSecurityAudit({
      teamId: permission.teamId,
      userId: revokedBy,
      action: 'permission_change',
      resourceType: permission.resourceType,
      resourceId: permission.resourceId,
      status: 'success',
      description: `Revoked ${permission.permission} permission from user ${permission.userId}`,
    });

    return { success: true };
  } catch (error) {
    console.error('Error revoking resource permission:', error);
    throw error;
  }
}

/**
 * Check if user has permission for resource
 */
export async function checkResourcePermission(
  userId: number,
  resourceType: string,
  resourceId: number,
  requiredPermission: string
): Promise<boolean> {
  try {
    const [permission] = await db.select()
      .from(resourcePermissions)
      .where(
        and(
          eq(resourcePermissions.userId, userId),
          eq(resourcePermissions.resourceType, resourceType),
          eq(resourcePermissions.resourceId, resourceId)
        )
      );

    if (!permission) {
      return false;
    }

    // Check if permission is expired
    if (permission.expiresAt && new Date() > new Date(permission.expiresAt)) {
      return false;
    }

    // Check permission level (admin > write > read)
    const permissionLevels: Record<string, number> = {
      'none': 0,
      'read': 1,
      'write': 2,
      'admin': 3,
    };

    const userLevel = permissionLevels[permission.permission] || 0;
    const requiredLevel = permissionLevels[requiredPermission] || 0;

    return userLevel >= requiredLevel;
  } catch (error) {
    console.error('Error checking resource permission:', error);
    return false;
  }
}

/**
 * Get user permissions for resource type
 */
export async function getUserResourcePermissions(userId: number, resourceType?: string) {
  try {
    const conditions = [eq(resourcePermissions.userId, userId)];

    if (resourceType) {
      conditions.push(eq(resourcePermissions.resourceType, resourceType));
    }

    const permissions = await db.select()
      .from(resourcePermissions)
      .where(and(...conditions))
      .orderBy(desc(resourcePermissions.createdAt));

    // Filter out expired permissions
    const now = new Date();
    return permissions.filter(p => !p.expiresAt || new Date(p.expiresAt) > now);
  } catch (error) {
    console.error('Error getting user resource permissions:', error);
    throw new Error('Failed to get user resource permissions');
  }
}

// ============================================================================
// OFFICE-LEVEL ACCESS CONTROL
// ============================================================================

/**
 * Set office access control
 */
export async function setOfficeAccessControl(data: {
  teamId: number;
  userId: number;
  officeRole: string;
  accessLevel: string;
  canViewTasks?: boolean;
  canEditTasks?: boolean;
  canDeleteTasks?: boolean;
  canViewFiles?: boolean;
  canUploadFiles?: boolean;
  canDeleteFiles?: boolean;
  canInviteMembers?: boolean;
  canManagePermissions?: boolean;
  grantedBy: number;
}) {
  try {
    // Check if access control already exists
    const [existing] = await db.select()
      .from(officeAccessControl)
      .where(
        and(
          eq(officeAccessControl.userId, data.userId),
          eq(officeAccessControl.officeRole, data.officeRole),
          eq(officeAccessControl.teamId, data.teamId)
        )
      );

    if (existing) {
      // Update existing
      const [updated] = await db.update(officeAccessControl)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(officeAccessControl.id, existing.id))
        .returning();

      await logSecurityAudit({
        teamId: data.teamId,
        userId: data.grantedBy,
        action: 'permission_change',
        resourceType: 'office',
        status: 'success',
        description: `Updated office access for user ${data.userId} in ${data.officeRole}`,
      });

      return updated;
    } else {
      // Create new
      const [access] = await db.insert(officeAccessControl)
        .values(data)
        .returning();

      await logSecurityAudit({
        teamId: data.teamId,
        userId: data.grantedBy,
        action: 'permission_change',
        resourceType: 'office',
        status: 'success',
        description: `Granted office access to user ${data.userId} in ${data.officeRole}`,
      });

      return access;
    }
  } catch (error) {
    console.error('Error setting office access control:', error);
    throw new Error('Failed to set office access control');
  }
}

/**
 * Get office access control for user
 */
export async function getOfficeAccessControl(userId: number, officeRole: string, teamId: number) {
  try {
    const [access] = await db.select()
      .from(officeAccessControl)
      .where(
        and(
          eq(officeAccessControl.userId, userId),
          eq(officeAccessControl.officeRole, officeRole),
          eq(officeAccessControl.teamId, teamId)
        )
      );

    return access;
  } catch (error) {
    console.error('Error getting office access control:', error);
    throw new Error('Failed to get office access control');
  }
}

/**
 * Check office permission
 */
export async function checkOfficePermission(
  userId: number,
  officeRole: string,
  teamId: number,
  permission: string
): Promise<boolean> {
  try {
    const access = await getOfficeAccessControl(userId, officeRole, teamId);

    if (!access) {
      return false;
    }

    // Map permission to field
    const permissionMap: Record<string, keyof typeof access> = {
      'view_tasks': 'canViewTasks',
      'edit_tasks': 'canEditTasks',
      'delete_tasks': 'canDeleteTasks',
      'view_files': 'canViewFiles',
      'upload_files': 'canUploadFiles',
      'delete_files': 'canDeleteFiles',
      'invite_members': 'canInviteMembers',
      'manage_permissions': 'canManagePermissions',
    };

    const field = permissionMap[permission];
    return field ? Boolean(access[field]) : false;
  } catch (error) {
    console.error('Error checking office permission:', error);
    return false;
  }
}

// ============================================================================
// SECURITY AUDIT TRAIL
// ============================================================================

/**
 * Log security audit event
 */
export async function logSecurityAudit(data: {
  teamId?: number;
  userId?: number;
  action: string;
  resourceType?: string;
  resourceId?: number;
  status: string;
  description: string;
  changes?: any;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  location?: string;
  riskLevel?: string;
  flagged?: boolean;
  metadata?: any;
}) {
  try {
    await db.insert(securityAuditTrail).values({
      ...data,
      ipAddress: data.ipAddress || 'unknown',
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error logging security audit:', error);
    // Don't throw error for logging failures
  }
}

/**
 * Get security audit trail
 */
export async function getSecurityAuditTrail(filters?: {
  teamId?: number;
  userId?: number;
  action?: string;
  resourceType?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  flagged?: boolean;
  limit?: number;
}) {
  try {
    const conditions = [];

    if (filters?.teamId) {
      conditions.push(eq(securityAuditTrail.teamId, filters.teamId));
    }

    if (filters?.userId) {
      conditions.push(eq(securityAuditTrail.userId, filters.userId));
    }

    if (filters?.action) {
      conditions.push(eq(securityAuditTrail.action, filters.action));
    }

    if (filters?.resourceType) {
      conditions.push(eq(securityAuditTrail.resourceType, filters.resourceType));
    }

    if (filters?.status) {
      conditions.push(eq(securityAuditTrail.status, filters.status));
    }

    if (filters?.startDate) {
      conditions.push(gte(securityAuditTrail.timestamp, filters.startDate));
    }

    if (filters?.endDate) {
      conditions.push(lt(securityAuditTrail.timestamp, filters.endDate));
    }

    if (filters?.flagged !== undefined) {
      conditions.push(eq(securityAuditTrail.flagged, filters.flagged));
    }

    let query = db.select()
      .from(securityAuditTrail)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(securityAuditTrail.timestamp));

    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }

    const logs = await query;
    return logs;
  } catch (error) {
    console.error('Error getting security audit trail:', error);
    throw new Error('Failed to get security audit trail');
  }
}

/**
 * Export audit logs
 */
export async function exportAuditLogs(filters?: {
  teamId?: number;
  startDate?: Date;
  endDate?: Date;
  format?: string;
}) {
  try {
    const logs = await getSecurityAuditTrail({
      ...filters,
      limit: undefined, // Get all logs
    });

    // Format based on requested format
    if (filters?.format === 'json') {
      return JSON.stringify(logs, null, 2);
    } else if (filters?.format === 'csv') {
      // Convert to CSV
      const headers = ['timestamp', 'action', 'userId', 'resourceType', 'status', 'description', 'ipAddress'];
      const csv = [
        headers.join(','),
        ...logs.map(log => headers.map(h => log[h as keyof typeof log] || '').join(','))
      ].join('\n');
      return csv;
    }

    return logs;
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    throw new Error('Failed to export audit logs');
  }
}

// ============================================================================
// TWO-FACTOR AUTHENTICATION
// ============================================================================

/**
 * Enable 2FA for user
 */
export async function enable2FA(userId: number, method: string) {
  try {
    // Check if 2FA already exists
    const [existing] = await db.select()
      .from(twoFactorAuth)
      .where(eq(twoFactorAuth.userId, userId));

    if (existing) {
      // Update existing
      const updates: any = { isEnabled: true, updatedAt: new Date() };

      if (method === 'totp') {
        const secret = speakeasy.generateSecret({ length: 32 });
        updates.totpSecret = secret.base32;
        updates.totpEnabled = true;
      } else if (method === 'sms') {
        updates.smsEnabled = true;
      } else if (method === 'email') {
        updates.emailEnabled = true;
      }

      const [updated] = await db.update(twoFactorAuth)
        .set(updates)
        .where(eq(twoFactorAuth.id, existing.id))
        .returning();

      return updated;
    } else {
      // Create new
      const data: any = {
        userId,
        method,
        isEnabled: true,
      };

      if (method === 'totp') {
        const secret = speakeasy.generateSecret({ length: 32 });
        data.totpSecret = secret.base32;
        data.totpEnabled = true;
      } else if (method === 'sms') {
        data.smsEnabled = true;
      } else if (method === 'email') {
        data.emailEnabled = true;
      }

      const [tfa] = await db.insert(twoFactorAuth)
        .values(data)
        .returning();

      return tfa;
    }
  } catch (error) {
    console.error('Error enabling 2FA:', error);
    throw new Error('Failed to enable 2FA');
  }
}

/**
 * Verify 2FA token
 */
export async function verify2FAToken(userId: number, token: string): Promise<boolean> {
  try {
    const [tfa] = await db.select()
      .from(twoFactorAuth)
      .where(eq(twoFactorAuth.userId, userId));

    if (!tfa || !tfa.isEnabled) {
      return false;
    }

    if (tfa.totpEnabled && tfa.totpSecret) {
      const verified = speakeasy.totp.verify({
        secret: tfa.totpSecret,
        encoding: 'base32',
        token,
        window: 2,
      });

      if (verified) {
        await db.update(twoFactorAuth)
          .set({ lastUsed: new Date(), failedAttempts: 0 })
          .where(eq(twoFactorAuth.id, tfa.id));
        return true;
      }
    }

    // Increment failed attempts
    await db.update(twoFactorAuth)
      .set({ failedAttempts: (tfa.failedAttempts || 0) + 1 })
      .where(eq(twoFactorAuth.id, tfa.id));

    return false;
  } catch (error) {
    console.error('Error verifying 2FA token:', error);
    return false;
  }
}

/**
 * Generate backup codes
 */
export async function generateBackupCodes(userId: number): Promise<string[]> {
  try {
    const codes = Array.from({ length: 10 }, () => 
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    await db.update(twoFactorAuth)
      .set({
        backupCodes: codes as any,
        backupCodesUsed: [] as any,
        updatedAt: new Date(),
      })
      .where(eq(twoFactorAuth.userId, userId));

    return codes;
  } catch (error) {
    console.error('Error generating backup codes:', error);
    throw new Error('Failed to generate backup codes');
  }
}

// ============================================================================
// IP WHITELISTING
// ============================================================================

/**
 * Add IP to whitelist
 */
export async function addIPToWhitelist(data: {
  teamId: number;
  ipAddress: string;
  ipRange?: string;
  label: string;
  description?: string;
  appliesToAllUsers?: boolean;
  specificUsers?: number[];
  addedBy: number;
  expiresAt?: Date;
}) {
  try {
    const [ip] = await db.insert(ipWhitelist).values(data).returning();

    await logSecurityAudit({
      teamId: data.teamId,
      userId: data.addedBy,
      action: 'modify',
      resourceType: 'ip_whitelist',
      status: 'success',
      description: `Added IP ${data.ipAddress} to whitelist`,
    });

    return ip;
  } catch (error) {
    console.error('Error adding IP to whitelist:', error);
    throw new Error('Failed to add IP to whitelist');
  }
}

/**
 * Check if IP is whitelisted
 */
export async function checkIPWhitelist(teamId: number, ipAddress: string, userId?: number): Promise<boolean> {
  try {
    const conditions = [
      eq(ipWhitelist.teamId, teamId),
      eq(ipWhitelist.isActive, true),
    ];

    const ips = await db.select()
      .from(ipWhitelist)
      .where(and(...conditions));

    const now = new Date();

    for (const ip of ips) {
      // Check if expired
      if (ip.expiresAt && new Date(ip.expiresAt) < now) {
        continue;
      }

      // Check if applies to user
      if (!ip.appliesToAllUsers && userId) {
        const specificUsers = ip.specificUsers as number[] || [];
        if (!specificUsers.includes(userId)) {
          continue;
        }
      }

      // Check IP match
      if (ip.ipAddress === ipAddress) {
        return true;
      }

      // TODO: Check IP range (CIDR notation)
      // This would require additional logic for IP range matching
    }

    return false;
  } catch (error) {
    console.error('Error checking IP whitelist:', error);
    return false;
  }
}

/**
 * Get IP whitelist
 */
export async function getIPWhitelist(teamId: number) {
  try {
    const ips = await db.select()
      .from(ipWhitelist)
      .where(eq(ipWhitelist.teamId, teamId))
      .orderBy(desc(ipWhitelist.createdAt));

    return ips;
  } catch (error) {
    console.error('Error getting IP whitelist:', error);
    throw new Error('Failed to get IP whitelist');
  }
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Create user session
 */
export async function createUserSession(data: {
  userId: number;
  deviceId?: string;
  deviceName?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
  ipAddress: string;
  location?: string;
  expiresAt: Date;
}) {
  try {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const refreshToken = crypto.randomBytes(32).toString('hex');

    const [session] = await db.insert(userSessions).values({
      ...data,
      sessionToken,
      refreshToken,
    }).returning();

    await logSecurityAudit({
      userId: data.userId,
      action: 'login',
      status: 'success',
      description: 'User logged in',
      ipAddress: data.ipAddress,
      sessionId: sessionToken,
    });

    return session;
  } catch (error) {
    console.error('Error creating user session:', error);
    throw new Error('Failed to create user session');
  }
}

/**
 * Get user sessions
 */
export async function getUserSessions(userId: number, activeOnly: boolean = false) {
  try {
    const conditions = [eq(userSessions.userId, userId)];

    if (activeOnly) {
      conditions.push(eq(userSessions.isActive, true));
    }

    const sessions = await db.select()
      .from(userSessions)
      .where(and(...conditions))
      .orderBy(desc(userSessions.lastActivity));

    return sessions;
  } catch (error) {
    console.error('Error getting user sessions:', error);
    throw new Error('Failed to get user sessions');
  }
}

/**
 * Revoke session
 */
export async function revokeSession(sessionId: number, userId: number) {
  try {
    await db.update(userSessions)
      .set({ isActive: false })
      .where(
        and(
          eq(userSessions.id, sessionId),
          eq(userSessions.userId, userId)
        )
      );

    await logSecurityAudit({
      userId,
      action: 'logout',
      status: 'success',
      description: 'Session revoked',
    });

    return { success: true };
  } catch (error) {
    console.error('Error revoking session:', error);
    throw new Error('Failed to revoke session');
  }
}

/**
 * Revoke all sessions except current
 */
export async function revokeAllSessions(userId: number, exceptSessionId?: number) {
  try {
    const conditions = [
      eq(userSessions.userId, userId),
      eq(userSessions.isActive, true),
    ];

    if (exceptSessionId) {
      conditions.push(sql`${userSessions.id} != ${exceptSessionId}`);
    }

    await db.update(userSessions)
      .set({ isActive: false })
      .where(and(...conditions));

    await logSecurityAudit({
      userId,
      action: 'logout',
      status: 'success',
      description: 'All sessions revoked',
    });

    return { success: true };
  } catch (error) {
    console.error('Error revoking all sessions:', error);
    throw new Error('Failed to revoke all sessions');
  }
}

// ============================================================================
// ROLE-BASED ACCESS CONTROL
// ============================================================================

/**
 * Create permission role
 */
export async function createPermissionRole(data: {
  teamId: number;
  name: string;
  description?: string;
  permissions: string[];
  level?: number;
  inheritsFrom?: number;
  createdBy: number;
}) {
  try {
    const [role] = await db.insert(permissionRoles).values({
      ...data,
      permissions: data.permissions as any,
    }).returning();

    await logSecurityAudit({
      teamId: data.teamId,
      userId: data.createdBy,
      action: 'modify',
      resourceType: 'permission_role',
      status: 'success',
      description: `Created permission role: ${data.name}`,
    });

    return role;
  } catch (error) {
    console.error('Error creating permission role:', error);
    throw new Error('Failed to create permission role');
  }
}

/**
 * Assign role to user
 */
export async function assignRoleToUser(data: {
  userId: number;
  roleId: number;
  teamId: number;
  assignedBy: number;
  expiresAt?: Date;
}) {
  try {
    const [assignment] = await db.insert(userRoleAssignments).values(data).returning();

    await logSecurityAudit({
      teamId: data.teamId,
      userId: data.assignedBy,
      action: 'permission_change',
      resourceType: 'user_role',
      status: 'success',
      description: `Assigned role ${data.roleId} to user ${data.userId}`,
    });

    return assignment;
  } catch (error) {
    console.error('Error assigning role to user:', error);
    throw new Error('Failed to assign role to user');
  }
}

/**
 * Get user roles
 */
export async function getUserRoles(userId: number, teamId: number) {
  try {
    const assignments = await db.select()
      .from(userRoleAssignments)
      .where(
        and(
          eq(userRoleAssignments.userId, userId),
          eq(userRoleAssignments.teamId, teamId),
          eq(userRoleAssignments.isActive, true)
        )
      );

    // Get role details
    const roleIds = assignments.map(a => a.roleId);
    if (roleIds.length === 0) {
      return [];
    }

    const roles = await db.select()
      .from(permissionRoles)
      .where(sql`${permissionRoles.id} IN (${sql.join(roleIds.map(id => sql`${id}`), sql`, `)})`);

    return roles;
  } catch (error) {
    console.error('Error getting user roles:', error);
    throw new Error('Failed to get user roles');
  }
}

/**
 * Check if user has permission (via roles)
 */
export async function checkRolePermission(
  userId: number,
  teamId: number,
  permission: string
): Promise<boolean> {
  try {
    const roles = await getUserRoles(userId, teamId);

    for (const role of roles) {
      const permissions = role.permissions as string[] || [];
      if (permissions.includes(permission) || permissions.includes('*')) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking role permission:', error);
    return false;
  }
}
