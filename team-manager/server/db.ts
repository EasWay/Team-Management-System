import { eq, and, isNull, desc, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
const { Pool } = pg;
import { InsertUser, users, teamMembers, InsertTeamMember, TeamMember, auditLogs, InsertAuditLog, teams, InsertTeam, Team, teamMembersCollaborative, InsertTeamMemberCollaborative, TeamMemberCollaborative, teamInvitations, InsertTeamInvitation, TeamInvitation, tasks, InsertTask, Task, clients, InsertClient, Client, projects, InsertProject, Project, projectFiles, InsertProjectFile, ProjectFile, activities, InsertActivity, Activity, repositories, InsertRepository, Repository, messages, Message, InsertMessage } from "../drizzle/schema";
import { ENV } from './_core/env';
import { randomBytes } from 'crypto';
import { broadcastTaskCreated, broadcastTaskUpdated, broadcastTaskMoved, broadcastTaskDeleted } from './socket-server';
import { encrypt, decrypt, generateToken } from './crypto';
import { GitHubService, parseGitHubUrl } from './github-service';

// Team Role Permissions
export const TEAM_PERMISSIONS: Record<string, string[]> = {
  admin: ['create_team', 'delete_team', 'update_team', 'invite_member', 'remove_member', 'change_role', 'create_task', 'update_task', 'delete_task', 'manage_repositories', 'delete_document'],
  team_lead: ['update_team', 'invite_member', 'create_task', 'update_task', 'delete_task', 'manage_repositories', 'delete_document'],
  developer: ['create_task', 'update_task'],
  viewer: [],
};

export type TeamRole = 'admin' | 'team_lead' | 'developer' | 'viewer';

export function hasPermission(role: TeamRole, permission: string): boolean {
  const permissions = TEAM_PERMISSIONS[role];
  return permissions.includes(permission);
}

export interface DepartmentHierarchyNode {
  id: number;
  name: string;
  description: string | null;
  parentId: number | null;
  managerId: number | null;
  createdAt: Date;
  updatedAt: Date;
  children: DepartmentHierarchyNode[];
  memberCount?: number;
}

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: pg.Pool | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db) {
    try {
      const connectionString = ENV.databaseUrl;

      if (connectionString) {
        // For Neon/production, connectionString is used
        _pool = new Pool({
          connectionString,
          ssl: connectionString.includes('neon.tech') ? { rejectUnauthorized: false } : false,
        });
      } else {
        // Fallback for local development
        _pool = new Pool({
          host: 'localhost',
          port: 5433,
          database: 'team_manager_db',
          user: 'postgres',
          password: 'postgres',
          ssl: false,
        });
      }

      _db = drizzle(_pool);
      console.log("[Database] Connected to PostgreSQL successfully");
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// Transaction wrapper for error handling and rollback
type DbType = ReturnType<typeof drizzle>;

export async function withTransaction<T>(
  operation: (db: DbType) => Promise<T>
): Promise<T> {
  const db = await getDb() as DbType;
  if (!db) {
    throw new Error("Database not available");
  }

  // PostgreSQL transaction handling with Drizzle
  return await db.transaction(async (tx) => {
    return await operation(tx as unknown as DbType);
  });
}

// Enhanced Error Classes for better error handling

export class DepartmentError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'DepartmentError';
  }
}

export class ValidationError extends DepartmentError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class ConflictError extends DepartmentError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'CONFLICT_ERROR', 409, details);
    this.name = 'ConflictError';
  }
}

export class NotFoundError extends DepartmentError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'NOT_FOUND_ERROR', 404, details);
    this.name = 'NotFoundError';
  }
}

export class IntegrityError extends DepartmentError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'INTEGRITY_ERROR', 422, details);
    this.name = 'IntegrityError';
  }
}

// Audit Logging System

export interface AuditLogEntry {
  operation: string;
  entityType: 'DEPARTMENT' | 'TEAM_MEMBER' | 'ASSIGNMENT' | 'HIERARCHY';
  entityId: number;
  userId?: number;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Audit] Cannot create audit log: database not available");
    return;
  }

  try {
    await db.insert(auditLogs).values({
      operation: entry.operation,
      entityType: entry.entityType,
      entityId: entry.entityId,
      userId: entry.userId || null,
      details: entry.details ? JSON.stringify(entry.details) : null,
      ipAddress: entry.ipAddress || null,
      userAgent: entry.userAgent || null,
      timestamp: new Date()
    });
  } catch (error) {
    console.error("[Audit] Failed to create audit log:", error);
    // Don't throw error to avoid breaking main operations
  }
}

export async function getAuditLogs(options?: {
  entityType?: string;
  entityId?: number;
  userId?: number;
  operation?: string;
  limit?: number;
  offset?: number;
}): Promise<(typeof auditLogs.$inferSelect & { userName?: string | null })[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  try {
    // Build the base query
    let query = db
      .select({
        id: auditLogs.id,
        operation: auditLogs.operation,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        userId: auditLogs.userId,
        details: auditLogs.details,
        timestamp: auditLogs.timestamp,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        userName: teamMembers.name,
      })
      .from(auditLogs)
      .leftJoin(teamMembers, eq(auditLogs.userId, teamMembers.id))
      .$dynamic();

    // Apply filters
    const conditions = [];
    if (options?.entityType) {
      conditions.push(eq(auditLogs.entityType, options.entityType));
    }
    if (options?.entityId) {
      conditions.push(eq(auditLogs.entityId, options.entityId));
    }
    if (options?.userId) {
      conditions.push(eq(auditLogs.userId, options.userId));
    }
    if (options?.operation) {
      conditions.push(eq(auditLogs.operation, options.operation));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Apply ordering and pagination
    query = query.orderBy(desc(auditLogs.timestamp));

    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.offset(options.offset);
    }

    return await query;
  } catch (error) {
    console.error("[Audit] Failed to get audit logs:", error);
    return [];
  }
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    const result = await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    }).returning();

    if (result.length > 0) {
      const user = result[0];
      await db.insert(teamMembers).values({
        id: user.id,
        name: user.name || user.email?.split('@')[0] || 'Unknown User',
        email: user.email,
        position: 'Member',
      }).onConflictDoNothing({ target: teamMembers.id });
    }
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createUserWithPassword(userData: {
  email: string;
  passwordHash: string;
  name?: string;
}): Promise<typeof users.$inferSelect> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return await db.transaction(async (tx) => {
    const result = await tx.insert(users).values({
      email: userData.email,
      passwordHash: userData.passwordHash,
      name: userData.name,
      loginMethod: 'email',
      role: 'user',
      lastSignedIn: new Date(),
    }).returning();

    const user = result[0];

    await tx.insert(teamMembers).values({
      id: user.id,
      name: user.name || user.email?.split('@')[0] || 'Unknown User',
      email: user.email,
      position: 'Member',
    }).onConflictDoNothing({ target: teamMembers.id });

    return user;
  });
}

export async function updateUserLastSignedIn(userId: number): Promise<typeof users.$inferSelect> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, userId))
    .returning();

  return result[0];
}

// Team member queries
export async function createTeamMember(member: InsertTeamMember): Promise<TeamMember> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  const result = await db.insert(teamMembers).values(member).returning();
  return result[0];
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }
  return db.select().from(teamMembers).orderBy(teamMembers.createdAt);
}

export async function getTeamMemberById(id: number): Promise<TeamMember | undefined> {
  const db = await getDb();
  if (!db) {
    return undefined;
  }
  const result = await db.select().from(teamMembers).where(eq(teamMembers.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateTeamMember(id: number, member: Partial<InsertTeamMember>): Promise<TeamMember | undefined> {
  const db = await getDb();
  if (!db) {
    return undefined;
  }
  await db.update(teamMembers).set(member).where(eq(teamMembers.id, id));
  return getTeamMemberById(id);
}

export async function deleteTeamMember(id: number, auditContext?: { userId?: number; ipAddress?: string; userAgent?: string }): Promise<boolean> {
  return await withTransaction(async (db) => {
    // Get team member details for audit log
    const teamMember = await getTeamMemberById(id);
    if (!teamMember) {
      throw new NotFoundError(
        `Team member with ID ${id} does not exist`,
        {
          teamMemberId: id,
          operation: 'delete'
        }
      );
    }

    // Delete the team member
    await db.delete(teamMembers).where(eq(teamMembers.id, id));

    // Create audit log
    await createAuditLog({
      operation: 'DELETE',
      entityType: 'TEAM_MEMBER',
      entityId: id,
      userId: auditContext?.userId,
      details: {
        teamMemberName: teamMember.name,
        position: teamMember.position,
        email: teamMember.email,
        phone: teamMember.phone
      },
      ipAddress: auditContext?.ipAddress,
      userAgent: auditContext?.userAgent
    });

    return true;
  });
}


// Team CRUD Operations

/**
 * Create a new team with automatic admin role assignment for the creator
 * Requirement 2.1: Team creation with automatic admin role assignment
 */
export async function createTeam(
  team: Omit<InsertTeam, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>,
  creatorId: number
): Promise<Team & { memberRole: TeamRole }> {
  return await withTransaction(async (db) => {
    // Create the team
    const [newTeam] = await db.insert(teams).values({
      name: team.name,
      description: team.description,
      createdBy: creatorId,
    }).returning();

    // Automatically assign creator as admin
    await db.insert(teamMembersCollaborative).values({
      teamId: newTeam.id,
      memberId: creatorId,
      role: 'admin',
    });

    return {
      ...newTeam,
      memberRole: 'admin' as TeamRole,
    };
  });
}

/**
 * Get all teams for a user
 */
export async function getUserTeams(userId: number): Promise<(Team & { memberRole: TeamRole; memberCount: number })[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const result = await db
    .select({
      id: teams.id,
      name: teams.name,
      description: teams.description,
      createdBy: teams.createdBy,
      createdAt: teams.createdAt,
      updatedAt: teams.updatedAt,
      memberRole: teamMembersCollaborative.role,
      memberCount: sql<number>`count(distinct ${teamMembersCollaborative.memberId})`,
    })
    .from(teams)
    .innerJoin(teamMembersCollaborative, and(eq(teams.id, teamMembersCollaborative.teamId), eq(teamMembersCollaborative.status, 'active')))
    .where(eq(teamMembersCollaborative.memberId, userId))
    .groupBy(teams.id, teamMembersCollaborative.role);

  return result as (Team & { memberRole: TeamRole; memberCount: number })[];
}

/**
 * Get a team by ID with member role information
 */
export async function getTeamById(
  teamId: number,
  userId?: number
): Promise<(Team & { memberRole?: TeamRole }) | undefined> {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  if (!userId) {
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    return team;
  }

  const result = await db
    .select({
      id: teams.id,
      name: teams.name,
      description: teams.description,
      createdBy: teams.createdBy,
      createdAt: teams.createdAt,
      updatedAt: teams.updatedAt,
      memberRole: teamMembersCollaborative.role,
    })
    .from(teams)
    .leftJoin(
      teamMembersCollaborative,
      and(
        eq(teams.id, teamMembersCollaborative.teamId),
        eq(teamMembersCollaborative.memberId, userId),
        eq(teamMembersCollaborative.status, 'active')
      )
    )
    .where(eq(teams.id, teamId))
    .limit(1);

  if (result.length === 0) {
    return undefined;
  }

  return result[0] as Team & { memberRole?: TeamRole };
}

/**
 * Update a team
 * Requirement 2.6: Role-based permission checking
 */
export async function updateTeam(
  teamId: number,
  updates: Partial<Omit<InsertTeam, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>>,
  userId: number
): Promise<Team | undefined> {
  return await withTransaction(async (db) => {
    // Check user has permission
    const [membership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, teamId),
          eq(teamMembersCollaborative.memberId, userId)
        )
      )
      .limit(1);

    if (!membership || !hasPermission(membership.role as TeamRole, 'update_team')) {
      throw new ValidationError('Insufficient permissions to update team');
    }

    const [updated] = await db
      .update(teams)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, teamId))
      .returning();

    return updated;
  });
}

/**
 * Delete a team
 * Requirement 2.6: Role-based permission checking
 */
export async function deleteTeam(teamId: number, userId: number): Promise<boolean> {
  return await withTransaction(async (db) => {
    // Check user is admin
    const [membership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, teamId),
          eq(teamMembersCollaborative.memberId, userId)
        )
      )
      .limit(1);

    if (!membership || !hasPermission(membership.role as TeamRole, 'delete_team')) {
      throw new ValidationError('Insufficient permissions to delete team');
    }

    await db.delete(teams).where(eq(teams.id, teamId));
    return true;
  });
}

/**
 * Get team members with role information
 */
export async function getCollaborativeTeamMembers(
  teamId: number
): Promise<(TeamMemberCollaborative & { member: typeof teamMembers.$inferSelect })[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const result = await db
    .select({
      id: teamMembersCollaborative.id,
      teamId: teamMembersCollaborative.teamId,
      memberId: teamMembersCollaborative.memberId,
      role: teamMembersCollaborative.role,
      status: teamMembersCollaborative.status,
      joinedAt: teamMembersCollaborative.joinedAt,
      member: teamMembers,
    })
    .from(teamMembersCollaborative)
    .innerJoin(teamMembers, eq(teamMembersCollaborative.memberId, teamMembers.id))
    .where(eq(teamMembersCollaborative.teamId, teamId));

  return result;
}

/**
 * Get all teams in the system for discovery
 */
export async function getAllTeams(userId?: number): Promise<(Team & { memberStatus?: string; memberRole?: string })[]> {
  const db = await getDb();
  if (!db) return [];

  if (!userId) {
    return await db.select().from(teams).orderBy(desc(teams.createdAt));
  }

  const result = await db
    .select({
      id: teams.id,
      name: teams.name,
      description: teams.description,
      createdBy: teams.createdBy,
      createdAt: teams.createdAt,
      updatedAt: teams.updatedAt,
      memberStatus: teamMembersCollaborative.status,
      memberRole: teamMembersCollaborative.role,
    })
    .from(teams)
    .leftJoin(
      teamMembersCollaborative,
      and(
        eq(teams.id, teamMembersCollaborative.teamId),
        eq(teamMembersCollaborative.memberId, userId)
      )
    )
    .orderBy(desc(teams.createdAt));

  return result as (Team & { memberStatus?: string; memberRole?: string })[];
}

/**
 * Request to join a team (creates pending membership)
 */
export async function requestToJoinTeam(teamId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(teamMembersCollaborative).values({
    teamId,
    memberId: userId,
    role: 'developer', // Default role for new joiners
    status: 'pending'
  }).onConflictDoNothing();
}

/**
 * Directly add a member to a team (for admins)
 */
export async function addMemberToTeam(teamId: number, memberId: number, role: TeamRole = 'developer'): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(teamMembersCollaborative).values({
    teamId,
    memberId,
    role,
    status: 'active'
  }).onConflictDoNothing();
}

/**
 * Approve a join request
 */
export async function approveJoinRequest(teamId: number, memberId: number, approvedBy: number): Promise<void> {
  return await withTransaction(async (db) => {
    // Check permission of approver
    const [approverMembership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(and(
        eq(teamMembersCollaborative.teamId, teamId),
        eq(teamMembersCollaborative.memberId, approvedBy),
        eq(teamMembersCollaborative.status, 'active')
      ))
      .limit(1);

    if (!approverMembership || !hasPermission(approverMembership.role as TeamRole, 'invite_member')) {
      throw new ValidationError('Insufficient permissions to approve join requests');
    }

    await db.update(teamMembersCollaborative)
      .set({ status: 'active' })
      .where(and(
        eq(teamMembersCollaborative.teamId, teamId),
        eq(teamMembersCollaborative.memberId, memberId)
      ));
  });
}

/**
 * Search all team members (users) globally
 */
export async function searchGlobalTeamMembers(query: string): Promise<TeamMember[]> {
  const db = await getDb();
  if (!db) return [];

  const searchPattern = `%${query}%`;
  return await db.select()
    .from(teamMembers)
    .where(sql`${teamMembers.name} ILIKE ${searchPattern} OR ${teamMembers.email} ILIKE ${searchPattern}`)
    .limit(20);
}

// Team Invitation System

/**
 * Generate a secure invitation token
 */
function generateInvitationToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Create a team invitation
 * Requirement 2.2: Team invitation with specified role
 */
export async function createTeamInvitation(
  invitation: {
    teamId: number;
    email: string;
    role?: string;
    invitedBy: number;
  }
): Promise<TeamInvitation> {
  return await withTransaction(async (db) => {
    // Check inviter has permission
    const [membership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, invitation.teamId),
          eq(teamMembersCollaborative.memberId, invitation.invitedBy)
        )
      )
      .limit(1);

    if (!membership || !hasPermission(membership.role as TeamRole, 'invite_member')) {
      throw new ValidationError('Insufficient permissions to invite members');
    }

    // Check if user is already a member
    const existingMember = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.email, invitation.email))
      .limit(1);

    if (existingMember.length > 0) {
      const [existingMembership] = await db
        .select()
        .from(teamMembersCollaborative)
        .where(
          and(
            eq(teamMembersCollaborative.teamId, invitation.teamId),
            eq(teamMembersCollaborative.memberId, existingMember[0].id)
          )
        )
        .limit(1);

      if (existingMembership) {
        throw new ConflictError('User is already a member of this team');
      }
    }

    // Create invitation
    const token = generateInvitationToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    const [newInvitation] = await db
      .insert(teamInvitations)
      .values({
        teamId: invitation.teamId,
        email: invitation.email,
        role: invitation.role || 'member',
        invitedBy: invitation.invitedBy,
        token,
        expiresAt,
      })
      .returning();

    return newInvitation;
  });
}

/**
 * Get pending invitations for a team
 */
export async function getTeamInvitations(teamId: number): Promise<TeamInvitation[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  return await db
    .select()
    .from(teamInvitations)
    .where(
      and(
        eq(teamInvitations.teamId, teamId),
        eq(teamInvitations.status, 'pending')
      )
    );
}

/**
 * Accept a team invitation
 * Requirement 2.3: Invitation acceptance with role assignment
 */
export async function acceptTeamInvitation(
  token: string,
  memberId: number
): Promise<TeamMemberCollaborative> {
  return await withTransaction(async (db) => {
    // Find invitation
    const [invitation] = await db
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.token, token))
      .limit(1);

    if (!invitation) {
      throw new NotFoundError('Invitation not found');
    }

    if (invitation.status === 'accepted') {
      throw new ConflictError('Invitation already accepted');
    }

    if (invitation.expiresAt < new Date()) {
      throw new ValidationError('Invitation has expired');
    }

    // Verify member email matches invitation
    const [member] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.id, memberId))
      .limit(1);

    if (!member || member.email !== invitation.email) {
      throw new ValidationError('Member email does not match invitation');
    }

    // Check if already a member
    const [existingMembership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, invitation.teamId),
          eq(teamMembersCollaborative.memberId, memberId)
        )
      )
      .limit(1);

    if (existingMembership) {
      throw new ConflictError('Member is already part of this team');
    }

    // Add member to team with default role
    const [newMember] = await db
      .insert(teamMembersCollaborative)
      .values({
        teamId: invitation.teamId,
        memberId,
        role: 'member',
      })
      .returning();

    // Mark invitation as accepted
    await db
      .update(teamInvitations)
      .set({ status: 'accepted' })
      .where(eq(teamInvitations.id, invitation.id));

    return newMember;
  });
}

/**
 * Reject or cancel a team invitation
 */
export async function rejectTeamInvitation(token: string): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  await db.delete(teamInvitations).where(eq(teamInvitations.token, token));
  return true;
}

// Member Management Operations

/**
 * Change a team member's role
 * Requirement 2.4: Role change with immediate effect
 */
export async function changeTeamMemberRole(
  teamId: number,
  targetMemberId: number,
  newRole: TeamRole,
  changedBy: number
): Promise<TeamMemberCollaborative> {
  return await withTransaction(async (db) => {
    // Check changer has permission
    const [changerMembership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, teamId),
          eq(teamMembersCollaborative.memberId, changedBy)
        )
      )
      .limit(1);

    if (!changerMembership || !hasPermission(changerMembership.role as TeamRole, 'change_role')) {
      throw new ValidationError('Insufficient permissions to change member role');
    }

    // Cannot change team creator's role
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (team && team.createdBy === targetMemberId) {
      throw new ValidationError('Cannot change team creator role');
    }

    // Update role
    const [updated] = await db
      .update(teamMembersCollaborative)
      .set({ role: newRole })
      .where(
        and(
          eq(teamMembersCollaborative.teamId, teamId),
          eq(teamMembersCollaborative.memberId, targetMemberId)
        )
      )
      .returning();

    if (!updated) {
      throw new NotFoundError('Team member not found');
    }

    return updated;
  });
}

/**
 * Remove a team member
 * Requirement 2.5: Member removal with access revocation
 */
export async function removeTeamMember(
  teamId: number,
  targetMemberId: number,
  removedBy: number
): Promise<boolean> {
  return await withTransaction(async (db) => {
    // Check remover has permission
    const [removerMembership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, teamId),
          eq(teamMembersCollaborative.memberId, removedBy)
        )
      )
      .limit(1);

    if (!removerMembership || !hasPermission(removerMembership.role as TeamRole, 'remove_member')) {
      throw new ValidationError('Insufficient permissions to remove member');
    }

    // Cannot remove team creator
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (team && team.createdBy === targetMemberId) {
      throw new ValidationError('Cannot remove team creator');
    }

    // Remove member
    await db
      .delete(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, teamId),
          eq(teamMembersCollaborative.memberId, targetMemberId)
        )
      );

    return true;
  });
}

/**
 * Check if a user has a specific permission for a team
 */
export async function checkTeamPermission(
  teamId: number,
  userId: number,
  permission: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    return false;
  }

  const [membership] = await db
    .select()
    .from(teamMembersCollaborative)
    .where(
      and(
        eq(teamMembersCollaborative.teamId, teamId),
        eq(teamMembersCollaborative.memberId, userId),
        eq(teamMembersCollaborative.status, 'active')
      )
    )
    .limit(1);

  if (!membership) {
    return false;
  }

  return hasPermission(membership.role as TeamRole, permission);
}

// Task Management Operations

/**
 * Create a new task
 * Requirement 3.1: Task creation with team and assignee validation
 */
export async function createTask(
  task: Omit<InsertTask, 'id' | 'createdAt' | 'updatedAt'>,
  creatorId: number
): Promise<Task> {
  return await withTransaction(async (db) => {
    // Validate team exists and user has permission
    if (!task.teamId) {
      throw new ValidationError('Team ID is required');
    }

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, task.teamId))
      .limit(1);

    if (!team) {
      throw new NotFoundError(`Team with ID ${task.teamId} does not exist`);
    }

    // Check creator has developer role or higher
    const [membership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, task.teamId),
          eq(teamMembersCollaborative.memberId, creatorId)
        )
      )
      .limit(1);

    if (!membership || !hasPermission(membership.role as TeamRole, 'create_task')) {
      throw new ValidationError('Insufficient permissions to create task. Developer role or higher required.');
    }

    // Validate assignee if provided
    if (task.assignedTo) {
      const [assignee] = await db
        .select()
        .from(teamMembersCollaborative)
        .where(
          and(
            eq(teamMembersCollaborative.teamId, task.teamId),
            eq(teamMembersCollaborative.memberId, task.assignedTo)
          )
        )
        .limit(1);

      if (!assignee) {
        throw new NotFoundError(`Assignee with ID ${task.assignedTo} is not a member of this team`);
      }
    }

    // Create task
    const [created] = await db
      .insert(tasks)
      .values({
        ...task,
        createdBy: creatorId,
        updatedAt: new Date(),
      })
      .returning();

    // Create activity log
    await db.insert(activities).values({
      teamId: task.teamId,
      userId: creatorId,
      type: 'task_created',
      entityId: created.id,
      entityType: 'task',
      description: `Created task: ${task.title}`,
      metadata: {
        taskTitle: task.title,
        status: task.status,
        priority: task.priority,
      },
    });

    // Broadcast task created event to team members (real-time sync)
    broadcastTaskCreated(task.teamId, created);

    return created;
  });
}

/**
 * Get tasks by team with optional filtering
 * Requirement 3.1: Task retrieval with filtering
 */
export async function getTasksByTeam(
  teamId: number,
  filters?: {
    status?: string;
    assignedTo?: number;
    priority?: string;
  }
): Promise<Task[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const conditions = [eq(tasks.teamId, teamId)];

  if (filters?.status) {
    conditions.push(eq(tasks.status, filters.status));
  }
  if (filters?.assignedTo) {
    conditions.push(eq(tasks.assignedTo, filters.assignedTo));
  }
  if (filters?.priority) {
    conditions.push(eq(tasks.priority, filters.priority));
  }

  return await db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(tasks.createdAt);
}

/**
 * Get a task by ID
 * Requirement 3.1: Task retrieval
 */
export async function getTaskById(taskId: number): Promise<Task | undefined> {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  const [task] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  return task;
}

/**
 * Update a task
 * Requirement 3.3: Task update with history tracking
 */
export async function updateTask(
  taskId: number,
  updates: Partial<Omit<InsertTask, 'id' | 'teamId' | 'createdAt' | 'updatedAt' | 'createdBy'>>,
  updatedBy: number
): Promise<Task> {
  return await withTransaction(async (db) => {
    // Get existing task
    const [existingTask] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!existingTask) {
      throw new NotFoundError(`Task with ID ${taskId} does not exist`);
    }

    if (!existingTask.teamId) {
      throw new ValidationError('Task has no associated team');
    }

    // Check user has permission
    const [membership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, existingTask.teamId),
          eq(teamMembersCollaborative.memberId, updatedBy)
        )
      )
      .limit(1);

    if (!membership || !hasPermission(membership.role as TeamRole, 'update_task')) {
      throw new ValidationError('Insufficient permissions to update task');
    }

    // Validate assignee if being updated
    if (updates.assignedTo !== undefined && updates.assignedTo !== null) {
      const [assignee] = await db
        .select()
        .from(teamMembersCollaborative)
        .where(
          and(
            eq(teamMembersCollaborative.teamId, existingTask.teamId),
            eq(teamMembersCollaborative.memberId, updates.assignedTo)
          )
        )
        .limit(1);

      if (!assignee) {
        throw new NotFoundError(`Assignee with ID ${updates.assignedTo} is not a member of this team`);
      }
    }

    // Update task
    const [updated] = await db
      .update(tasks)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId))
      .returning();

    // Create activity log for significant changes
    const changedFields: string[] = [];
    if (updates.title !== undefined) changedFields.push('title');
    if (updates.description !== undefined) changedFields.push('description');
    if (updates.assignedTo !== undefined) changedFields.push('assignee');
    if (updates.priority !== undefined) changedFields.push('priority');
    if (updates.status !== undefined) changedFields.push('status');
    if (updates.dueDate !== undefined) changedFields.push('dueDate');

    if (changedFields.length > 0) {
      await db.insert(activities).values({
        teamId: existingTask.teamId,
        userId: updatedBy,
        type: 'task_updated',
        entityId: taskId,
        entityType: 'task',
        description: `Updated task: ${updated.title}`,
        metadata: {
          taskTitle: updated.title,
          changedFields,
          previousValues: {
            title: existingTask.title,
            status: existingTask.status,
            priority: existingTask.priority,
            assignedTo: existingTask.assignedTo,
          },
          newValues: updates,
        },
      });
    }

    // Broadcast task updated event to team members (real-time sync)
    broadcastTaskUpdated(existingTask.teamId, updated);

    return updated;
  });
}

/**
 * Delete a task
 * Requirement 3.1: Task deletion with permission checks
 */
export async function deleteTask(taskId: number, deletedBy: number): Promise<boolean> {
  return await withTransaction(async (db) => {
    // Get existing task
    const [existingTask] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!existingTask) {
      throw new NotFoundError(`Task with ID ${taskId} does not exist`);
    }

    if (!existingTask.teamId) {
      throw new ValidationError('Task has no associated team');
    }

    // Check user has permission
    const [membership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, existingTask.teamId),
          eq(teamMembersCollaborative.memberId, deletedBy)
        )
      )
      .limit(1);

    if (!membership || !hasPermission(membership.role as TeamRole, 'delete_task')) {
      throw new ValidationError('Insufficient permissions to delete task');
    }

    // Delete task
    await db.delete(tasks).where(eq(tasks.id, taskId));

    // Create activity log
    await db.insert(activities).values({
      teamId: existingTask.teamId,
      userId: deletedBy,
      type: 'task_deleted',
      entityId: taskId,
      entityType: 'task',
      description: `Deleted task: ${existingTask.title}`,
      metadata: {
        taskTitle: existingTask.title,
        status: existingTask.status,
        priority: existingTask.priority,
      },
    });

    // Broadcast task deleted event to team members (real-time sync)
    broadcastTaskDeleted(existingTask.teamId, taskId);

    return true;
  });
}

/**
 * Move a task to a new status (simplified without position tracking)
 * Requirement 3.2: Task movement with real-time updates
 */
export async function moveTask(
  taskId: number,
  newStatus: string,
  movedBy: number
): Promise<Task> {
  return await withTransaction(async (db) => {
    // Get existing task
    const [existingTask] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!existingTask) {
      throw new NotFoundError(`Task with ID ${taskId} does not exist`);
    }

    if (!existingTask.teamId) {
      throw new ValidationError('Task has no associated team');
    }

    // Check user has permission
    const [membership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, existingTask.teamId),
          eq(teamMembersCollaborative.memberId, movedBy)
        )
      )
      .limit(1);

    if (!membership || !hasPermission(membership.role as TeamRole, 'update_task')) {
      throw new ValidationError('Insufficient permissions to move task');
    }

    // Update the task status
    const [updated] = await db
      .update(tasks)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId))
      .returning();

    // Create activity log
    await db.insert(activities).values({
      teamId: existingTask.teamId,
      userId: movedBy,
      type: 'task_moved',
      entityId: taskId,
      entityType: 'task',
      description: `Moved task: ${existingTask.title}`,
      metadata: {
        taskTitle: existingTask.title,
        previousStatus: existingTask.status,
        newStatus: newStatus,
      },
    });

    // Broadcast task moved event to team members (real-time sync)
    broadcastTaskMoved(existingTask.teamId, taskId, newStatus, 0);

    return updated;
  });
}

/**
 * Get task history (state transitions)
 * Requirement 3.5: Task history tracking
 */
export async function getTaskHistory(taskId: number): Promise<Activity[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const [task] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (!task) {
    return [];
  }

  return await db
    .select()
    .from(activities)
    .where(
      and(
        eq(activities.entityId, taskId),
        eq(activities.entityType, 'task')
      )
    )
    .orderBy(desc(activities.createdAt));
}

// ============================================================================
// Repository Management Functions
// ============================================================================

/**
 * Create a repository connection with encrypted token storage
 * Requirement 4.1: Repository connection with metadata storage
 */
export async function createRepository(
  teamId: number,
  repoUrl: string,
  accessToken: string,
  userId: number
): Promise<Repository> {
  return await withTransaction(async (db) => {
    // Check user has permission
    const [membership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, teamId),
          eq(teamMembersCollaborative.memberId, userId)
        )
      )
      .limit(1);

    if (!membership || !hasPermission(membership.role as TeamRole, 'manage_repositories')) {
      throw new ValidationError('Insufficient permissions to connect repository. Admin or Team Lead role required.');
    }

    // Parse GitHub URL
    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
      throw new ValidationError('Invalid GitHub repository URL');
    }

    // Create GitHub service and validate access
    const githubService = new GitHubService(accessToken);
    await githubService.validateRepositoryAccess(parsed.owner, parsed.repo);

    // Get repository metadata
    const metadata = await githubService.getRepositoryMetadata(parsed.owner, parsed.repo);

    // Check if repository already connected to this team
    const [existing] = await db
      .select()
      .from(repositories)
      .where(
        and(
          eq(repositories.teamId, teamId),
          eq(repositories.githubId, metadata.id.toString())
        )
      )
      .limit(1);

    if (existing) {
      throw new ConflictError('Repository already connected to this team');
    }

    // Create repository record
    const [created] = await db
      .insert(repositories)
      .values({
        teamId,
        githubId: metadata.id.toString(),
        name: metadata.name,
        url: metadata.url,
        description: metadata.description || null,
        isPrivate: metadata.private,
        defaultBranch: metadata.defaultBranch,
        createdBy: userId,
      })
      .returning();

    // Create activity log
    await db.insert(activities).values({
      teamId,
      userId,
      type: 'repository_connected',
      entityId: created.id,
      entityType: 'repository',
      description: `Connected repository: ${metadata.name}`,
      metadata: {
        repositoryName: metadata.name,
        repositoryUrl: metadata.url,
      },
    });

    return created;
  });
}

/**
 * Get repositories by team
 * Requirement 4.1: Repository retrieval
 */
export async function getRepositoriesByTeam(teamId: number): Promise<Repository[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  return await db
    .select()
    .from(repositories)
    .where(eq(repositories.teamId, teamId))
    .orderBy(desc(repositories.createdAt));
}

/**
 * Get a repository by ID
 * Requirement 4.1: Repository retrieval
 */
export async function getRepositoryById(repositoryId: number): Promise<Repository | undefined> {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  const [repository] = await db
    .select()
    .from(repositories)
    .where(eq(repositories.id, repositoryId))
    .limit(1);

  return repository;
}

/**
 * Update repository metadata
 * Requirement 4.1: Repository update
 */
export async function updateRepository(
  repositoryId: number,
  updates: Partial<Pick<InsertRepository, 'name' | 'url' | 'description'>>,
  userId: number
): Promise<Repository> {
  return await withTransaction(async (db) => {
    // Get existing repository
    const [existingRepo] = await db
      .select()
      .from(repositories)
      .where(eq(repositories.id, repositoryId))
      .limit(1);

    if (!existingRepo) {
      throw new NotFoundError(`Repository with ID ${repositoryId} does not exist`);
    }

    if (!existingRepo.teamId) {
      throw new ValidationError('Repository has no associated team');
    }

    // Check user has permission
    const [membership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, existingRepo.teamId),
          eq(teamMembersCollaborative.memberId, userId)
        )
      )
      .limit(1);

    if (!membership || !hasPermission(membership.role as TeamRole, 'manage_repositories')) {
      throw new ValidationError('Insufficient permissions to update repository');
    }

    // Update repository
    const [updated] = await db
      .update(repositories)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(repositories.id, repositoryId))
      .returning();

    return updated;
  });
}

/**
 * Delete a repository connection
 * Requirement 4.1: Repository deletion
 */
export async function deleteRepository(repositoryId: number, userId: number): Promise<boolean> {
  return await withTransaction(async (db) => {
    // Get existing repository
    const [existingRepo] = await db
      .select()
      .from(repositories)
      .where(eq(repositories.id, repositoryId))
      .limit(1);

    if (!existingRepo) {
      throw new NotFoundError(`Repository with ID ${repositoryId} does not exist`);
    }

    if (!existingRepo.teamId) {
      throw new ValidationError('Repository has no associated team');
    }

    // Check user has permission
    const [membership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, existingRepo.teamId),
          eq(teamMembersCollaborative.memberId, userId)
        )
      )
      .limit(1);

    if (!membership || !hasPermission(membership.role as TeamRole, 'manage_repositories')) {
      throw new ValidationError('Insufficient permissions to delete repository');
    }

    // Delete repository
    await db.delete(repositories).where(eq(repositories.id, repositoryId));

    // Create activity log
    await db.insert(activities).values({
      teamId: existingRepo.teamId,
      userId,
      type: 'repository_disconnected',
      entityId: repositoryId,
      entityType: 'repository',
      description: `Disconnected repository: ${existingRepo.name}`,
      metadata: {
        repositoryName: existingRepo.name,
        repositoryUrl: existingRepo.url,
      },
    });

    return true;
  });
}

/**
 * Link a GitHub PR to a task (simplified - stores PR URL in task description or metadata)
 * Requirement 4.4: PR-task linking
 */
export async function linkTaskToPR(
  taskId: number,
  prUrl: string,
  userId: number
): Promise<Task> {
  return await withTransaction(async (db) => {
    // Get existing task
    const [existingTask] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!existingTask) {
      throw new NotFoundError(`Task with ID ${taskId} does not exist`);
    }

    if (!existingTask.teamId) {
      throw new ValidationError('Task has no associated team');
    }

    // Check user has permission
    const [membership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, existingTask.teamId),
          eq(teamMembersCollaborative.memberId, userId)
        )
      )
      .limit(1);

    if (!membership || !hasPermission(membership.role as TeamRole, 'update_task')) {
      throw new ValidationError('Insufficient permissions to link PR to task');
    }

    // Validate PR URL is from GitHub
    if (!prUrl.includes('github.com') || !prUrl.includes('/pull/')) {
      throw new ValidationError('Invalid GitHub pull request URL');
    }

    // Update task description to include PR link
    const updatedDescription = existingTask.description
      ? `${existingTask.description}\n\nPR: ${prUrl}`
      : `PR: ${prUrl}`;

    const [updated] = await db
      .update(tasks)
      .set({
        description: updatedDescription,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId))
      .returning();

    // Create activity log
    await db.insert(activities).values({
      teamId: existingTask.teamId,
      userId,
      type: 'pr_linked',
      entityId: taskId,
      entityType: 'task',
      description: `Linked PR to task: ${existingTask.title}`,
      metadata: {
        taskTitle: existingTask.title,
        prUrl,
      },
    });

    return updated;
  });
}

/**
 * Sync repository data (update timestamp)
 * Requirement 4.5: Repository data refresh
 */
export async function syncRepository(repositoryId: number, userId: number): Promise<Repository> {
  return await withTransaction(async (db) => {
    // Get existing repository
    const [existingRepo] = await db
      .select()
      .from(repositories)
      .where(eq(repositories.id, repositoryId))
      .limit(1);

    if (!existingRepo) {
      throw new NotFoundError(`Repository with ID ${repositoryId} does not exist`);
    }

    if (!existingRepo.teamId) {
      throw new ValidationError('Repository has no associated team');
    }

    // Check user has permission
    const [membership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, existingRepo.teamId),
          eq(teamMembersCollaborative.memberId, userId)
        )
      )
      .limit(1);

    if (!membership) {
      throw new ValidationError('User is not a member of this team');
    }

    // Update timestamp
    const [updated] = await db
      .update(repositories)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(repositories.id, repositoryId))
      .returning();

    // Create activity log
    await db.insert(activities).values({
      teamId: existingRepo.teamId,
      userId,
      type: 'repository_synced',
      entityId: repositoryId,
      entityType: 'repository',
      description: `Synced repository: ${existingRepo.name}`,
      metadata: {
        repositoryName: existingRepo.name,
      },
    });

    return updated;
  });
}

// ============================================================================
// Clients & Projects Management Functions
// ============================================================================

export async function createClient(
  clientData: Omit<InsertClient, 'id' | 'createdAt' | 'updatedAt'>,
  userId?: number
): Promise<Client> {
  const db = await getDb();
  if (!db) throw new Error("Database uninitialized");
  const [created] = await db.insert(clients).values(clientData).returning();

  if (userId) {
    await db.insert(activities).values({
      teamId: clientData.teamId,
      userId,
      type: 'client_created',
      entityId: created.id,
      entityType: 'client',
      description: `Created client: ${created.firstName} ${created.lastName}`,
    });
  }
  return created;
}

export async function getClientsByTeam(teamId: number): Promise<Client[]> {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(clients)
    .where(eq(clients.teamId, teamId))
    .orderBy(desc(clients.updatedAt));
}

export async function getClientById(clientId: number): Promise<Client | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  return client;
}

export async function updateClient(
  clientId: number,
  updates: Partial<Omit<InsertClient, 'id' | 'createdAt'>>,
  userId?: number
): Promise<Client> {
  const db = await getDb();
  if (!db) throw new Error("Database uninitialized");
  const [updated] = await db
    .update(clients)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(clients.id, clientId))
    .returning();

  if (userId && updated) {
    await db.insert(activities).values({
      teamId: updated.teamId,
      userId,
      type: 'client_updated',
      entityId: updated.id,
      entityType: 'client',
      description: `Updated client: ${updated.firstName} ${updated.lastName}`,
    });
  }
  return updated;
}

export async function createProject(
  projectData: Omit<InsertProject, 'id' | 'createdAt' | 'updatedAt'>,
  userId?: number
): Promise<Project> {
  const db = await getDb();
  if (!db) throw new Error("Database uninitialized");
  const [created] = await db.insert(projects).values(projectData).returning();

  if (userId) {
    await db.insert(activities).values({
      teamId: projectData.teamId,
      userId,
      type: 'project_created',
      entityId: created.id,
      entityType: 'project',
      description: `Created project: ${created.name}`,
    });
  }
  return created;
}

export async function getProjectsByTeam(teamId: number): Promise<Project[]> {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(projects)
    .where(eq(projects.teamId, teamId))
    .orderBy(desc(projects.updatedAt));
}

export async function getProjectById(projectId: number): Promise<Project | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return project;
}

export async function updateProject(
  projectId: number,
  updates: Partial<Omit<InsertProject, 'id' | 'createdAt'>>,
  userId?: number
): Promise<Project> {
  const db = await getDb();
  if (!db) throw new Error("Database uninitialized");
  const [updated] = await db
    .update(projects)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(projects.id, projectId))
    .returning();

  if (userId && updated) {
    await db.insert(activities).values({
      teamId: updated.teamId,
      userId,
      type: 'project_updated',
      entityId: updated.id,
      entityType: 'project',
      description: `Updated project: ${updated.name}`,
    });
  }
  return updated;
}

export async function createProjectFromParsedPRD(
  teamId: number,
  data: {
    clientFirstName: string;
    clientLastName: string;
    clientEmail?: string;
    clientPhone?: string;
    projectName: string;
    projectDefinition: string;
    projectScope: string;
    dateReceived?: string;
  },
  userId?: number
): Promise<{ client: Client; project: Project }> {
  return await withTransaction(async (db) => {
    // 1. Find or Create Client
    let [client] = await db
      .select()
      .from(clients)
      .where(and(
        eq(clients.teamId, teamId),
        eq(clients.firstName, data.clientFirstName),
        eq(clients.lastName, data.clientLastName)
      ))
      .limit(1);

    if (!client) {
      [client] = await db.insert(clients).values({
        teamId,
        firstName: data.clientFirstName,
        lastName: data.clientLastName,
        email: data.clientEmail,
        phone: data.clientPhone,
      }).returning();
    }

    // 2. Create Project
    const [project] = await db.insert(projects).values({
      teamId,
      clientId: client.id,
      name: data.projectName,
      definition: data.projectDefinition,
      description: data.projectScope,
      dateReceived: data.dateReceived ? new Date(data.dateReceived) : new Date(),
      status: 'active',
    }).returning();

    if (userId) {
      await db.insert(activities).values({
        teamId,
        userId,
        type: 'project_created',
        entityId: project.id,
        entityType: 'project',
        description: `Imported project from PRD: ${project.name}`,
      });
    }

    return { client, project };
  });
}

export async function deleteProject(projectId: number, userId?: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database uninitialized");

  // Get project info for activity logging
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

  await db.delete(projects).where(eq(projects.id, projectId));

  if (userId && project) {
    await db.insert(activities).values({
      teamId: project.teamId,
      userId,
      type: 'project_deleted',
      entityId: projectId,
      entityType: 'project',
      description: `Deleted project: ${project.name}`,
    });
  }
  return true;
}

export async function createProjectFile(
  fileData: Omit<InsertProjectFile, 'id' | 'createdAt'>
): Promise<ProjectFile> {
  const db = await getDb();
  if (!db) throw new Error("Database uninitialized");
  const [created] = await db.insert(projectFiles).values(fileData).returning();

  if (fileData.uploadedBy && fileData.projectId) {
    // Get project to find teamId
    const [project] = await db.select().from(projects).where(eq(projects.id, fileData.projectId)).limit(1);
    if (project) {
      await db.insert(activities).values({
        teamId: project.teamId,
        userId: fileData.uploadedBy,
        type: 'artifact_uploaded',
        entityId: created.id,
        entityType: 'project_file',
        description: `Uploaded artifact: ${created.title} to ${project.name}`,
      });
    }
  }
  return created;
}

export async function deleteProjectFile(fileId: number, userId?: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database uninitialized");

  // Get file info for activity logging
  const [file] = await db.select().from(projectFiles).where(eq(projectFiles.id, fileId)).limit(1);
  if (!file) return false;

  let project = null;
  if (file.projectId) {
    const [foundProject] = await db.select().from(projects).where(eq(projects.id, file.projectId)).limit(1);
    project = foundProject;
  }

  await db.delete(projectFiles).where(eq(projectFiles.id, fileId));

  if (userId && project) {
    await db.insert(activities).values({
      teamId: project.teamId,
      userId,
      type: 'artifact_deleted',
      entityId: fileId,
      entityType: 'project_file',
      description: `Deleted artifact: ${file.title} from ${project.name}`,
    });
  }
  return true;
}

export async function getProjectFiles(projectId: number): Promise<ProjectFile[]> {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(projectFiles)
    .where(eq(projectFiles.projectId, projectId))
    .orderBy(desc(projectFiles.createdAt));
}

/**
 * Source Control: Team-level GitHub Integration
 */
export async function setTeamGithubToken(teamId: number, token: string): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database uninitialized");

  const encryptedToken = encrypt(token);

  await db
    .update(teams)
    .set({ githubAccessToken: encryptedToken, updatedAt: new Date() })
    .where(eq(teams.id, teamId));

  return true;
}

export async function getTeamGithubToken(teamId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  const [team] = await db
    .select({ githubAccessToken: teams.githubAccessToken })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  if (!team || !team.githubAccessToken) return null;

  try {
    return decrypt(team.githubAccessToken);
  } catch (error) {
    console.error(`Failed to decrypt GitHub token for team ${teamId}:`, error);
    return null;
  }
}

/**
 * Messages System
 */
export async function getMessages(): Promise<Message[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(messages).orderBy(desc(messages.createdAt));
}
