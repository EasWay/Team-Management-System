CREATE TABLE "call_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"call_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"message" text NOT NULL,
	"message_type" text DEFAULT 'text',
	"file_url" text,
	"file_name" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "call_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"call_id" integer NOT NULL,
	"user_id" integer NOT NULL,
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
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"from_member_id" integer NOT NULL,
	"to_member_id" integer NOT NULL,
	"content" text NOT NULL,
	"message_type" text DEFAULT 'text',
	"file_url" text,
	"file_name" text,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_activity_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"activity_type" text NOT NULL,
	"description" text NOT NULL,
	"project_id" integer,
	"file_id" integer,
	"ip_address" text,
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"project_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"feedback_type" text NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"rating" integer,
	"deliverable_id" integer,
	"file_id" integer,
	"status" text DEFAULT 'pending',
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"response" text,
	"attachments" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_portal_access" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"email" text NOT NULL,
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
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "client_portal_access_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "client_project_visibility" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"project_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"is_visible" boolean DEFAULT true,
	"can_view_files" boolean DEFAULT true,
	"can_download_files" boolean DEFAULT false,
	"can_view_tasks" boolean DEFAULT false,
	"can_view_timeline" boolean DEFAULT true,
	"custom_status" text,
	"custom_description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "client_project_visibility_client_id_project_id_unique" UNIQUE("client_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "daily_digest_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"team_id" integer NOT NULL,
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
CREATE TABLE "google_drive_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer,
	"user_id" integer,
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
	"connected_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "google_drive_files_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" integer NOT NULL,
	"google_file_id" text NOT NULL,
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
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "google_drive_files_cache_google_file_id_unique" UNIQUE("google_file_id")
);
--> statement-breakpoint
CREATE TABLE "ip_whitelist" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"ip_address" text NOT NULL,
	"ip_range" text,
	"label" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"applies_to_all_users" boolean DEFAULT true,
	"specific_users" jsonb,
	"added_by" integer NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
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
	"quiet_hours_start" text,
	"quiet_hours_end" text,
	"quiet_hours_timezone" text DEFAULT 'UTC',
	"daily_digest_enabled" boolean DEFAULT true,
	"daily_digest_time" text DEFAULT '08:00',
	"daily_digest_timezone" text DEFAULT 'UTC',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
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
	"created_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "office_access_control" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"user_id" integer NOT NULL,
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
	"granted_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "office_access_control_user_id_office_role_team_id_unique" UNIQUE("user_id","office_role","team_id")
);
--> statement-breakpoint
CREATE TABLE "office_rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"office_role" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"is_permanent" boolean DEFAULT true,
	"max_participants" integer DEFAULT 10,
	"is_public" boolean DEFAULT true,
	"allowed_users" jsonb,
	"current_call_id" integer,
	"active_participants" integer DEFAULT 0,
	"screen_sharing_enabled" boolean DEFAULT true,
	"recording_enabled" boolean DEFAULT false,
	"chat_enabled" boolean DEFAULT true,
	"knock_to_enter" boolean DEFAULT false,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "permission_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"permissions" jsonb NOT NULL,
	"level" integer DEFAULT 0,
	"inherits_from" integer,
	"is_active" boolean DEFAULT true,
	"is_system" boolean DEFAULT false,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "permission_roles_team_id_name_unique" UNIQUE("team_id","name")
);
--> statement-breakpoint
CREATE TABLE "resource_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" integer NOT NULL,
	"permission" text NOT NULL,
	"granted_by" integer NOT NULL,
	"granted_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	"reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "resource_permissions_user_id_resource_type_resource_id_unique" UNIQUE("user_id","resource_type","resource_id")
);
--> statement-breakpoint
CREATE TABLE "security_audit_trail" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer,
	"user_id" integer,
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
CREATE TABLE "two_factor_auth" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
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
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "two_factor_auth_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_push_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"push_token" text NOT NULL,
	"platform" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_role_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"assigned_by" integer NOT NULL,
	"assigned_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "user_role_assignments_user_id_role_id_team_id_unique" UNIQUE("user_id","role_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"session_token" text NOT NULL,
	"refresh_token" text,
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
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "user_sessions_session_token_unique" UNIQUE("session_token"),
	CONSTRAINT "user_sessions_refresh_token_unique" UNIQUE("refresh_token")
);
--> statement-breakpoint
CREATE TABLE "video_calls" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"project_id" integer,
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
	"room_id" text,
	"is_recorded" boolean DEFAULT false,
	"recording_url" text,
	"recording_duration" integer,
	"host_id" integer NOT NULL,
	"participants" jsonb,
	"max_participants" integer DEFAULT 50,
	"screen_sharing_enabled" boolean DEFAULT true,
	"recording_enabled" boolean DEFAULT false,
	"chat_enabled" boolean DEFAULT true,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "video_calls_room_id_unique" UNIQUE("room_id")
);
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "team_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "priority" text DEFAULT 'normal';--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "task_id" integer;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "project_id" integer;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "file_id" integer;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "folder_id" integer;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "action_url" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "action_label" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "read_at" timestamp;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "sent_via_email" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "sent_via_push" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "sent_in_app" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "completion_percentage" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "tags" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "call_messages" ADD CONSTRAINT "call_messages_call_id_video_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."video_calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_messages" ADD CONSTRAINT "call_messages_user_id_team_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_call_id_video_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."video_calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_user_id_team_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_from_member_id_team_members_id_fk" FOREIGN KEY ("from_member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_to_member_id_team_members_id_fk" FOREIGN KEY ("to_member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_activity_log" ADD CONSTRAINT "client_activity_log_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_activity_log" ADD CONSTRAINT "client_activity_log_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_activity_log" ADD CONSTRAINT "client_activity_log_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_activity_log" ADD CONSTRAINT "client_activity_log_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_feedback" ADD CONSTRAINT "client_feedback_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_feedback" ADD CONSTRAINT "client_feedback_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_feedback" ADD CONSTRAINT "client_feedback_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_feedback" ADD CONSTRAINT "client_feedback_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_feedback" ADD CONSTRAINT "client_feedback_reviewed_by_team_members_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_portal_access" ADD CONSTRAINT "client_portal_access_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_portal_access" ADD CONSTRAINT "client_portal_access_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_project_visibility" ADD CONSTRAINT "client_project_visibility_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_project_visibility" ADD CONSTRAINT "client_project_visibility_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_project_visibility" ADD CONSTRAINT "client_project_visibility_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_digest_queue" ADD CONSTRAINT "daily_digest_queue_user_id_team_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_digest_queue" ADD CONSTRAINT "daily_digest_queue_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_drive_connections" ADD CONSTRAINT "google_drive_connections_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_drive_connections" ADD CONSTRAINT "google_drive_connections_user_id_team_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_drive_connections" ADD CONSTRAINT "google_drive_connections_connected_by_team_members_id_fk" FOREIGN KEY ("connected_by") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_drive_files_cache" ADD CONSTRAINT "google_drive_files_cache_connection_id_google_drive_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."google_drive_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ip_whitelist" ADD CONSTRAINT "ip_whitelist_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ip_whitelist" ADD CONSTRAINT "ip_whitelist_added_by_team_members_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_team_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_created_by_team_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_access_control" ADD CONSTRAINT "office_access_control_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_access_control" ADD CONSTRAINT "office_access_control_user_id_team_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_access_control" ADD CONSTRAINT "office_access_control_granted_by_team_members_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_rooms" ADD CONSTRAINT "office_rooms_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_rooms" ADD CONSTRAINT "office_rooms_current_call_id_video_calls_id_fk" FOREIGN KEY ("current_call_id") REFERENCES "public"."video_calls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_rooms" ADD CONSTRAINT "office_rooms_created_by_team_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_roles" ADD CONSTRAINT "permission_roles_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_roles" ADD CONSTRAINT "permission_roles_inherits_from_permission_roles_id_fk" FOREIGN KEY ("inherits_from") REFERENCES "public"."permission_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_roles" ADD CONSTRAINT "permission_roles_created_by_team_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_permissions" ADD CONSTRAINT "resource_permissions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_permissions" ADD CONSTRAINT "resource_permissions_user_id_team_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_permissions" ADD CONSTRAINT "resource_permissions_granted_by_team_members_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_audit_trail" ADD CONSTRAINT "security_audit_trail_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_audit_trail" ADD CONSTRAINT "security_audit_trail_user_id_team_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor_auth" ADD CONSTRAINT "two_factor_auth_user_id_team_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_push_tokens" ADD CONSTRAINT "user_push_tokens_user_id_team_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_user_id_team_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_role_id_permission_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."permission_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_assigned_by_team_members_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_team_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_calls" ADD CONSTRAINT "video_calls_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_calls" ADD CONSTRAINT "video_calls_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_calls" ADD CONSTRAINT "video_calls_host_id_team_members_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "call_participants_call_id_idx" ON "call_participants" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "call_participants_user_id_idx" ON "call_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_messages_from_idx" ON "chat_messages" USING btree ("from_member_id");--> statement-breakpoint
CREATE INDEX "chat_messages_to_idx" ON "chat_messages" USING btree ("to_member_id");--> statement-breakpoint
CREATE INDEX "chat_messages_team_idx" ON "chat_messages" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "google_drive_connections_team_id_idx" ON "google_drive_connections" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "google_drive_connections_user_id_idx" ON "google_drive_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "google_drive_connections_office_role_idx" ON "google_drive_connections" USING btree ("office_role");--> statement-breakpoint
CREATE INDEX "google_drive_files_cache_connection_id_idx" ON "google_drive_files_cache" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "google_drive_files_cache_google_file_id_idx" ON "google_drive_files_cache" USING btree ("google_file_id");--> statement-breakpoint
CREATE INDEX "ip_whitelist_team_id_idx" ON "ip_whitelist" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "ip_whitelist_ip_address_idx" ON "ip_whitelist" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "office_access_control_team_id_idx" ON "office_access_control" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "office_access_control_user_id_idx" ON "office_access_control" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "office_rooms_team_id_idx" ON "office_rooms" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "office_rooms_office_role_idx" ON "office_rooms" USING btree ("office_role");--> statement-breakpoint
CREATE INDEX "permission_roles_team_id_idx" ON "permission_roles" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "resource_permissions_team_id_idx" ON "resource_permissions" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "resource_permissions_user_id_idx" ON "resource_permissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "resource_permissions_resource_idx" ON "resource_permissions" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "security_audit_trail_team_id_idx" ON "security_audit_trail" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "security_audit_trail_user_id_idx" ON "security_audit_trail" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "security_audit_trail_action_idx" ON "security_audit_trail" USING btree ("action");--> statement-breakpoint
CREATE INDEX "security_audit_trail_timestamp_idx" ON "security_audit_trail" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "security_audit_trail_flagged_idx" ON "security_audit_trail" USING btree ("flagged");--> statement-breakpoint
CREATE INDEX "user_role_assignments_user_id_idx" ON "user_role_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_role_assignments_role_id_idx" ON "user_role_assignments" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_sessions_session_token_idx" ON "user_sessions" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX "user_sessions_is_active_idx" ON "user_sessions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "video_calls_team_id_idx" ON "video_calls" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "video_calls_status_idx" ON "video_calls" USING btree ("status");--> statement-breakpoint
CREATE INDEX "video_calls_room_id_idx" ON "video_calls" USING btree ("room_id");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_team_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_folder_id_file_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."file_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_team_id_idx" ON "activities" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "activities_team_created_idx" ON "activities" USING btree ("team_id","created_at");--> statement-breakpoint
CREATE INDEX "projects_team_id_idx" ON "projects" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "projects_team_status_idx" ON "projects" USING btree ("team_id","status");--> statement-breakpoint
CREATE INDEX "tasks_team_id_idx" ON "tasks" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "tasks_assigned_to_idx" ON "tasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "tasks_team_status_idx" ON "tasks" USING btree ("team_id","status");--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "link";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");