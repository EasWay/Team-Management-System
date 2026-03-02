import { eq, and, isNull, desc, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from 'pg';
const { Pool } = pkg;
import { InsertUser, users, teamMembers, InsertTeamMember, TeamMember, departments, InsertDepartment, Department, departmentAssignments, DepartmentAssignment, auditLogs, InsertAuditLog, teams, InsertTeam, Team, teamMembersCollaborative, InsertTeamMemberCollaborative, TeamMemberCollaborative, teamInvitations, InsertTeamInvitation, TeamInvitation, tasks, InsertTask, Task, documents, InsertDocument, Document, activities, InsertActivity, Activity, repositories, InsertRepository, Repository } from "../drizzle/schema";
import { ENV } from './_core/env';
import { randomBytes } from 'crypto';
import { broadcastTaskCreated, broadcastTaskUpdated, broadcastTaskMoved, broadcastTaskDeleted } from './socket-server';
import { encrypt, generateToken } from './crypto';
import { GitHubService, parseGitHubUrl } from './github-service';

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
let _pool: pkg.Pool | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db) {
    try {
      _pool = new Pool({
        host: 'localhost',
        port: 5433, // PostgreSQL 13 is running on port 5433
        database: 'team_manager_db', // Updated to match created database name
        user: 'postgres',
        password: 'postgres',
        ssl: false, // Disable SSL for local development
      });
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
    return await operation(tx as DbType);
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

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
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

  const result = await db.insert(users).values({
    email: userData.email,
    passwordHash: userData.passwordHash,
    name: userData.name,
    loginMethod: 'email',
    role: 'user',
    lastSignedIn: new Date(),
  }).returning();

  return result[0];
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

export async function createTeamMemberWithDepartment(member: InsertTeamMember & { departmentId?: number }, auditContext?: { userId?: number; ipAddress?: string; userAgent?: string }): Promise<TeamMember> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Create the team member first
  const { departmentId, ...memberData } = member;
  const result = await db.insert(teamMembers).values(memberData).returning();
  const createdMember = result[0];

  // If department is specified, assign the member to it
  if (departmentId) {
    await assignMemberToDepartment({
      teamMemberId: createdMember.id,
      departmentId: departmentId,
      assignedBy: createdMember.id // Self-assigned during creation
    }, auditContext);
  }

  // Create audit log for team member creation
  await createAuditLog({
    operation: 'CREATE',
    entityType: 'TEAM_MEMBER',
    entityId: createdMember.id,
    userId: auditContext?.userId,
    details: {
      teamMemberName: createdMember.name,
      position: createdMember.position,
      email: createdMember.email,
      phone: createdMember.phone,
      assignedToDepartment: departmentId || null
    },
    ipAddress: auditContext?.ipAddress,
    userAgent: auditContext?.userAgent
  });

  return createdMember;
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }
  return db.select().from(teamMembers).orderBy(teamMembers.createdAt);
}

export async function getTeamMembersWithDepartments(): Promise<(TeamMember & { currentDepartment?: Department })[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  // Get all team members
  const members = await db.select().from(teamMembers).orderBy(teamMembers.createdAt);

  // For each member, get their current department assignment
  const membersWithDepartments = await Promise.all(
    members.map(async (member) => {
      const currentAssignment = await getTeamMemberCurrentAssignment(member.id);
      return {
        ...member,
        currentDepartment: currentAssignment?.department || undefined
      };
    })
  );

  return membersWithDepartments;
}

export async function getTeamMemberById(id: number): Promise<TeamMember | undefined> {
  const db = await getDb();
  if (!db) {
    return undefined;
  }
  const result = await db.select().from(teamMembers).where(eq(teamMembers.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getTeamMemberByIdWithDepartment(id: number): Promise<(TeamMember & { 
  currentDepartment?: Department;
  departmentHistory?: { assignment: typeof departmentAssignments.$inferSelect; department: Department }[];
}) | undefined> {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  // Get the team member
  const member = await getTeamMemberById(id);
  if (!member) {
    return undefined;
  }

  // Get current department assignment
  const currentAssignment = await getTeamMemberCurrentAssignment(id);
  
  // Get assignment history
  const assignmentHistory = await getTeamMemberAssignmentHistory(id);

  return {
    ...member,
    currentDepartment: currentAssignment?.department || undefined,
    departmentHistory: assignmentHistory
  };
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

    // Get current department assignment
    const currentAssignment = await getTeamMemberCurrentAssignment(id);

    // Get departments where this member is a manager
    const managedDepartments = await db.select().from(departments).where(eq(departments.managerId, id));

    // Handle department cleanup: remove manager assignments
    if (managedDepartments.length > 0) {
      await db.update(departments)
        .set({ managerId: null, updatedAt: new Date() })
        .where(eq(departments.managerId, id));
    }

    // Deactivate any active department assignments (cascade will handle the records)
    await db.update(departmentAssignments)
      .set({ isActive: false })
      .where(and(
        eq(departmentAssignments.teamMemberId, id),
        eq(departmentAssignments.isActive, true)
      ));

    // Delete the team member (cascade will handle department assignments)
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
        phone: teamMember.phone,
        currentDepartment: currentAssignment ? {
          id: currentAssignment.department.id,
          name: currentAssignment.department.name
        } : null,
        managedDepartments: managedDepartments.map(dept => ({ id: dept.id, name: dept.name })),
        cleanupActions: {
          departmentAssignmentsDeactivated: currentAssignment ? 1 : 0,
          managerAssignmentsRemoved: managedDepartments.length
        }
      },
      ipAddress: auditContext?.ipAddress,
      userAgent: auditContext?.userAgent
    });

    return true;
  });
}

// Department queries
export async function createDepartment(department: InsertDepartment, auditContext?: { userId?: number; ipAddress?: string; userAgent?: string }): Promise<Department> {
  return await withTransaction(async (db) => {
    // Check for department name uniqueness
    const existingDepartment = await db.select().from(departments).where(eq(departments.name, department.name)).limit(1);
    if (existingDepartment.length > 0) {
      throw new ConflictError(
        `Department with name "${department.name}" already exists`,
        { 
          conflictingName: department.name,
          existingDepartmentId: existingDepartment[0].id 
        }
      );
    }

    // Validate manager exists if provided
    if (department.managerId) {
      const manager = await getTeamMemberById(department.managerId);
      if (!manager) {
        throw new NotFoundError(
          `Manager with ID ${department.managerId} does not exist`,
          { 
            managerId: department.managerId,
            field: 'managerId' 
          }
        );
      }
    }

    // Validate parent department exists if provided
    if (department.parentId) {
      const parentDepartment = await getDepartmentById(department.parentId);
      if (!parentDepartment) {
        throw new NotFoundError(
          `Parent department with ID ${department.parentId} does not exist`,
          { 
            parentId: department.parentId,
            field: 'parentId' 
          }
        );
      }
    }

    const result = await db.insert(departments).values({
      ...department,
      updatedAt: new Date()
    }).returning();
    
    const createdDepartment = result[0];

    // Create audit log
    await createAuditLog({
      operation: 'CREATE',
      entityType: 'DEPARTMENT',
      entityId: createdDepartment.id,
      userId: auditContext?.userId,
      details: {
        departmentName: createdDepartment.name,
        description: createdDepartment.description,
        managerId: createdDepartment.managerId,
        parentId: createdDepartment.parentId
      },
      ipAddress: auditContext?.ipAddress,
      userAgent: auditContext?.userAgent
    });

    return createdDepartment;
  });
}

export async function getDepartments(): Promise<Department[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }
  return db.select().from(departments).orderBy(departments.createdAt);
}

export async function getDepartmentById(id: number): Promise<Department | undefined> {
  const db = await getDb();
  if (!db) {
    return undefined;
  }
  const result = await db.select().from(departments).where(eq(departments.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateDepartment(id: number, department: Partial<InsertDepartment>, auditContext?: { userId?: number; ipAddress?: string; userAgent?: string }): Promise<Department | undefined> {
  return await withTransaction(async (db) => {
    // Check if department exists
    const existingDepartment = await getDepartmentById(id);
    if (!existingDepartment) {
      throw new NotFoundError(
        `Department with ID ${id} does not exist`,
        { 
          departmentId: id,
          operation: 'update' 
        }
      );
    }

    // Check for department name uniqueness if name is being updated
    if (department.name && department.name !== existingDepartment.name) {
      const nameConflict = await db.select().from(departments).where(eq(departments.name, department.name)).limit(1);
      if (nameConflict.length > 0) {
        throw new ConflictError(
          `Department with name "${department.name}" already exists`,
          { 
            conflictingName: department.name,
            existingDepartmentId: nameConflict[0].id,
            currentDepartmentId: id 
          }
        );
      }
    }

    // Validate manager exists if provided
    if (department.managerId) {
      const manager = await getTeamMemberById(department.managerId);
      if (!manager) {
        throw new NotFoundError(
          `Manager with ID ${department.managerId} does not exist`,
          { 
            managerId: department.managerId,
            field: 'managerId',
            departmentId: id 
          }
        );
      }
    }

    // Validate parent department exists if provided
    if (department.parentId !== undefined) {
      if (department.parentId !== null) {
        const parentDepartment = await getDepartmentById(department.parentId);
        if (!parentDepartment) {
          throw new NotFoundError(
            `Parent department with ID ${department.parentId} does not exist`,
            { 
              parentId: department.parentId,
              field: 'parentId',
              departmentId: id 
            }
          );
        }

        // Check for circular reference if setting a parent
        const isCircular = await checkCircularReference(department.parentId, id);
        if (isCircular) {
          throw new IntegrityError(
            `Setting parent would create a circular reference in the department hierarchy`,
            { 
              departmentId: id,
              parentId: department.parentId,
              operation: 'update' 
            }
          );
        }
      }
    }

    await db.update(departments).set({
      ...department,
      updatedAt: new Date()
    }).where(eq(departments.id, id));

    const updatedDepartment = await getDepartmentById(id);

    // Create audit log
    await createAuditLog({
      operation: 'UPDATE',
      entityType: 'DEPARTMENT',
      entityId: id,
      userId: auditContext?.userId,
      details: {
        previousValues: {
          name: existingDepartment.name,
          description: existingDepartment.description,
          managerId: existingDepartment.managerId,
          parentId: existingDepartment.parentId
        },
        newValues: department,
        departmentName: updatedDepartment?.name
      },
      ipAddress: auditContext?.ipAddress,
      userAgent: auditContext?.userAgent
    });

    return updatedDepartment;
  });
}

export async function deleteDepartment(id: number, auditContext?: { userId?: number; ipAddress?: string; userAgent?: string }): Promise<boolean> {
  return await withTransaction(async (db) => {
    // Check if department exists
    const existingDepartment = await getDepartmentById(id);
    if (!existingDepartment) {
      throw new NotFoundError(
        `Department with ID ${id} does not exist`,
        { 
          departmentId: id,
          operation: 'delete' 
        }
      );
    }

    // Check if department has assigned members
    const assignedMembers = await db.select().from(departmentAssignments)
      .where(and(eq(departmentAssignments.departmentId, id), eq(departmentAssignments.isActive, true)))
      .limit(1);
    
    if (assignedMembers.length > 0) {
      // Get member count for better error message
      const memberCount = await db.select().from(departmentAssignments)
        .where(and(eq(departmentAssignments.departmentId, id), eq(departmentAssignments.isActive, true)));
      
      throw new IntegrityError(
        `Cannot delete department "${existingDepartment.name}" because it has ${memberCount.length} assigned team member(s). Please reassign or remove all team members first.`,
        { 
          departmentId: id,
          departmentName: existingDepartment.name,
          assignedMemberCount: memberCount.length,
          operation: 'delete',
          suggestion: 'Reassign or remove all team members before deleting the department'
        }
      );
    }

    // Handle hierarchy integrity: check for child departments
    const childDepartments = await getDepartmentChildren(id, false);
    
    if (childDepartments.length > 0) {
      // Option 1: Move children to the parent of the department being deleted (orphan prevention)
      // This maintains the hierarchy structure by promoting children up one level
      const parentId = existingDepartment.parentId;
      
      for (const child of childDepartments) {
        await db.update(departments).set({
          parentId: parentId, // This could be null if the deleted department was a root
          updatedAt: new Date()
        }).where(eq(departments.id, child.id));
      }
    }

    // Now safe to delete the department
    await db.delete(departments).where(eq(departments.id, id));

    // Create audit log
    await createAuditLog({
      operation: 'DELETE',
      entityType: 'DEPARTMENT',
      entityId: id,
      userId: auditContext?.userId,
      details: {
        departmentName: existingDepartment.name,
        description: existingDepartment.description,
        managerId: existingDepartment.managerId,
        parentId: existingDepartment.parentId,
        childDepartmentsPromoted: childDepartments.map(child => ({ id: child.id, name: child.name }))
      },
      ipAddress: auditContext?.ipAddress,
      userAgent: auditContext?.userAgent
    });

    return true;
  });
}

export async function deleteDepartmentWithStrategy(
  id: number, 
  childHandlingStrategy: 'promote' | 'prevent' = 'promote'
): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    return false;
  }

  // Check if department exists
  const existingDepartment = await getDepartmentById(id);
  if (!existingDepartment) {
    throw new Error(`Department with ID ${id} does not exist`);
  }

  // Check if department has assigned members
  const assignedMembers = await db.select().from(departmentAssignments)
    .where(and(eq(departmentAssignments.departmentId, id), eq(departmentAssignments.isActive, true)))
    .limit(1);
  
  if (assignedMembers.length > 0) {
    throw new Error(`Cannot delete department "${existingDepartment.name}" because it has assigned team members. Please reassign or remove all team members first.`);
  }

  // Handle hierarchy integrity based on strategy
  const childDepartments = await getDepartmentChildren(id, false);
  
  if (childDepartments.length > 0) {
    if (childHandlingStrategy === 'prevent') {
      // Prevent deletion if there are child departments
      const childNames = childDepartments.map(child => child.name).join(', ');
      throw new Error(`Cannot delete department "${existingDepartment.name}" because it has child departments: ${childNames}. Please handle child departments first.`);
    } else if (childHandlingStrategy === 'promote') {
      // Move children to the parent of the department being deleted (orphan prevention)
      const parentId = existingDepartment.parentId;
      
      for (const child of childDepartments) {
        await db.update(departments).set({
          parentId: parentId, // This could be null if the deleted department was a root
          updatedAt: new Date()
        }).where(eq(departments.id, child.id));
      }
    }
  }

  // Now safe to delete the department
  await db.delete(departments).where(eq(departments.id, id));
  return true;
}

// Department Assignment Operations

export async function assignMemberToDepartment(assignment: {
  teamMemberId: number;
  departmentId: number;
  assignedBy?: number;
}, auditContext?: { userId?: number; ipAddress?: string; userAgent?: string }): Promise<{ id: number; teamMemberId: number; departmentId: number; assignedAt: Date; assignedBy: number | null; isActive: boolean }> {
  return await withTransaction(async (db) => {
    // Validate department exists
    const department = await getDepartmentById(assignment.departmentId);
    if (!department) {
      throw new NotFoundError(
        `Department with ID ${assignment.departmentId} does not exist`,
        { 
          departmentId: assignment.departmentId,
          operation: 'assign',
          field: 'departmentId' 
        }
      );
    }

    // Validate team member exists
    const teamMember = await getTeamMemberById(assignment.teamMemberId);
    if (!teamMember) {
      throw new NotFoundError(
        `Team member with ID ${assignment.teamMemberId} does not exist`,
        { 
          teamMemberId: assignment.teamMemberId,
          operation: 'assign',
          field: 'teamMemberId' 
        }
      );
    }

    // Validate assignedBy exists if provided
    if (assignment.assignedBy) {
      const assignedByMember = await getTeamMemberById(assignment.assignedBy);
      if (!assignedByMember) {
        throw new NotFoundError(
          `Assigning manager with ID ${assignment.assignedBy} does not exist`,
          { 
            assignedBy: assignment.assignedBy,
            operation: 'assign',
            field: 'assignedBy' 
          }
        );
      }
    }

    // Get previous assignment for audit log
    const previousAssignment = await getTeamMemberCurrentAssignment(assignment.teamMemberId);

    // Deactivate any existing active assignments for this team member (single active assignment constraint)
    await db.update(departmentAssignments)
      .set({ isActive: false })
      .where(and(
        eq(departmentAssignments.teamMemberId, assignment.teamMemberId),
        eq(departmentAssignments.isActive, true)
      ));

    // Create new assignment with metadata recording
    const result = await db.insert(departmentAssignments).values({
      teamMemberId: assignment.teamMemberId,
      departmentId: assignment.departmentId,
      assignedBy: assignment.assignedBy || null,
      isActive: true,
      assignedAt: new Date()
    }).returning();

    const newAssignment = result[0];

    // Create audit log
    await createAuditLog({
      operation: previousAssignment ? 'REASSIGN' : 'ASSIGN',
      entityType: 'ASSIGNMENT',
      entityId: newAssignment.id,
      userId: auditContext?.userId || assignment.assignedBy,
      details: {
        teamMemberId: assignment.teamMemberId,
        teamMemberName: teamMember.name,
        departmentId: assignment.departmentId,
        departmentName: department.name,
        assignedBy: assignment.assignedBy,
        previousDepartment: previousAssignment ? {
          id: previousAssignment.department.id,
          name: previousAssignment.department.name
        } : null
      },
      ipAddress: auditContext?.ipAddress,
      userAgent: auditContext?.userAgent
    });

    return newAssignment;
  });
}

export async function reassignMember(reassignment: {
  teamMemberId: number;
  newDepartmentId: number;
  assignedBy?: number;
}, auditContext?: { userId?: number; ipAddress?: string; userAgent?: string }): Promise<{ id: number; teamMemberId: number; departmentId: number; assignedAt: Date; assignedBy: number | null; isActive: boolean }> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Validate new department exists
  const newDepartment = await getDepartmentById(reassignment.newDepartmentId);
  if (!newDepartment) {
    throw new Error(`Department with ID ${reassignment.newDepartmentId} does not exist`);
  }

  // Validate team member exists
  const teamMember = await getTeamMemberById(reassignment.teamMemberId);
  if (!teamMember) {
    throw new Error(`Team member with ID ${reassignment.teamMemberId} does not exist`);
  }

  // Validate assignedBy exists if provided
  if (reassignment.assignedBy) {
    const assignedByMember = await getTeamMemberById(reassignment.assignedBy);
    if (!assignedByMember) {
      throw new Error(`Assigning manager with ID ${reassignment.assignedBy} does not exist`);
    }
  }

  // Get previous assignment for audit log
  const previousAssignment = await getTeamMemberCurrentAssignment(reassignment.teamMemberId);

  // Deactivate current active assignment (preserving history)
  await db.update(departmentAssignments)
    .set({ isActive: false })
    .where(and(
      eq(departmentAssignments.teamMemberId, reassignment.teamMemberId),
      eq(departmentAssignments.isActive, true)
    ));

  // Create new assignment
  const result = await db.insert(departmentAssignments).values({
    teamMemberId: reassignment.teamMemberId,
    departmentId: reassignment.newDepartmentId,
    assignedBy: reassignment.assignedBy || null,
    isActive: true,
    assignedAt: new Date()
  }).returning();

  const newAssignment = result[0];

  // Create audit log
  await createAuditLog({
    operation: 'REASSIGN',
    entityType: 'ASSIGNMENT',
    entityId: newAssignment.id,
    userId: auditContext?.userId || reassignment.assignedBy,
    details: {
      teamMemberId: reassignment.teamMemberId,
      teamMemberName: teamMember.name,
      newDepartmentId: reassignment.newDepartmentId,
      newDepartmentName: newDepartment.name,
      previousDepartment: previousAssignment ? {
        id: previousAssignment.department.id,
        name: previousAssignment.department.name
      } : null,
      assignedBy: reassignment.assignedBy
    },
    ipAddress: auditContext?.ipAddress,
    userAgent: auditContext?.userAgent
  });

  return newAssignment;
}

export async function unassignMemberFromDepartment(unassignment: {
  teamMemberId: number;
  departmentId?: number; // Optional - if not provided, unassign from current department
}, auditContext?: { userId?: number; ipAddress?: string; userAgent?: string }): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Validate team member exists
  const teamMember = await getTeamMemberById(unassignment.teamMemberId);
  if (!teamMember) {
    throw new Error(`Team member with ID ${unassignment.teamMemberId} does not exist`);
  }

  // Get current assignment for audit log
  const currentAssignment = await getTeamMemberCurrentAssignment(unassignment.teamMemberId);

  let whereCondition;
  let departmentName = '';
  
  if (unassignment.departmentId) {
    // Validate department exists if specified
    const department = await getDepartmentById(unassignment.departmentId);
    if (!department) {
      throw new Error(`Department with ID ${unassignment.departmentId} does not exist`);
    }
    departmentName = department.name;
    
    whereCondition = and(
      eq(departmentAssignments.teamMemberId, unassignment.teamMemberId),
      eq(departmentAssignments.departmentId, unassignment.departmentId),
      eq(departmentAssignments.isActive, true)
    );
  } else {
    // Unassign from any active department
    if (currentAssignment) {
      departmentName = currentAssignment.department.name;
    }
    
    whereCondition = and(
      eq(departmentAssignments.teamMemberId, unassignment.teamMemberId),
      eq(departmentAssignments.isActive, true)
    );
  }

  // Deactivate the assignment(s)
  await db.update(departmentAssignments)
    .set({ isActive: false })
    .where(whereCondition);

  // Create audit log
  await createAuditLog({
    operation: 'UNASSIGN',
    entityType: 'ASSIGNMENT',
    entityId: currentAssignment?.assignment.id || 0,
    userId: auditContext?.userId,
    details: {
      teamMemberId: unassignment.teamMemberId,
      teamMemberName: teamMember.name,
      departmentId: unassignment.departmentId || currentAssignment?.department.id,
      departmentName: departmentName
    },
    ipAddress: auditContext?.ipAddress,
    userAgent: auditContext?.userAgent
  });

  return true;
}

export async function getDepartmentMembers(departmentId: number): Promise<TeamMember[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  // Validate department exists
  const department = await getDepartmentById(departmentId);
  if (!department) {
    throw new Error(`Department with ID ${departmentId} does not exist`);
  }

  const result = await db
    .select({
      id: teamMembers.id,
      name: teamMembers.name,
      position: teamMembers.position,
      duties: teamMembers.duties,
      email: teamMembers.email,
      phone: teamMembers.phone,
      pictureFileName: teamMembers.pictureFileName,
      createdAt: teamMembers.createdAt,
      updatedAt: teamMembers.updatedAt,
    })
    .from(teamMembers)
    .innerJoin(
      departmentAssignments,
      and(
        eq(teamMembers.id, departmentAssignments.teamMemberId),
        eq(departmentAssignments.departmentId, departmentId),
        eq(departmentAssignments.isActive, true)
      )
    );

  return result;
}

export async function getTeamMemberCurrentAssignment(teamMemberId: number): Promise<{
  assignment: typeof departmentAssignments.$inferSelect;
  department: Department;
} | null> {
  const db = await getDb();
  if (!db) {
    return null;
  }

  const result = await db
    .select({
      assignment: departmentAssignments,
      department: departments,
    })
    .from(departmentAssignments)
    .innerJoin(departments, eq(departmentAssignments.departmentId, departments.id))
    .where(and(
      eq(departmentAssignments.teamMemberId, teamMemberId),
      eq(departmentAssignments.isActive, true)
    ))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function getTeamMemberAssignmentHistory(teamMemberId: number): Promise<{
  assignment: typeof departmentAssignments.$inferSelect;
  department: Department;
}[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const result = await db
    .select({
      assignment: departmentAssignments,
      department: departments,
    })
    .from(departmentAssignments)
    .innerJoin(departments, eq(departmentAssignments.departmentId, departments.id))
    .where(eq(departmentAssignments.teamMemberId, teamMemberId))
    .orderBy(departmentAssignments.assignedAt);

  return result;
}

export async function getUnassignedTeamMembers(): Promise<TeamMember[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  // Get all team members who don't have an active department assignment
  const result = await db
    .select({
      id: teamMembers.id,
      name: teamMembers.name,
      position: teamMembers.position,
      duties: teamMembers.duties,
      email: teamMembers.email,
      phone: teamMembers.phone,
      pictureFileName: teamMembers.pictureFileName,
      createdAt: teamMembers.createdAt,
      updatedAt: teamMembers.updatedAt,
    })
    .from(teamMembers)
    .leftJoin(
      departmentAssignments,
      and(
        eq(teamMembers.id, departmentAssignments.teamMemberId),
        eq(departmentAssignments.isActive, true)
      )
    )
    .where(isNull(departmentAssignments.teamMemberId)); // No active assignment

  return result;
}

// Department Hierarchy Operations

export async function setDepartmentParent(departmentId: number, parentId: number | null, auditContext?: { userId?: number; ipAddress?: string; userAgent?: string }): Promise<Department | undefined> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Validate department exists
  const department = await getDepartmentById(departmentId);
  if (!department) {
    throw new Error(`Department with ID ${departmentId} does not exist`);
  }

  const previousParentId = department.parentId;
  let parentName = null;

  // If setting a parent, validate parent exists and check for circular references
  if (parentId !== null) {
    const parentDepartment = await getDepartmentById(parentId);
    if (!parentDepartment) {
      throw new Error(`Parent department with ID ${parentId} does not exist`);
    }
    parentName = parentDepartment.name;

    // Check for circular reference by traversing up the hierarchy from the parent
    const isCircular = await checkCircularReference(parentId, departmentId);
    if (isCircular) {
      throw new Error(`Setting parent would create a circular reference in the department hierarchy`);
    }
  }

  // Update the department's parent
  await db.update(departments).set({
    parentId: parentId,
    updatedAt: new Date()
  }).where(eq(departments.id, departmentId));

  const updatedDepartment = await getDepartmentById(departmentId);

  // Create audit log
  await createAuditLog({
    operation: 'HIERARCHY_UPDATE',
    entityType: 'HIERARCHY',
    entityId: departmentId,
    userId: auditContext?.userId,
    details: {
      departmentId: departmentId,
      departmentName: department.name,
      previousParentId: previousParentId,
      newParentId: parentId,
      newParentName: parentName
    },
    ipAddress: auditContext?.ipAddress,
    userAgent: auditContext?.userAgent
  });

  return updatedDepartment;
}

async function checkCircularReference(parentId: number, targetDepartmentId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    return false;
  }

  let currentId: number | null = parentId;
  const visited = new Set<number>();

  while (currentId !== null) {
    // If we've reached the target department, we have a circular reference
    if (currentId === targetDepartmentId) {
      return true;
    }

    // If we've already visited this department, we have a cycle (but not necessarily involving our target)
    if (visited.has(currentId)) {
      break;
    }

    visited.add(currentId);

    // Get the parent of the current department
    const currentDept = await getDepartmentById(currentId);
    if (!currentDept) {
      break;
    }

    currentId = currentDept.parentId;
  }

  return false;
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

export async function getDepartmentHierarchy(): Promise<DepartmentHierarchyNode[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  // Get all departments
  const allDepartments = await getDepartments();

  // Get member counts for each department
  const memberCounts = new Map<number, number>();
  for (const dept of allDepartments) {
    const members = await getDepartmentMembers(dept.id);
    memberCounts.set(dept.id, members.length);
  }

  // Build hierarchy tree structure
  const departmentMap = new Map<number, DepartmentHierarchyNode>();
  const rootDepartments: DepartmentHierarchyNode[] = [];

  // First pass: create all nodes
  for (const dept of allDepartments) {
    const node: DepartmentHierarchyNode = {
      id: dept.id,
      name: dept.name,
      description: dept.description,
      parentId: dept.parentId,
      managerId: dept.managerId,
      createdAt: dept.createdAt,
      updatedAt: dept.updatedAt,
      children: [],
      memberCount: memberCounts.get(dept.id) || 0
    };
    departmentMap.set(dept.id, node);
  }

  // Second pass: build parent-child relationships
  for (const dept of allDepartments) {
    const node = departmentMap.get(dept.id)!;
    
    if (dept.parentId === null) {
      // Root level department
      rootDepartments.push(node);
    } else {
      // Child department - add to parent's children array
      const parent = departmentMap.get(dept.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent doesn't exist, treat as root (orphaned department)
        rootDepartments.push(node);
      }
    }
  }

  // Sort children arrays by name for consistent ordering
  const sortChildren = (nodes: DepartmentHierarchyNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach(node => sortChildren(node.children));
  };

  sortChildren(rootDepartments);
  rootDepartments.sort((a, b) => a.name.localeCompare(b.name));

  return rootDepartments;
}

export async function getDepartmentPath(departmentId: number): Promise<Department[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const path: Department[] = [];
  let currentId: number | null = departmentId;

  while (currentId !== null) {
    const dept = await getDepartmentById(currentId);
    if (!dept) {
      break;
    }
    
    path.unshift(dept); // Add to beginning to build path from root to target
    currentId = dept.parentId;
  }

  return path;
}

export async function getDepartmentChildren(departmentId: number, recursive: boolean = false): Promise<Department[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  // Get direct children
  const directChildren = await db.select().from(departments)
    .where(eq(departments.parentId, departmentId))
    .orderBy(departments.name);

  if (!recursive) {
    return directChildren;
  }

  // Get all descendants recursively
  const allChildren: Department[] = [...directChildren];
  
  for (const child of directChildren) {
    const grandChildren = await getDepartmentChildren(child.id, true);
    allChildren.push(...grandChildren);
  }

  return allChildren;
}

// Helper function for testing - basic assignment creation (kept for backward compatibility)
export async function createDepartmentAssignment(assignment: { teamMemberId: number; departmentId: number; assignedBy?: number }, auditContext?: { userId?: number; ipAddress?: string; userAgent?: string }): Promise<void> {
  await assignMemberToDepartment(assignment, auditContext);
}

// Department Reporting and Statistics

export interface DepartmentStats {
  totalDepartments: number;
  totalAssignedMembers: number;
  totalUnassignedMembers: number;
  averageDepartmentSize: number;
  maxHierarchyDepth: number;
  departmentSizeDistribution: { departmentId: number; departmentName: string; memberCount: number }[];
  hierarchyMetrics: {
    rootDepartments: number;
    departmentsWithChildren: number;
    departmentsWithoutChildren: number;
  };
}

export async function getDepartmentStats(): Promise<DepartmentStats> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Get all departments
  const allDepartments = await getDepartments();
  const totalDepartments = allDepartments.length;

  // Get all team members
  const allTeamMembers = await getTeamMembers();
  const totalTeamMembers = allTeamMembers.length;

  // Get unassigned members
  const unassignedMembers = await getUnassignedTeamMembers();
  const totalUnassignedMembers = unassignedMembers.length;
  const totalAssignedMembers = totalTeamMembers - totalUnassignedMembers;

  // Calculate department size distribution
  const departmentSizeDistribution: { departmentId: number; departmentName: string; memberCount: number }[] = [];
  let totalMembersInDepartments = 0;

  for (const dept of allDepartments) {
    const members = await getDepartmentMembers(dept.id);
    const memberCount = members.length;
    departmentSizeDistribution.push({
      departmentId: dept.id,
      departmentName: dept.name,
      memberCount: memberCount
    });
    totalMembersInDepartments += memberCount;
  }

  // Calculate average department size
  const averageDepartmentSize = totalDepartments > 0 ? totalMembersInDepartments / totalDepartments : 0;

  // Calculate hierarchy metrics
  const rootDepartments = allDepartments.filter(dept => dept.parentId === null).length;
  const departmentsWithChildren = new Set<number>();
  
  for (const dept of allDepartments) {
    if (dept.parentId !== null) {
      departmentsWithChildren.add(dept.parentId);
    }
  }

  const departmentsWithChildrenCount = departmentsWithChildren.size;
  const departmentsWithoutChildren = totalDepartments - departmentsWithChildrenCount;

  // Calculate maximum hierarchy depth
  let maxHierarchyDepth = 0;
  for (const dept of allDepartments) {
    const depth = await calculateDepartmentDepth(dept.id);
    maxHierarchyDepth = Math.max(maxHierarchyDepth, depth);
  }

  return {
    totalDepartments,
    totalAssignedMembers,
    totalUnassignedMembers,
    averageDepartmentSize: Math.round(averageDepartmentSize * 100) / 100, // Round to 2 decimal places
    maxHierarchyDepth,
    departmentSizeDistribution: departmentSizeDistribution.sort((a, b) => b.memberCount - a.memberCount), // Sort by member count descending
    hierarchyMetrics: {
      rootDepartments,
      departmentsWithChildren: departmentsWithChildrenCount,
      departmentsWithoutChildren
    }
  };
}

async function calculateDepartmentDepth(departmentId: number): Promise<number> {
  const db = await getDb();
  if (!db) {
    return 0;
  }

  let depth = 0;
  let currentId: number | null = departmentId;

  while (currentId !== null) {
    const dept = await getDepartmentById(currentId);
    if (!dept) {
      break;
    }
    
    if (dept.parentId === null) {
      depth++; // Count the root level
      break;
    }
    
    depth++;
    currentId = dept.parentId;
  }

  return depth;
}

export interface TeamMemberDistributionReport {
  totalTeamMembers: number;
  assignedMembers: number;
  unassignedMembers: number;
  departmentDistribution: {
    departmentId: number;
    departmentName: string;
    memberCount: number;
    members: TeamMember[];
  }[];
  unassignedMembersList: TeamMember[];
}

export async function getTeamMemberDistributionReport(): Promise<TeamMemberDistributionReport> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Get all team members and unassigned members
  const allTeamMembers = await getTeamMembers();
  const unassignedMembers = await getUnassignedTeamMembers();
  
  const totalTeamMembers = allTeamMembers.length;
  const unassignedCount = unassignedMembers.length;
  const assignedCount = totalTeamMembers - unassignedCount;

  // Get all departments and their members
  const allDepartments = await getDepartments();
  const departmentDistribution: {
    departmentId: number;
    departmentName: string;
    memberCount: number;
    members: TeamMember[];
  }[] = [];

  for (const dept of allDepartments) {
    const members = await getDepartmentMembers(dept.id);
    departmentDistribution.push({
      departmentId: dept.id,
      departmentName: dept.name,
      memberCount: members.length,
      members: members
    });
  }

  // Sort by member count descending
  departmentDistribution.sort((a, b) => b.memberCount - a.memberCount);

  return {
    totalTeamMembers,
    assignedMembers: assignedCount,
    unassignedMembers: unassignedCount,
    departmentDistribution,
    unassignedMembersList: unassignedMembers
  };
}

// Department Export Functionality

export interface DepartmentExportData {
  exportMetadata: {
    exportDate: Date;
    exportedBy?: string;
    totalDepartments: number;
    totalTeamMembers: number;
    totalAssignments: number;
  };
  departments: {
    id: number;
    name: string;
    description: string | null;
    parentId: number | null;
    parentName?: string;
    managerId: number | null;
    managerName?: string;
    createdAt: Date;
    updatedAt: Date;
    memberCount: number;
    currentMembers: {
      id: number;
      name: string;
      position: string;
      email: string | null;
      phone: string | null;
      assignedAt: Date;
      assignedBy?: string;
    }[];
  }[];
  hierarchyStructure: DepartmentHierarchyNode[];
  assignmentHistory: {
    id: number;
    teamMemberId: number;
    teamMemberName: string;
    departmentId: number;
    departmentName: string;
    assignedAt: Date;
    assignedBy: number | null;
    assignedByName?: string;
    isActive: boolean;
  }[];
  unassignedMembers: {
    id: number;
    name: string;
    position: string;
    email: string | null;
    phone: string | null;
    createdAt: Date;
  }[];
}

export async function exportDepartmentData(options?: {
  includeHistoricalData?: boolean;
  exportedBy?: string;
}): Promise<DepartmentExportData> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const includeHistoricalData = options?.includeHistoricalData ?? true;
  const exportedBy = options?.exportedBy;

  // Get all departments with enhanced information
  const allDepartments = await getDepartments();
  const hierarchyStructure = await getDepartmentHierarchy();
  const unassignedMembers = await getUnassignedTeamMembers();

  // Build enhanced department data
  const departmentsWithDetails: DepartmentExportData['departments'] = [];
  
  for (const dept of allDepartments) {
    // Get current members
    const currentMembers = await getDepartmentMembers(dept.id);
    
    // Get parent name if exists
    let parentName: string | undefined;
    if (dept.parentId) {
      const parent = await getDepartmentById(dept.parentId);
      parentName = parent?.name;
    }

    // Get manager name if exists
    let managerName: string | undefined;
    if (dept.managerId) {
      const manager = await getTeamMemberById(dept.managerId);
      managerName = manager?.name;
    }

    // Get assignment details for current members
    const membersWithAssignmentDetails = await Promise.all(
      currentMembers.map(async (member) => {
        const currentAssignment = await getTeamMemberCurrentAssignment(member.id);
        let assignedByName: string | undefined;
        
        if (currentAssignment?.assignment.assignedBy) {
          const assignedByMember = await getTeamMemberById(currentAssignment.assignment.assignedBy);
          assignedByName = assignedByMember?.name;
        }

        return {
          id: member.id,
          name: member.name,
          position: member.position,
          email: member.email,
          phone: member.phone,
          assignedAt: currentAssignment?.assignment.assignedAt || new Date(),
          assignedBy: assignedByName
        };
      })
    );

    departmentsWithDetails.push({
      id: dept.id,
      name: dept.name,
      description: dept.description,
      parentId: dept.parentId,
      parentName,
      managerId: dept.managerId,
      managerName,
      createdAt: dept.createdAt,
      updatedAt: dept.updatedAt,
      memberCount: currentMembers.length,
      currentMembers: membersWithAssignmentDetails
    });
  }

  // Get assignment history if requested
  let assignmentHistory: DepartmentExportData['assignmentHistory'] = [];
  
  if (includeHistoricalData) {
    const allAssignments = await db
      .select({
        assignment: departmentAssignments,
        teamMember: teamMembers,
        department: departments,
      })
      .from(departmentAssignments)
      .innerJoin(teamMembers, eq(departmentAssignments.teamMemberId, teamMembers.id))
      .innerJoin(departments, eq(departmentAssignments.departmentId, departments.id))
      .orderBy(departmentAssignments.assignedAt);

    assignmentHistory = await Promise.all(
      allAssignments.map(async (record) => {
        let assignedByName: string | undefined;
        if (record.assignment.assignedBy) {
          const assignedByMember = await getTeamMemberById(record.assignment.assignedBy);
          assignedByName = assignedByMember?.name;
        }

        return {
          id: record.assignment.id,
          teamMemberId: record.assignment.teamMemberId,
          teamMemberName: record.teamMember.name,
          departmentId: record.assignment.departmentId,
          departmentName: record.department.name,
          assignedAt: record.assignment.assignedAt,
          assignedBy: record.assignment.assignedBy,
          assignedByName,
          isActive: record.assignment.isActive
        };
      })
    );
  }

  // Get total assignment count
  const totalAssignments = await db
    .select({ count: departmentAssignments.id })
    .from(departmentAssignments);

  // Prepare unassigned members with full details
  const unassignedMembersWithDetails = unassignedMembers.map(member => ({
    id: member.id,
    name: member.name,
    position: member.position,
    email: member.email,
    phone: member.phone,
    createdAt: member.createdAt
  }));

  return {
    exportMetadata: {
      exportDate: new Date(),
      exportedBy,
      totalDepartments: allDepartments.length,
      totalTeamMembers: (await getTeamMembers()).length,
      totalAssignments: totalAssignments.length
    },
    departments: departmentsWithDetails,
    hierarchyStructure,
    assignmentHistory,
    unassignedMembers: unassignedMembersWithDetails
  };
}

export async function exportDepartmentDataAsJSON(options?: {
  includeHistoricalData?: boolean;
  exportedBy?: string;
}): Promise<string> {
  const data = await exportDepartmentData(options);
  return JSON.stringify(data, null, 2);
}

export async function exportDepartmentDataAsCSV(options?: {
  includeHistoricalData?: boolean;
  exportedBy?: string;
}): Promise<{
  departments: string;
  assignments: string;
  unassignedMembers: string;
}> {
  const data = await exportDepartmentData(options);

  // Export departments as CSV
  const departmentHeaders = [
    'ID', 'Name', 'Description', 'Parent ID', 'Parent Name', 
    'Manager ID', 'Manager Name', 'Member Count', 'Created At', 'Updated At'
  ];
  
  const departmentRows = data.departments.map(dept => [
    dept.id.toString(),
    `"${dept.name}"`,
    dept.description ? `"${dept.description}"` : '',
    dept.parentId?.toString() || '',
    dept.parentName ? `"${dept.parentName}"` : '',
    dept.managerId?.toString() || '',
    dept.managerName ? `"${dept.managerName}"` : '',
    dept.memberCount.toString(),
    dept.createdAt.toISOString(),
    dept.updatedAt.toISOString()
  ]);

  const departmentsCSV = [departmentHeaders.join(','), ...departmentRows.map(row => row.join(','))].join('\n');

  // Export assignments as CSV (if historical data included)
  let assignmentsCSV = '';
  if (options?.includeHistoricalData !== false) {
    const assignmentHeaders = [
      'ID', 'Team Member ID', 'Team Member Name', 'Department ID', 
      'Department Name', 'Assigned At', 'Assigned By ID', 'Assigned By Name', 'Is Active'
    ];
    
    const assignmentRows = data.assignmentHistory.map(assignment => [
      assignment.id.toString(),
      assignment.teamMemberId.toString(),
      `"${assignment.teamMemberName}"`,
      assignment.departmentId.toString(),
      `"${assignment.departmentName}"`,
      assignment.assignedAt.toISOString(),
      assignment.assignedBy?.toString() || '',
      assignment.assignedByName ? `"${assignment.assignedByName}"` : '',
      assignment.isActive.toString()
    ]);

    assignmentsCSV = [assignmentHeaders.join(','), ...assignmentRows.map(row => row.join(','))].join('\n');
  }

  // Export unassigned members as CSV
  const unassignedHeaders = ['ID', 'Name', 'Position', 'Email', 'Phone', 'Created At'];
  const unassignedRows = data.unassignedMembers.map(member => [
    member.id.toString(),
    `"${member.name}"`,
    `"${member.position}"`,
    member.email ? `"${member.email}"` : '',
    member.phone ? `"${member.phone}"` : '',
    member.createdAt.toISOString()
  ]);

  const unassignedMembersCSV = [unassignedHeaders.join(','), ...unassignedRows.map(row => row.join(','))].join('\n');

  return {
    departments: departmentsCSV,
    assignments: assignmentsCSV,
    unassignedMembers: unassignedMembersCSV
  };
}
// Historical Reporting Functions

export interface AssignmentHistoryReport {
  assignments: {
    id: number;
    teamMemberId: number;
    teamMemberName: string;
    departmentId: number;
    departmentName: string;
    assignedAt: Date;
    assignedBy?: number;
    assignedByName?: string;
    isActive: boolean;
  }[];
  totalAssignments: number;
  uniqueMembers: number;
  uniqueDepartments: number;
}

export async function getAssignmentHistoryReport(filters: {
  teamMemberId?: number;
  departmentId?: number;
  startDate?: string;
  endDate?: string;
}): Promise<AssignmentHistoryReport> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  let query = db
    .select({
      assignment: departmentAssignments,
      teamMember: teamMembers,
      department: departments,
    })
    .from(departmentAssignments)
    .innerJoin(teamMembers, eq(departmentAssignments.teamMemberId, teamMembers.id))
    .innerJoin(departments, eq(departmentAssignments.departmentId, departments.id))
    .$dynamic();

  // Apply filters
  const conditions = [];
  if (filters.teamMemberId) {
    conditions.push(eq(departmentAssignments.teamMemberId, filters.teamMemberId));
  }
  if (filters.departmentId) {
    conditions.push(eq(departmentAssignments.departmentId, filters.departmentId));
  }
  if (filters.startDate) {
    conditions.push(gte(departmentAssignments.assignedAt, new Date(filters.startDate)));
  }
  if (filters.endDate) {
    conditions.push(lte(departmentAssignments.assignedAt, new Date(filters.endDate)));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const results = await query.orderBy(desc(departmentAssignments.assignedAt));

  const assignments = await Promise.all(
    results.map(async (result) => {
      let assignedByName: string | undefined;
      if (result.assignment.assignedBy) {
        const assignedByMember = await getTeamMemberById(result.assignment.assignedBy);
        assignedByName = assignedByMember?.name;
      }

      return {
        id: result.assignment.id,
        teamMemberId: result.assignment.teamMemberId,
        teamMemberName: result.teamMember.name,
        departmentId: result.assignment.departmentId,
        departmentName: result.department.name,
        assignedAt: result.assignment.assignedAt,
        assignedBy: result.assignment.assignedBy || undefined,
        assignedByName,
        isActive: result.assignment.isActive,
      };
    })
  );

  const uniqueMembers = new Set(assignments.map(a => a.teamMemberId)).size;
  const uniqueDepartments = new Set(assignments.map(a => a.departmentId)).size;

  return {
    assignments,
    totalAssignments: assignments.length,
    uniqueMembers,
    uniqueDepartments,
  };
}

export interface DepartmentTrendsReport {
  departmentId?: number;
  departmentName?: string;
  timeRange: string;
  trends: {
    date: string;
    memberCount: number;
    newAssignments: number;
    departures: number;
  }[];
  summary: {
    totalPeriods: number;
    averageMemberCount: number;
    totalNewAssignments: number;
    totalDepartures: number;
    netChange: number;
  };
}

export async function getDepartmentTrendsReport(filters: {
  departmentId?: number;
  timeRange?: '30d' | '90d' | '1y' | 'all';
}): Promise<DepartmentTrendsReport> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const timeRange = filters.timeRange || '90d';
  let startDate: Date;
  const endDate = new Date();

  switch (timeRange) {
    case '30d':
      startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date('2020-01-01'); // Far back date for 'all'
  }

  let departmentName: string | undefined;
  if (filters.departmentId) {
    const dept = await getDepartmentById(filters.departmentId);
    departmentName = dept?.name;
  }

  // Get all assignments within the time range
  let query = db
    .select({
      assignment: departmentAssignments,
      department: departments,
    })
    .from(departmentAssignments)
    .innerJoin(departments, eq(departmentAssignments.departmentId, departments.id))
    .$dynamic();

  const conditions = [gte(departmentAssignments.assignedAt, startDate)];
  if (filters.departmentId) {
    conditions.push(eq(departmentAssignments.departmentId, filters.departmentId));
  }

  query = query.where(and(...conditions));

  const assignments = await query.orderBy(departmentAssignments.assignedAt);

  // Group assignments by week for trend analysis
  const weeklyData = new Map<string, {
    memberCount: number;
    newAssignments: number;
    departures: number;
  }>();

  // Initialize weekly buckets
  const current = new Date(startDate);
  while (current <= endDate) {
    const weekKey = current.toISOString().split('T')[0];
    weeklyData.set(weekKey, {
      memberCount: 0,
      newAssignments: 0,
      departures: 0,
    });
    current.setDate(current.getDate() + 7); // Move to next week
  }

  // Process assignments to calculate trends
  for (const { assignment } of assignments) {
    const assignmentDate = new Date(assignment.assignedAt);
    const weekKey = assignmentDate.toISOString().split('T')[0];
    
    // Find the closest week bucket
    let closestWeek = weekKey;
    let minDiff = Infinity;
    for (const week of Array.from(weeklyData.keys())) {
      const diff = Math.abs(new Date(week).getTime() - assignmentDate.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        closestWeek = week;
      }
    }

    const weekData = weeklyData.get(closestWeek);
    if (weekData) {
      if (assignment.isActive) {
        weekData.newAssignments++;
        weekData.memberCount++;
      } else {
        weekData.departures++;
      }
    }
  }

  const trends = Array.from(weeklyData.entries()).map(([date, data]) => ({
    date,
    ...data,
  }));

  const summary = {
    totalPeriods: trends.length,
    averageMemberCount: trends.reduce((sum, t) => sum + t.memberCount, 0) / trends.length || 0,
    totalNewAssignments: trends.reduce((sum, t) => sum + t.newAssignments, 0),
    totalDepartures: trends.reduce((sum, t) => sum + t.departures, 0),
    netChange: trends.reduce((sum, t) => sum + t.newAssignments - t.departures, 0),
  };

  return {
    departmentId: filters.departmentId,
    departmentName,
    timeRange,
    trends,
    summary,
  };
}

export interface MemberMovementPatternsReport {
  timeRange: string;
  patterns: {
    fromDepartmentId: number | null;
    fromDepartmentName: string | null;
    toDepartmentId: number;
    toDepartmentName: string;
    movementCount: number;
    memberIds: number[];
  }[];
  summary: {
    totalMovements: number;
    mostCommonSource: string | null;
    mostCommonDestination: string | null;
    averageMovementsPerMember: number;
  };
}

export async function getMemberMovementPatternsReport(filters: {
  timeRange?: '30d' | '90d' | '1y' | 'all';
}): Promise<MemberMovementPatternsReport> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const timeRange = filters.timeRange || '90d';
  let startDate: Date;
  const endDate = new Date();

  switch (timeRange) {
    case '30d':
      startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date('2020-01-01'); // Far back date for 'all'
  }

  // Get all team members and their assignment history
  const allMembers = await getTeamMembers();
  const movementPatterns = new Map<string, {
    fromDepartmentId: number | null;
    fromDepartmentName: string | null;
    toDepartmentId: number;
    toDepartmentName: string;
    memberIds: Set<number>;
  }>();

  for (const member of allMembers) {
    const history = await getTeamMemberAssignmentHistory(member.id);
    
    // Filter history by date range
    const filteredHistory = history.filter(h => 
      h.assignment.assignedAt >= startDate && h.assignment.assignedAt <= endDate
    );

    // Analyze movements (transitions between departments)
    for (let i = 1; i < filteredHistory.length; i++) {
      const previousAssignment = filteredHistory[i - 1];
      const currentAssignment = filteredHistory[i];

      const patternKey = `${previousAssignment.department.id}->${currentAssignment.department.id}`;
      
      if (!movementPatterns.has(patternKey)) {
        movementPatterns.set(patternKey, {
          fromDepartmentId: previousAssignment.department.id,
          fromDepartmentName: previousAssignment.department.name,
          toDepartmentId: currentAssignment.department.id,
          toDepartmentName: currentAssignment.department.name,
          memberIds: new Set(),
        });
      }

      movementPatterns.get(patternKey)!.memberIds.add(member.id);
    }

    // Also track initial assignments (from null to first department)
    if (filteredHistory.length > 0) {
      const firstAssignment = filteredHistory[0];
      const patternKey = `null->${firstAssignment.department.id}`;
      
      if (!movementPatterns.has(patternKey)) {
        movementPatterns.set(patternKey, {
          fromDepartmentId: null,
          fromDepartmentName: null,
          toDepartmentId: firstAssignment.department.id,
          toDepartmentName: firstAssignment.department.name,
          memberIds: new Set(),
        });
      }

      movementPatterns.get(patternKey)!.memberIds.add(member.id);
    }
  }

  const patterns = Array.from(movementPatterns.values()).map(pattern => ({
    ...pattern,
    movementCount: pattern.memberIds.size,
    memberIds: Array.from(pattern.memberIds),
  })).sort((a, b) => b.movementCount - a.movementCount);

  // Calculate summary statistics
  const totalMovements = patterns.reduce((sum, p) => sum + p.movementCount, 0);
  
  const destinationCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  
  patterns.forEach(pattern => {
    const destKey = pattern.toDepartmentName;
    const sourceKey = pattern.fromDepartmentName || 'New Hire';
    
    destinationCounts.set(destKey, (destinationCounts.get(destKey) || 0) + pattern.movementCount);
    sourceCounts.set(sourceKey, (sourceCounts.get(sourceKey) || 0) + pattern.movementCount);
  });

  const mostCommonDestination = Array.from(destinationCounts.entries())
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  
  const mostCommonSource = Array.from(sourceCounts.entries())
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const uniqueMembers = new Set(patterns.flatMap(p => p.memberIds)).size;
  const averageMovementsPerMember = uniqueMembers > 0 ? totalMovements / uniqueMembers : 0;

  return {
    timeRange,
    patterns,
    summary: {
      totalMovements,
      mostCommonSource,
      mostCommonDestination,
      averageMovementsPerMember,
    },
  };
}


// ============================================================================
// Team Collaboration System
// ============================================================================

// Team Role Permissions
export const TEAM_PERMISSIONS = {
  admin: ['create_team', 'delete_team', 'update_team', 'invite_member', 'remove_member', 'change_role', 'create_task', 'update_task', 'delete_task', 'manage_repositories'],
  team_lead: ['update_team', 'invite_member', 'create_task', 'update_task', 'delete_task', 'manage_repositories'],
  developer: ['create_task', 'update_task'],
  viewer: []
} as const;

export type TeamRole = keyof typeof TEAM_PERMISSIONS;

export function hasPermission(role: TeamRole, permission: string): boolean {
  const rolePermissions = TEAM_PERMISSIONS[role];
  return (rolePermissions as readonly string[]).includes(permission);
}

// Team CRUD Operations

/**
 * Create a new team with automatic admin role assignment for the creator
 * Requirement 2.1: Team creation with automatic admin role assignment
 */
export async function createTeam(
  team: Omit<InsertTeam, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
  creatorId: number
): Promise<Team & { memberRole: TeamRole }> {
  return await withTransaction(async (db) => {
    // Create the team
    const [newTeam] = await db.insert(teams).values({
      name: team.name,
      description: team.description,
      ownerId: creatorId,
    }).returning();

    // Automatically assign creator as admin
    await db.insert(teamMembersCollaborative).values({
      teamId: newTeam.id,
      userId: creatorId,
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
      ownerId: teams.ownerId,
      createdAt: teams.createdAt,
      updatedAt: teams.updatedAt,
      memberRole: teamMembersCollaborative.role,
      memberCount: sql<number>`count(distinct ${teamMembersCollaborative.userId})`,
    })
    .from(teams)
    .innerJoin(teamMembersCollaborative, eq(teams.id, teamMembersCollaborative.teamId))
    .where(eq(teamMembersCollaborative.userId, userId))
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
      ownerId: teams.ownerId,
      createdAt: teams.createdAt,
      updatedAt: teams.updatedAt,
      memberRole: teamMembersCollaborative.role,
    })
    .from(teams)
    .leftJoin(
      teamMembersCollaborative,
      and(
        eq(teams.id, teamMembersCollaborative.teamId),
        eq(teamMembersCollaborative.userId, userId)
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
  updates: Partial<Omit<InsertTeam, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>>,
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
          eq(teamMembersCollaborative.userId, userId)
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
          eq(teamMembersCollaborative.userId, userId)
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
): Promise<(TeamMemberCollaborative & { user: typeof users.$inferSelect })[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const result = await db
    .select({
      id: teamMembersCollaborative.id,
      teamId: teamMembersCollaborative.teamId,
      userId: teamMembersCollaborative.userId,
      role: teamMembersCollaborative.role,
      joinedAt: teamMembersCollaborative.joinedAt,
      user: users,
    })
    .from(teamMembersCollaborative)
    .innerJoin(users, eq(teamMembersCollaborative.userId, users.id))
    .where(eq(teamMembersCollaborative.teamId, teamId));

  return result;
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
    role: TeamRole;
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
          eq(teamMembersCollaborative.userId, invitation.invitedBy)
        )
      )
      .limit(1);

    if (!membership || !hasPermission(membership.role as TeamRole, 'invite_member')) {
      throw new ValidationError('Insufficient permissions to invite members');
    }

    // Check if user is already a member
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, invitation.email))
      .limit(1);

    if (existingUser.length > 0) {
      const [existingMembership] = await db
        .select()
        .from(teamMembersCollaborative)
        .where(
          and(
            eq(teamMembersCollaborative.teamId, invitation.teamId),
            eq(teamMembersCollaborative.userId, existingUser[0].id)
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
        role: invitation.role,
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
        isNull(teamInvitations.acceptedAt)
      )
    );
}

/**
 * Accept a team invitation
 * Requirement 2.3: Invitation acceptance with role assignment
 */
export async function acceptTeamInvitation(
  token: string,
  userId: number
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

    if (invitation.acceptedAt) {
      throw new ConflictError('Invitation already accepted');
    }

    if (invitation.expiresAt < new Date()) {
      throw new ValidationError('Invitation has expired');
    }

    // Verify user email matches invitation
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || user.email !== invitation.email) {
      throw new ValidationError('User email does not match invitation');
    }

    // Check if already a member
    const [existingMembership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, invitation.teamId),
          eq(teamMembersCollaborative.userId, userId)
        )
      )
      .limit(1);

    if (existingMembership) {
      throw new ConflictError('User is already a member of this team');
    }

    // Add user to team with specified role
    const [newMember] = await db
      .insert(teamMembersCollaborative)
      .values({
        teamId: invitation.teamId,
        userId,
        role: invitation.role,
      })
      .returning();

    // Mark invitation as accepted
    await db
      .update(teamInvitations)
      .set({ acceptedAt: new Date() })
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
  targetUserId: number,
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
          eq(teamMembersCollaborative.userId, changedBy)
        )
      )
      .limit(1);

    if (!changerMembership || !hasPermission(changerMembership.role as TeamRole, 'change_role')) {
      throw new ValidationError('Insufficient permissions to change member role');
    }

    // Cannot change team owner's role
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (team.ownerId === targetUserId) {
      throw new ValidationError('Cannot change team owner role');
    }

    // Update role
    const [updated] = await db
      .update(teamMembersCollaborative)
      .set({ role: newRole })
      .where(
        and(
          eq(teamMembersCollaborative.teamId, teamId),
          eq(teamMembersCollaborative.userId, targetUserId)
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
  targetUserId: number,
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
          eq(teamMembersCollaborative.userId, removedBy)
        )
      )
      .limit(1);

    if (!removerMembership || !hasPermission(removerMembership.role as TeamRole, 'remove_member')) {
      throw new ValidationError('Insufficient permissions to remove member');
    }

    // Cannot remove team owner
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (team.ownerId === targetUserId) {
      throw new ValidationError('Cannot remove team owner');
    }

    // Remove member
    await db
      .delete(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, teamId),
          eq(teamMembersCollaborative.userId, targetUserId)
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
        eq(teamMembersCollaborative.userId, userId)
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
  task: Omit<InsertTask, 'id' | 'createdAt' | 'updatedAt' | 'position'>,
  creatorId: number
): Promise<Task> {
  return await withTransaction(async (db) => {
    // Validate team exists and user has permission
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
          eq(teamMembersCollaborative.userId, creatorId)
        )
      )
      .limit(1);

    if (!membership || !hasPermission(membership.role as TeamRole, 'create_task')) {
      throw new ValidationError('Insufficient permissions to create task. Developer role or higher required.');
    }

    // Validate assignee if provided
    if (task.assigneeId) {
      const [assignee] = await db
        .select()
        .from(teamMembersCollaborative)
        .where(
          and(
            eq(teamMembersCollaborative.teamId, task.teamId),
            eq(teamMembersCollaborative.userId, task.assigneeId)
          )
        )
        .limit(1);

      if (!assignee) {
        throw new NotFoundError(`Assignee with ID ${task.assigneeId} is not a member of this team`);
      }
    }

    // Get the highest position in the status column
    const [maxPosition] = await db
      .select({ max: sql<number>`MAX(${tasks.position})` })
      .from(tasks)
      .where(
        and(
          eq(tasks.teamId, task.teamId),
          eq(tasks.status, task.status)
        )
      );

    const position = (maxPosition?.max ?? -1) + 1;

    // Create task
    const [created] = await db
      .insert(tasks)
      .values({
        ...task,
        position,
        updatedAt: new Date(),
      })
      .returning();

    // Create activity log
    await db.insert(activities).values({
      teamId: task.teamId,
      userId: creatorId,
      type: 'task_created',
      entityId: created.id.toString(),
      entityType: 'task',
      metadata: JSON.stringify({
        taskTitle: task.title,
        status: task.status,
        priority: task.priority,
      }),
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
    assigneeId?: number;
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
  if (filters?.assigneeId) {
    conditions.push(eq(tasks.assigneeId, filters.assigneeId));
  }
  if (filters?.priority) {
    conditions.push(eq(tasks.priority, filters.priority));
  }

  return await db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(tasks.position);
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
  updates: Partial<Omit<InsertTask, 'id' | 'teamId' | 'createdAt' | 'updatedAt' | 'position'>>,
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

    // Check user has permission
    const [membership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, existingTask.teamId),
          eq(teamMembersCollaborative.userId, updatedBy)
        )
      )
      .limit(1);

    if (!membership || !hasPermission(membership.role as TeamRole, 'update_task')) {
      throw new ValidationError('Insufficient permissions to update task');
    }

    // Validate assignee if being updated
    if (updates.assigneeId !== undefined && updates.assigneeId !== null) {
      const [assignee] = await db
        .select()
        .from(teamMembersCollaborative)
        .where(
          and(
            eq(teamMembersCollaborative.teamId, existingTask.teamId),
            eq(teamMembersCollaborative.userId, updates.assigneeId)
          )
        )
        .limit(1);

      if (!assignee) {
        throw new NotFoundError(`Assignee with ID ${updates.assigneeId} is not a member of this team`);
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
    if (updates.assigneeId !== undefined) changedFields.push('assignee');
    if (updates.priority !== undefined) changedFields.push('priority');
    if (updates.status !== undefined) changedFields.push('status');
    if (updates.dueDate !== undefined) changedFields.push('dueDate');

    if (changedFields.length > 0) {
      await db.insert(activities).values({
        teamId: existingTask.teamId,
        userId: updatedBy,
        type: 'task_updated',
        entityId: taskId.toString(),
        entityType: 'task',
        metadata: JSON.stringify({
          taskTitle: updated.title,
          changedFields,
          previousValues: {
            title: existingTask.title,
            status: existingTask.status,
            priority: existingTask.priority,
            assigneeId: existingTask.assigneeId,
          },
          newValues: updates,
        }),
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

    // Check user has permission
    const [membership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, existingTask.teamId),
          eq(teamMembersCollaborative.userId, deletedBy)
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
      entityId: taskId.toString(),
      entityType: 'task',
      metadata: JSON.stringify({
        taskTitle: existingTask.title,
        status: existingTask.status,
        priority: existingTask.priority,
      }),
    });

    // Broadcast task deleted event to team members (real-time sync)
    broadcastTaskDeleted(existingTask.teamId, taskId);

    return true;
  });
}

/**
 * Move a task to a new position/status
 * Requirement 3.2: Task movement with real-time updates
 */
export async function moveTask(
  taskId: number,
  newStatus: string,
  newPosition: number,
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

    // Check user has permission
    const [membership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, existingTask.teamId),
          eq(teamMembersCollaborative.userId, movedBy)
        )
      )
      .limit(1);

    if (!membership || !hasPermission(membership.role as TeamRole, 'update_task')) {
      throw new ValidationError('Insufficient permissions to move task');
    }

    const statusChanged = existingTask.status !== newStatus;

    // If moving to a different status column, adjust positions
    if (statusChanged) {
      // Get all tasks in the new status column
      const tasksInNewColumn = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.teamId, existingTask.teamId),
            eq(tasks.status, newStatus)
          )
        )
        .orderBy(tasks.position);

      // Shift positions to make room
      for (let i = tasksInNewColumn.length - 1; i >= newPosition; i--) {
        await db
          .update(tasks)
          .set({ position: i + 1 })
          .where(eq(tasks.id, tasksInNewColumn[i].id));
      }

      // Get all tasks in the old status column
      const tasksInOldColumn = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.teamId, existingTask.teamId),
            eq(tasks.status, existingTask.status),
            sql`${tasks.id} != ${taskId}`
          )
        )
        .orderBy(tasks.position);

      // Compact positions in old column
      for (let i = 0; i < tasksInOldColumn.length; i++) {
        await db
          .update(tasks)
          .set({ position: i })
          .where(eq(tasks.id, tasksInOldColumn[i].id));
      }
    } else {
      // Moving within the same column
      const tasksInColumn = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.teamId, existingTask.teamId),
            eq(tasks.status, existingTask.status),
            sql`${tasks.id} != ${taskId}`
          )
        )
        .orderBy(tasks.position);

      // Reorder tasks
      const reordered: Task[] = [];
      for (let i = 0; i < tasksInColumn.length; i++) {
        if (i === newPosition) {
          reordered.push(existingTask);
        }
        reordered.push(tasksInColumn[i]);
      }
      if (newPosition >= tasksInColumn.length) {
        reordered.push(existingTask);
      }

      // Update positions
      for (let i = 0; i < reordered.length; i++) {
        await db
          .update(tasks)
          .set({ position: i })
          .where(eq(tasks.id, reordered[i].id));
      }
    }

    // Update the moved task
    const [updated] = await db
      .update(tasks)
      .set({
        status: newStatus,
        position: newPosition,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId))
      .returning();

    // Create activity log
    await db.insert(activities).values({
      teamId: existingTask.teamId,
      userId: movedBy,
      type: 'task_moved',
      entityId: taskId.toString(),
      entityType: 'task',
      metadata: JSON.stringify({
        taskTitle: existingTask.title,
        previousStatus: existingTask.status,
        newStatus: newStatus,
        previousPosition: existingTask.position,
        newPosition: newPosition,
      }),
    });

    // Broadcast task moved event to team members (real-time sync)
    broadcastTaskMoved(existingTask.teamId, taskId, newStatus, newPosition);

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
        eq(activities.entityId, taskId.toString()),
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
          eq(teamMembersCollaborative.userId, userId)
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
          eq(repositories.githubId, metadata.id)
        )
      )
      .limit(1);

    if (existing) {
      throw new ConflictError('Repository already connected to this team');
    }

    // Encrypt access token
    const encryptedToken = encrypt(accessToken);

    // Generate webhook secret
    const webhookSecret = generateToken(32);

    // Create repository record
    const [created] = await db
      .insert(repositories)
      .values({
        teamId,
        githubId: metadata.id,
        name: metadata.name,
        fullName: metadata.fullName,
        url: metadata.url,
        accessToken: encryptedToken,
        webhookSecret,
        lastSyncAt: new Date(),
      })
      .returning();

    // Create activity log
    await db.insert(activities).values({
      teamId,
      userId,
      type: 'repository_connected',
      entityId: created.id.toString(),
      entityType: 'repository',
      metadata: JSON.stringify({
        repositoryName: metadata.fullName,
        repositoryUrl: metadata.url,
      }),
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
  updates: Partial<Pick<InsertRepository, 'name' | 'fullName' | 'url' | 'lastSyncAt'>>,
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

    // Check user has permission
    const [membership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, existingRepo.teamId),
          eq(teamMembersCollaborative.userId, userId)
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

    // Check user has permission
    const [membership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, existingRepo.teamId),
          eq(teamMembersCollaborative.userId, userId)
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
      entityId: repositoryId.toString(),
      entityType: 'repository',
      metadata: JSON.stringify({
        repositoryName: existingRepo.fullName,
        repositoryUrl: existingRepo.url,
      }),
    });

    return true;
  });
}

/**
 * Link a GitHub PR to a task (bidirectional linking)
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

    // Check user has permission
    const [membership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, existingTask.teamId),
          eq(teamMembersCollaborative.userId, userId)
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

    // Update task with PR URL
    const [updated] = await db
      .update(tasks)
      .set({
        githubPrUrl: prUrl,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId))
      .returning();

    // Create activity log
    await db.insert(activities).values({
      teamId: existingTask.teamId,
      userId,
      type: 'pr_linked',
      entityId: taskId.toString(),
      entityType: 'task',
      metadata: JSON.stringify({
        taskTitle: existingTask.title,
        prUrl,
      }),
    });

    return updated;
  });
}

/**
 * Sync repository data (update lastSyncAt timestamp)
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

    // Check user has permission
    const [membership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, existingRepo.teamId),
          eq(teamMembersCollaborative.userId, userId)
        )
      )
      .limit(1);

    if (!membership) {
      throw new ValidationError('User is not a member of this team');
    }

    // Update lastSyncAt
    const [updated] = await db
      .update(repositories)
      .set({
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(repositories.id, repositoryId))
      .returning();

    // Create activity log
    await db.insert(activities).values({
      teamId: existingRepo.teamId,
      userId,
      type: 'repository_synced',
      entityId: repositoryId.toString(),
      entityType: 'repository',
      metadata: JSON.stringify({
        repositoryName: existingRepo.fullName,
      }),
    });

    return updated;
  });
}

// ============================================================================
// Document Management Functions (Collaborative Code Editor)
// ============================================================================

/**
 * Create a new document for collaborative editing
 * Requirement 5.1: Document creation with team validation
 */
export async function createDocument(
  document: Omit<InsertDocument, 'id' | 'createdAt' | 'updatedAt'>,
  creatorId: number
): Promise<Document> {
  return await withTransaction(async (db) => {
    // Validate team exists and user has permission
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, document.teamId))
      .limit(1);

    if (!team) {
      throw new NotFoundError(`Team with ID ${document.teamId} does not exist`);
    }

    // Check creator is a member of the team
    const [membership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, document.teamId),
          eq(teamMembersCollaborative.userId, creatorId)
        )
      )
      .limit(1);

    if (!membership) {
      throw new ValidationError('User is not a member of this team');
    }

    // Create document
    const [created] = await db
      .insert(documents)
      .values({
        ...document,
        updatedAt: new Date(),
      })
      .returning();

    // Create activity log
    await db.insert(activities).values({
      teamId: document.teamId,
      userId: creatorId,
      type: 'document_created',
      entityId: created.id.toString(),
      entityType: 'document',
      metadata: JSON.stringify({
        documentName: document.name,
      }),
    });

    return created;
  });
}

/**
 * Get documents by team
 * Requirement 5.1: Document retrieval with team filtering
 */
export async function getDocumentsByTeam(teamId: number): Promise<Document[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  return await db
    .select()
    .from(documents)
    .where(eq(documents.teamId, teamId))
    .orderBy(desc(documents.updatedAt));
}

/**
 * Get a document by ID
 * Requirement 5.1: Document retrieval
 */
export async function getDocumentById(documentId: number): Promise<Document | undefined> {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  const [document] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  return document;
}

/**
 * Update document Yjs state (store collaborative editing updates)
 * Requirement 5.2: Yjs state persistence
 */
export async function updateDocumentYjsState(
  documentId: number,
  yjsState: string,
  userId: number
): Promise<Document> {
  return await withTransaction(async (db) => {
    // Get existing document
    const [existingDoc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (!existingDoc) {
      throw new NotFoundError(`Document with ID ${documentId} does not exist`);
    }

    // Check user has permission
    const [membership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, existingDoc.teamId),
          eq(teamMembersCollaborative.userId, userId)
        )
      )
      .limit(1);

    if (!membership) {
      throw new ValidationError('User is not a member of this team');
    }

    // Update document Yjs state
    const [updated] = await db
      .update(documents)
      .set({
        yjsState,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId))
      .returning();

    return updated;
  });
}

/**
 * Delete a document
 * Requirement 5.1: Document deletion with permission checks
 */
export async function deleteDocument(documentId: number, userId: number): Promise<boolean> {
  return await withTransaction(async (db) => {
    // Get existing document
    const [existingDoc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (!existingDoc) {
      throw new NotFoundError(`Document with ID ${documentId} does not exist`);
    }

    // Check user has permission (admin or team_lead can delete)
    const [membership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, existingDoc.teamId),
          eq(teamMembersCollaborative.userId, userId)
        )
      )
      .limit(1);

    if (!membership || !hasPermission(membership.role as TeamRole, 'delete_document')) {
      throw new ValidationError('Insufficient permissions to delete document. Admin or Team Lead role required.');
    }

    // Delete document
    await db.delete(documents).where(eq(documents.id, documentId));

    // Create activity log
    await db.insert(activities).values({
      teamId: existingDoc.teamId,
      userId,
      type: 'document_deleted',
      entityId: documentId.toString(),
      entityType: 'document',
      metadata: JSON.stringify({
        documentName: existingDoc.name,
      }),
    });

    return true;
  });
}

/**
 * Get active users currently editing a document
 * This is a placeholder - actual implementation will use Socket.io presence
 * Requirement 5.3: User presence tracking
 */
export async function getActiveDocumentUsers(documentId: number): Promise<{ userId: number; username: string }[]> {
  // This function will be implemented with Socket.io presence tracking
  // For now, return empty array as the actual presence is tracked in real-time via Socket.io
  return [];
}

/**
 * Requirement 5.1: Document update (rename)
 */
export async function updateDocument(
  documentId: number,
  updates: { name?: string },
  userId: number
): Promise<Document> {
  return await withTransaction(async (db) => {
    // Get existing document
    const existingDocResult = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
    const existingDoc = existingDocResult[0];

    if (!existingDoc) {
      throw new Error('Document not found');
    }

    // Verify user has access to the team
    const teamMemberResult = await db.select().from(teamMembersCollaborative).where(and(
      eq(teamMembersCollaborative.teamId, existingDoc.teamId),
      eq(teamMembersCollaborative.userId, userId)
    )).limit(1);
    const teamMember = teamMemberResult[0];

    if (!teamMember) {
      throw new Error('User does not have access to this document');
    }

    // Update document
    const updatedDoc = await db
      .update(documents)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId))
      .returning();

    return updatedDoc[0];
  });
}
