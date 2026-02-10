import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = sqliteTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: text("openId").unique(),
  /** GitHub OAuth identifier */
  githubId: text("githubId").unique(),
  /** Google OAuth identifier */
  googleId: text("googleId").unique(),
  name: text("name"),
  email: text("email").unique(),
  loginMethod: text("loginMethod"),
  role: text("role").default("user").notNull(),
  /** Bcrypt hash of password for email/password authentication. Nullable for OAuth users. */
  passwordHash: text("passwordHash"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  emailIdx: index("users_email_idx").on(table.email),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const teamMembers = sqliteTable("teamMembers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  position: text("position").notNull(),
  duties: text("duties"),
  email: text("email"),
  phone: text("phone"),
  pictureFileName: text("pictureFileName"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = typeof teamMembers.$inferInsert;

export const departments = sqliteTable("departments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  description: text("description"),
  parentId: integer("parentId"),
  managerId: integer("managerId"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type Department = typeof departments.$inferSelect;
export type InsertDepartment = typeof departments.$inferInsert;

export const departmentAssignments = sqliteTable("departmentAssignments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamMemberId: integer("teamMemberId").notNull().references(() => teamMembers.id, { onDelete: "cascade" }),
  departmentId: integer("departmentId").notNull().references(() => departments.id, { onDelete: "cascade" }),
  assignedAt: integer("assignedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  assignedBy: integer("assignedBy").references(() => teamMembers.id, { onDelete: "set null" }),
  isActive: integer("isActive", { mode: "boolean" }).notNull().default(true),
});

export type DepartmentAssignment = typeof departmentAssignments.$inferSelect;
export type InsertDepartmentAssignment = typeof departmentAssignments.$inferInsert;

export const auditLogs = sqliteTable("auditLogs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  operation: text("operation").notNull(), // CREATE, UPDATE, DELETE, ASSIGN, UNASSIGN, etc.
  entityType: text("entityType").notNull(), // DEPARTMENT, TEAM_MEMBER, ASSIGNMENT
  entityId: integer("entityId").notNull(), // ID of the affected entity
  userId: integer("userId").references(() => teamMembers.id, { onDelete: "set null" }), // Who performed the action
  details: text("details"), // JSON string with operation details
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// Collaborative Development Platform Tables

export const teams = sqliteTable("teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: integer("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type Team = typeof teams.$inferSelect;
export type InsertTeam = typeof teams.$inferInsert;

export const teamMembersCollaborative = sqliteTable("teamMembersCollaborative", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("teamId").notNull().references(() => teams.id, { onDelete: "cascade" }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // admin, team_lead, developer, viewer
  joinedAt: integer("joinedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  teamIdIdx: index("teamMembersCollaborative_teamId_idx").on(table.teamId),
  userIdIdx: index("teamMembersCollaborative_userId_idx").on(table.userId),
}));

export type TeamMemberCollaborative = typeof teamMembersCollaborative.$inferSelect;
export type InsertTeamMemberCollaborative = typeof teamMembersCollaborative.$inferInsert;

export const teamInvitations = sqliteTable("teamInvitations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("teamId").notNull().references(() => teams.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull(), // admin, team_lead, developer, viewer
  token: text("token").notNull().unique(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  acceptedAt: integer("acceptedAt", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type TeamInvitation = typeof teamInvitations.$inferSelect;
export type InsertTeamInvitation = typeof teamInvitations.$inferInsert;

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("teamId").notNull().references(() => teams.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  assigneeId: integer("assigneeId").references(() => users.id, { onDelete: "set null" }),
  priority: text("priority").notNull(), // low, medium, high, urgent
  status: text("status").notNull(), // todo, in_progress, review, done
  position: integer("position").notNull().default(0),
  githubPrUrl: text("githubPrUrl"),
  dueDate: integer("dueDate", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  teamIdIdx: index("tasks_teamId_idx").on(table.teamId),
  assigneeIdIdx: index("tasks_assigneeId_idx").on(table.assigneeId),
  statusIdx: index("tasks_status_idx").on(table.status),
}));

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("teamId").notNull().references(() => teams.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  yjsState: text("yjsState"), // Stored as base64 encoded string
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

export const repositories = sqliteTable("repositories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("teamId").notNull().references(() => teams.id, { onDelete: "cascade" }),
  githubId: integer("githubId").notNull(),
  name: text("name").notNull(),
  fullName: text("fullName").notNull(),
  url: text("url").notNull(),
  accessToken: text("accessToken").notNull(), // Encrypted
  webhookSecret: text("webhookSecret").notNull(),
  lastSyncAt: integer("lastSyncAt", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  teamIdIdx: index("repositories_teamId_idx").on(table.teamId),
}));

export type Repository = typeof repositories.$inferSelect;
export type InsertRepository = typeof repositories.$inferInsert;

export const activities = sqliteTable("activities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("teamId").notNull().references(() => teams.id, { onDelete: "cascade" }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // task_created, task_updated, commit_pushed, pr_opened, etc.
  entityId: text("entityId").notNull(),
  entityType: text("entityType").notNull(),
  metadata: text("metadata"), // JSON string
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  teamIdCreatedAtIdx: index("activities_teamId_createdAt_idx").on(table.teamId, table.createdAt),
}));

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = typeof activities.$inferInsert;

export const oauthTokens = sqliteTable("oauthTokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), // github, google, manus
  accessToken: text("accessToken").notNull(), // Encrypted
  refreshToken: text("refreshToken"), // Encrypted
  expiresAt: integer("expiresAt", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  userIdProviderIdx: index("oauthTokens_userId_provider_idx").on(table.userId, table.provider),
}));

export type OAuthToken = typeof oauthTokens.$inferSelect;
export type InsertOAuthToken = typeof oauthTokens.$inferInsert;
