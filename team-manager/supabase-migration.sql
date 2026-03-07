-- Supabase migration from your Drizzle schema
-- Run this in Supabase SQL Editor

-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id SERIAL PRIMARY KEY,
  open_id TEXT UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT,
  name TEXT,
  login_method TEXT,
  role TEXT DEFAULT 'user',
  last_signed_in TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team Members table
CREATE TABLE public.team_members (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  position TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams table
CREATE TABLE public.teams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by INTEGER REFERENCES team_members(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team Members Collaborative table
CREATE TABLE public.team_members_collaborative (
  id SERIAL PRIMARY KEY,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  member_id INTEGER REFERENCES team_members(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks table
CREATE TABLE public.tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo',
  priority TEXT DEFAULT 'medium',
  assigned_to INTEGER REFERENCES team_members(id),
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES team_members(id),
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable real-time for tasks (for Kanban updates)
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;

-- Row Level Security policies
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members_collaborative ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see teams they're members of
CREATE POLICY "Users can view teams they belong to" ON teams
  FOR SELECT USING (
    id IN (
      SELECT team_id FROM team_members_collaborative 
      WHERE member_id IN (
        SELECT id FROM team_members WHERE email = auth.jwt() ->> 'email'
      )
    )
  );

-- Policy: Users can only see tasks from their teams
CREATE POLICY "Users can view tasks from their teams" ON tasks
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM team_members_collaborative 
      WHERE member_id IN (
        SELECT id FROM team_members WHERE email = auth.jwt() ->> 'email'
      )
    )
  );