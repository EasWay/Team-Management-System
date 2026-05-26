CREATE TABLE "calendar_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"project_id" integer,
	"task_id" integer,
	"title" text NOT NULL,
	"description" text,
	"event_type" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"all_day" boolean DEFAULT false,
	"recurrence" text,
	"recurrence_end" timestamp,
	"location" text,
	"meeting_url" text,
	"created_by" integer NOT NULL,
	"assigned_to" jsonb,
	"status" text DEFAULT 'scheduled',
	"priority" text DEFAULT 'medium',
	"reminders" jsonb,
	"color" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "file_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"comment" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "file_folders" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"project_id" integer,
	"parent_folder_id" integer,
	"name" text NOT NULL,
	"description" text,
	"color" text,
	"icon" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "file_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_id" integer NOT NULL,
	"shared_with" integer NOT NULL,
	"shared_by" integer NOT NULL,
	"permission" text DEFAULT 'view',
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "file_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_id" integer NOT NULL,
	"version" integer NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer NOT NULL,
	"uploaded_by" integer NOT NULL,
	"change_description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"project_id" integer,
	"task_id" integer,
	"folder_id" integer,
	"file_name" text NOT NULL,
	"original_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"file_type" text NOT NULL,
	"file_url" text NOT NULL,
	"thumbnail_url" text,
	"tags" jsonb,
	"description" text,
	"version" integer DEFAULT 1,
	"parent_file_id" integer,
	"is_latest_version" boolean DEFAULT true,
	"is_public" boolean DEFAULT false,
	"uploaded_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"due_date" timestamp NOT NULL,
	"depends_on" jsonb,
	"status" text DEFAULT 'pending',
	"completed_at" timestamp,
	"completed_by" integer,
	"progress" integer DEFAULT 0,
	"color" text,
	"icon" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"team_id" integer,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"link" text,
	"read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_dependencies" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"depends_on_task_id" integer NOT NULL,
	"dependency_type" text DEFAULT 'finish_to_start',
	"lag" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_availability" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"is_recurring" boolean DEFAULT false,
	"recurrence_pattern" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_created_by_team_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_comments" ADD CONSTRAINT "file_comments_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_comments" ADD CONSTRAINT "file_comments_user_id_team_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_folders" ADD CONSTRAINT "file_folders_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_folders" ADD CONSTRAINT "file_folders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_folders" ADD CONSTRAINT "file_folders_created_by_team_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_shares" ADD CONSTRAINT "file_shares_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_shares" ADD CONSTRAINT "file_shares_shared_with_team_members_id_fk" FOREIGN KEY ("shared_with") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_shares" ADD CONSTRAINT "file_shares_shared_by_team_members_id_fk" FOREIGN KEY ("shared_by") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_uploaded_by_team_members_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_folder_id_file_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."file_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_team_members_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_completed_by_team_members_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_created_by_team_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_depends_on_task_id_tasks_id_fk" FOREIGN KEY ("depends_on_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_availability" ADD CONSTRAINT "user_availability_user_id_team_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_availability" ADD CONSTRAINT "user_availability_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_events_team_id_idx" ON "calendar_events" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "calendar_events_start_date_idx" ON "calendar_events" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "calendar_events_event_type_idx" ON "calendar_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "file_folders_team_id_idx" ON "file_folders" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "file_folders_project_id_idx" ON "file_folders" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "file_versions_file_id_idx" ON "file_versions" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "files_team_id_idx" ON "files" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "files_project_id_idx" ON "files" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "files_task_id_idx" ON "files" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "files_folder_id_idx" ON "files" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "task_dependencies_task_id_idx" ON "task_dependencies" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_dependencies_depends_on_idx" ON "task_dependencies" USING btree ("depends_on_task_id");--> statement-breakpoint
CREATE INDEX "user_availability_user_id_idx" ON "user_availability" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_availability_start_date_idx" ON "user_availability" USING btree ("start_date");