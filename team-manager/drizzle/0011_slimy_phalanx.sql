CREATE TABLE "approvals" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"approver_type" text NOT NULL,
	"approver_user_id" integer,
	"status" text DEFAULT 'pending',
	"comments" text,
	"votes_for" integer DEFAULT 0,
	"votes_against" integer DEFAULT 0,
	"votes_abstain" integer DEFAULT 0,
	"required_votes" integer,
	"voters" jsonb,
	"from_stage" text,
	"to_stage" text,
	"deliverables" jsonb,
	"created_at" timestamp DEFAULT now(),
	"resolved_at" timestamp,
	"resolved_by" integer
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "ideation_data" jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "workflow_stage" text DEFAULT 'ideation';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "assigned_role" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "handoff_history" jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "deliverables" jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "evaluation_data" jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "evaluated_at" timestamp;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "workflow_stage" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "assigned_role" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "handoff_history" jsonb;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "deliverables" jsonb;--> statement-breakpoint
ALTER TABLE "team_members_collaborative" ADD COLUMN "office_role" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "approval_mode" text DEFAULT 'pm';--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "boss_user_id" integer;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "pm_user_id" integer;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "vote_threshold" integer DEFAULT 51;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approver_user_id_team_members_id_fk" FOREIGN KEY ("approver_user_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_resolved_by_team_members_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_boss_user_id_team_members_id_fk" FOREIGN KEY ("boss_user_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_pm_user_id_team_members_id_fk" FOREIGN KEY ("pm_user_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;