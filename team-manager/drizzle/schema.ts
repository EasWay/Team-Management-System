import { pgTable, serial, text, timestamp, boolean, integer, jsonb, varchar, index, unique, date } from "drizzle-orm/pg-core";
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
  // New fields for approval workflow configuration
  approvalMode: text("approval_mode").default("pm"), // 'boss', 'pm', 'team_vote'
  bossUserId: integer("boss_user_id").references(() => teamMembers.id),
  pmUserId: integer("pm_user_id").references(() => teamMembers.id),
  voteThreshold: integer("vote_threshold").default(51), // percentage for team votes
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Team Members Collaborative table
export const teamMembersCollaborative = pgTable("team_members_collaborative", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  memberId: integer("member_id").references(() => teamMembers.id, { onDelete: "cascade" }).notNull(),
  role: text("role").default("member"), // 'admin', 'team_lead', 'member', 'viewer'
  officeRole: text("office_role"), // 'project_manager', 'lead_researcher', 'systems_architect', 'backend_engineer', 'fullstack_engineer', 'ai_engineer', 'qa_tester', 'designer'
  status: text("status").default("active"), // 'active', 'pending'
  joinedAt: timestamp("joined_at").defaultNow(),
});

// Team Invitations table
export const teamInvitations = pgTable("team_invitations", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  email: text("email").notNull(),
  invitedBy: integer("invited_by").references(() => teamMembers.id).notNull(),
  role: text("role").default("member"),
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
  // New fields for sequential handoff workflow
  workflowStage: text("workflow_stage"), // 'ideation', 'design', 'business', 'development', 'testing', 'review', 'completed'
  assignedRole: text("assigned_role"), // 'designer', 'business_strategist', 'backend_dev', 'frontend_dev', etc.
  handoffHistory: jsonb("handoff_history"), // array of {from, to, deliverables, timestamp, comments}
  deliverables: jsonb("deliverables"), // {type: 'figma'|'github'|'pdf'|'link', url, description, uploadedAt}
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
  // New fields for AI ideation and workflow
  ideationData: jsonb("ideation_data"), // {chatLogs, speakers, aiAnalysis, finalDecisionReport}
  workflowStage: text("workflow_stage").default("ideation"), // 'ideation', 'design', 'business', 'development', 'testing', 'completed'
  assignedRole: text("assigned_role"), // current role responsible for this stage
  handoffHistory: jsonb("handoff_history"), // array of handoff records
  deliverables: jsonb("deliverables"), // accumulated deliverables from all stages
  // New fields for AI project evaluation
  evaluationData: jsonb("evaluation_data"), // {overallScore, designAlignment, businessAlignment, technicalQuality, testingProtocol, readyForLaunch}
  evaluatedAt: timestamp("evaluated_at"),
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

// Messages table
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email").notNull(),
  serviceType: text("service_type").notNull(),
  details: text("details").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Approvals table - NEW for Decision Table / Quality Gate
export const approvals = pgTable("approvals", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(), // 'task', 'project', 'handoff'
  entityId: integer("entity_id").notNull(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  approverType: text("approver_type").notNull(), // 'boss', 'pm', 'team_vote'
  approverUserId: integer("approver_user_id").references(() => teamMembers.id), // null for team_vote
  status: text("status").default("pending"), // 'pending', 'approved', 'rejected'
  comments: text("comments"),
  // For team voting
  votesFor: integer("votes_for").default(0),
  votesAgainst: integer("votes_against").default(0),
  votesAbstain: integer("votes_abstain").default(0),
  requiredVotes: integer("required_votes"), // calculated based on team size and threshold
  voters: jsonb("voters"), // array of {userId, vote: 'for'|'against'|'abstain', timestamp}
  // Metadata
  fromStage: text("from_stage"), // for handoff approvals
  toStage: text("to_stage"), // for handoff approvals
  deliverables: jsonb("deliverables"), // snapshot of deliverables being approved
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: integer("resolved_by").references(() => teamMembers.id),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  oauthTokens: many(oauthTokens),
}));

export const teamMembersRelations = relations(teamMembers, ({ many, one }) => ({
  createdTeams: many(teams, { relationName: "creator" }),
  bossOfTeams: many(teams, { relationName: "boss" }),
  pmOfTeams: many(teams, { relationName: "projectManager" }),
  teamMemberships: many(teamMembersCollaborative),
  assignedTasks: many(tasks, { relationName: "assignee" }),
  createdTasks: many(tasks, { relationName: "creator" }),
  createdProjects: many(projects),
  uploadedFiles: many(projectFiles),
  activities: many(activities),
  createdRepositories: many(repositories),
  sentInvitations: many(teamInvitations),
  auditLogs: many(auditLogs),
  approvals: many(approvals, { relationName: "approver" }),
  resolvedApprovals: many(approvals, { relationName: "resolver" }),
}));


export const teamsRelations = relations(teams, ({ many, one }) => ({
  creator: one(teamMembers, {
    fields: [teams.createdBy],
    references: [teamMembers.id],
    relationName: "creator",
  }),
  boss: one(teamMembers, {
    fields: [teams.bossUserId],
    references: [teamMembers.id],
    relationName: "boss",
  }),
  projectManager: one(teamMembers, {
    fields: [teams.pmUserId],
    references: [teamMembers.id],
    relationName: "projectManager",
  }),
  members: many(teamMembersCollaborative),
  tasks: many(tasks),
  clients: many(clients),
  projects: many(projects),
  repositories: many(repositories),
  invitations: many(teamInvitations),
  activities: many(activities),
  approvals: many(approvals),
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

export const approvalsRelations = relations(approvals, ({ one }) => ({
  team: one(teams, {
    fields: [approvals.teamId],
    references: [teams.id],
  }),
  approver: one(teamMembers, {
    fields: [approvals.approverUserId],
    references: [teamMembers.id],
    relationName: "approver",
  }),
  resolver: one(teamMembers, {
    fields: [approvals.resolvedBy],
    references: [teamMembers.id],
    relationName: "resolver",
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

export type InsertMessage = typeof messages.$inferInsert;
export type Message = typeof messages.$inferSelect;

export type InsertApproval = typeof approvals.$inferInsert;
export type Approval = typeof approvals.$inferSelect;
// Meta Accounts table for Facebook Page + Instagram Business connections


// File Storage table - Enhanced file management system
export const files = pgTable("files", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  taskId: integer("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  folderId: integer("folder_id").references(() => fileFolders.id, { onDelete: "cascade" }),
  
  // File metadata
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  fileSize: integer("file_size").notNull(), // in bytes
  mimeType: text("mime_type").notNull(),
  fileType: text("file_type").notNull(), // 'image', 'pdf', 'video', 'code', 'document', 'other'
  fileUrl: text("file_url").notNull(), // S3 URL or local path
  thumbnailUrl: text("thumbnail_url"), // For images/videos
  
  // File organization
  tags: jsonb("tags"), // array of strings for categorization
  description: text("description"),
  
  // Version control
  version: integer("version").default(1),
  parentFileId: integer("parent_file_id"), // Reference to previous version
  isLatestVersion: boolean("is_latest_version").default(true),
  
  // Access control
  isPublic: boolean("is_public").default(false),
  uploadedBy: integer("uploaded_by").references(() => teamMembers.id).notNull(),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  teamIdIdx: index("files_team_id_idx").on(table.teamId),
  projectIdIdx: index("files_project_id_idx").on(table.projectId),
  taskIdIdx: index("files_task_id_idx").on(table.taskId),
  folderIdIdx: index("files_folder_id_idx").on(table.folderId),
}));

// File Folders table - Organize files in folder structure
export const fileFolders = pgTable("file_folders", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  parentFolderId: integer("parent_folder_id"), // For nested folders
  
  name: text("name").notNull(),
  description: text("description"),
  color: text("color"), // For visual organization
  icon: text("icon"), // Icon name for folder
  
  createdBy: integer("created_by").references(() => teamMembers.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  teamIdIdx: index("file_folders_team_id_idx").on(table.teamId),
  projectIdIdx: index("file_folders_project_id_idx").on(table.projectId),
}));

// File Versions table - Track file version history
export const fileVersions = pgTable("file_versions", {
  id: serial("id").primaryKey(),
  fileId: integer("file_id").references(() => files.id, { onDelete: "cascade" }).notNull(),
  version: integer("version").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size").notNull(),
  uploadedBy: integer("uploaded_by").references(() => teamMembers.id).notNull(),
  changeDescription: text("change_description"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  fileIdIdx: index("file_versions_file_id_idx").on(table.fileId),
}));

// File Comments table - Comments on files
export const fileComments = pgTable("file_comments", {
  id: serial("id").primaryKey(),
  fileId: integer("file_id").references(() => files.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => teamMembers.id, { onDelete: "cascade" }).notNull(),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// File Shares table - Track file sharing and permissions
export const fileShares = pgTable("file_shares", {
  id: serial("id").primaryKey(),
  fileId: integer("file_id").references(() => files.id, { onDelete: "cascade" }).notNull(),
  sharedWith: integer("shared_with").references(() => teamMembers.id, { onDelete: "cascade" }).notNull(),
  sharedBy: integer("shared_by").references(() => teamMembers.id).notNull(),
  permission: text("permission").default("view"), // 'view', 'edit', 'download'
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations for file tables
export const filesRelations = relations(files, ({ one, many }) => ({
  team: one(teams, {
    fields: [files.teamId],
    references: [teams.id],
  }),
  project: one(projects, {
    fields: [files.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [files.taskId],
    references: [tasks.id],
  }),
  folder: one(fileFolders, {
    fields: [files.folderId],
    references: [fileFolders.id],
  }),
  uploader: one(teamMembers, {
    fields: [files.uploadedBy],
    references: [teamMembers.id],
  }),
  versions: many(fileVersions),
  comments: many(fileComments),
  shares: many(fileShares),
}));

export const fileFoldersRelations = relations(fileFolders, ({ one, many }) => ({
  team: one(teams, {
    fields: [fileFolders.teamId],
    references: [teams.id],
  }),
  project: one(projects, {
    fields: [fileFolders.projectId],
    references: [projects.id],
  }),
  creator: one(teamMembers, {
    fields: [fileFolders.createdBy],
    references: [teamMembers.id],
  }),
  files: many(files),
}));

export const fileVersionsRelations = relations(fileVersions, ({ one }) => ({
  file: one(files, {
    fields: [fileVersions.fileId],
    references: [files.id],
  }),
  uploader: one(teamMembers, {
    fields: [fileVersions.uploadedBy],
    references: [teamMembers.id],
  }),
}));

export const fileCommentsRelations = relations(fileComments, ({ one }) => ({
  file: one(files, {
    fields: [fileComments.fileId],
    references: [files.id],
  }),
  user: one(teamMembers, {
    fields: [fileComments.userId],
    references: [teamMembers.id],
  }),
}));

export const fileSharesRelations = relations(fileShares, ({ one }) => ({
  file: one(files, {
    fields: [fileShares.fileId],
    references: [files.id],
  }),
  sharedWithUser: one(teamMembers, {
    fields: [fileShares.sharedWith],
    references: [teamMembers.id],
  }),
  sharedByUser: one(teamMembers, {
    fields: [fileShares.sharedBy],
    references: [teamMembers.id],
  }),
}));

// Type exports for file tables
export type InsertFile = typeof files.$inferInsert;
export type File = typeof files.$inferSelect;

export type InsertFileFolder = typeof fileFolders.$inferInsert;
export type FileFolder = typeof fileFolders.$inferSelect;

export type InsertFileVersion = typeof fileVersions.$inferInsert;
export type FileVersion = typeof fileVersions.$inferSelect;

export type InsertFileComment = typeof fileComments.$inferInsert;
export type FileComment = typeof fileComments.$inferSelect;

export type InsertFileShare = typeof fileShares.$inferInsert;
export type FileShare = typeof fileShares.$inferSelect;

// Calendar Events table - Team and personal calendar management
export const calendarEvents = pgTable("calendar_events", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  taskId: integer("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  
  // Event details
  title: text("title").notNull(),
  description: text("description"),
  eventType: text("event_type").notNull(), // 'deadline', 'meeting', 'milestone', 'personal', 'office_hours'
  
  // Timing
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  allDay: boolean("all_day").default(false),
  recurrence: text("recurrence"), // 'daily', 'weekly', 'monthly', 'yearly', null for one-time
  recurrenceEnd: timestamp("recurrence_end"),
  
  // Location and meeting details
  location: text("location"),
  meetingUrl: text("meeting_url"),
  
  // Attendees and assignments
  createdBy: integer("created_by").references(() => teamMembers.id).notNull(),
  assignedTo: jsonb("assigned_to"), // array of user IDs
  
  // Status and priority
  status: text("status").default("scheduled"), // 'scheduled', 'in_progress', 'completed', 'cancelled'
  priority: text("priority").default("medium"), // 'low', 'medium', 'high', 'urgent'
  
  // Reminders
  reminders: jsonb("reminders"), // array of {type: 'email'|'notification', minutesBefore: number}
  
  // Metadata
  color: text("color"), // For visual categorization
  metadata: jsonb("metadata"), // Additional custom data
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  teamIdIdx: index("calendar_events_team_id_idx").on(table.teamId),
  startDateIdx: index("calendar_events_start_date_idx").on(table.startDate),
  eventTypeIdx: index("calendar_events_event_type_idx").on(table.eventType),
}));

// Milestones table - Project milestones and key dates
export const milestones = pgTable("milestones", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  
  name: text("name").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date").notNull(),
  
  // Dependencies
  dependsOn: jsonb("depends_on"), // array of milestone IDs
  
  // Status
  status: text("status").default("pending"), // 'pending', 'in_progress', 'completed', 'delayed'
  completedAt: timestamp("completed_at"),
  completedBy: integer("completed_by").references(() => teamMembers.id),
  
  // Progress
  progress: integer("progress").default(0), // 0-100
  
  // Metadata
  color: text("color"),
  icon: text("icon"),
  
  createdBy: integer("created_by").references(() => teamMembers.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Task Dependencies table - Track task dependencies for Gantt chart
export const taskDependencies = pgTable("task_dependencies", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => tasks.id, { onDelete: "cascade" }).notNull(),
  dependsOnTaskId: integer("depends_on_task_id").references(() => tasks.id, { onDelete: "cascade" }).notNull(),
  dependencyType: text("dependency_type").default("finish_to_start"), // 'finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish'
  lag: integer("lag").default(0), // Days of lag/lead time
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  taskIdIdx: index("task_dependencies_task_id_idx").on(table.taskId),
  dependsOnIdx: index("task_dependencies_depends_on_idx").on(table.dependsOnTaskId),
}));

// User Availability table - Track team member availability
export const userAvailability = pgTable("user_availability", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => teamMembers.id, { onDelete: "cascade" }).notNull(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  
  // Availability window
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  
  // Status
  status: text("status").notNull(), // 'available', 'busy', 'away', 'offline'
  
  // Details
  reason: text("reason"), // Optional reason for unavailability
  isRecurring: boolean("is_recurring").default(false),
  recurrencePattern: text("recurrence_pattern"), // 'weekly', 'daily', etc.
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("user_availability_user_id_idx").on(table.userId),
  startDateIdx: index("user_availability_start_date_idx").on(table.startDate),
}));

// Relations for calendar tables
export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  team: one(teams, {
    fields: [calendarEvents.teamId],
    references: [teams.id],
  }),
  project: one(projects, {
    fields: [calendarEvents.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [calendarEvents.taskId],
    references: [tasks.id],
  }),
  creator: one(teamMembers, {
    fields: [calendarEvents.createdBy],
    references: [teamMembers.id],
  }),
}));

export const milestonesRelations = relations(milestones, ({ one }) => ({
  team: one(teams, {
    fields: [milestones.teamId],
    references: [teams.id],
  }),
  project: one(projects, {
    fields: [milestones.projectId],
    references: [projects.id],
  }),
  creator: one(teamMembers, {
    fields: [milestones.createdBy],
    references: [teamMembers.id],
  }),
  completedByUser: one(teamMembers, {
    fields: [milestones.completedBy],
    references: [teamMembers.id],
  }),
}));

export const taskDependenciesRelations = relations(taskDependencies, ({ one }) => ({
  task: one(tasks, {
    fields: [taskDependencies.taskId],
    references: [tasks.id],
  }),
  dependsOnTask: one(tasks, {
    fields: [taskDependencies.dependsOnTaskId],
    references: [tasks.id],
  }),
}));

export const userAvailabilityRelations = relations(userAvailability, ({ one }) => ({
  user: one(teamMembers, {
    fields: [userAvailability.userId],
    references: [teamMembers.id],
  }),
  team: one(teams, {
    fields: [userAvailability.teamId],
    references: [teams.id],
  }),
}));

// Type exports for calendar tables
export type InsertCalendarEvent = typeof calendarEvents.$inferInsert;
export type CalendarEvent = typeof calendarEvents.$inferSelect;

export type InsertMilestone = typeof milestones.$inferInsert;
export type Milestone = typeof milestones.$inferSelect;

export type InsertTaskDependency = typeof taskDependencies.$inferInsert;
export type TaskDependency = typeof taskDependencies.$inferSelect;

export type InsertUserAvailability = typeof userAvailability.$inferInsert;
export type UserAvailability = typeof userAvailability.$inferSelect;

// Video Calls table - Office video rooms and calls
export const videoCalls = pgTable("video_calls", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  
  // Call details
  title: text("title").notNull(),
  description: text("description"),
  callType: text("call_type").notNull(), // 'office_room', 'quick_huddle', 'scheduled_meeting', 'screen_share'
  
  // Office context
  officeRole: text("office_role"), // Which office the call is in
  
  // Call status
  status: text("status").default("scheduled"), // 'scheduled', 'active', 'ended', 'cancelled'
  
  // Timing
  scheduledStartTime: timestamp("scheduled_start_time"),
  actualStartTime: timestamp("actual_start_time"),
  endTime: timestamp("end_time"),
  duration: integer("duration"), // in seconds
  
  // Integration
  integrationType: text("integration_type"), // 'webrtc', 'zoom', 'google_meet', 'teams'
  externalMeetingId: text("external_meeting_id"), // For Zoom/Meet integration
  meetingUrl: text("meeting_url"),
  meetingPassword: text("meeting_password"),
  
  // WebRTC details
  roomId: text("room_id").unique(), // For WebRTC rooms
  
  // Recording
  isRecorded: boolean("is_recorded").default(false),
  recordingUrl: text("recording_url"),
  recordingDuration: integer("recording_duration"),
  
  // Participants
  hostId: integer("host_id").references(() => teamMembers.id).notNull(),
  participants: jsonb("participants"), // array of {userId, joinedAt, leftAt, duration}
  maxParticipants: integer("max_participants").default(50),
  
  // Features
  screenSharingEnabled: boolean("screen_sharing_enabled").default(true),
  recordingEnabled: boolean("recording_enabled").default(false),
  chatEnabled: boolean("chat_enabled").default(true),
  
  // Metadata
  metadata: jsonb("metadata"), // Additional data
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  teamIdIdx: index("video_calls_team_id_idx").on(table.teamId),
  statusIdx: index("video_calls_status_idx").on(table.status),
  roomIdIdx: index("video_calls_room_id_idx").on(table.roomId),
}));

// Call Participants table - Track who joined calls
export const callParticipants = pgTable("call_participants", {
  id: serial("id").primaryKey(),
  callId: integer("call_id").references(() => videoCalls.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => teamMembers.id, { onDelete: "cascade" }).notNull(),
  
  // Participation details
  joinedAt: timestamp("joined_at").notNull(),
  leftAt: timestamp("left_at"),
  duration: integer("duration"), // in seconds
  
  // Status during call
  isMuted: boolean("is_muted").default(false),
  isVideoOn: boolean("is_video_on").default(true),
  isSharingScreen: boolean("is_sharing_screen").default(false),
  
  // Connection quality
  connectionQuality: text("connection_quality"), // 'excellent', 'good', 'fair', 'poor'
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  callIdIdx: index("call_participants_call_id_idx").on(table.callId),
  userIdIdx: index("call_participants_user_id_idx").on(table.userId),
}));

// Call Messages table - In-call chat messages
export const callMessages = pgTable("call_messages", {
  id: serial("id").primaryKey(),
  callId: integer("call_id").references(() => videoCalls.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => teamMembers.id, { onDelete: "cascade" }).notNull(),
  
  message: text("message").notNull(),
  messageType: text("message_type").default("text"), // 'text', 'file', 'emoji', 'system'
  
  // File attachments
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Office Rooms table - Persistent office video rooms
export const officeRooms = pgTable("office_rooms", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  
  // Room details
  name: text("name").notNull(),
  description: text("description"),
  officeRole: text("office_role").notNull(), // 'project_manager', 'lead_researcher', etc.
  
  // Room settings
  isActive: boolean("is_active").default(true),
  isPermanent: boolean("is_permanent").default(true), // Always available vs temporary
  maxParticipants: integer("max_participants").default(10),
  
  // Access control
  isPublic: boolean("is_public").default(true), // Anyone in team can join
  allowedUsers: jsonb("allowed_users"), // array of user IDs if private
  
  // Current status
  currentCallId: integer("current_call_id").references(() => videoCalls.id),
  activeParticipants: integer("active_participants").default(0),
  
  // Room features
  screenSharingEnabled: boolean("screen_sharing_enabled").default(true),
  recordingEnabled: boolean("recording_enabled").default(false),
  chatEnabled: boolean("chat_enabled").default(true),
  knockToEnter: boolean("knock_to_enter").default(false), // Require permission to join
  
  createdBy: integer("created_by").references(() => teamMembers.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  teamIdIdx: index("office_rooms_team_id_idx").on(table.teamId),
  officeRoleIdx: index("office_rooms_office_role_idx").on(table.officeRole),
}));

// Relations for video call tables
export const videoCallsRelations = relations(videoCalls, ({ one, many }) => ({
  team: one(teams, {
    fields: [videoCalls.teamId],
    references: [teams.id],
  }),
  project: one(projects, {
    fields: [videoCalls.projectId],
    references: [projects.id],
  }),
  host: one(teamMembers, {
    fields: [videoCalls.hostId],
    references: [teamMembers.id],
  }),
  participants: many(callParticipants),
  messages: many(callMessages),
}));

export const callParticipantsRelations = relations(callParticipants, ({ one }) => ({
  call: one(videoCalls, {
    fields: [callParticipants.callId],
    references: [videoCalls.id],
  }),
  user: one(teamMembers, {
    fields: [callParticipants.userId],
    references: [teamMembers.id],
  }),
}));

export const callMessagesRelations = relations(callMessages, ({ one }) => ({
  call: one(videoCalls, {
    fields: [callMessages.callId],
    references: [videoCalls.id],
  }),
  user: one(teamMembers, {
    fields: [callMessages.userId],
    references: [teamMembers.id],
  }),
}));

export const officeRoomsRelations = relations(officeRooms, ({ one }) => ({
  team: one(teams, {
    fields: [officeRooms.teamId],
    references: [teams.id],
  }),
  creator: one(teamMembers, {
    fields: [officeRooms.createdBy],
    references: [teamMembers.id],
  }),
  currentCall: one(videoCalls, {
    fields: [officeRooms.currentCallId],
    references: [videoCalls.id],
  }),
}));

// Type exports for video call tables
export type InsertVideoCall = typeof videoCalls.$inferInsert;
export type VideoCall = typeof videoCalls.$inferSelect;

export type InsertCallParticipant = typeof callParticipants.$inferInsert;
export type CallParticipant = typeof callParticipants.$inferSelect;

export type InsertCallMessage = typeof callMessages.$inferInsert;
export type CallMessage = typeof callMessages.$inferSelect;

export type InsertOfficeRoom = typeof officeRooms.$inferInsert;
export type OfficeRoom = typeof officeRooms.$inferSelect;

// Notification Preferences table - User notification settings
export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => teamMembers.id, { onDelete: "cascade" }).notNull(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  
  // Channel preferences
  emailEnabled: boolean("email_enabled").default(true),
  pushEnabled: boolean("push_enabled").default(true),
  inAppEnabled: boolean("in_app_enabled").default(true),
  
  // Notification types
  taskAssignments: boolean("task_assignments").default(true),
  taskDeadlines: boolean("task_deadlines").default(true),
  mentions: boolean("mentions").default(true),
  approvalRequests: boolean("approval_requests").default(true),
  folderAlerts: boolean("folder_alerts").default(true),
  projectUpdates: boolean("project_updates").default(true),
  teamMessages: boolean("team_messages").default(true),
  
  // Priority levels
  highPriorityOnly: boolean("high_priority_only").default(false),
  
  // Quiet hours
  quietHoursEnabled: boolean("quiet_hours_enabled").default(false),
  quietHoursStart: text("quiet_hours_start"), // Format: "22:00"
  quietHoursEnd: text("quiet_hours_end"), // Format: "08:00"
  quietHoursTimezone: text("quiet_hours_timezone").default("UTC"),
  
  // Daily digest
  dailyDigestEnabled: boolean("daily_digest_enabled").default(true),
  dailyDigestTime: text("daily_digest_time").default("08:00"), // Format: "08:00"
  dailyDigestTimezone: text("daily_digest_timezone").default("UTC"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Notifications table - Individual notifications
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => teamMembers.id, { onDelete: "cascade" }).notNull(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  
  // Notification details
  type: text("type").notNull(), // task_assignment, deadline_approaching, mention, approval_request, folder_alert, etc.
  title: text("title").notNull(),
  message: text("message").notNull(),
  priority: text("priority").default("normal"), // low, normal, high, urgent
  
  // Related entities
  taskId: integer("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  fileId: integer("file_id").references(() => files.id, { onDelete: "cascade" }),
  folderId: integer("folder_id").references(() => fileFolders.id, { onDelete: "cascade" }),
  
  // Action link
  actionUrl: text("action_url"),
  actionLabel: text("action_label"),
  
  // Status
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  
  // Delivery status
  sentViaEmail: boolean("sent_via_email").default(false),
  sentViaPush: boolean("sent_via_push").default(false),
  sentInApp: boolean("sent_in_app").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Notification Rules table - Automated notification triggers
export const notificationRules = pgTable("notification_rules", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  
  // Rule details
  name: text("name").notNull(),
  description: text("description"),
  ruleType: text("rule_type").notNull(), // folder_idle, deadline_approaching, approval_pending, etc.
  
  // Conditions
  conditions: jsonb("conditions"), // Flexible JSON for rule conditions
  
  // Thresholds
  thresholdHours: integer("threshold_hours"), // e.g., 24 hours for folder idle
  thresholdDays: integer("threshold_days"), // e.g., 3 days before deadline
  
  // Actions
  notificationType: text("notification_type").notNull(),
  notificationPriority: text("notification_priority").default("normal"),
  
  // Status
  isActive: boolean("is_active").default(true),
  lastTriggered: timestamp("last_triggered"),
  
  createdBy: integer("created_by").references(() => teamMembers.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Daily Digest Queue table - Track digest emails
export const dailyDigestQueue = pgTable("daily_digest_queue", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => teamMembers.id, { onDelete: "cascade" }).notNull(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  
  // Digest details
  digestDate: date("digest_date").notNull(),
  scheduledTime: timestamp("scheduled_time").notNull(),
  
  // Content
  tasksDueToday: jsonb("tasks_due_today"),
  tasksOverdue: jsonb("tasks_overdue"),
  approvalsPending: jsonb("approvals_pending"),
  foldersIdle: jsonb("folders_idle"),
  unreadMentions: jsonb("unread_mentions"),
  
  // Status
  status: text("status").default("pending"), // pending, sent, failed
  sentAt: timestamp("sent_at"),
  error: text("error"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations for notification tables
export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(teamMembers, {
    fields: [notificationPreferences.userId],
    references: [teamMembers.id],
  }),
  team: one(teams, {
    fields: [notificationPreferences.teamId],
    references: [teams.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(teamMembers, {
    fields: [notifications.userId],
    references: [teamMembers.id],
  }),
  team: one(teams, {
    fields: [notifications.teamId],
    references: [teams.id],
  }),
  task: one(tasks, {
    fields: [notifications.taskId],
    references: [tasks.id],
  }),
  project: one(projects, {
    fields: [notifications.projectId],
    references: [projects.id],
  }),
  file: one(files, {
    fields: [notifications.fileId],
    references: [files.id],
  }),
  folder: one(fileFolders, {
    fields: [notifications.folderId],
    references: [fileFolders.id],
  }),
}));

export const notificationRulesRelations = relations(notificationRules, ({ one }) => ({
  team: one(teams, {
    fields: [notificationRules.teamId],
    references: [teams.id],
  }),
  creator: one(teamMembers, {
    fields: [notificationRules.createdBy],
    references: [teamMembers.id],
  }),
}));

export const dailyDigestQueueRelations = relations(dailyDigestQueue, ({ one }) => ({
  user: one(teamMembers, {
    fields: [dailyDigestQueue.userId],
    references: [teamMembers.id],
  }),
  team: one(teams, {
    fields: [dailyDigestQueue.teamId],
    references: [teams.id],
  }),
}));

// Type exports for notification tables
export type InsertNotificationPreference = typeof notificationPreferences.$inferInsert;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;

export type InsertNotification = typeof notifications.$inferInsert;
export type Notification = typeof notifications.$inferSelect;

export type InsertNotificationRule = typeof notificationRules.$inferInsert;
export type NotificationRule = typeof notificationRules.$inferSelect;

export type InsertDailyDigestQueue = typeof dailyDigestQueue.$inferInsert;
export type DailyDigestQueue = typeof dailyDigestQueue.$inferSelect;

// Client Portal Access table - Client login and access management
export const clientPortalAccess = pgTable("client_portal_access", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  
  // Authentication
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  
  // Access control
  isActive: boolean("is_active").default(true),
  canViewProjects: boolean("can_view_projects").default(true),
  canViewDeliverables: boolean("can_view_deliverables").default(true),
  canLeaveFeedback: boolean("can_leave_feedback").default(true),
  canApprove: boolean("can_approve").default(false),
  
  // Branding
  customLogo: text("custom_logo"),
  brandColor: text("brand_color"),
  whiteLabel: boolean("white_label").default(false),
  
  // Session management
  lastLogin: timestamp("last_login"),
  loginToken: text("login_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Client Feedback table - Client feedback on projects and deliverables
export const clientFeedback = pgTable("client_feedback", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  
  // Feedback details
  feedbackType: text("feedback_type").notNull(), // 'general', 'deliverable', 'milestone', 'approval'
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  rating: integer("rating"), // 1-5 stars
  
  // Related entities
  deliverableId: integer("deliverable_id"), // Reference to specific deliverable
  fileId: integer("file_id").references(() => files.id),
  
  // Status
  status: text("status").default("pending"), // 'pending', 'reviewed', 'resolved'
  reviewedBy: integer("reviewed_by").references(() => teamMembers.id),
  reviewedAt: timestamp("reviewed_at"),
  response: text("response"),
  
  // Attachments
  attachments: jsonb("attachments"), // array of file URLs
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Client Activity Log table - Track client portal activity
export const clientActivityLog = pgTable("client_activity_log", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  
  // Activity details
  activityType: text("activity_type").notNull(), // 'login', 'view_project', 'view_deliverable', 'leave_feedback', 'approve', 'download'
  description: text("description").notNull(),
  
  // Related entities
  projectId: integer("project_id").references(() => projects.id),
  fileId: integer("file_id").references(() => files.id),
  
  // Metadata
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Client Project Visibility table - Control which projects clients can see
export const clientProjectVisibility = pgTable("client_project_visibility", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  
  // Visibility settings
  isVisible: boolean("is_visible").default(true),
  canViewFiles: boolean("can_view_files").default(true),
  canDownloadFiles: boolean("can_download_files").default(false),
  canViewTasks: boolean("can_view_tasks").default(false),
  canViewTimeline: boolean("can_view_timeline").default(true),
  
  // Custom fields
  customStatus: text("custom_status"), // Custom status label for client view
  customDescription: text("custom_description"), // Client-facing description
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueClientProject: unique().on(table.clientId, table.projectId),
}));

// Relations for client portal tables
export const clientPortalAccessRelations = relations(clientPortalAccess, ({ one }) => ({
  client: one(clients, {
    fields: [clientPortalAccess.clientId],
    references: [clients.id],
  }),
  team: one(teams, {
    fields: [clientPortalAccess.teamId],
    references: [teams.id],
  }),
}));

export const clientFeedbackRelations = relations(clientFeedback, ({ one }) => ({
  client: one(clients, {
    fields: [clientFeedback.clientId],
    references: [clients.id],
  }),
  project: one(projects, {
    fields: [clientFeedback.projectId],
    references: [projects.id],
  }),
  team: one(teams, {
    fields: [clientFeedback.teamId],
    references: [teams.id],
  }),
  file: one(files, {
    fields: [clientFeedback.fileId],
    references: [files.id],
  }),
  reviewer: one(teamMembers, {
    fields: [clientFeedback.reviewedBy],
    references: [teamMembers.id],
  }),
}));

export const clientActivityLogRelations = relations(clientActivityLog, ({ one }) => ({
  client: one(clients, {
    fields: [clientActivityLog.clientId],
    references: [clients.id],
  }),
  team: one(teams, {
    fields: [clientActivityLog.teamId],
    references: [teams.id],
  }),
  project: one(projects, {
    fields: [clientActivityLog.projectId],
    references: [projects.id],
  }),
  file: one(files, {
    fields: [clientActivityLog.fileId],
    references: [files.id],
  }),
}));

export const clientProjectVisibilityRelations = relations(clientProjectVisibility, ({ one }) => ({
  client: one(clients, {
    fields: [clientProjectVisibility.clientId],
    references: [clients.id],
  }),
  project: one(projects, {
    fields: [clientProjectVisibility.projectId],
    references: [projects.id],
  }),
  team: one(teams, {
    fields: [clientProjectVisibility.teamId],
    references: [teams.id],
  }),
}));

// Type exports for client portal tables
export type InsertClientPortalAccess = typeof clientPortalAccess.$inferInsert;
export type ClientPortalAccess = typeof clientPortalAccess.$inferSelect;

export type InsertClientFeedback = typeof clientFeedback.$inferInsert;
export type ClientFeedback = typeof clientFeedback.$inferSelect;

export type InsertClientActivityLog = typeof clientActivityLog.$inferInsert;
export type ClientActivityLog = typeof clientActivityLog.$inferSelect;

export type InsertClientProjectVisibility = typeof clientProjectVisibility.$inferInsert;
export type ClientProjectVisibility = typeof clientProjectVisibility.$inferSelect;

// Permissions & Security Tables

// Resource Permissions table - Granular access control
export const resourcePermissions = pgTable("resource_permissions", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => teamMembers.id, { onDelete: "cascade" }).notNull(),
  
  // Resource identification
  resourceType: text("resource_type").notNull(), // 'project', 'task', 'file', 'folder', 'office', 'repository'
  resourceId: integer("resource_id").notNull(),
  
  // Permission level
  permission: text("permission").notNull(), // 'read', 'write', 'admin', 'none'
  
  // Granted by
  grantedBy: integer("granted_by").references(() => teamMembers.id).notNull(),
  grantedAt: timestamp("granted_at").defaultNow(),
  
  // Expiration
  expiresAt: timestamp("expires_at"),
  
  // Metadata
  reason: text("reason"),
  metadata: jsonb("metadata"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  teamIdIdx: index("resource_permissions_team_id_idx").on(table.teamId),
  userIdIdx: index("resource_permissions_user_id_idx").on(table.userId),
  resourceIdx: index("resource_permissions_resource_idx").on(table.resourceType, table.resourceId),
  uniqueUserResource: unique().on(table.userId, table.resourceType, table.resourceId),
}));

// Office Access Control table - Office-level permissions
export const officeAccessControl = pgTable("office_access_control", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => teamMembers.id, { onDelete: "cascade" }).notNull(),
  
  // Office role
  officeRole: text("office_role").notNull(), // 'project_manager', 'lead_researcher', etc.
  
  // Access level
  accessLevel: text("access_level").notNull(), // 'full', 'limited', 'view_only', 'none'
  
  // Specific permissions
  canViewTasks: boolean("can_view_tasks").default(true),
  canEditTasks: boolean("can_edit_tasks").default(false),
  canDeleteTasks: boolean("can_delete_tasks").default(false),
  canViewFiles: boolean("can_view_files").default(true),
  canUploadFiles: boolean("can_upload_files").default(false),
  canDeleteFiles: boolean("can_delete_files").default(false),
  canInviteMembers: boolean("can_invite_members").default(false),
  canManagePermissions: boolean("can_manage_permissions").default(false),
  
  // Granted by
  grantedBy: integer("granted_by").references(() => teamMembers.id).notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  teamIdIdx: index("office_access_control_team_id_idx").on(table.teamId),
  userIdIdx: index("office_access_control_user_id_idx").on(table.userId),
  uniqueUserOffice: unique().on(table.userId, table.officeRole, table.teamId),
}));

// Security Audit Trail table - Enhanced audit logging
export const securityAuditTrail = pgTable("security_audit_trail", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => teamMembers.id),
  
  // Action details
  action: text("action").notNull(), // 'login', 'logout', 'access', 'modify', 'delete', 'permission_change', 'failed_login'
  resourceType: text("resource_type"), // 'project', 'task', 'file', 'folder', 'office', 'user', 'permission'
  resourceId: integer("resource_id"),
  
  // Result
  status: text("status").notNull(), // 'success', 'failure', 'denied'
  
  // Details
  description: text("description").notNull(),
  changes: jsonb("changes"), // Before/after values for modifications
  
  // Security context
  ipAddress: text("ip_address").notNull(),
  userAgent: text("user_agent"),
  sessionId: text("session_id"),
  location: text("location"), // Geolocation if available
  
  // Risk assessment
  riskLevel: text("risk_level").default("low"), // 'low', 'medium', 'high', 'critical'
  flagged: boolean("flagged").default(false),
  
  // Metadata
  metadata: jsonb("metadata"),
  
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => ({
  teamIdIdx: index("security_audit_trail_team_id_idx").on(table.teamId),
  userIdIdx: index("security_audit_trail_user_id_idx").on(table.userId),
  actionIdx: index("security_audit_trail_action_idx").on(table.action),
  timestampIdx: index("security_audit_trail_timestamp_idx").on(table.timestamp),
  flaggedIdx: index("security_audit_trail_flagged_idx").on(table.flagged),
}));

// Two-Factor Authentication table - 2FA management
export const twoFactorAuth = pgTable("two_factor_auth", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => teamMembers.id, { onDelete: "cascade" }).notNull().unique(),
  
  // 2FA method
  method: text("method").notNull(), // 'totp', 'sms', 'email', 'backup_codes'
  
  // TOTP (Time-based One-Time Password)
  totpSecret: text("totp_secret"), // Encrypted secret key
  totpEnabled: boolean("totp_enabled").default(false),
  
  // SMS
  phoneNumber: text("phone_number"), // Encrypted phone number
  smsEnabled: boolean("sms_enabled").default(false),
  
  // Email
  emailEnabled: boolean("email_enabled").default(false),
  
  // Backup codes
  backupCodes: jsonb("backup_codes"), // Array of encrypted backup codes
  backupCodesUsed: jsonb("backup_codes_used"), // Array of used codes
  
  // Status
  isEnabled: boolean("is_enabled").default(false),
  isVerified: boolean("is_verified").default(false),
  
  // Recovery
  recoveryEmail: text("recovery_email"),
  
  // Metadata
  lastUsed: timestamp("last_used"),
  failedAttempts: integer("failed_attempts").default(0),
  lockedUntil: timestamp("locked_until"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// IP Whitelist table - IP-based access control
export const ipWhitelist = pgTable("ip_whitelist", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  
  // IP configuration
  ipAddress: text("ip_address").notNull(),
  ipRange: text("ip_range"), // CIDR notation for IP ranges
  
  // Description
  label: text("label").notNull(),
  description: text("description"),
  
  // Status
  isActive: boolean("is_active").default(true),
  
  // Scope
  appliesToAllUsers: boolean("applies_to_all_users").default(true),
  specificUsers: jsonb("specific_users"), // Array of user IDs if not all users
  
  // Added by
  addedBy: integer("added_by").references(() => teamMembers.id).notNull(),
  
  // Expiration
  expiresAt: timestamp("expires_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  teamIdIdx: index("ip_whitelist_team_id_idx").on(table.teamId),
  ipAddressIdx: index("ip_whitelist_ip_address_idx").on(table.ipAddress),
}));

// User Sessions table - Session management
export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => teamMembers.id, { onDelete: "cascade" }).notNull(),
  
  // Session details
  sessionToken: text("session_token").notNull().unique(),
  refreshToken: text("refresh_token").unique(),
  
  // Device information
  deviceId: text("device_id"),
  deviceName: text("device_name"),
  deviceType: text("device_type"), // 'desktop', 'mobile', 'tablet'
  browser: text("browser"),
  os: text("os"),
  
  // Location
  ipAddress: text("ip_address").notNull(),
  location: text("location"),
  
  // Status
  isActive: boolean("is_active").default(true),
  
  // Timestamps
  lastActivity: timestamp("last_activity").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  
  // Security
  isTrusted: boolean("is_trusted").default(false),
  requiresVerification: boolean("requires_verification").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("user_sessions_user_id_idx").on(table.userId),
  sessionTokenIdx: index("user_sessions_session_token_idx").on(table.sessionToken),
  isActiveIdx: index("user_sessions_is_active_idx").on(table.isActive),
}));

// Permission Roles table - Role-based access control
export const permissionRoles = pgTable("permission_roles", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  
  // Role details
  name: text("name").notNull(),
  description: text("description"),
  
  // Permissions
  permissions: jsonb("permissions").notNull(), // Array of permission strings
  
  // Hierarchy
  level: integer("level").default(0), // 0 = lowest, higher = more permissions
  inheritsFrom: integer("inherits_from").references(() => permissionRoles.id),
  
  // Status
  isActive: boolean("is_active").default(true),
  isSystem: boolean("is_system").default(false), // System roles can't be deleted
  
  // Created by
  createdBy: integer("created_by").references(() => teamMembers.id).notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  teamIdIdx: index("permission_roles_team_id_idx").on(table.teamId),
  uniqueTeamName: unique().on(table.teamId, table.name),
}));

// User Role Assignments table - Assign roles to users
export const userRoleAssignments = pgTable("user_role_assignments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => teamMembers.id, { onDelete: "cascade" }).notNull(),
  roleId: integer("role_id").references(() => permissionRoles.id, { onDelete: "cascade" }).notNull(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  
  // Assignment details
  assignedBy: integer("assigned_by").references(() => teamMembers.id).notNull(),
  assignedAt: timestamp("assigned_at").defaultNow(),
  
  // Expiration
  expiresAt: timestamp("expires_at"),
  
  // Status
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("user_role_assignments_user_id_idx").on(table.userId),
  roleIdIdx: index("user_role_assignments_role_id_idx").on(table.roleId),
  uniqueUserRole: unique().on(table.userId, table.roleId, table.teamId),
}));

// Relations for permissions and security tables
export const resourcePermissionsRelations = relations(resourcePermissions, ({ one }) => ({
  team: one(teams, {
    fields: [resourcePermissions.teamId],
    references: [teams.id],
  }),
  user: one(teamMembers, {
    fields: [resourcePermissions.userId],
    references: [teamMembers.id],
  }),
  grantedByUser: one(teamMembers, {
    fields: [resourcePermissions.grantedBy],
    references: [teamMembers.id],
  }),
}));

export const officeAccessControlRelations = relations(officeAccessControl, ({ one }) => ({
  team: one(teams, {
    fields: [officeAccessControl.teamId],
    references: [teams.id],
  }),
  user: one(teamMembers, {
    fields: [officeAccessControl.userId],
    references: [teamMembers.id],
  }),
  grantedByUser: one(teamMembers, {
    fields: [officeAccessControl.grantedBy],
    references: [teamMembers.id],
  }),
}));

export const securityAuditTrailRelations = relations(securityAuditTrail, ({ one }) => ({
  team: one(teams, {
    fields: [securityAuditTrail.teamId],
    references: [teams.id],
  }),
  user: one(teamMembers, {
    fields: [securityAuditTrail.userId],
    references: [teamMembers.id],
  }),
}));

export const twoFactorAuthRelations = relations(twoFactorAuth, ({ one }) => ({
  user: one(teamMembers, {
    fields: [twoFactorAuth.userId],
    references: [teamMembers.id],
  }),
}));

export const ipWhitelistRelations = relations(ipWhitelist, ({ one }) => ({
  team: one(teams, {
    fields: [ipWhitelist.teamId],
    references: [teams.id],
  }),
  addedByUser: one(teamMembers, {
    fields: [ipWhitelist.addedBy],
    references: [teamMembers.id],
  }),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(teamMembers, {
    fields: [userSessions.userId],
    references: [teamMembers.id],
  }),
}));

export const permissionRolesRelations = relations(permissionRoles, ({ one, many }) => ({
  team: one(teams, {
    fields: [permissionRoles.teamId],
    references: [teams.id],
  }),
  creator: one(teamMembers, {
    fields: [permissionRoles.createdBy],
    references: [teamMembers.id],
  }),
  parentRole: one(permissionRoles, {
    fields: [permissionRoles.inheritsFrom],
    references: [permissionRoles.id],
  }),
  assignments: many(userRoleAssignments),
}));

export const userRoleAssignmentsRelations = relations(userRoleAssignments, ({ one }) => ({
  user: one(teamMembers, {
    fields: [userRoleAssignments.userId],
    references: [teamMembers.id],
  }),
  role: one(permissionRoles, {
    fields: [userRoleAssignments.roleId],
    references: [permissionRoles.id],
  }),
  team: one(teams, {
    fields: [userRoleAssignments.teamId],
    references: [teams.id],
  }),
  assignedByUser: one(teamMembers, {
    fields: [userRoleAssignments.assignedBy],
    references: [teamMembers.id],
  }),
}));

// Type exports for permissions and security tables
export type InsertResourcePermission = typeof resourcePermissions.$inferInsert;
export type ResourcePermission = typeof resourcePermissions.$inferSelect;

export type InsertOfficeAccessControl = typeof officeAccessControl.$inferInsert;
export type OfficeAccessControl = typeof officeAccessControl.$inferSelect;

export type InsertSecurityAuditTrail = typeof securityAuditTrail.$inferInsert;
export type SecurityAuditTrail = typeof securityAuditTrail.$inferSelect;

export type InsertTwoFactorAuth = typeof twoFactorAuth.$inferInsert;
export type TwoFactorAuth = typeof twoFactorAuth.$inferSelect;

export type InsertIpWhitelist = typeof ipWhitelist.$inferInsert;
export type IpWhitelist = typeof ipWhitelist.$inferSelect;

export type InsertUserSession = typeof userSessions.$inferInsert;
export type UserSession = typeof userSessions.$inferSelect;

export type InsertPermissionRole = typeof permissionRoles.$inferInsert;
export type PermissionRole = typeof permissionRoles.$inferSelect;

export type InsertUserRoleAssignment = typeof userRoleAssignments.$inferInsert;
export type UserRoleAssignment = typeof userRoleAssignments.$inferSelect;


// Google Drive Connections table - Team and Office-level Google Drive integration
export const googleDriveConnections = pgTable("google_drive_connections", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => teamMembers.id, { onDelete: "cascade" }),
  officeRole: text("office_role"), // 'project_manager', 'lead_researcher', etc. - null for team-level
  
  // Connection type
  connectionType: text("connection_type").notNull(), // 'team' or 'office'
  
  // Google Drive details
  driveId: text("drive_id"), // Google Drive ID (for shared drives)
  driveName: text("drive_name"),
  driveUrl: text("drive_url").notNull(),
  
  // OAuth tokens (encrypted)
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  
  // Sync settings
  autoSync: boolean("auto_sync").default(false),
  syncFolders: jsonb("sync_folders"), // array of folder IDs to sync
  lastSyncedAt: timestamp("last_synced_at"),
  
  // Status
  isActive: boolean("is_active").default(true),
  
  // Metadata
  connectedBy: integer("connected_by").references(() => teamMembers.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  teamIdIdx: index("google_drive_connections_team_id_idx").on(table.teamId),
  userIdIdx: index("google_drive_connections_user_id_idx").on(table.userId),
  officeRoleIdx: index("google_drive_connections_office_role_idx").on(table.officeRole),
}));

// Google Drive Files Cache table - Cache Google Drive file metadata
export const googleDriveFilesCache = pgTable("google_drive_files_cache", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").references(() => googleDriveConnections.id, { onDelete: "cascade" }).notNull(),
  
  // Google Drive file details
  googleFileId: text("google_file_id").notNull().unique(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size"),
  webViewLink: text("web_view_link"),
  webContentLink: text("web_content_link"),
  thumbnailLink: text("thumbnail_link"),
  
  // Folder structure
  parentFolderId: text("parent_folder_id"),
  folderPath: text("folder_path"),
  
  // Metadata
  createdTime: timestamp("created_time"),
  modifiedTime: timestamp("modified_time"),
  owners: jsonb("owners"), // array of owner info
  
  // Cache info
  lastFetchedAt: timestamp("last_fetched_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  connectionIdIdx: index("google_drive_files_cache_connection_id_idx").on(table.connectionId),
  googleFileIdIdx: index("google_drive_files_cache_google_file_id_idx").on(table.googleFileId),
}));

// Relations for Google Drive tables
export const googleDriveConnectionsRelations = relations(googleDriveConnections, ({ one, many }) => ({
  team: one(teams, {
    fields: [googleDriveConnections.teamId],
    references: [teams.id],
  }),
  user: one(teamMembers, {
    fields: [googleDriveConnections.userId],
    references: [teamMembers.id],
  }),
  connectedByUser: one(teamMembers, {
    fields: [googleDriveConnections.connectedBy],
    references: [teamMembers.id],
  }),
  filesCache: many(googleDriveFilesCache),
}));

export const googleDriveFilesCacheRelations = relations(googleDriveFilesCache, ({ one }) => ({
  connection: one(googleDriveConnections, {
    fields: [googleDriveFilesCache.connectionId],
    references: [googleDriveConnections.id],
  }),
}));

// Type exports for Google Drive tables
export type InsertGoogleDriveConnection = typeof googleDriveConnections.$inferInsert;
export type GoogleDriveConnection = typeof googleDriveConnections.$inferSelect;

export type InsertGoogleDriveFileCache = typeof googleDriveFilesCache.$inferInsert;
export type GoogleDriveFileCache = typeof googleDriveFilesCache.$inferSelect;

// ─── Mobile Push Tokens ───────────────────────────────────────────────────────
// Stores Expo push tokens for mobile push notification delivery.
export const userPushTokens = pgTable("user_push_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => teamMembers.id, { onDelete: "cascade" }).notNull(),
  pushToken: text("push_token").notNull(),
  platform: text("platform"), // 'ios' | 'android'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type InsertUserPushToken = typeof userPushTokens.$inferInsert;
export type UserPushToken = typeof userPushTokens.$inferSelect;

// ─── Telegram Idea Workflow ────────────────────────────────────────────────────

/**
 * Links a Telegram user to a team member so the PM can reach them via WhatsApp.
 */
export const telegramUsers = pgTable("telegram_users", {
  id: serial("id").primaryKey(),
  telegramId: text("telegram_id").notNull().unique(),
  telegramUsername: text("telegram_username"),
  telegramFirstName: text("telegram_first_name"),
  teamMemberId: integer("team_member_id").references(() => teamMembers.id, { onDelete: "set null" }),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }),
  whatsappNumber: text("whatsapp_number"), // e.g. "2348012345678" — used for wa.me links
  isRegistered: boolean("is_registered").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type InsertTelegramUser = typeof telegramUsers.$inferInsert;
export type TelegramUser = typeof telegramUsers.$inferSelect;

/**
 * Raw idea captured from Telegram before LLM processing.
 */
export const rawIdeas = pgTable("raw_ideas", {
  id: serial("id").primaryKey(),
  telegramUserId: integer("telegram_user_id").references(() => telegramUsers.id, { onDelete: "cascade" }).notNull(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }),
  messageId: text("message_id"),                      // Telegram message ID
  type: text("type").notNull(),                        // 'text' | 'image' | 'audio' | 'document'
  rawText: text("raw_text"),                           // Original text or caption
  mediaUrl: text("media_url"),                         // S3 URL after download
  transcription: text("transcription"),                // For audio messages
  status: text("status").default("pending").notNull(), // 'pending' | 'processing' | 'processed' | 'failed'
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  processedAt: timestamp("processed_at"),
});

export type InsertRawIdea = typeof rawIdeas.$inferInsert;
export type RawIdea = typeof rawIdeas.$inferSelect;

/**
 * LLM-refined idea ready for PM review.
 */
export const processedIdeas = pgTable("processed_ideas", {
  id: serial("id").primaryKey(),
  rawIdeaId: integer("raw_idea_id").references(() => rawIdeas.id, { onDelete: "cascade" }).notNull(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }),
  telegramUserId: integer("telegram_user_id").references(() => telegramUsers.id, { onDelete: "set null" }),

  // LLM output
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  refinedDescription: text("refined_description").notNull(),
  category: text("category").notNull(),             // 'product' | 'process' | 'marketing' | 'technical' | 'other'
  priority: text("priority").notNull(),             // 'low' | 'medium' | 'high' | 'critical'
  estimatedImpact: text("estimated_impact"),
  suggestedNextSteps: jsonb("suggested_next_steps"),// string[]
  llmRawOutput: jsonb("llm_raw_output"),            // Full LLM response for audit

  // PM workflow
  pmNotes: text("pm_notes"),
  status: text("status").default("inbox").notNull(), // 'inbox' | 'reviewing' | 'sent_to_conference' | 'archived' | 'converted'
  sentToPmAt: timestamp("sent_to_pm_at"),
  sentToConferenceAt: timestamp("sent_to_conference_at"),
  approvalId: integer("approval_id"),               // Set when sent to conference room

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type InsertProcessedIdea = typeof processedIdeas.$inferInsert;
export type ProcessedIdea = typeof processedIdeas.$inferSelect;
