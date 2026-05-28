CREATE TABLE IF NOT EXISTS "google_drive_connections" (
	"id" serial PRIMARY KEY NOT NULL,
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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "google_drive_connections_team_id_idx" ON "google_drive_connections" ("team_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "google_drive_connections_user_id_idx" ON "google_drive_connections" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "google_drive_connections_office_role_idx" ON "google_drive_connections" ("office_role");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "google_drive_files_cache" (
	"id" serial PRIMARY KEY NOT NULL,
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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "google_drive_files_cache_connection_id_idx" ON "google_drive_files_cache" ("connection_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "google_drive_files_cache_google_file_id_idx" ON "google_drive_files_cache" ("google_file_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_messages_from_idx" ON "chat_messages" ("from_member_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_messages_to_idx" ON "chat_messages" ("to_member_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_messages_team_idx" ON "chat_messages" ("team_id");
