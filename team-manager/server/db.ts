import { eq, and, or, isNull, desc, gte, lte, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
const { Pool } = pg;
import { InsertUser, users, teamMembers, InsertTeamMember, TeamMember, auditLogs, InsertAuditLog, teams, InsertTeam, Team, teamMembersCollaborative, InsertTeamMemberCollaborative, TeamMemberCollaborative, teamInvitations, InsertTeamInvitation, TeamInvitation, tasks, InsertTask, Task, clients, InsertClient, Client, projects, InsertProject, Project, projectFiles, InsertProjectFile, ProjectFile, activities, InsertActivity, Activity, repositories, InsertRepository, Repository, messages, Message, InsertMessage, approvals, InsertApproval, Approval, chatMessages, InsertChatMessage, ChatMessage, notifications, userPushTokens, oauthTokens } from "../drizzle/schema";
import { ENV } from './_core/env';
import { randomBytes } from 'crypto';
import { broadcastTaskCreated, broadcastTaskUpdated, broadcastTaskMoved, broadcastTaskDeleted, broadcastToMember } from './socket-server';
import { checkTeamLimit, checkProjectLimit, checkStorageLimit } from './meta.js';
import { notifyTaskChanged } from './deadline-tracker.js';
import { encrypt, decrypt, generateToken } from './crypto';
import { GitHubService, parseGitHubUrl } from './github-service';

// Team Role Permissions
export const TEAM_PERMISSIONS: Record<string, string[]> = {
  admin: ['create_team', 'delete_team', 'update_team', 'invite_member', 'remove_member', 'change_role', 'create_task', 'update_task', 'delete_task', 'manage_repositories', 'delete_document', 'grant_permission', 'assign_role', 'view_audit_trail'],
  team_lead: ['update_team', 'invite_member', 'create_task', 'update_task', 'delete_task', 'manage_repositories', 'delete_document', 'view_audit_trail'],
  developer: ['create_task', 'update_task'],
  member: ['create_task', 'update_task'],
  viewer: [],
};

export type TeamRole = 'admin' | 'team_lead' | 'developer' | 'member' | 'viewer';

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

      // Auto-migrate missing tables
      try {
        await _pool.query(`
          CREATE TABLE IF NOT EXISTS "notification_preferences" (
            "id" serial PRIMARY KEY NOT NULL,
            "user_id" integer NOT NULL,
            "team_id" integer NOT NULL,
            "email_enabled" boolean DEFAULT true,
            "push_enabled" boolean DEFAULT true,
            "in_app_enabled" boolean DEFAULT true,
            "task_assignments" boolean DEFAULT true,
            "task_deadlines" boolean DEFAULT true,
            "mentions" boolean DEFAULT true,
            "approval_requests" boolean DEFAULT true,
            "folder_alerts" boolean DEFAULT true,
            "project_updates" boolean DEFAULT true,
            "team_messages" boolean DEFAULT true,
            "high_priority_only" boolean DEFAULT false,
            "quiet_hours_enabled" boolean DEFAULT false,
            "quiet_hours_start" text DEFAULT '22:00',
            "quiet_hours_end" text DEFAULT '08:00',
            "quiet_hours_timezone" text DEFAULT 'UTC',
            "daily_digest_enabled" boolean DEFAULT false,
            "daily_digest_time" text DEFAULT '08:00',
            "daily_digest_timezone" text DEFAULT 'UTC',
            "created_at" timestamp DEFAULT now(),
            "updated_at" timestamp DEFAULT now()
          );

          CREATE TABLE IF NOT EXISTS "call_messages" (
            "id" serial PRIMARY KEY NOT NULL,
            "call_id" integer NOT NULL,
            "user_id" integer NOT NULL,
            "message" text NOT NULL,
            "message_type" text DEFAULT 'text',
            "file_url" text,
            "file_name" text,
            "created_at" timestamp DEFAULT now()
          );

          ALTER TABLE users ADD COLUMN IF NOT EXISTS username text UNIQUE;

          -- Ensure every user row has a matching team_members row (FK target
          -- for team_members_collaborative). This is NOT team membership by
          -- itself — it does not add anyone to any team.
          INSERT INTO "team_members" ("id", "name", "email", "position")
          SELECT u.id, COALESCE(u.name, split_part(u.email, '@', 1), 'Unknown User'), u.email, 'Member'
          FROM "users" u
          WHERE NOT EXISTS (
              SELECT 1 FROM "team_members" tm
              WHERE tm.id = u.id
          );
        `);
        console.log("[Database] Auto-migration applied successfully.");
      } catch (err) {
        console.error("[Database] Auto-migration error:", err);
      }
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function ensureMissingTables(): Promise<void> {
  try {
    const db = await getDb();
    if (!db || !_pool) return;
    await _pool.query(`
      CREATE TABLE IF NOT EXISTS "google_drive_connections" (
        "id" serial PRIMARY KEY,
        "team_id" integer REFERENCES "teams"("id") ON DELETE cascade,
        "user_id" integer REFERENCES "team_members"("id") ON DELETE cascade,
        "office_role" text,
        "connection_type" text NOT NULL,
        "drive_id" text,
        "drive_name" text,
        "drive_url" text NOT NULL,
        "access_token" text,
        "refresh_token" text,
        "token_expires_at" timestamp,
        "auto_sync" boolean DEFAULT false,
        "sync_folders" jsonb,
        "last_synced_at" timestamp,
        "is_active" boolean DEFAULT true,
        "connected_by" integer NOT NULL REFERENCES "team_members"("id"),
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "google_drive_connections_team_id_idx" ON "google_drive_connections" ("team_id");
      CREATE INDEX IF NOT EXISTS "google_drive_connections_user_id_idx" ON "google_drive_connections" ("user_id");
      CREATE INDEX IF NOT EXISTS "google_drive_connections_office_role_idx" ON "google_drive_connections" ("office_role");

      CREATE TABLE IF NOT EXISTS "google_drive_files_cache" (
        "id" serial PRIMARY KEY,
        "connection_id" integer NOT NULL REFERENCES "google_drive_connections"("id") ON DELETE cascade,
        "google_file_id" text NOT NULL UNIQUE,
        "file_name" text NOT NULL,
        "mime_type" text NOT NULL,
        "file_size" integer,
        "web_view_link" text,
        "web_content_link" text,
        "thumbnail_link" text,
        "parent_folder_id" text,
        "folder_path" text,
        "created_time" timestamp,
        "modified_time" timestamp,
        "owners" jsonb,
        "last_fetched_at" timestamp DEFAULT now(),
        "created_at" timestamp DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "google_drive_files_cache_connection_id_idx" ON "google_drive_files_cache" ("connection_id");
      CREATE INDEX IF NOT EXISTS "google_drive_files_cache_google_file_id_idx" ON "google_drive_files_cache" ("google_file_id");

      CREATE TABLE IF NOT EXISTS "chat_messages" (
        "id" serial PRIMARY KEY,
        "team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
        "from_member_id" integer NOT NULL REFERENCES "team_members"("id") ON DELETE cascade,
        "to_member_id" integer NOT NULL REFERENCES "team_members"("id") ON DELETE cascade,
        "content" text NOT NULL,
        "message_type" text DEFAULT 'text',
        "file_url" text,
        "file_name" text,
        "read_at" timestamp,
        "created_at" timestamp DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "chat_messages_from_idx" ON "chat_messages" ("from_member_id");
      CREATE INDEX IF NOT EXISTS "chat_messages_to_idx" ON "chat_messages" ("to_member_id");
      CREATE INDEX IF NOT EXISTS "chat_messages_team_idx" ON "chat_messages" ("team_id");
    `);
    console.log("[Database] Ensured google_drive_connections, google_drive_files_cache, and chat_messages tables exist.");

    // Add username and avatar_url columns to users table (added in PR #15)
    await _pool.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" text;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" text;
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'users_username_unique'
        ) THEN
          ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE ("username");
        END IF;
      END $$;
    `);
    console.log("[Database] Ensured users.username and users.avatar_url columns exist.");

    // Create tables that were added to drizzle/schema.ts but never had a
    // migration generated for them (see drizzle/0019_add_missing_security_client_video_tables.sql).
    // Several security/client-portal/video-call features were silently
    // non-functional in any environment that didn't manually run `npm run db:push`.
    await _pool.query(`
      CREATE TABLE IF NOT EXISTS "video_calls" (
        "id" serial PRIMARY KEY NOT NULL,
        "team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
        "project_id" integer REFERENCES "projects"("id") ON DELETE cascade,
        "title" text NOT NULL,
        "description" text,
        "call_type" text NOT NULL,
        "office_role" text,
        "status" text DEFAULT 'scheduled',
        "scheduled_start_time" timestamp,
        "actual_start_time" timestamp,
        "end_time" timestamp,
        "duration" integer,
        "integration_type" text,
        "external_meeting_id" text,
        "meeting_url" text,
        "meeting_password" text,
        "room_id" text UNIQUE,
        "is_recorded" boolean DEFAULT false,
        "recording_url" text,
        "recording_duration" integer,
        "host_id" integer NOT NULL REFERENCES "team_members"("id"),
        "participants" jsonb,
        "max_participants" integer DEFAULT 50,
        "screen_sharing_enabled" boolean DEFAULT true,
        "recording_enabled" boolean DEFAULT false,
        "chat_enabled" boolean DEFAULT true,
        "metadata" jsonb,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "video_calls_team_id_idx" ON "video_calls" ("team_id");
      CREATE INDEX IF NOT EXISTS "video_calls_status_idx" ON "video_calls" ("status");
      CREATE INDEX IF NOT EXISTS "video_calls_room_id_idx" ON "video_calls" ("room_id");

      CREATE TABLE IF NOT EXISTS "call_participants" (
        "id" serial PRIMARY KEY NOT NULL,
        "call_id" integer NOT NULL REFERENCES "video_calls"("id") ON DELETE cascade,
        "user_id" integer NOT NULL REFERENCES "team_members"("id") ON DELETE cascade,
        "joined_at" timestamp NOT NULL,
        "left_at" timestamp,
        "duration" integer,
        "is_muted" boolean DEFAULT false,
        "is_video_on" boolean DEFAULT true,
        "is_sharing_screen" boolean DEFAULT false,
        "connection_quality" text,
        "created_at" timestamp DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "call_participants_call_id_idx" ON "call_participants" ("call_id");
      CREATE INDEX IF NOT EXISTS "call_participants_user_id_idx" ON "call_participants" ("user_id");

      CREATE TABLE IF NOT EXISTS "office_rooms" (
        "id" serial PRIMARY KEY NOT NULL,
        "team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
        "name" text NOT NULL,
        "description" text,
        "office_role" text NOT NULL,
        "is_active" boolean DEFAULT true,
        "is_permanent" boolean DEFAULT true,
        "max_participants" integer DEFAULT 10,
        "is_public" boolean DEFAULT true,
        "allowed_users" jsonb,
        "current_call_id" integer REFERENCES "video_calls"("id"),
        "active_participants" integer DEFAULT 0,
        "screen_sharing_enabled" boolean DEFAULT true,
        "recording_enabled" boolean DEFAULT false,
        "chat_enabled" boolean DEFAULT true,
        "knock_to_enter" boolean DEFAULT false,
        "created_by" integer NOT NULL REFERENCES "team_members"("id"),
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "office_rooms_team_id_idx" ON "office_rooms" ("team_id");
      CREATE INDEX IF NOT EXISTS "office_rooms_office_role_idx" ON "office_rooms" ("office_role");

      CREATE TABLE IF NOT EXISTS "notification_rules" (
        "id" serial PRIMARY KEY NOT NULL,
        "team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
        "name" text NOT NULL,
        "description" text,
        "rule_type" text NOT NULL,
        "conditions" jsonb,
        "threshold_hours" integer,
        "threshold_days" integer,
        "notification_type" text NOT NULL,
        "notification_priority" text DEFAULT 'normal',
        "is_active" boolean DEFAULT true,
        "last_triggered" timestamp,
        "created_by" integer REFERENCES "team_members"("id"),
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "daily_digest_queue" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" integer NOT NULL REFERENCES "team_members"("id") ON DELETE cascade,
        "team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
        "digest_date" date NOT NULL,
        "scheduled_time" timestamp NOT NULL,
        "tasks_due_today" jsonb,
        "tasks_overdue" jsonb,
        "approvals_pending" jsonb,
        "folders_idle" jsonb,
        "unread_mentions" jsonb,
        "status" text DEFAULT 'pending',
        "sent_at" timestamp,
        "error" text,
        "created_at" timestamp DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "client_portal_access" (
        "id" serial PRIMARY KEY NOT NULL,
        "client_id" integer NOT NULL REFERENCES "clients"("id") ON DELETE cascade,
        "team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
        "email" text NOT NULL UNIQUE,
        "password_hash" text,
        "is_active" boolean DEFAULT true,
        "can_view_projects" boolean DEFAULT true,
        "can_view_deliverables" boolean DEFAULT true,
        "can_leave_feedback" boolean DEFAULT true,
        "can_approve" boolean DEFAULT false,
        "custom_logo" text,
        "brand_color" text,
        "white_label" boolean DEFAULT false,
        "last_login" timestamp,
        "login_token" text,
        "token_expires_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "client_feedback" (
        "id" serial PRIMARY KEY NOT NULL,
        "client_id" integer NOT NULL REFERENCES "clients"("id") ON DELETE cascade,
        "project_id" integer NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
        "team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
        "feedback_type" text NOT NULL,
        "subject" text NOT NULL,
        "message" text NOT NULL,
        "rating" integer,
        "deliverable_id" integer,
        "file_id" integer REFERENCES "files"("id"),
        "status" text DEFAULT 'pending',
        "reviewed_by" integer REFERENCES "team_members"("id"),
        "reviewed_at" timestamp,
        "response" text,
        "attachments" jsonb,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "client_activity_log" (
        "id" serial PRIMARY KEY NOT NULL,
        "client_id" integer NOT NULL REFERENCES "clients"("id") ON DELETE cascade,
        "team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
        "activity_type" text NOT NULL,
        "description" text NOT NULL,
        "project_id" integer REFERENCES "projects"("id"),
        "file_id" integer REFERENCES "files"("id"),
        "ip_address" text,
        "user_agent" text,
        "metadata" jsonb,
        "created_at" timestamp DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "client_project_visibility" (
        "id" serial PRIMARY KEY NOT NULL,
        "client_id" integer NOT NULL REFERENCES "clients"("id") ON DELETE cascade,
        "project_id" integer NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
        "team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
        "is_visible" boolean DEFAULT true,
        "can_view_files" boolean DEFAULT true,
        "can_download_files" boolean DEFAULT false,
        "can_view_tasks" boolean DEFAULT false,
        "can_view_timeline" boolean DEFAULT true,
        "custom_status" text,
        "custom_description" text,
        "created_at" timestamp DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "resource_permissions" (
        "id" serial PRIMARY KEY NOT NULL,
        "team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
        "user_id" integer NOT NULL REFERENCES "team_members"("id") ON DELETE cascade,
        "resource_type" text NOT NULL,
        "resource_id" integer NOT NULL,
        "permission" text NOT NULL,
        "granted_by" integer NOT NULL REFERENCES "team_members"("id"),
        "granted_at" timestamp DEFAULT now(),
        "expires_at" timestamp,
        "reason" text,
        "metadata" jsonb,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "resource_permissions_user_id_resource_type_resource_id_unique" UNIQUE("user_id","resource_type","resource_id")
      );
      CREATE INDEX IF NOT EXISTS "resource_permissions_team_id_idx" ON "resource_permissions" ("team_id");
      CREATE INDEX IF NOT EXISTS "resource_permissions_user_id_idx" ON "resource_permissions" ("user_id");
      CREATE INDEX IF NOT EXISTS "resource_permissions_resource_idx" ON "resource_permissions" ("resource_type","resource_id");

      CREATE TABLE IF NOT EXISTS "office_access_control" (
        "id" serial PRIMARY KEY NOT NULL,
        "team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
        "user_id" integer NOT NULL REFERENCES "team_members"("id") ON DELETE cascade,
        "office_role" text NOT NULL,
        "access_level" text NOT NULL,
        "can_view_tasks" boolean DEFAULT true,
        "can_edit_tasks" boolean DEFAULT false,
        "can_delete_tasks" boolean DEFAULT false,
        "can_view_files" boolean DEFAULT true,
        "can_upload_files" boolean DEFAULT false,
        "can_delete_files" boolean DEFAULT false,
        "can_invite_members" boolean DEFAULT false,
        "can_manage_permissions" boolean DEFAULT false,
        "granted_by" integer NOT NULL REFERENCES "team_members"("id"),
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "office_access_control_user_id_office_role_team_id_unique" UNIQUE("user_id","office_role","team_id")
      );
      CREATE INDEX IF NOT EXISTS "office_access_control_team_id_idx" ON "office_access_control" ("team_id");
      CREATE INDEX IF NOT EXISTS "office_access_control_user_id_idx" ON "office_access_control" ("user_id");

      CREATE TABLE IF NOT EXISTS "security_audit_trail" (
        "id" serial PRIMARY KEY NOT NULL,
        "team_id" integer REFERENCES "teams"("id") ON DELETE cascade,
        "user_id" integer REFERENCES "team_members"("id"),
        "action" text NOT NULL,
        "resource_type" text,
        "resource_id" integer,
        "status" text NOT NULL,
        "description" text NOT NULL,
        "changes" jsonb,
        "ip_address" text NOT NULL,
        "user_agent" text,
        "session_id" text,
        "location" text,
        "risk_level" text DEFAULT 'low',
        "flagged" boolean DEFAULT false,
        "metadata" jsonb,
        "timestamp" timestamp DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "security_audit_trail_team_id_idx" ON "security_audit_trail" ("team_id");
      CREATE INDEX IF NOT EXISTS "security_audit_trail_user_id_idx" ON "security_audit_trail" ("user_id");
      CREATE INDEX IF NOT EXISTS "security_audit_trail_action_idx" ON "security_audit_trail" ("action");
      CREATE INDEX IF NOT EXISTS "security_audit_trail_timestamp_idx" ON "security_audit_trail" ("timestamp");
      CREATE INDEX IF NOT EXISTS "security_audit_trail_flagged_idx" ON "security_audit_trail" ("flagged");

      CREATE TABLE IF NOT EXISTS "two_factor_auth" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" integer NOT NULL UNIQUE REFERENCES "team_members"("id") ON DELETE cascade,
        "method" text NOT NULL,
        "totp_secret" text,
        "totp_enabled" boolean DEFAULT false,
        "phone_number" text,
        "sms_enabled" boolean DEFAULT false,
        "email_enabled" boolean DEFAULT false,
        "backup_codes" jsonb,
        "backup_codes_used" jsonb,
        "is_enabled" boolean DEFAULT false,
        "is_verified" boolean DEFAULT false,
        "recovery_email" text,
        "last_used" timestamp,
        "failed_attempts" integer DEFAULT 0,
        "locked_until" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "ip_whitelist" (
        "id" serial PRIMARY KEY NOT NULL,
        "team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
        "ip_address" text NOT NULL,
        "ip_range" text,
        "label" text NOT NULL,
        "description" text,
        "is_active" boolean DEFAULT true,
        "applies_to_all_users" boolean DEFAULT true,
        "specific_users" jsonb,
        "added_by" integer NOT NULL REFERENCES "team_members"("id"),
        "expires_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "ip_whitelist_team_id_idx" ON "ip_whitelist" ("team_id");
      CREATE INDEX IF NOT EXISTS "ip_whitelist_ip_address_idx" ON "ip_whitelist" ("ip_address");

      CREATE TABLE IF NOT EXISTS "user_sessions" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" integer NOT NULL REFERENCES "team_members"("id") ON DELETE cascade,
        "session_token" text NOT NULL UNIQUE,
        "refresh_token" text UNIQUE,
        "device_id" text,
        "device_name" text,
        "device_type" text,
        "browser" text,
        "os" text,
        "ip_address" text NOT NULL,
        "location" text,
        "is_active" boolean DEFAULT true,
        "last_activity" timestamp DEFAULT now(),
        "expires_at" timestamp NOT NULL,
        "is_trusted" boolean DEFAULT false,
        "requires_verification" boolean DEFAULT false,
        "created_at" timestamp DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "user_sessions_user_id_idx" ON "user_sessions" ("user_id");
      CREATE INDEX IF NOT EXISTS "user_sessions_session_token_idx" ON "user_sessions" ("session_token");
      CREATE INDEX IF NOT EXISTS "user_sessions_is_active_idx" ON "user_sessions" ("is_active");

      CREATE TABLE IF NOT EXISTS "permission_roles" (
        "id" serial PRIMARY KEY NOT NULL,
        "team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
        "name" text NOT NULL,
        "description" text,
        "permissions" jsonb NOT NULL,
        "level" integer DEFAULT 0,
        "inherits_from" integer REFERENCES "permission_roles"("id"),
        "is_active" boolean DEFAULT true,
        "is_system" boolean DEFAULT false,
        "created_by" integer NOT NULL REFERENCES "team_members"("id"),
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "permission_roles_team_id_name_unique" UNIQUE("team_id","name")
      );
      CREATE INDEX IF NOT EXISTS "permission_roles_team_id_idx" ON "permission_roles" ("team_id");

      CREATE TABLE IF NOT EXISTS "user_role_assignments" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" integer NOT NULL REFERENCES "team_members"("id") ON DELETE cascade,
        "role_id" integer NOT NULL REFERENCES "permission_roles"("id") ON DELETE cascade,
        "team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
        "assigned_by" integer NOT NULL REFERENCES "team_members"("id"),
        "assigned_at" timestamp DEFAULT now(),
        "expires_at" timestamp,
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now(),
        CONSTRAINT "user_role_assignments_user_id_role_id_team_id_unique" UNIQUE("user_id","role_id","team_id")
      );
      CREATE INDEX IF NOT EXISTS "user_role_assignments_user_id_idx" ON "user_role_assignments" ("user_id");
      CREATE INDEX IF NOT EXISTS "user_role_assignments_role_id_idx" ON "user_role_assignments" ("role_id");
    `);
    console.log("[Database] Ensured security/client-portal/video-call tables exist (resource_permissions, office_access_control, security_audit_trail, two_factor_auth, ip_whitelist, user_sessions, permission_roles, user_role_assignments, client_portal_access, client_feedback, client_activity_log, client_project_visibility, video_calls, call_participants, office_rooms, notification_rules, daily_digest_queue).");
  } catch (err) {
    console.warn("[Database] ensureMissingTables error:", err);
  }
}

export async function sendNotification(params: {
  userId: number;
  teamId: number;
  type: string;
  title: string;
  message: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  taskId?: number;
  projectId?: number;
  actionUrl?: string;
  actionLabel?: string;
}, dbClient?: any) {
  console.log('[NotificationSystem] Entering sendNotification with params:', JSON.stringify(params, null, 2));
  try {
    const db = dbClient || await getDb();
    if (!db) {
      console.error('[NotificationSystem] Failed: db connection not available');
      return;
    }
    
    console.log('[NotificationSystem] Attempting to insert notification into database...');
    const [notif] = await db
      .insert(notifications)
      .values({
        userId: params.userId,
        teamId: params.teamId,
        type: params.type as any,
        title: params.title,
        message: params.message,
        priority: (params.priority || 'medium') as any,
        taskId: params.taskId ?? null,
        projectId: params.projectId ?? null,
        actionUrl: params.actionUrl ?? null,
        actionLabel: params.actionLabel ?? null,
        isRead: false,
        sentInApp: true,
      })
      .returning();
      
    console.log('[NotificationSystem] DB Insert successful. Notification record:', JSON.stringify(notif, null, 2));

    console.log('[NotificationSystem] Calling broadcastToMember for userId:', params.userId);
    broadcastToMember(params.userId, 'notification', notif);
    console.log('[NotificationSystem] broadcastToMember completed.');

    // Send Expo push notification
    console.log('[NotificationSystem] Checking notification preferences for userId:', params.userId);
    const { notificationPreferences } = await import('../drizzle/schema.js');
    const [prefs] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, params.userId));
    
    // Default to true if no preferences are found (opt-in by default)
    let shouldSendPush = true;
    if (prefs) {
      if (!prefs.pushEnabled) {
        shouldSendPush = false;
        console.log('[NotificationSystem] Push notifications disabled globally by user.');
      } else {
        // Map notification type to preference column
        switch (params.type) {
          case 'task_assignment':
            shouldSendPush = prefs.taskAssignments !== false;
            break;
          case 'task_deadline':
            shouldSendPush = prefs.taskDeadlines !== false;
            break;
          case 'mention':
          case 'team_messages':
            shouldSendPush = prefs.mentions !== false;
            break;
          case 'approval_request':
            shouldSendPush = prefs.approvalRequests !== false;
            break;
          case 'folder_alert':
            shouldSendPush = prefs.folderAlerts !== false;
            break;
        }
      }
    }

    if (!shouldSendPush) {
      console.log(`[NotificationSystem] Push notification skipped based on user preference for type: ${params.type}`);
      return notif;
    }

    console.log('[NotificationSystem] Querying for Expo push tokens for userId:', params.userId);
    const pushRecords = await db
      .select({ pushToken: userPushTokens.pushToken })
      .from(userPushTokens)
      .where(eq(userPushTokens.userId, params.userId));
      
    console.log(`[NotificationSystem] Found ${pushRecords.length} push tokens for user.`);

    if (pushRecords.length > 0) {
      const messages = pushRecords.map(record => ({
        to: record.pushToken,
        sound: 'default',
        title: params.title,
        body: params.message,
        data: {
          actionUrl: params.actionUrl,
          taskId: params.taskId,
          projectId: params.projectId,
        },
      }));

      console.log('[NotificationSystem] Sending to Expo push API:', JSON.stringify(messages, null, 2));

      fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      }).then(async (res) => {
        console.log('[NotificationSystem] Expo push API responded with status:', res.status);
        if (res.ok) {
          const response = await res.json();
          console.log('[NotificationSystem] Expo response data:', JSON.stringify(response, null, 2));
          const tokensToDelete: string[] = [];
          if (response.data && Array.isArray(response.data)) {
            const ticketIds: string[] = [];
            response.data.forEach((ticket: any, index: number) => {
              if (ticket.status === 'ok' && ticket.id) {
                ticketIds.push(ticket.id);
              }
              if (ticket.status === 'error' && ticket.details && (ticket.details.error === 'DeviceNotRegistered' || ticket.details.error === 'InvalidCredentials')) {
                console.warn(`[NotificationSystem] Invalid token detected: ${messages[index].to}, error: ${ticket.details.error}`);
                tokensToDelete.push(messages[index].to);
              }
            });
            
            // Query receipts for debugging
            if (ticketIds.length > 0) {
              console.log(`[NotificationSystem] Querying receipts for ${ticketIds.length} tickets in 3 seconds...`);
              setTimeout(async () => {
                try {
                  const receiptRes = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: ticketIds })
                  });
                  if (receiptRes.ok) {
                    const receiptData = await receiptRes.json();
                    console.log('[NotificationSystem] Expo receipt data:', JSON.stringify(receiptData, null, 2));
                  } else {
                    console.error('[NotificationSystem] Failed to fetch receipts, status:', receiptRes.status);
                  }
                } catch (e) {
                  console.error('[NotificationSystem] Error fetching receipts:', e);
                }
              }, 3000);
            }
          }
          
          if (tokensToDelete.length > 0) {
            console.log(`[NotificationSystem] Deleting ${tokensToDelete.length} invalid tokens from database.`);
            await db.delete(userPushTokens).where(inArray(userPushTokens.pushToken, tokensToDelete));
          }
        } else {
          const errText = await res.text();
          console.error('[NotificationSystem] Expo API error response:', errText);
        }
      }).catch(err => {
        console.error('[NotificationSystem] Failed to send push notification via Expo:', err);
      });
    }

    return notif;
  } catch (err) {
    console.error('[NotificationSystem] CRITICAL ERROR in sendNotification:', err);
  }
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
    const [existing] = await tx.select({ id: users.id }).from(users).limit(1);
    const role = existing ? 'user' : 'admin';

    const result = await tx.insert(users).values({
      email: userData.email,
      passwordHash: userData.passwordHash,
      name: userData.name,
      loginMethod: 'email',
      role,
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

export async function updateUserProfile(
  userId: number,
  updates: { name?: string; username?: string; avatarUrl?: string }
): Promise<typeof users.$inferSelect> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.update(users)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();

  if (!result[0]) throw new Error("User not found");
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
      status: 'active',
    });

    return {
      ...newTeam,
      memberRole: 'admin' as TeamRole,
    };
  });
}

/**
 * One-time startup backfill: set status = 'active' for any
 * team_members_collaborative rows that still have NULL status.
 * These were created before migration 0009 added the status column.
 * Safe to run multiple times (WHERE status IS NULL is a no-op once done).
 */
export async function backfillTeamMemberStatus(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    const result = await db
      .update(teamMembersCollaborative)
      .set({ status: 'active' })
      .where(isNull(teamMembersCollaborative.status))
      .returning({ id: teamMembersCollaborative.id });
    if (result.length > 0) {
      console.log(`[DB] Backfilled status='active' on ${result.length} team_members_collaborative row(s)`);
    }
  } catch (err) {
    console.error('[DB] backfillTeamMemberStatus failed (non-fatal):', err);
  }
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
    .innerJoin(
      teamMembersCollaborative,
      and(
        eq(teams.id, teamMembersCollaborative.teamId),
        // Treat NULL status as 'active' — rows inserted before migration 0009
        // added the status column have NULL and must not be silently excluded.
        or(
          eq(teamMembersCollaborative.status, 'active'),
          isNull(teamMembersCollaborative.status)
        )
      )
    )
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
): Promise<(TeamMemberCollaborative & { member: typeof teamMembers.$inferSelect; userAvatarUrl: string | null })[]> {
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
      officeRole: teamMembersCollaborative.officeRole,
      joinedAt: teamMembersCollaborative.joinedAt,
      member: teamMembers,
      userAvatarUrl: users.avatarUrl,
    })
    .from(teamMembersCollaborative)
    .innerJoin(teamMembers, eq(teamMembersCollaborative.memberId, teamMembers.id))
    .leftJoin(users, eq(teamMembers.email, users.email))
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

  try {
    const { teams, users } = await import('../drizzle/schema.js');
    const [team] = await db.select({ name: teams.name }).from(teams).where(eq(teams.id, teamId)).limit(1);
    const [addedUser] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, memberId)).limit(1);
    
    const teamName = team?.name || 'a team';
    const memberName = addedUser?.name || addedUser?.email || 'A new member';
    
    const allMembers = await db
      .select({ userId: teamMembersCollaborative.memberId })
      .from(teamMembersCollaborative)
      .where(and(eq(teamMembersCollaborative.teamId, teamId), eq(teamMembersCollaborative.status, 'active')));

    for (const member of allMembers) {
      if (member.userId === memberId) {
        await sendNotification({
          userId: member.userId,
          teamId,
          type: 'team_messages',
          title: 'Welcome to the team!',
          message: `You have been added to ${teamName} as a ${role}.`,
          priority: 'high',
          actionUrl: '/teams',
          actionLabel: 'View Team'
        }, db);
      } else {
        await sendNotification({
          userId: member.userId,
          teamId,
          type: 'team_messages',
          title: 'New Team Member',
          message: `${memberName} has joined ${teamName}.`,
          priority: 'low',
          actionUrl: '/teams',
          actionLabel: 'View Team'
        }, db);
      }
    }
  } catch (err) {
    console.error('Failed to send add member notification:', err);
  }
}

/**
 * Remove a member from a team (for admins)
 */
export async function removeMemberFromTeam(teamId: number, memberId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(teamMembersCollaborative)
    .where(and(
      eq(teamMembersCollaborative.teamId, teamId),
      eq(teamMembersCollaborative.memberId, memberId)
    ));
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
        status: 'active',
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
 * Update team member's office role (Digital HQ assignment)
 */
export async function updateTeamMemberOfficeRole(
  teamId: number,
  targetMemberId: number,
  officeRole: string | null,
  changedBy: number
): Promise<TeamMemberCollaborative> {
  return await withTransaction(async (db) => {
    // Check changer has permission (admin or team_lead can assign offices)
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
      throw new ValidationError('Insufficient permissions to assign office roles');
    }

    // Update office role
    const [updated] = await db
      .update(teamMembersCollaborative)
      .set({ officeRole: officeRole })
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
    let shouldDeleteCompletely = false;
    
    await withTransaction(async (db) => {
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
        
      // Check if they have any other team memberships
      const remaining = await db
        .select({ id: teamMembersCollaborative.id })
        .from(teamMembersCollaborative)
        .where(eq(teamMembersCollaborative.memberId, targetMemberId))
        .limit(1);
        
      if (remaining.length === 0) {
        shouldDeleteCompletely = true;
      }
  
      // Send notification
      try {
        const { teams, users } = await import('../drizzle/schema.js');
        const [team] = await db.select({ name: teams.name }).from(teams).where(eq(teams.id, teamId)).limit(1);
        const [removedUser] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, targetMemberId)).limit(1);
        
        const teamName = team?.name || 'a team';
        const memberName = removedUser?.name || removedUser?.email || 'A member';
        
        // Notify the removed member
        await sendNotification({
          userId: targetMemberId,
          teamId,
          type: 'team_messages',
          title: 'Team Access Revoked',
          message: `You have been removed from ${teamName}.`,
          priority: 'high',
          actionUrl: '/',
          actionLabel: 'View Dashboard'
        }, db);
        
        // Notify the rest of the team
        const allMembers = await db
          .select({ userId: teamMembersCollaborative.memberId })
          .from(teamMembersCollaborative)
          .where(and(eq(teamMembersCollaborative.teamId, teamId), eq(teamMembersCollaborative.status, 'active')));
          
        for (const member of allMembers) {
          if (member.userId !== removedBy) {
            await sendNotification({
              userId: member.userId,
              teamId,
              type: 'team_messages',
              title: 'Member Removed',
              message: `${memberName} was removed from the team.`,
              priority: 'low',
              actionUrl: '/teams',
              actionLabel: 'View Team'
            }, db);
          }
        }
      } catch (err) {
        console.error('Failed to send remove member notification:', err);
      }

      return true;
    });
    
    if (shouldDeleteCompletely) {
      await permanentlyDeleteUser(targetMemberId);
    }
    
    return true;
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

/**
 * Get a user's role in a team (null if not a member)
 */
export async function getMemberRoleInTeam(
  teamId: number,
  userId: number
): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  const [membership] = await db
    .select({ role: teamMembersCollaborative.role })
    .from(teamMembersCollaborative)
    .where(
      and(
        eq(teamMembersCollaborative.teamId, teamId),
        eq(teamMembersCollaborative.memberId, userId),
        eq(teamMembersCollaborative.status, 'active')
      )
    )
    .limit(1);

  return membership?.role ?? null;
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

    // Notify assignee of new task assignment
    if (created.assignedTo && created.assignedTo !== creatorId) {
      await sendNotification({
        userId: created.assignedTo,
        teamId: task.teamId,
        type: 'task_assignment',
        title: 'New Task Assigned',
        message: `You have been assigned: "${created.title}"`,
        priority: (created.priority || 'medium') as any,
        taskId: created.id,
        actionUrl: `/tasks`,
        actionLabel: 'View Task',
      }, db);
    }

    notifyTaskChanged();
    return created;
  });
}

/**
 * Get tasks by team with optional filtering
 * Supports member-scoped view: only show tasks assigned to OR created by viewerMemberId
 */
export async function getTasksByTeam(
  teamId: number,
  filters?: {
    status?: string;
    assignedTo?: number;
    priority?: string;
    createdBy?: number;
    /** When set, returns only tasks where assignedTo=viewerMemberId OR createdBy=viewerMemberId */
    viewerMemberId?: number;
  }
): Promise<(Task & { assignee?: { id: number; name: string | null } | null; creator?: { id: number; name: string | null } | null })[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(tasks.teamId, teamId)];

  if (filters?.status) {
    conditions.push(eq(tasks.status, filters.status));
  }
  if (filters?.assignedTo) {
    conditions.push(eq(tasks.assignedTo, filters.assignedTo));
  }
  if (filters?.createdBy) {
    conditions.push(eq(tasks.createdBy, filters.createdBy));
  }
  if (filters?.priority) {
    conditions.push(eq(tasks.priority, filters.priority));
  }
  if (filters?.viewerMemberId) {
    // Member scope: tasks they created OR were assigned to
    conditions.push(
      or(
        eq(tasks.assignedTo, filters.viewerMemberId),
        eq(tasks.createdBy, filters.viewerMemberId)
      )!
    );
  }

  const assigneeTm = { id: teamMembers.id, name: teamMembers.name };

  const rows = await db
    .select({
      task: tasks,
      assigneeName: teamMembers.name,
      assigneeId: teamMembers.id,
    })
    .from(tasks)
    .leftJoin(teamMembers, eq(tasks.assignedTo, teamMembers.id))
    .where(and(...conditions))
    .orderBy(desc(tasks.createdAt));

  // Enrich with creator names in a second query for simplicity
  const allCreatorIds = Array.from(new Set(rows.map(r => r.task.createdBy).filter(Boolean))) as number[];
  let creatorMap: Record<number, string | null> = {};
  if (allCreatorIds.length > 0) {
    const creators = await db
      .select({ id: teamMembers.id, name: teamMembers.name })
      .from(teamMembers)
      .where(
        allCreatorIds.length === 1
          ? eq(teamMembers.id, allCreatorIds[0])
          : or(...allCreatorIds.map(id => eq(teamMembers.id, id)))!
      );
    creatorMap = Object.fromEntries(creators.map(c => [c.id, c.name]));
  }

  return rows.map(r => ({
    ...r.task,
    assignee: r.assigneeId ? { id: r.assigneeId, name: r.assigneeName } : null,
    creator: r.task.createdBy ? { id: r.task.createdBy, name: creatorMap[r.task.createdBy] ?? null } : null,
  }));
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

    // If a status change is requested, only the assignee is allowed
    if (updates.status !== undefined && updates.status !== existingTask.status) {
      if (existingTask.assignedTo && existingTask.assignedTo !== updatedBy) {
        throw new ValidationError('Only the task assignee can change the task status');
      }
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

    // Notify assignee when task is updated by someone else
    if (existingTask.assignedTo && existingTask.assignedTo !== updatedBy) {
      await sendNotification({
        userId: existingTask.assignedTo,
        teamId: existingTask.teamId,
        type: 'task_assignment',
        title: 'Task Updated',
        message: `A task assigned to you was updated: "${existingTask.title}"`,
        priority: 'low',
        taskId: existingTask.id,
        actionUrl: `/tasks`,
        actionLabel: 'View Task',
      }, db);
    }
    // Notify creator when assignee updates status
    if (updates.status && existingTask.createdBy && existingTask.createdBy !== updatedBy) {
      await sendNotification({
        userId: existingTask.createdBy,
        teamId: existingTask.teamId,
        type: 'task_assignment',
        title: 'Task Status Changed',
        message: `Task "${existingTask.title}" status changed to ${updates.status}`,
        priority: 'low',
        taskId: existingTask.id,
        actionUrl: `/tasks`,
        actionLabel: 'View Task',
      }, db);
    }

    notifyTaskChanged();
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

    notifyTaskChanged();
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

    // Only the task assignee can move (change status of) a task
    if (existingTask.assignedTo && existingTask.assignedTo !== movedBy) {
      throw new ValidationError('Only the task assignee can change the task status');
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

    // Notify creator when someone else moves the task
    if (existingTask.createdBy && existingTask.createdBy !== movedBy) {
      await sendNotification({
        userId: existingTask.createdBy,
        teamId: existingTask.teamId,
        type: 'task_assignment',
        title: 'Task Moved',
        message: `Task "${existingTask.title}" was moved to ${newStatus}`,
        priority: 'low',
        taskId: existingTask.id,
        actionUrl: `/tasks`,
        actionLabel: 'View Task',
      }, db);
    }

    return updated;
  });
}

/**
 * Reopen a completed task (only by task creator, requires a reason)
 */
export async function reopenTask(
  taskId: number,
  reason: string,
  reopenedBy: number
): Promise<Task> {
  return await withTransaction(async (db) => {
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

    if (existingTask.status !== 'done') {
      throw new ValidationError('Only completed tasks can be reopened');
    }

    if (existingTask.createdBy !== reopenedBy) {
      throw new ValidationError('Only the task creator can reopen a completed task');
    }

    const [updated] = await db
      .update(tasks)
      .set({ status: 'todo', updatedAt: new Date() })
      .where(eq(tasks.id, taskId))
      .returning();

    await db.insert(activities).values({
      teamId: existingTask.teamId,
      userId: reopenedBy,
      type: 'task_reopened',
      entityId: taskId,
      entityType: 'task',
      description: `Reopened task: ${existingTask.title}`,
      metadata: {
        taskTitle: existingTask.title,
        previousStatus: 'done',
        newStatus: 'todo',
        reason,
      },
    });

    broadcastTaskUpdated(existingTask.teamId, updated);

    // Notify assignee that task was reopened
    if (existingTask.assignedTo) {
      await sendNotification({
        userId: existingTask.assignedTo,
        teamId: existingTask.teamId,
        type: 'task_assignment',
        title: 'Task Reopened',
        message: `Task "${existingTask.title}" has been reopened. Reason: ${reason}`,
        priority: 'medium',
        taskId: existingTask.id,
        actionUrl: `/tasks`,
        actionLabel: 'View Task',
      }, db);
    }

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

/**
 * ============================================================================
 * APPROVAL SYSTEM - Decision Table / Quality Gate
 * ============================================================================
 */

export type ApproverType = 'boss' | 'pm' | 'team_vote';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type VoteChoice = 'for' | 'against' | 'abstain';

export interface VoterRecord {
  userId: number;
  vote: VoteChoice;
  timestamp: string;
  reason?: string;
}

/**
 * Create an approval request
 */
export async function createApproval(
  approvalData: {
    entityType: 'task' | 'project' | 'handoff';
    entityId: number;
    teamId: number;
    fromStage?: string;
    toStage?: string;
    deliverables?: any;
    comments?: string;
  },
  requestedBy: number
): Promise<Approval> {
  return await withTransaction(async (db) => {
    // Get team approval configuration
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, approvalData.teamId))
      .limit(1);

    if (!team) {
      throw new NotFoundError('Team not found');
    }

    const approvalMode = (team.approvalMode || 'pm') as ApproverType;
    let approverUserId: number | null = null;
    let requiredVotes: number | null = null;

    // Determine approver based on team configuration
    if (approvalMode === 'boss') {
      if (!team.bossUserId) {
        throw new ValidationError('Team does not have a boss configured');
      }
      approverUserId = team.bossUserId;
    } else if (approvalMode === 'pm') {
      if (!team.pmUserId) {
        throw new ValidationError('Team does not have a project manager configured');
      }
      approverUserId = team.pmUserId;
    } else if (approvalMode === 'team_vote') {
      // Calculate required votes based on team size and threshold
      const teamMembers = await db
        .select()
        .from(teamMembersCollaborative)
        .where(
          and(
            eq(teamMembersCollaborative.teamId, approvalData.teamId),
            eq(teamMembersCollaborative.status, 'active')
          )
        );

      const threshold = team.voteThreshold || 51;
      requiredVotes = Math.ceil((teamMembers.length * threshold) / 100);
    }

    // Create approval
    const [approval] = await db
      .insert(approvals)
      .values({
        entityType: approvalData.entityType,
        entityId: approvalData.entityId,
        teamId: approvalData.teamId,
        approverType: approvalMode,
        approverUserId,
        status: 'pending',
        comments: approvalData.comments,
        fromStage: approvalData.fromStage,
        toStage: approvalData.toStage,
        deliverables: approvalData.deliverables,
        requiredVotes,
        voters: [],
      })
      .returning();
    // Create activity
    await db.insert(activities).values({
      teamId: approvalData.teamId,
      userId: requestedBy,
      type: 'approval_requested',
      entityId: approval.id,
      entityType: 'approval',
      description: `Requested approval for ${approvalData.entityType} #${approvalData.entityId}`,
      metadata: {
        approvalId: approval.id,
        approverType: approvalMode,
        fromStage: approvalData.fromStage,
        toStage: approvalData.toStage,
      },
    });

    // Dispatch approval request notification
    try {
      const title = 'New Approval Request';
      const message = `An approval request was submitted for a ${approvalData.entityType}.`;
      if (approverUserId) {
        await sendNotification({
          userId: approverUserId,
          teamId: approvalData.teamId,
          type: 'approval_request',
          title,
          message,
          priority: 'high',
        }, db);
      } else if (approvalMode === 'team_vote') {
        const members = await db
          .select({ userId: teamMembersCollaborative.userId })
          .from(teamMembersCollaborative)
          .where(
            and(
              eq(teamMembersCollaborative.teamId, approvalData.teamId),
              eq(teamMembersCollaborative.status, 'active')
            )
          );
        for (const member of members) {
          if (member.userId !== requestedBy) {
            await sendNotification({
              userId: member.userId,
              teamId: approvalData.teamId,
              type: 'approval_request',
              title,
              message,
              priority: 'high',
            }, db);
          }
        }
      }
    } catch (err) {
      console.error('Failed to send approval notification:', err);
    }

    return approval;
  });
}

/**
 * Get approvals for a team with optional filters
 */
export async function getApprovals(filters: {
  teamId: number;
  status?: ApprovalStatus;
  entityType?: string;
  entityId?: number;
  approverUserId?: number;
}): Promise<(Approval & { 
  approverName?: string | null;
  entityName?: string | null;
})[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(approvals.teamId, filters.teamId)];

  if (filters.status) {
    conditions.push(eq(approvals.status, filters.status));
  }
  if (filters.entityType) {
    conditions.push(eq(approvals.entityType, filters.entityType));
  }
  if (filters.entityId) {
    conditions.push(eq(approvals.entityId, filters.entityId));
  }
  if (filters.approverUserId) {
    conditions.push(eq(approvals.approverUserId, filters.approverUserId));
  }

  const result = await db
    .select({
      id: approvals.id,
      entityType: approvals.entityType,
      entityId: approvals.entityId,
      teamId: approvals.teamId,
      approverType: approvals.approverType,
      approverUserId: approvals.approverUserId,
      status: approvals.status,
      comments: approvals.comments,
      votesFor: approvals.votesFor,
      votesAgainst: approvals.votesAgainst,
      votesAbstain: approvals.votesAbstain,
      requiredVotes: approvals.requiredVotes,
      voters: approvals.voters,
      fromStage: approvals.fromStage,
      toStage: approvals.toStage,
      deliverables: approvals.deliverables,
      createdAt: approvals.createdAt,
      resolvedAt: approvals.resolvedAt,
      resolvedBy: approvals.resolvedBy,
      approverName: teamMembers.name,
    })
    .from(approvals)
    .leftJoin(teamMembers, eq(approvals.approverUserId, teamMembers.id))
    .where(and(...conditions))
    .orderBy(desc(approvals.createdAt));

  // Fetch entity names
  const enriched = await Promise.all(
    result.map(async (approval) => {
      let entityName: string | null = null;

      if (approval.entityType === 'task') {
        const task = await getTaskById(approval.entityId);
        entityName = task?.title || null;
      } else if (approval.entityType === 'project') {
        const project = await getProjectById(approval.entityId);
        entityName = project?.name || null;
      }

      return {
        ...approval,
        entityName,
      };
    })
  );

  return enriched;
}

/**
 * Get approval by ID
 */
export async function getApprovalById(approvalId: number): Promise<Approval | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const [approval] = await db
    .select()
    .from(approvals)
    .where(eq(approvals.id, approvalId))
    .limit(1);

  return approval;
}

/**
 * Boss or PM approval
 */
export async function approveOrReject(
  approvalId: number,
  decision: 'approved' | 'rejected',
  userId: number,
  comments?: string
): Promise<Approval> {
  return await withTransaction(async (db) => {
    const [approval] = await db
      .select()
      .from(approvals)
      .where(eq(approvals.id, approvalId))
      .limit(1);

    if (!approval) {
      throw new NotFoundError('Approval not found');
    }

    if (approval.status !== 'pending') {
      throw new ValidationError('Approval already resolved');
    }

    // Verify user is the designated approver
    if (approval.approverType !== 'team_vote' && approval.approverUserId !== userId) {
      throw new ValidationError('You are not authorized to approve this request');
    }

    // Update approval
    const [updated] = await db
      .update(approvals)
      .set({
        status: decision,
        resolvedAt: new Date(),
        resolvedBy: userId,
        comments: comments || approval.comments,
      })
      .where(eq(approvals.id, approvalId))
      .returning();

    // Create activity
    await db.insert(activities).values({
      teamId: approval.teamId,
      userId,
      type: decision === 'approved' ? 'approval_approved' : 'approval_rejected',
      entityId: approval.id,
      entityType: 'approval',
      description: `${decision === 'approved' ? 'Approved' : 'Rejected'} ${approval.entityType} #${approval.entityId}`,
      metadata: {
        approvalId: approval.id,
        decision,
        comments,
      },
    });

    return updated;
  });
}

/**
 * Cast a vote for team voting
 */
export async function castVote(
  approvalId: number,
  userId: number,
  vote: VoteChoice,
  reason?: string
): Promise<Approval> {
  return await withTransaction(async (db) => {
    const [approval] = await db
      .select()
      .from(approvals)
      .where(eq(approvals.id, approvalId))
      .limit(1);

    if (!approval) {
      throw new NotFoundError('Approval not found');
    }

    if (approval.status !== 'pending') {
      throw new ValidationError('Approval already resolved');
    }

    if (approval.approverType !== 'team_vote') {
      throw new ValidationError('This approval does not use team voting');
    }

    // Verify user is a team member
    const [membership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, approval.teamId),
          eq(teamMembersCollaborative.memberId, userId),
          eq(teamMembersCollaborative.status, 'active')
        )
      )
      .limit(1);

    if (!membership) {
      throw new ValidationError('You are not a member of this team');
    }

    // Get current voters
    const voters = (approval.voters as VoterRecord[]) || [];

    // Check if user already voted
    const existingVoteIndex = voters.findIndex((v) => v.userId === userId);

    if (existingVoteIndex >= 0) {
      // Update existing vote
      const oldVote = voters[existingVoteIndex].vote;
      voters[existingVoteIndex] = {
        userId,
        vote,
        timestamp: new Date().toISOString(),
        reason,
      };

      // Update vote counts
      let votesFor = approval.votesFor || 0;
      let votesAgainst = approval.votesAgainst || 0;
      let votesAbstain = approval.votesAbstain || 0;

      // Remove old vote count
      if (oldVote === 'for') votesFor--;
      else if (oldVote === 'against') votesAgainst--;
      else if (oldVote === 'abstain') votesAbstain--;

      // Add new vote count
      if (vote === 'for') votesFor++;
      else if (vote === 'against') votesAgainst++;
      else if (vote === 'abstain') votesAbstain++;

      await db
        .update(approvals)
        .set({
          voters,
          votesFor,
          votesAgainst,
          votesAbstain,
        })
        .where(eq(approvals.id, approvalId));
    } else {
      // Add new vote
      voters.push({
        userId,
        vote,
        timestamp: new Date().toISOString(),
        reason,
      });

      // Update vote counts
      const votesFor = (approval.votesFor || 0) + (vote === 'for' ? 1 : 0);
      const votesAgainst = (approval.votesAgainst || 0) + (vote === 'against' ? 1 : 0);
      const votesAbstain = (approval.votesAbstain || 0) + (vote === 'abstain' ? 1 : 0);

      await db
        .update(approvals)
        .set({
          voters,
          votesFor,
          votesAgainst,
          votesAbstain,
        })
        .where(eq(approvals.id, approvalId));
    }

    // Check if voting is complete
    const [updatedApproval] = await db
      .select()
      .from(approvals)
      .where(eq(approvals.id, approvalId))
      .limit(1);

    const votesFor = updatedApproval.votesFor || 0;
    const requiredVotes = updatedApproval.requiredVotes || 1;

    if (votesFor >= requiredVotes) {
      // Automatically approve
      await db
        .update(approvals)
        .set({
          status: 'approved',
          resolvedAt: new Date(),
          resolvedBy: userId,
        })
        .where(eq(approvals.id, approvalId));

      // Create activity
      await db.insert(activities).values({
        teamId: approval.teamId,
        userId,
        type: 'approval_approved',
        entityId: approval.id,
        entityType: 'approval',
        description: `Team vote approved ${approval.entityType} #${approval.entityId}`,
        metadata: {
          approvalId: approval.id,
          votesFor,
          requiredVotes,
        },
      });
    }

    // Return updated approval
    const [final] = await db
      .select()
      .from(approvals)
      .where(eq(approvals.id, approvalId))
      .limit(1);

    return final;
  });
}

/**
 * Get pending approvals for a specific user (as approver)
 */
export async function getPendingApprovalsForUser(userId: number): Promise<Approval[]> {
  const db = await getDb();
  if (!db) return [];

  // Get approvals where user is the designated approver
  const directApprovals = await db
    .select()
    .from(approvals)
    .where(
      and(
        eq(approvals.approverUserId, userId),
        eq(approvals.status, 'pending')
      )
    )
    .orderBy(desc(approvals.createdAt));

  // Get team vote approvals for teams user is a member of
  const memberships = await db
    .select()
    .from(teamMembersCollaborative)
    .where(
      and(
        eq(teamMembersCollaborative.memberId, userId),
        eq(teamMembersCollaborative.status, 'active')
      )
    );

  const teamIds = memberships.map((m) => m.teamId);

  const teamVoteApprovals = teamIds.length > 0
    ? await db
        .select()
        .from(approvals)
        .where(
          and(
            eq(approvals.approverType, 'team_vote'),
            eq(approvals.status, 'pending'),
            sql`${approvals.teamId} IN (${sql.join(teamIds.map(id => sql`${id}`), sql`, `)})`
          )
        )
        .orderBy(desc(approvals.createdAt))
    : [];

  return [...directApprovals, ...teamVoteApprovals];
}

/**
 * Configure team approval settings
 */
export async function configureTeamApproval(
  teamId: number,
  config: {
    approvalMode: ApproverType;
    bossUserId?: number;
    pmUserId?: number;
    voteThreshold?: number;
  },
  userId: number
): Promise<Team> {
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
      throw new ValidationError('Insufficient permissions to configure team approval');
    }

    // Validate configuration
    if (config.approvalMode === 'boss' && !config.bossUserId) {
      throw new ValidationError('Boss user ID is required for boss approval mode');
    }
    if (config.approvalMode === 'pm' && !config.pmUserId) {
      throw new ValidationError('PM user ID is required for PM approval mode');
    }
    if (config.approvalMode === 'team_vote' && config.voteThreshold) {
      if (config.voteThreshold < 1 || config.voteThreshold > 100) {
        throw new ValidationError('Vote threshold must be between 1 and 100');
      }
    }

    // Update team
    const [updated] = await db
      .update(teams)
      .set({
        approvalMode: config.approvalMode,
        bossUserId: config.bossUserId,
        pmUserId: config.pmUserId,
        voteThreshold: config.voteThreshold,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, teamId))
      .returning();

    return updated;
  });
}

/**
 * ============================================================================
 * SEQUENTIAL HANDOFF SYSTEM - Role-based Workflow
 * ============================================================================
 */

export type WorkflowStage = 'ideation' | 'design' | 'business' | 'development' | 'testing' | 'review' | 'completed' | 'research' | 'architecture' | 'backend' | 'fullstack' | 'ai';
export type WorkflowRole = 'designer' | 'business_strategist' | 'backend_dev' | 'frontend_dev' | 'qa_tester' | 'reviewer';

export interface HandoffRecord {
  from: WorkflowRole | string;
  to: WorkflowRole | string;
  fromUserId?: number;
  toUserId?: number;
  deliverables: DeliverableItem[];
  timestamp: string;
  comments?: string;
  approved?: boolean;
  approvalId?: number;
}

export interface DeliverableItem {
  type: 'figma' | 'github' | 'pdf' | 'link' | 'document' | 'image';
  url: string;
  description: string;
  uploadedAt: string;
  uploadedBy?: number;
}

/**
 * Push work to next stage (handoff)
 */
export async function handoffTask(
  taskId: number,
  handoffData: {
    toStage: WorkflowStage;
    toRole: WorkflowRole;
    toUserId?: number;
    deliverables: DeliverableItem[];
    comments?: string;
    requiresApproval?: boolean;
  },
  fromUserId: number
): Promise<Task> {
  return await withTransaction(async (db) => {
    // Get current task
    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    // Verify user has permission
    if (!task.teamId) {
      throw new ValidationError('Task must belong to a team');
    }

    const [membership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, task.teamId),
          eq(teamMembersCollaborative.memberId, fromUserId)
        )
      )
      .limit(1);

    if (!membership || !hasPermission(membership.role as TeamRole, 'update_task')) {
      throw new ValidationError('Insufficient permissions to handoff task');
    }

    // Create handoff record
    const handoffHistory = (task.handoffHistory as HandoffRecord[]) || [];
    const newHandoff: HandoffRecord = {
      from: task.assignedRole || 'unknown',
      to: handoffData.toRole,
      fromUserId,
      toUserId: handoffData.toUserId,
      deliverables: handoffData.deliverables,
      timestamp: new Date().toISOString(),
      comments: handoffData.comments,
      approved: !handoffData.requiresApproval,
    };

    handoffHistory.push(newHandoff);

    // Update task deliverables
    const currentDeliverables = (task.deliverables as Record<string, DeliverableItem[]>) || {};
    const roleKey = task.assignedRole || 'unknown';
    currentDeliverables[roleKey] = handoffData.deliverables;

    // Create approval if required
    let approvalId: number | undefined;
    if (handoffData.requiresApproval) {
      const approval = await createApproval(
        {
          entityType: 'handoff',
          entityId: taskId,
          teamId: task.teamId,
          fromStage: task.workflowStage || undefined,
          toStage: handoffData.toStage,
          deliverables: handoffData.deliverables,
          comments: handoffData.comments,
        },
        fromUserId
      );
      approvalId = approval.id;
      newHandoff.approvalId = approvalId;

      // Update handoff history with approval ID
      handoffHistory[handoffHistory.length - 1] = newHandoff;
    }

    // Update task
    const updateData: any = {
      handoffHistory,
      deliverables: currentDeliverables,
      updatedAt: new Date(),
    };

    // Only update stage/role if no approval required or auto-approved
    if (!handoffData.requiresApproval) {
      updateData.workflowStage = handoffData.toStage;
      updateData.assignedRole = handoffData.toRole;
      if (handoffData.toUserId) {
        updateData.assignedTo = handoffData.toUserId;
      }
    }

    const [updated] = await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, taskId))
      .returning();

    // Create activity
    await db.insert(activities).values({
      teamId: task.teamId,
      userId: fromUserId,
      type: 'task_handoff',
      entityId: taskId,
      entityType: 'task',
      description: `Handed off task to ${handoffData.toRole}${handoffData.requiresApproval ? ' (pending approval)' : ''}`,
      metadata: {
        fromStage: task.workflowStage,
        toStage: handoffData.toStage,
        fromRole: task.assignedRole,
        toRole: handoffData.toRole,
        requiresApproval: handoffData.requiresApproval,
        approvalId,
      },
    });

    return updated;
  });
}

/**
 * Push project to next stage (handoff)
 */
export async function handoffProject(
  projectId: number,
  handoffData: {
    toStage: WorkflowStage;
    toRole: WorkflowRole;
    toUserId?: number;
    deliverables: DeliverableItem[];
    comments?: string;
    requiresApproval?: boolean;
  },
  fromUserId: number
): Promise<Project> {
  return await withTransaction(async (db) => {
    // Get current project
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    // Verify user has permission
    if (!project.teamId) {
      throw new ValidationError('Project must belong to a team');
    }

    const [membership] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, project.teamId),
          eq(teamMembersCollaborative.memberId, fromUserId)
        )
      )
      .limit(1);

    if (!membership || !hasPermission(membership.role as TeamRole, 'update_team')) {
      throw new ValidationError('Insufficient permissions to handoff project');
    }

    // Create handoff record
    const handoffHistory = (project.handoffHistory as HandoffRecord[]) || [];
    const newHandoff: HandoffRecord = {
      from: project.assignedRole || 'unknown',
      to: handoffData.toRole,
      fromUserId,
      toUserId: handoffData.toUserId,
      deliverables: handoffData.deliverables,
      timestamp: new Date().toISOString(),
      comments: handoffData.comments,
      approved: !handoffData.requiresApproval,
    };

    handoffHistory.push(newHandoff);

    // Update project deliverables
    const currentDeliverables = (project.deliverables as Record<string, DeliverableItem[]>) || {};
    const roleKey = project.assignedRole || 'unknown';
    currentDeliverables[roleKey] = handoffData.deliverables;

    // Create approval if required
    let approvalId: number | undefined;
    if (handoffData.requiresApproval) {
      const approval = await createApproval(
        {
          entityType: 'handoff',
          entityId: projectId,
          teamId: project.teamId,
          fromStage: project.workflowStage || undefined,
          toStage: handoffData.toStage,
          deliverables: handoffData.deliverables,
          comments: handoffData.comments,
        },
        fromUserId
      );
      approvalId = approval.id;
      newHandoff.approvalId = approvalId;

      // Update handoff history with approval ID
      handoffHistory[handoffHistory.length - 1] = newHandoff;
    }

    // Update project
    const updateData: any = {
      handoffHistory,
      deliverables: currentDeliverables,
      updatedAt: new Date(),
    };

    // Only update stage/role if no approval required or auto-approved
    if (!handoffData.requiresApproval) {
      updateData.workflowStage = handoffData.toStage;
      updateData.assignedRole = handoffData.toRole;
    }

    const [updated] = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, projectId))
      .returning();

    // Create activity
    await db.insert(activities).values({
      teamId: project.teamId,
      userId: fromUserId,
      type: 'project_handoff',
      entityId: projectId,
      entityType: 'project',
      description: `Handed off project to ${handoffData.toRole}${handoffData.requiresApproval ? ' (pending approval)' : ''}`,
      metadata: {
        fromStage: project.workflowStage,
        toStage: handoffData.toStage,
        fromRole: project.assignedRole,
        toRole: handoffData.toRole,
        requiresApproval: handoffData.requiresApproval,
        approvalId,
      },
    });

    return updated;
  });
}

/**
 * Get tasks assigned to a specific role
 */
export async function getTasksByRole(
  teamId: number,
  role: WorkflowRole,
  userId?: number
): Promise<Task[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [
    eq(tasks.teamId, teamId),
    eq(tasks.assignedRole, role),
  ];

  if (userId) {
    conditions.push(eq(tasks.assignedTo, userId));
  }

  return await db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(desc(tasks.updatedAt));
}

/**
 * Get projects assigned to a specific role
 */
export async function getProjectsByRole(
  teamId: number,
  role: WorkflowRole,
  userId?: number
): Promise<Project[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [
    eq(projects.teamId, teamId),
    eq(projects.assignedRole, role),
  ];

  return await db
    .select()
    .from(projects)
    .where(and(...conditions))
    .orderBy(desc(projects.updatedAt));
}

/**
 * Get tasks by workflow stage
 */
export async function getTasksByStage(
  teamId: number,
  stage: WorkflowStage
): Promise<Task[]> {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.teamId, teamId),
        eq(tasks.workflowStage, stage)
      )
    )
    .orderBy(desc(tasks.updatedAt));
}

/**
 * Get projects by workflow stage
 */
export async function getProjectsByStage(
  teamId: number,
  stage: WorkflowStage
): Promise<Project[]> {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.teamId, teamId),
        eq(projects.workflowStage, stage)
      )
    )
    .orderBy(desc(projects.updatedAt));
}

/**
 * Get user's role-based work queue
 */
export async function getMyWorkQueue(
  userId: number,
  teamId: number
): Promise<{
  tasks: Task[];
  projects: Project[];
  role?: string;
}> {
  const db = await getDb();
  if (!db) return { tasks: [], projects: [] };

  // Get user's primary role in team
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

  if (!membership) {
    return { tasks: [], projects: [] };
  }

  // Get tasks assigned to user or their role
  const userTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.teamId, teamId),
        eq(tasks.assignedTo, userId)
      )
    )
    .orderBy(desc(tasks.updatedAt));

  // Get projects in user's domain (if they have a workflow role)
  const userProjects: Project[] = [];

  return {
    tasks: userTasks,
    projects: userProjects,
    role: membership.role ?? undefined,
  };
}

/**
 * Accept handoff (when approval is approved, update task/project)
 */
export async function acceptHandoff(
  entityType: 'task' | 'project',
  entityId: number,
  approvalId: number
): Promise<Task | Project> {
  return await withTransaction(async (db) => {
    // Get approval
    const [approval] = await db
      .select()
      .from(approvals)
      .where(eq(approvals.id, approvalId))
      .limit(1);

    if (!approval || approval.status !== 'approved') {
      throw new ValidationError('Approval must be approved first');
    }

    if (entityType === 'task') {
      // Update task
      const [task] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, entityId))
        .limit(1);

      if (!task) {
        throw new NotFoundError('Task not found');
      }

      const [updated] = await db
        .update(tasks)
        .set({
          workflowStage: approval.toStage || task.workflowStage,
          assignedRole: approval.toStage || task.assignedRole,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, entityId))
        .returning();

      return updated;
    } else {
      // Update project
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, entityId))
        .limit(1);

      if (!project) {
        throw new NotFoundError('Project not found');
      }

      const [updated] = await db
        .update(projects)
        .set({
          workflowStage: approval.toStage || project.workflowStage,
          assignedRole: approval.toStage || project.assignedRole,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, entityId))
        .returning();

      return updated;
    }
  });
}

/**
 * ============================================================================
 * SEQUENTIAL HANDOFF SYSTEM - Role-Based Workflow
 * ============================================================================
 */

export type AssignedRole = 'project_manager' | 'lead_researcher' | 'systems_architect' | 'backend_engineer' | 'fullstack_engineer' | 'ai_engineer' | 'qa_tester' | 'designer';

export interface Deliverable {
  type: 'figma' | 'github' | 'pdf' | 'link' | 'document' | 'image';
  url: string;
  description: string;
  uploadedAt: string;
  uploadedBy?: number;
}

/**
 * Get tasks/projects assigned to a specific role for workspace view
 */
export async function getWorkspaceItems(
  teamId: number,
  assignedRole: AssignedRole,
  entityType: 'task' | 'project' = 'task'
): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  if (entityType === 'task') {
    return await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.teamId, teamId),
          eq(tasks.assignedRole, assignedRole)
        )
      )
      .orderBy(desc(tasks.updatedAt));
  } else {
    return await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.teamId, teamId),
          eq(projects.assignedRole, assignedRole)
        )
      )
      .orderBy(desc(projects.updatedAt));
  }
}

/**
 * Get all items in a specific workflow stage
 */
export async function getItemsByStage(
  teamId: number,
  workflowStage: WorkflowStage,
  entityType: 'task' | 'project' = 'task'
): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  if (entityType === 'task') {
    return await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.teamId, teamId),
          eq(tasks.workflowStage, workflowStage)
        )
      )
      .orderBy(desc(tasks.updatedAt));
  } else {
    return await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.teamId, teamId),
          eq(projects.workflowStage, workflowStage)
        )
      )
      .orderBy(desc(projects.updatedAt));
  }
}

/**
 * Add deliverable to task or project
 */
export async function addDeliverable(
  entityType: 'task' | 'project',
  entityId: number,
  deliverable: Deliverable,
  userId: number
): Promise<any> {
  return await withTransaction(async (db) => {
    const table = entityType === 'task' ? tasks : projects;
    
    // Get current entity
    const [entity] = await db
      .select()
      .from(table)
      .where(eq(table.id, entityId))
      .limit(1);

    if (!entity) {
      throw new NotFoundError(`${entityType} not found`);
    }

    // Get current deliverables
    const currentDeliverables = (entity.deliverables as any) || {};
    const role = entity.assignedRole || 'general';

    // Add new deliverable to role's deliverables
    if (!currentDeliverables[role]) {
      currentDeliverables[role] = [];
    }

    currentDeliverables[role].push({
      ...deliverable,
      uploadedAt: new Date().toISOString(),
      uploadedBy: userId,
    });

    // Update entity
    const [updated] = await db
      .update(table)
      .set({
        deliverables: currentDeliverables,
        updatedAt: new Date(),
      })
      .where(eq(table.id, entityId))
      .returning();

    // Create activity
    await db.insert(activities).values({
      teamId: entity.teamId,
      userId,
      type: 'deliverable_added',
      entityId,
      entityType,
      description: `Added ${deliverable.type} deliverable: ${deliverable.description}`,
      metadata: {
        deliverableType: deliverable.type,
        role,
      },
    });

    return updated;
  });
}

/**
 * Push work to next stage (handoff)
 */
export async function handoffToNextStage(
  entityType: 'task' | 'project',
  entityId: number,
  handoffData: {
    toStage: WorkflowStage;
    toRole: AssignedRole;
    toUserId?: number;
    comments?: string;
    requiresApproval?: boolean;
  },
  userId: number
): Promise<any> {
  return await withTransaction(async (db) => {
    const table = entityType === 'task' ? tasks : projects;
    
    // Get current entity
    const [entity] = await db
      .select()
      .from(table)
      .where(eq(table.id, entityId))
      .limit(1);

    if (!entity) {
      throw new NotFoundError(`${entityType} not found`);
    }

    const fromStage = entity.workflowStage || 'ideation';
    const fromRole = entity.assignedRole || 'unknown';

    // Create handoff record
    const handoffRecord: HandoffRecord = {
      from: fromRole,
      to: handoffData.toRole,
      fromUserId: userId,
      toUserId: handoffData.toUserId,
      deliverables: (entity.deliverables as any)?.[fromRole] || [],
      timestamp: new Date().toISOString(),
      comments: handoffData.comments,
      approved: !handoffData.requiresApproval,
    };

    // Get current handoff history
    const handoffHistory = (entity.handoffHistory as HandoffRecord[]) || [];
    handoffHistory.push(handoffRecord);

    // If approval required, create approval request
    let approvalId: number | undefined;
    if (handoffData.requiresApproval) {
      const approval = await createApproval(
        {
          entityType,
          entityId,
          teamId: entity.teamId!,
          fromStage,
          toStage: handoffData.toStage,
          deliverables: entity.deliverables,
          comments: handoffData.comments,
        },
        userId
      );
      approvalId = approval.id;
      handoffRecord.approvalId = approvalId;

      // Update handoff history with approval ID
      handoffHistory[handoffHistory.length - 1] = handoffRecord;

      // Update entity with pending handoff
      await db
        .update(table)
        .set({
          handoffHistory,
          updatedAt: new Date(),
        })
        .where(eq(table.id, entityId));

      // Create activity
      await db.insert(activities).values({
        teamId: entity.teamId,
        userId,
        type: 'handoff_pending',
        entityId,
        entityType,
        description: `Requested handoff from ${fromRole} to ${handoffData.toRole} (pending approval)`,
        metadata: {
          fromStage,
          toStage: handoffData.toStage,
          fromRole,
          toRole: handoffData.toRole,
          approvalId,
        },
      });

      return {
        ...entity,
        handoffHistory,
        pendingApproval: true,
        approvalId,
      };
    }

    // No approval required - complete handoff immediately
    const [updated] = await db
      .update(table)
      .set({
        workflowStage: handoffData.toStage,
        assignedRole: handoffData.toRole,
        assignedTo: (handoffData.toUserId || (entity as any).assignedTo) as any,
        handoffHistory,
        updatedAt: new Date(),
      } as any)
      .where(eq(table.id, entityId))
      .returning();

    // Create activity
    await db.insert(activities).values({
      teamId: entity.teamId,
      userId,
      type: 'handoff_completed',
      entityId,
      entityType,
      description: `Handed off from ${fromRole} to ${handoffData.toRole}`,
      metadata: {
        fromStage,
        toStage: handoffData.toStage,
        fromRole,
        toRole: handoffData.toRole,
      },
    });

    return updated;
  });
}

/**
 * Complete handoff after approval
 */
export async function completeHandoff(
  entityType: 'task' | 'project',
  entityId: number,
  approvalId: number
): Promise<any> {
  return await withTransaction(async (db) => {
    const table = entityType === 'task' ? tasks : projects;
    
    // Get approval
    const [approval] = await db
      .select()
      .from(approvals)
      .where(eq(approvals.id, approvalId))
      .limit(1);

    if (!approval) {
      throw new NotFoundError('Approval not found');
    }

    if (approval.status !== 'approved') {
      throw new ValidationError('Approval must be approved before completing handoff');
    }

    // Get entity
    const [entity] = await db
      .select()
      .from(table)
      .where(eq(table.id, entityId))
      .limit(1);

    if (!entity) {
      throw new NotFoundError(`${entityType} not found`);
    }

    // Update handoff history to mark as approved
    const handoffHistory = (entity.handoffHistory as HandoffRecord[]) || [];
    const pendingHandoff = handoffHistory.find((h) => h.approvalId === approvalId);

    if (pendingHandoff) {
      pendingHandoff.approved = true;
    }

    // Complete handoff
    const [updated] = await db
      .update(table)
      .set({
        workflowStage: approval.toStage,
        assignedRole: approval.toStage === 'design' ? 'designer' :
                      approval.toStage === 'business' ? 'business_strategist' :
                      approval.toStage === 'development' ? 'backend_dev' :
                      approval.toStage === 'testing' ? 'qa_tester' :
                      approval.toStage === 'review' ? 'reviewer' : entity.assignedRole,
        handoffHistory,
        updatedAt: new Date(),
      })
      .where(eq(table.id, entityId))
      .returning();

    // Create activity
    await db.insert(activities).values({
      teamId: entity.teamId,
      userId: approval.resolvedBy || null,
      type: 'handoff_completed',
      entityId,
      entityType,
      description: `Handoff approved and completed to ${approval.toStage}`,
      metadata: {
        approvalId,
        toStage: approval.toStage,
      },
    });

    return updated;
  });
}

/**
 * Get handoff history for an entity
 */
export async function getHandoffHistory(
  entityType: 'task' | 'project',
  entityId: number
): Promise<HandoffRecord[]> {
  const db = await getDb();
  if (!db) return [];

  const table = entityType === 'task' ? tasks : projects;
  
  const [entity] = await db
    .select()
    .from(table)
    .where(eq(table.id, entityId))
    .limit(1);

  if (!entity) {
    return [];
  }

  return (entity.handoffHistory as HandoffRecord[]) || [];
}

/**
 * Get deliverables for an entity
 */
export async function getDeliverables(
  entityType: 'task' | 'project',
  entityId: number,
  role?: string
): Promise<Record<string, Deliverable[]>> {
  const db = await getDb();
  if (!db) return {};

  const table = entityType === 'task' ? tasks : projects;
  
  const [entity] = await db
    .select()
    .from(table)
    .where(eq(table.id, entityId))
    .limit(1);

  if (!entity) {
    return {};
  }

  const allDeliverables = (entity.deliverables as Record<string, Deliverable[]>) || {};

  if (role) {
    return { [role]: allDeliverables[role] || [] };
  }

  return allDeliverables;
}

/**
 * Get workspace summary for a user
 */
export async function getWorkspaceSummary(
  teamId: number,
  userId: number
): Promise<{
  myRole: string | null;
  assignedItems: any[];
  pendingHandoffs: any[];
  recentHandoffs: HandoffRecord[];
}> {
  const db = await getDb();
  if (!db) {
    return {
      myRole: null,
      assignedItems: [],
      pendingHandoffs: [],
      recentHandoffs: [],
    };
  }

  // Get user's role in team
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

  const myRole = membership?.role || null;

  // Get items assigned to user
  const assignedTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.teamId, teamId),
        eq(tasks.assignedTo, userId)
      )
    )
    .orderBy(desc(tasks.updatedAt))
    .limit(10);

  // Get pending handoffs (items waiting for approval)
  const pendingApprovals = await db
    .select()
    .from(approvals)
    .where(
      and(
        eq(approvals.teamId, teamId),
        eq(approvals.status, 'pending'),
        eq(approvals.entityType, 'handoff')
      )
    )
    .orderBy(desc(approvals.createdAt))
    .limit(10);

  // Get recent activities for handoffs
  const recentActivities = await db
    .select()
    .from(activities)
    .where(
      and(
        eq(activities.teamId, teamId),
        sql`${activities.type} IN ('handoff_completed', 'handoff_pending')`
      )
    )
    .orderBy(desc(activities.createdAt))
    .limit(10);

  return {
    myRole,
    assignedItems: assignedTasks,
    pendingHandoffs: pendingApprovals,
    recentHandoffs: recentActivities.map((a) => a.metadata as any),
  };
}

/**
 * ============================================================================
 * AI PROJECT EVALUATION SYSTEM
 * ============================================================================
 */

/**
 * Save evaluation results to project
 */
export async function saveProjectEvaluation(
  projectId: number,
  evaluationData: any,
  userId: number
): Promise<any> {
  return await withTransaction(async (db) => {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    // Update project with evaluation
    const [updated] = await db
      .update(projects)
      .set({
        evaluationData,
        evaluatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))
      .returning();

    // Create activity
    await db.insert(activities).values({
      teamId: project.teamId,
      userId,
      type: 'project_evaluated',
      entityId: projectId,
      entityType: 'project',
      description: `AI evaluation completed: ${evaluationData.overallScore}/100`,
      metadata: {
        overallScore: evaluationData.overallScore,
        readyForLaunch: evaluationData.readyForLaunch,
        criticalIssues: evaluationData.criticalIssues?.length || 0,
      },
    });

    return updated;
  });
}

/**
 * Get project evaluation
 */
export async function getProjectEvaluation(projectId: number): Promise<any | null> {
  const db = await getDb();
  if (!db) return null;

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project || !project.evaluationData) {
    return null;
  }

  return {
    projectId: project.id,
    projectName: project.name,
    evaluationData: project.evaluationData,
    evaluatedAt: project.evaluatedAt,
  };
}

/**
 * Get all evaluated projects for a team
 */
export async function getEvaluatedProjects(teamId: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  const evaluatedProjects = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.teamId, teamId),
        sql`${projects.evaluationData} IS NOT NULL`
      )
    )
    .orderBy(desc(projects.evaluatedAt));

  return evaluatedProjects.map((p) => ({
    id: p.id,
    name: p.name,
    overallScore: (p.evaluationData as any)?.overallScore || 0,
    readyForLaunch: (p.evaluationData as any)?.readyForLaunch || false,
    evaluatedAt: p.evaluatedAt,
  }));
}

/**
 * Get projects ready for launch
 */
export async function getProjectsReadyForLaunch(teamId: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  const readyProjects = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.teamId, teamId),
        sql`${projects.evaluationData} IS NOT NULL`,
        sql`(${projects.evaluationData}->>'readyForLaunch')::boolean = true`
      )
    )
    .orderBy(desc(projects.evaluatedAt));

  return readyProjects;
}

/**
 * Get evaluation statistics for a team
 */
export async function getEvaluationStats(teamId: number): Promise<{
  totalEvaluated: number;
  averageScore: number;
  readyForLaunch: number;
  needsWork: number;
}> {
  const db = await getDb();
  if (!db) {
    return {
      totalEvaluated: 0,
      averageScore: 0,
      readyForLaunch: 0,
      needsWork: 0,
    };
  }

  const evaluatedProjects = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.teamId, teamId),
        sql`${projects.evaluationData} IS NOT NULL`
      )
    );

  if (evaluatedProjects.length === 0) {
    return {
      totalEvaluated: 0,
      averageScore: 0,
      readyForLaunch: 0,
      needsWork: 0,
    };
  }

  const scores = evaluatedProjects.map((p) => (p.evaluationData as any)?.overallScore || 0);
  const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  const readyForLaunch = evaluatedProjects.filter(
    (p) => (p.evaluationData as any)?.readyForLaunch === true
  ).length;

  const needsWork = evaluatedProjects.filter(
    (p) => (p.evaluationData as any)?.overallScore < 70
  ).length;

  return {
    totalEvaluated: evaluatedProjects.length,
    averageScore,
    readyForLaunch,
    needsWork,
  };
}

// ─── Chat Message Functions ────────────────────────────────────────────────────

/**
 * Send a direct message from one member to another
 */
export async function sendChatMessage(
  fromMemberId: number,
  toMemberId: number,
  teamId: number,
  content: string,
  messageType: 'text' | 'image' | 'file' = 'text',
  fileUrl?: string,
  fileName?: string
): Promise<ChatMessage> {
  const db = await getDb();
  if (!db) throw new Error('Database unavailable');

  const [msg] = await db
    .insert(chatMessages)
    .values({ fromMemberId, toMemberId, teamId, content, messageType, fileUrl, fileName })
    .returning();

  // Send a mention/team_messages notification to the recipient
  try {
    const { teamMembers } = await import('../drizzle/schema.js');
    console.log(`[sendChatMessage] Fetching sender details for fromMemberId=${fromMemberId}`);
    const sender = await db.select({ name: teamMembers.name }).from(teamMembers).where(eq(teamMembers.id, fromMemberId)).limit(1);
    const senderName = sender[0]?.name || 'A teammate';
    
    console.log(`[sendChatMessage] Fetching recipient details for toMemberId=${toMemberId}`);
    const recipient = await db.select({ id: teamMembers.id }).from(teamMembers).where(eq(teamMembers.id, toMemberId)).limit(1);
    if (recipient[0]) {
      console.log(`[sendChatMessage] Sending notification to userId=${recipient[0].id}`);
      await sendNotification({
        userId: recipient[0].id,
        teamId: teamId,
        type: 'mention', // using mention for direct messages
        title: 'New Message',
        message: `${senderName} sent you a message: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
        priority: 'high',
        actionUrl: '/chat',
        actionLabel: 'View Message'
      }, db);
    } else {
      console.warn(`[sendChatMessage] Recipient toMemberId=${toMemberId} not found, skipping notification`);
    }
  } catch (err) {
    console.error('[sendChatMessage] Failed to send chat notification:', err);
  }

  return msg;
}

/**
 * Get messages between two members (conversation thread)
 */
export async function getChatMessages(
  memberA: number,
  memberB: number,
  teamId: number,
  limit = 50,
  before?: Date
): Promise<(ChatMessage & { fromName: string | null; toName: string | null })[]> {
  const db = await getDb();
  if (!db) return [];

  const fromAlias = teamMembers;

  const conditions = [
    eq(chatMessages.teamId, teamId),
    or(
      and(eq(chatMessages.fromMemberId, memberA), eq(chatMessages.toMemberId, memberB)),
      and(eq(chatMessages.fromMemberId, memberB), eq(chatMessages.toMemberId, memberA))
    )!,
  ];

  if (before) {
    conditions.push(lte(chatMessages.createdAt, before));
  }

  const rows = await db
    .select({
      msg: chatMessages,
      fromName: sql<string | null>`(SELECT name FROM ${fromAlias} WHERE id = ${chatMessages.fromMemberId})`,
      toName: sql<string | null>`(SELECT name FROM ${fromAlias} WHERE id = ${chatMessages.toMemberId})`,
    })
    .from(chatMessages)
    .where(and(...conditions))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);

  return rows.map(r => ({ ...r.msg, fromName: r.fromName, toName: r.toName })).reverse();
}

/**
 * Get list of unique conversation partners for a member
 */
export async function getChatConversations(
  memberId: number,
  teamId: number
): Promise<{
  partnerId: number;
  partnerName: string | null;
  partnerAvatarUrl: string | null;
  lastMessage: string;
  lastMessageAt: Date | null;
  unreadCount: number;
}[]> {
  const db = await getDb();
  if (!db) return [];

  // Find all unique partners
  const sent = await db
    .selectDistinct({ partnerId: chatMessages.toMemberId })
    .from(chatMessages)
    .where(and(eq(chatMessages.fromMemberId, memberId), eq(chatMessages.teamId, teamId)));

  const received = await db
    .selectDistinct({ partnerId: chatMessages.fromMemberId })
    .from(chatMessages)
    .where(and(eq(chatMessages.toMemberId, memberId), eq(chatMessages.teamId, teamId)));

  const partnerIds = Array.from(new Set([
    ...sent.map(r => r.partnerId),
    ...received.map(r => r.partnerId),
  ]));

  if (partnerIds.length === 0) return [];

  const result = await Promise.all(
    partnerIds.map(async (partnerId) => {
      // Get last message
      const [lastMsg] = await db
        .select()
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.teamId, teamId),
            or(
              and(eq(chatMessages.fromMemberId, memberId), eq(chatMessages.toMemberId, partnerId)),
              and(eq(chatMessages.fromMemberId, partnerId), eq(chatMessages.toMemberId, memberId))
            )!
          )
        )
        .orderBy(desc(chatMessages.createdAt))
        .limit(1);

      // Get unread count
      const [unreadRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.teamId, teamId),
            eq(chatMessages.fromMemberId, partnerId),
            eq(chatMessages.toMemberId, memberId),
            isNull(chatMessages.readAt)
          )
        );

      // Get partner name and avatar (via users table linked by email)
      const [partner] = await db
        .select({ id: teamMembers.id, name: teamMembers.name, avatarUrl: users.avatarUrl })
        .from(teamMembers)
        .leftJoin(users, eq(teamMembers.email, users.email))
        .where(eq(teamMembers.id, partnerId))
        .limit(1);

      return {
        partnerId,
        partnerName: partner?.name ?? null,
        partnerAvatarUrl: partner?.avatarUrl ?? null,
        lastMessage: lastMsg?.content ?? '',
        lastMessageAt: lastMsg?.createdAt ?? null,
        unreadCount: Number(unreadRow?.count ?? 0),
      };
    })
  );

  // Sort by last message time desc
  return result.sort((a, b) =>
    (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0)
  );
}

/**
 * Mark messages from a sender to a recipient as read
 */
export async function markMessagesAsRead(
  fromMemberId: number,
  toMemberId: number,
  teamId: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(chatMessages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(chatMessages.teamId, teamId),
        eq(chatMessages.fromMemberId, fromMemberId),
        eq(chatMessages.toMemberId, toMemberId),
        isNull(chatMessages.readAt)
      )
    );
}

// ============= ADMIN FUNCTIONS =============

export async function listAllUsers() {
  const db = await getDb();
  if (!db) throw new Error('Database unavailable');

  const result = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      loginMethod: users.loginMethod,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .orderBy(users.createdAt);

  return result;
}

export async function getUserTeamMemberships(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database unavailable');

  return db
    .select({
      teamId: teamMembersCollaborative.teamId,
      teamName: teams.name,
      role: teamMembersCollaborative.role,
      officeRole: teamMembersCollaborative.officeRole,
      status: teamMembersCollaborative.status,
    })
    .from(teamMembersCollaborative)
    .innerJoin(teams, eq(teams.id, teamMembersCollaborative.teamId))
    .where(eq(teamMembersCollaborative.memberId, userId));
}

export async function setUserSystemRole(userId: number, role: 'admin' | 'user') {
  const db = await getDb();
  if (!db) throw new Error('Database unavailable');

  await db.update(users).set({ role }).where(eq(users.id, userId));

  // Also update all team memberships to admin/developer
  if (role === 'admin') {
    await db
      .update(teamMembersCollaborative)
      .set({ role: 'admin' })
      .where(eq(teamMembersCollaborative.memberId, userId));
  }
}

export async function removeUserFromSystem(userId: number) {
  await permanentlyDeleteUser(userId);
}

export async function addUserToSystem(params: {
  name: string;
  email: string;
  teamId: number;
  role: string;
  officeRole: string;
  position: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database unavailable');

  // Check email not already taken
  const existing = await db.select().from(users).where(eq(users.email, params.email)).limit(1);
  if (existing.length > 0) throw new Error('A user with this email already exists');

  // Create user
  const [newUser] = await db.insert(users).values({
    email: params.email,
    name: params.name,
    loginMethod: 'github',
    role: 'user',
  }).returning();

  // Create team member profile
  await db.insert(teamMembers).values({
    id: newUser.id,
    name: params.name,
    email: params.email,
    position: params.position,
  }).onConflictDoNothing({ target: teamMembers.id });

  // Add to team
  await db.insert(teamMembersCollaborative).values({
    teamId: params.teamId,
    memberId: newUser.id,
    role: params.role,
    officeRole: params.officeRole,
    status: 'active',
  });

  // Send welcome notification
  await sendNotification({
    userId: newUser.id,
    teamId: params.teamId,
    type: 'team_messages',
    title: 'Welcome to the team!',
    message: `You have been added to the team as ${params.officeRole.replace(/_/g, ' ')}.`,
    priority: 'medium',
    actionUrl: '/',
    actionLabel: 'Go to Dashboard',
  });

  return newUser;
}

export async function getAllSystemUsers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(users).orderBy(desc(users.createdAt));
}

export async function permanentlyDeleteUser(targetUserId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.transaction(async (tx) => {
    // Reassign NOT NULL fields to a fallback admin
    const adminRes = await tx.execute(sql`SELECT id FROM users WHERE role = 'admin' AND id != ${targetUserId} LIMIT 1`);
    const fallbackAdminId = adminRes.rows.length > 0 ? adminRes.rows[0].id : null;
    
    const runSafe = async (query: any) => {
      try {
        await tx.execute(sql`SAVEPOINT update_sp`);
        await tx.execute(query);
        await tx.execute(sql`RELEASE SAVEPOINT update_sp`);
      } catch (err) {
        await tx.execute(sql`ROLLBACK TO SAVEPOINT update_sp`);
      }
    };

    if (fallbackAdminId) {
      await runSafe(sql`UPDATE file_folders SET created_by = ${fallbackAdminId} WHERE created_by = ${targetUserId}`);
      await runSafe(sql`UPDATE calendar_events SET created_by = ${fallbackAdminId} WHERE created_by = ${targetUserId}`);
      await runSafe(sql`UPDATE video_calls SET host_id = ${fallbackAdminId} WHERE host_id = ${targetUserId}`);
      await runSafe(sql`UPDATE resource_permissions SET granted_by = ${fallbackAdminId} WHERE granted_by = ${targetUserId}`);
      await runSafe(sql`UPDATE office_access_control SET granted_by = ${fallbackAdminId} WHERE granted_by = ${targetUserId}`);
      await runSafe(sql`UPDATE ip_whitelist SET added_by = ${fallbackAdminId} WHERE added_by = ${targetUserId}`);
      await runSafe(sql`UPDATE permission_roles SET created_by = ${fallbackAdminId} WHERE created_by = ${targetUserId}`);
      await runSafe(sql`UPDATE user_role_assignments SET assigned_by = ${fallbackAdminId} WHERE assigned_by = ${targetUserId}`);
      await runSafe(sql`UPDATE google_drive_connections SET connected_by = ${fallbackAdminId} WHERE connected_by = ${targetUserId}`);
      await runSafe(sql`UPDATE team_invitations SET invited_by = ${fallbackAdminId} WHERE invited_by = ${targetUserId}`);
      await runSafe(sql`UPDATE files SET uploaded_by = ${fallbackAdminId} WHERE uploaded_by = ${targetUserId}`);
      await runSafe(sql`UPDATE file_versions SET uploaded_by = ${fallbackAdminId} WHERE uploaded_by = ${targetUserId}`);
      await runSafe(sql`UPDATE file_shares SET shared_by = ${fallbackAdminId} WHERE shared_by = ${targetUserId}`);
      await runSafe(sql`UPDATE milestones SET created_by = ${fallbackAdminId} WHERE created_by = ${targetUserId}`);
      await runSafe(sql`UPDATE automated_rules SET created_by = ${fallbackAdminId} WHERE created_by = ${targetUserId}`);
    } else {
      // Very rare fallback if no other admin exists: just delete to avoid constraint failures
      await runSafe(sql`DELETE FROM file_folders WHERE created_by = ${targetUserId}`);
      await runSafe(sql`DELETE FROM calendar_events WHERE created_by = ${targetUserId}`);
      await runSafe(sql`DELETE FROM video_calls WHERE host_id = ${targetUserId}`);
      await runSafe(sql`DELETE FROM resource_permissions WHERE granted_by = ${targetUserId}`);
      await runSafe(sql`DELETE FROM office_access_control WHERE granted_by = ${targetUserId}`);
      await runSafe(sql`DELETE FROM ip_whitelist WHERE added_by = ${targetUserId}`);
      await runSafe(sql`DELETE FROM permission_roles WHERE created_by = ${targetUserId}`);
      await runSafe(sql`DELETE FROM user_role_assignments WHERE assigned_by = ${targetUserId}`);
      await runSafe(sql`DELETE FROM google_drive_connections WHERE connected_by = ${targetUserId}`);
      await runSafe(sql`DELETE FROM team_invitations WHERE invited_by = ${targetUserId}`);
      await runSafe(sql`DELETE FROM files WHERE uploaded_by = ${targetUserId}`);
      await runSafe(sql`DELETE FROM file_versions WHERE uploaded_by = ${targetUserId}`);
      await runSafe(sql`DELETE FROM file_shares WHERE shared_by = ${targetUserId}`);
      await runSafe(sql`DELETE FROM milestones WHERE created_by = ${targetUserId}`);
      await runSafe(sql`DELETE FROM automated_rules WHERE created_by = ${targetUserId}`);
    }

    // Set nullable references to NULL
    await runSafe(sql`UPDATE teams SET created_by = NULL WHERE created_by = ${targetUserId}`);
    await runSafe(sql`UPDATE teams SET boss_user_id = NULL WHERE boss_user_id = ${targetUserId}`);
    await runSafe(sql`UPDATE teams SET pm_user_id = NULL WHERE pm_user_id = ${targetUserId}`);
    await runSafe(sql`UPDATE projects SET created_by = NULL WHERE created_by = ${targetUserId}`);
    await runSafe(sql`UPDATE project_files SET uploaded_by = NULL WHERE uploaded_by = ${targetUserId}`);
    await runSafe(sql`UPDATE repositories SET created_by = NULL WHERE created_by = ${targetUserId}`);
    await runSafe(sql`UPDATE approvals SET approver_user_id = NULL WHERE approver_user_id = ${targetUserId}`);
    await runSafe(sql`UPDATE approvals SET reviewed_by = NULL WHERE reviewed_by = ${targetUserId}`);
    await runSafe(sql`UPDATE approvals SET resolved_by = NULL WHERE resolved_by = ${targetUserId}`);
    await runSafe(sql`UPDATE files SET created_by = NULL WHERE created_by = ${targetUserId}`);
    await runSafe(sql`UPDATE tasks SET created_by = NULL WHERE created_by = ${targetUserId}`);
    await runSafe(sql`UPDATE tasks SET assigned_to = NULL WHERE assigned_to = ${targetUserId}`);
    await runSafe(sql`UPDATE tasks SET completed_by = NULL WHERE completed_by = ${targetUserId}`);
    await runSafe(sql`UPDATE milestones SET completed_by = NULL WHERE completed_by = ${targetUserId}`);

    // Delete records strictly bound to the user
    await runSafe(sql`DELETE FROM security_audit_trail WHERE user_id = ${targetUserId}`);
    await runSafe(sql`DELETE FROM user_push_tokens WHERE user_id = ${targetUserId}`);
    await runSafe(sql`DELETE FROM user_sessions WHERE user_id = ${targetUserId}`);
    await runSafe(sql`DELETE FROM call_participants WHERE user_id = ${targetUserId}`);
    await runSafe(sql`DELETE FROM user_availability WHERE user_id = ${targetUserId}`);

    // Delete from child tables that reference the user
    await tx.delete(oauthTokens).where(eq(oauthTokens.userId, targetUserId));
    await tx.delete(teamMembersCollaborative).where(eq(teamMembersCollaborative.memberId, targetUserId));
    await tx.delete(notifications).where(eq(notifications.userId, targetUserId));
    await tx.delete(activities).where(eq(activities.userId, targetUserId));
    await tx.delete(auditLogs).where(eq(auditLogs.userId, targetUserId));
    
    // Delete from users and teamMembers
    await tx.delete(users).where(eq(users.id, targetUserId));
    await tx.delete(teamMembers).where(eq(teamMembers.id, targetUserId));
  });
}
