-- 17 tables defined in drizzle/schema.ts never had a migration generated for
-- them, so they don't exist in the database at all. This creates them.
-- See: security audit trail / permission grant / session / 2FA / client
-- portal / video call features were silently non-functional because of this.

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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_calls_team_id_idx" ON "video_calls" ("team_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_calls_status_idx" ON "video_calls" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_calls_room_id_idx" ON "video_calls" ("room_id");
--> statement-breakpoint

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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_participants_call_id_idx" ON "call_participants" ("call_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_participants_user_id_idx" ON "call_participants" ("user_id");
--> statement-breakpoint

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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "office_rooms_team_id_idx" ON "office_rooms" ("team_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "office_rooms_office_role_idx" ON "office_rooms" ("office_role");
--> statement-breakpoint

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
--> statement-breakpoint

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
--> statement-breakpoint

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
--> statement-breakpoint

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
--> statement-breakpoint

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
--> statement-breakpoint

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
--> statement-breakpoint

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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_permissions_team_id_idx" ON "resource_permissions" ("team_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_permissions_user_id_idx" ON "resource_permissions" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_permissions_resource_idx" ON "resource_permissions" ("resource_type","resource_id");
--> statement-breakpoint

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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "office_access_control_team_id_idx" ON "office_access_control" ("team_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "office_access_control_user_id_idx" ON "office_access_control" ("user_id");
--> statement-breakpoint

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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "security_audit_trail_team_id_idx" ON "security_audit_trail" ("team_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "security_audit_trail_user_id_idx" ON "security_audit_trail" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "security_audit_trail_action_idx" ON "security_audit_trail" ("action");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "security_audit_trail_timestamp_idx" ON "security_audit_trail" ("timestamp");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "security_audit_trail_flagged_idx" ON "security_audit_trail" ("flagged");
--> statement-breakpoint

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
--> statement-breakpoint

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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ip_whitelist_team_id_idx" ON "ip_whitelist" ("team_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ip_whitelist_ip_address_idx" ON "ip_whitelist" ("ip_address");
--> statement-breakpoint

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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_user_id_idx" ON "user_sessions" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_session_token_idx" ON "user_sessions" ("session_token");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_is_active_idx" ON "user_sessions" ("is_active");
--> statement-breakpoint

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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permission_roles_team_id_idx" ON "permission_roles" ("team_id");
--> statement-breakpoint

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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_role_assignments_user_id_idx" ON "user_role_assignments" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_role_assignments_role_id_idx" ON "user_role_assignments" ("role_id");
