CREATE TABLE IF NOT EXISTS "user_push_tokens" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "push_token" text NOT NULL,
  "platform" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_push_tokens" ADD CONSTRAINT "user_push_tokens_user_id_team_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
