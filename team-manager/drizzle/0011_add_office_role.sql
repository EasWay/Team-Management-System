-- Migration: Add office_role column to team_members_collaborative table
-- Date: 2026-05-25
-- Description: Adds office_role field for Digital HQ office assignments

-- Add the office_role column (nullable, so existing data is safe)
ALTER TABLE "team_members_collaborative" 
ADD COLUMN IF NOT EXISTS "office_role" TEXT;

-- Add a comment to document the column
COMMENT ON COLUMN "team_members_collaborative"."office_role" IS 'Digital HQ office assignment: project_manager, lead_researcher, systems_architect, backend_engineer, fullstack_engineer, ai_engineer, qa_tester, designer, or NULL for visitors';

-- Optional: Create an index for faster queries by office role
CREATE INDEX IF NOT EXISTS "idx_team_members_office_role" 
ON "team_members_collaborative" ("office_role");

-- Optional: Add a check constraint to ensure only valid office roles
ALTER TABLE "team_members_collaborative"
ADD CONSTRAINT "chk_office_role_valid" 
CHECK (
  "office_role" IS NULL OR 
  "office_role" IN (
    'project_manager',
    'lead_researcher', 
    'systems_architect',
    'backend_engineer',
    'fullstack_engineer',
    'ai_engineer',
    'qa_tester',
    'designer'
  )
);
