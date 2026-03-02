import { pgTable, serial, text, timestamp, boolean, integer, jsonb, varchar, index, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: text("open_id").unique(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  name: text("name"),
  loginMethod: text("login_method"),
  role: text("role").default("user"),
  lastSignedIn: timestamp("last_signed_in"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Team Members table
export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  position: text("position"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Departments table
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  parentId: integer("parent_id").references(() => departments.id),
  managerId: integer("manager_id").references(() => teamMembers.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Department Assignments table
export const departmentAssignments = pgTable("department_assignments", {
  id: serial("id").primaryKey(),
  teamMemberId: integer("team_member_id").references(() => teamMembers.id, { onDelete: "cascade" }).notNull(),
  departmentId: integer("department_id").references(() => departments.id, { onDelete: "cascade" }).notNull(),
  assignedBy: integer("assigned_by").references(() => teamMembers.id),
  assignedAt: timestamp("assigned_at").defaultNow(),
  isActive: boolean("is_active").default(true),
});

// Audit Logs table
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  operation: text("operation").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  userId: integer("user_id").references(() => teamMembers.id),
  details: text("details"), // JSON string
  timestamp: timestamp("timestamp").defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});

// Teams table
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: integer("created_by").references(() => teamMembers.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Team Members Collaborative table
export const teamMembersCollaborative = pgTable("team_members_collaborative", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  memberId: integer("member_id").references(() => teamMembers.id, { onDelete: "cascade" }).notNull(),
  role: text("role").default("member"),
  joinedAt: timestamp("joined_at").defaultNow(),
});

// Team Invitations table
export const teamInvitations = pgTable("team_invitations", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  email: text("email").notNull(),
  invitedBy: integer("invited_by").references(() => teamMembers.id).notNull(),
  token: text("token").notNull().unique(),
  status: text("status").default("pending"), // pending, accepted, expired
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tasks table
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").default("todo"), // todo, in-progress, done
  priority: text("priority").default("medium"), // low, medium, high
  assignedTo: integer("assigned_to").references(() => teamMembers.id),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }),
  createdBy: integer("created_by").references(() => teamMembers.id),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Documents table
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content"),
  type: text("type").default("markdown"), // markdown, text, etc.
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }),
  createdBy: integer("created_by").references(() => teamMembers.id),
  lastEditedBy: integer("last_edited_by").references(() => teamMembers.id),
  isPublic: boolean("is_public").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Activities table
export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // task_created, task_updated, etc.
  description: text("description").notNull(),
  entityType: text("entity_type"), // task, document, team, etc.
  entityId: integer("entity_id"),
  userId: integer("user_id").references(() => teamMembers.id),
  teamId: integer("team_id").references(() => teams.id),
  metadata: jsonb("metadata"), // Additional data as JSON
  createdAt: timestamp("created_at").defaultNow(),
});

// Repositories table
export const repositories = pgTable("repositories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  description: text("description"),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }),
  githubId: text("github_id").unique(),
  isPrivate: boolean("is_private").default(true),
  defaultBranch: text("default_branch").default("main"),
  createdBy: integer("created_by").references(() => teamMembers.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// OAuth Tokens table
export const oauthTokens = pgTable("oauth_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  provider: text("provider").notNull(), // github, google, etc.
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueUserProvider: unique().on(table.userId, table.provider),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  oauthTokens: many(oauthTokens),
}));

export const teamMembersRelations = relations(teamMembers, ({ many, one }) => ({
  departmentAssignments: many(departmentAssignments),
  managedDepartments: many(departments, { relationName: "manager" }),
  createdTeams: many(teams, { relationName: "creator" }),
  teamMemberships: many(teamMembersCollaborative),
  assignedTasks: many(tasks, { relationName: "assignee" }),
  createdTasks: many(tasks, { relationName: "creator" }),
  createdDocuments: many(documents, { relationName: "creator" }),
  editedDocuments: many(documents, { relationName: "editor" }),
  activities: many(activities),
  createdRepositories: many(repositories),
  sentInvitations: many(teamInvitations),
  auditLogs: many(auditLogs),
}));

export const departmentsRelations = relations(departments, ({ many, one }) => ({
  parent: one(departments, {
    fields: [departments.parentId],
    references: [departments.id],
    relationName: "parent",
  }),
  children: many(departments, { relationName: "parent" }),
  manager: one(teamMembers, {
    fields: [departments.managerId],
    references: [teamMembers.id],
    relationName: "manager",
  }),
  assignments: many(departmentAssignments),
}));

export const departmentAssignmentsRelations = relations(departmentAssignments, ({ one }) => ({
  teamMember: one(teamMembers, {
    fields: [departmentAssignments.teamMemberId],
    references: [teamMembers.id],
  }),
  department: one(departments, {
    fields: [departmentAssignments.departmentId],
    references: [departments.id],
  }),
  assignedByMember: one(teamMembers, {
    fields: [departmentAssignments.assignedBy],
    references: [teamMembers.id],
  }),
}));

export const teamsRelations = relations(teams, ({ many, one }) => ({
  creator: one(teamMembers, {
    fields: [teams.createdBy],
    references: [teamMembers.id],
    relationName: "creator",
  }),
  members: many(teamMembersCollaborative),
  tasks: many(tasks),
  documents: many(documents),
  repositories: many(repositories),
  invitations: many(teamInvitations),
  activities: many(activities),
}));

export const teamMembersCollaborativeRelations = relations(teamMembersCollaborative, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembersCollaborative.teamId],
    references: [teams.id],
  }),
  member: one(teamMembers, {
    fields: [teamMembersCollaborative.memberId],
    references: [teamMembers.id],
  }),
}));

export const teamInvitationsRelations = relations(teamInvitations, ({ one }) => ({
  team: one(teams, {
    fields: [teamInvitations.teamId],
    references: [teams.id],
  }),
  invitedBy: one(teamMembers, {
    fields: [teamInvitations.invitedBy],
    references: [teamMembers.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  assignee: one(teamMembers, {
    fields: [tasks.assignedTo],
    references: [teamMembers.id],
    relationName: "assignee",
  }),
  creator: one(teamMembers, {
    fields: [tasks.createdBy],
    references: [teamMembers.id],
    relationName: "creator",
  }),
  team: one(teams, {
    fields: [tasks.teamId],
    references: [teams.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  creator: one(teamMembers, {
    fields: [documents.createdBy],
    references: [teamMembers.id],
    relationName: "creator",
  }),
  lastEditor: one(teamMembers, {
    fields: [documents.lastEditedBy],
    references: [teamMembers.id],
    relationName: "editor",
  }),
  team: one(teams, {
    fields: [documents.teamId],
    references: [teams.id],
  }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  user: one(teamMembers, {
    fields: [activities.userId],
    references: [teamMembers.id],
  }),
  team: one(teams, {
    fields: [activities.teamId],
    references: [teams.id],
  }),
}));

export const repositoriesRelations = relations(repositories, ({ one }) => ({
  team: one(teams, {
    fields: [repositories.teamId],
    references: [teams.id],
  }),
  creator: one(teamMembers, {
    fields: [repositories.createdBy],
    references: [teamMembers.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(teamMembers, {
    fields: [auditLogs.userId],
    references: [teamMembers.id],
  }),
}));

export const oauthTokensRelations = relations(oauthTokens, ({ one }) => ({
  user: one(users, {
    fields: [oauthTokens.userId],
    references: [users.id],
  }),
}));

// Type exports
export type InsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type InsertTeamMember = typeof teamMembers.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;

export type InsertDepartment = typeof departments.$inferInsert;
export type Department = typeof departments.$inferSelect;

export type InsertDepartmentAssignment = typeof departmentAssignments.$inferInsert;
export type DepartmentAssignment = typeof departmentAssignments.$inferSelect;

export type InsertAuditLog = typeof auditLogs.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;

export type InsertTeam = typeof teams.$inferInsert;
export type Team = typeof teams.$inferSelect;

export type InsertTeamMemberCollaborative = typeof teamMembersCollaborative.$inferInsert;
export type TeamMemberCollaborative = typeof teamMembersCollaborative.$inferSelect;

export type InsertTeamInvitation = typeof teamInvitations.$inferInsert;
export type TeamInvitation = typeof teamInvitations.$inferSelect;

export type InsertTask = typeof tasks.$inferInsert;
export type Task = typeof tasks.$inferSelect;

export type InsertDocument = typeof documents.$inferInsert;
export type Document = typeof documents.$inferSelect;

export type InsertActivity = typeof activities.$inferInsert;
export type Activity = typeof activities.$inferSelect;

export type InsertRepository = typeof repositories.$inferInsert;
export type Repository = typeof repositories.$inferSelect;

export type InsertOAuthToken = typeof oauthTokens.$inferInsert;
export type OAuthToken = typeof oauthTokens.$inferSelect;