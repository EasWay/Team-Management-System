-- Meta Accounts table for Facebook Page + Instagram Business connections
-- Run this in Supabase SQL Editor after the main migration

CREATE TABLE public.meta_accounts (
  id SERIAL PRIMARY KEY,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  member_id INTEGER REFERENCES team_members(id) ON DELETE CASCADE,
  meta_user_id TEXT,
  page_id TEXT,
  page_name TEXT,
  page_access_token TEXT,
  instagram_id TEXT,
  instagram_username TEXT,
  instagram_access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  refresh_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX idx_meta_accounts_team ON meta_accounts(team_id);

-- Enable RLS
ALTER TABLE meta_accounts ENABLE ROW LEVEL SECURITY;

-- Policy: Team members can view their team's meta accounts
CREATE POLICY "Team members can view meta accounts" ON meta_accounts
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM team_members_collaborative 
      WHERE member_id IN (
        SELECT id FROM team_members WHERE email = auth.jwt() ->> 'email'
      )
    )
  );

-- Policy: Team members can insert meta accounts for their team
CREATE POLICY "Team members can insert meta accounts" ON meta_accounts
  FOR INSERT WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_members_collaborative 
      WHERE member_id IN (
        SELECT id FROM team_members WHERE email = auth.jwt() ->> 'email'
      )
    )
  );

-- Enable real-time for meta_accounts
ALTER PUBLICATION supabase_realtime ADD TABLE meta_accounts;