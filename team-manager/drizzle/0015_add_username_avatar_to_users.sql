ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" text;
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");
EXCEPTION
 WHEN duplicate_table THEN null;
 WHEN duplicate_object THEN null;
 WHEN duplicate_alias THEN null;
END $$;
