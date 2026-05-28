ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "completion_percentage" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "tags" jsonb;
