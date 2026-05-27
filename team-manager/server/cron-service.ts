/**
 * Cron Service
 *
 * Runs scheduled jobs without an external dependency by using a simple
 * setInterval-based scheduler (avoids adding node-cron to the bundle).
 *
 * Jobs:
 *   1. processPendingIdeas  — pick up any pending Telegram ideas and run them
 *      through the LLM pipeline (runs every 5 minutes as a safety net; most
 *      ideas are processed immediately on receipt).
 *
 *   2. notifyPMOfNewIdeas   — hourly digest push notification to PM(s) when
 *      there are unread ideas sitting in the inbox.
 *
 *   3. checkApproachingDeadlines — existing routine, wired up here.
 */

import { getDb } from "./db";
import { eq } from "drizzle-orm";
import { teams } from "../drizzle/schema";
import { processPendingIdeas, notifyPMOfNewIdeas } from "./idea-service";
import { checkApproachingDeadlines } from "./notification-service";
import { ENV } from "./_core/env";

let started = false;

function every(ms: number, label: string, fn: () => Promise<void>): void {
  const run = async () => {
    try {
      await fn();
    } catch (err) {
      console.error(`[Cron:${label}] Error:`, err);
    }
  };

  // Run once after a short delay on startup, then on interval
  setTimeout(run, 10_000);
  setInterval(run, ms);
}

export function startCronJobs(): void {
  if (started) return;
  started = true;

  console.log("[Cron] Starting scheduled jobs...");

  // ── Job 1: Process pending ideas every 5 minutes ────────────────────────
  every(5 * 60 * 1000, "processPendingIdeas", async () => {
    await processPendingIdeas();
  });

  // ── Job 2: PM inbox notification — hourly ───────────────────────────────
  every(60 * 60 * 1000, "pmInboxNotification", async () => {
    const db = await getDb();
    if (!db) return;
    const allTeams = await db.select({ id: teams.id }).from(teams);
    for (const team of allTeams) {
      await notifyPMOfNewIdeas(team.id);
    }
  });

  // ── Job 3: Approaching deadlines — every hour ───────────────────────────
  every(60 * 60 * 1000, "approachingDeadlines", async () => {
    const db = await getDb();
    if (!db) return;
    const allTeams = await db.select({ id: teams.id }).from(teams);
    for (const team of allTeams) {
      await checkApproachingDeadlines(team.id).catch(() => {});
    }
  });

  console.log("[Cron] Jobs scheduled.");
}
