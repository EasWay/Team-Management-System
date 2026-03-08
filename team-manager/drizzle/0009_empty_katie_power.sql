DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_invitations' AND column_name='role') THEN
    ALTER TABLE "team_invitations" ADD COLUMN "role" text DEFAULT 'member';
  END IF;
END $$;
--> statement-breakpoint
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members_collaborative' AND column_name='status') THEN
    ALTER TABLE "team_members_collaborative" ADD COLUMN "status" text DEFAULT 'active';
  END IF;
END $$;