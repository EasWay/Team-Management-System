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
  duties: text("duties"),
  pictureFileName: text("picture_file_name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  githubAccessToken: text("github_access_token"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Team Members Collaborative table
export const teamMembersCollaborative = pgTable("team_members_collaborative", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  memberId: integer("member_id").references(() => teamMembers.id, { onDelete: "cascade" }).notNull(),
  role: text("role").default("member"),
  status: text("status").default("active"), // 'active', 'pending'
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

// Clients table
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Projects table
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // Nature / scope name
  definition: text("definition"),
  description: text("description"),
  dateReceived: timestamp("date_received").defaultNow(),
  dateEnded: timestamp("date_ended"),
  status: text("status").default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Project Files table
export const projectFiles = pgTable("project_files", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  fileUrl: text("file_url").notNull(),
  type: text("type").default("document"), // generic document, prd, image, etc.
  uploadedBy: integer("uploaded_by").references(() => teamMembers.id),
  createdAt: timestamp("created_at").defaultNow(),
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
  createdTeams: many(teams, { relationName: "creator" }),
  teamMemberships: many(teamMembersCollaborative),
  assignedTasks: many(tasks, { relationName: "assignee" }),
  createdTasks: many(tasks, { relationName: "creator" }),
  createdProjects: many(projects),
  uploadedFiles: many(projectFiles),
  activities: many(activities),
  createdRepositories: many(repositories),
  sentInvitations: many(teamInvitations),
  auditLogs: many(auditLogs),
}));


export const teamsRelations = relations(teams, ({ many, one }) => ({
  creator: one(teamMembers, {
    fields: [teams.createdBy],
    references: [teamMembers.id],
    relationName: "creator",
  }),
  members: many(teamMembersCollaborative),
  tasks: many(tasks),
  clients: many(clients),
  projects: many(projects),
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

export const clientsRelations = relations(clients, ({ one, many }) => ({
  team: one(teams, {
    fields: [clients.teamId],
    references: [teams.id],
  }),
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(clients, {
    fields: [projects.clientId],
    references: [clients.id],
  }),
  team: one(teams, {
    fields: [projects.teamId],
    references: [teams.id],
  }),
  files: many(projectFiles),
}));

export const projectFilesRelations = relations(projectFiles, ({ one }) => ({
  project: one(projects, {
    fields: [projectFiles.projectId],
    references: [projects.id],
  }),
  uploader: one(teamMembers, {
    fields: [projectFiles.uploadedBy],
    references: [teamMembers.id],
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

export type InsertClient = typeof clients.$inferInsert;
export type Client = typeof clients.$inferSelect;

export type InsertProject = typeof projects.$inferInsert;
export type Project = typeof projects.$inferSelect;

export type InsertProjectFile = typeof projectFiles.$inferInsert;
export type ProjectFile = typeof projectFiles.$inferSelect;

export type InsertActivity = typeof activities.$inferInsert;
export type Activity = typeof activities.$inferSelect;

export type InsertRepository = typeof repositories.$inferInsert;
export type Repository = typeof repositories.$inferSelect;

export type InsertOAuthToken = typeof oauthTokens.$inferInsert;
export type OAuthToken = typeof oauthTokens.$inferSelect;