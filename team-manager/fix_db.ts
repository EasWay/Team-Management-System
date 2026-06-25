import "dotenv/config";
import { getDb } from "./server/db";
import { sql } from "drizzle-orm";

async function fix() {
  const db = await getDb();
  if (!db) {
    console.error("No DB connection");
    return;
  }
  
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "notification_preferences" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" integer NOT NULL,
        "team_id" integer NOT NULL,
        "email_enabled" boolean DEFAULT true,
        "push_enabled" boolean DEFAULT true,
        "in_app_enabled" boolean DEFAULT true,
        "task_assignments" boolean DEFAULT true,
        "task_deadlines" boolean DEFAULT true,
        "mentions" boolean DEFAULT true,
        "approval_requests" boolean DEFAULT true,
        "folder_alerts" boolean DEFAULT true,
        "project_updates" boolean DEFAULT true,
        "team_messages" boolean DEFAULT true,
        "high_priority_only" boolean DEFAULT false,
        "quiet_hours_enabled" boolean DEFAULT false,
        "quiet_hours_start" text DEFAULT '22:00',
        "quiet_hours_end" text DEFAULT '08:00',
        "quiet_hours_timezone" text DEFAULT 'UTC',
        "daily_digest_enabled" boolean DEFAULT false,
        "daily_digest_time" text DEFAULT '08:00',
        "daily_digest_timezone" text DEFAULT 'UTC',
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "call_messages" (
        "id" serial PRIMARY KEY NOT NULL,
        "call_id" integer NOT NULL,
        "user_id" integer NOT NULL,
        "message" text NOT NULL,
        "message_type" text DEFAULT 'text',
        "file_url" text,
        "file_name" text,
        "created_at" timestamp DEFAULT now()
      );

      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS username text UNIQUE;
    `);
    console.log("Successfully created missing tables and columns");
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}

fix();
