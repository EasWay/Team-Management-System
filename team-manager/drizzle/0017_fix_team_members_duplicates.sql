-- Remove duplicate team members by keeping only the row with the lowest id
DELETE FROM "team_members_collaborative" a USING "team_members_collaborative" b
WHERE a.id > b.id 
  AND a.team_id = b.team_id 
  AND a.member_id = b.member_id;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "team_members_collaborative" ADD CONSTRAINT "unique_team_member" UNIQUE("team_id", "member_id");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
