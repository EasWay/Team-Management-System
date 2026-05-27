/**
 * Idea Service
 *
 * Processes raw ideas captured from Telegram through the LLM pipeline:
 *   raw idea → transcribe (audio) → refine → categorise → prioritise → save
 *
 * Also handles delivering batched ideas to the PM's office and sending a
 * processed idea to the Conference Room for team deliberation.
 */

import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "./db";
import {
  rawIdeas,
  processedIdeas,
  telegramUsers,
  teamMembers,
  teams,
  notifications,
  userPushTokens,
} from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";
import { createApproval } from "./db";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RefinedIdea {
  title: string;
  summary: string;
  refinedDescription: string;
  category: "product" | "process" | "marketing" | "technical" | "other";
  priority: "low" | "medium" | "high" | "critical";
  estimatedImpact: string;
  suggestedNextSteps: string[];
}

// ─── Audio Transcription ──────────────────────────────────────────────────────

/**
 * Transcribe an audio file (OGG/MP3/WAV) using Groq's Whisper endpoint.
 * Falls back gracefully when no audio URL is provided.
 */
export async function transcribeAudio(audioUrl: string): Promise<string> {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ENV.groqApiKey}`,
      },
      body: (() => {
        const form = new FormData();
        form.append("model", "whisper-large-v3");
        form.append("url", audioUrl); // Groq accepts URL for remote files
        form.append("response_format", "text");
        return form;
      })(),
    });

    if (!response.ok) {
      console.warn("[IdeaService] Whisper transcription failed:", await response.text());
      return "[Audio transcription unavailable]";
    }

    return (await response.text()).trim();
  } catch (err) {
    console.warn("[IdeaService] Transcription error:", err);
    return "[Audio transcription unavailable]";
  }
}

// ─── LLM Refinement ───────────────────────────────────────────────────────────

/**
 * Pass the raw idea content through the LLM and get a structured, refined idea.
 */
export async function refineIdea(rawContent: string, mediaType: string): Promise<RefinedIdea> {
  const prompt = `You are a product strategist helping a software team capture and refine ideas from team members.

A team member submitted the following idea via Telegram (${mediaType}):

"""
${rawContent}
"""

Your job is to:
1. Understand the core idea, even if it's vague or informal
2. Write a clear title (max 8 words)
3. Write a one-sentence summary
4. Write a refined, professional description (2-4 sentences)
5. Choose the most fitting category: product | process | marketing | technical | other
6. Assign priority: low | medium | high | critical
   — critical = time-sensitive or high business impact
   — high = significant value, not immediately urgent
   — medium = worth doing, can wait
   — low = nice to have
7. Estimate potential impact in one sentence
8. List 3-5 concrete suggested next steps

Return ONLY a JSON object matching this schema exactly:
{
  "title": "...",
  "summary": "...",
  "refinedDescription": "...",
  "category": "product",
  "priority": "medium",
  "estimatedImpact": "...",
  "suggestedNextSteps": ["...", "...", "..."]
}`;

  const result = await invokeLLM({
    messages: [
      { role: "system", content: "You are a precise product strategist. Return only valid JSON." },
      { role: "user", content: prompt },
    ],
    responseFormat: { type: "json_object" },
  });

  const content = typeof result.choices[0].message.content === "string"
    ? result.choices[0].message.content
    : JSON.stringify(result.choices[0].message.content);

  return JSON.parse(content) as RefinedIdea;
}

// ─── Process Raw Idea ─────────────────────────────────────────────────────────

/**
 * Full pipeline: pick up a pending raw idea, refine it, and save as a processed idea.
 */
export async function processRawIdea(rawIdeaId: number): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  // Mark as processing
  await db.update(rawIdeas).set({ status: "processing" }).where(eq(rawIdeas.id, rawIdeaId));

  const [raw] = await db.select().from(rawIdeas).where(eq(rawIdeas.id, rawIdeaId)).limit(1);
  if (!raw) return null;

  try {
    let contentForLLM = raw.rawText ?? "";

    // Transcribe audio if needed
    if (raw.type === "audio" && raw.mediaUrl && !raw.transcription) {
      console.log(`[IdeaService] Transcribing audio for rawIdea ${rawIdeaId}`);
      const transcription = await transcribeAudio(raw.mediaUrl);
      await db.update(rawIdeas).set({ transcription }).where(eq(rawIdeas.id, rawIdeaId));
      contentForLLM = transcription;
    } else if (raw.transcription) {
      contentForLLM = raw.transcription;
    }

    if (!contentForLLM.trim()) {
      contentForLLM = `[${raw.type} message — no extractable text]`;
    }

    // Refine via LLM
    const refined = await refineIdea(contentForLLM, raw.type);

    // Persist processed idea
    const [processed] = await db
      .insert(processedIdeas)
      .values({
        rawIdeaId: raw.id,
        teamId: raw.teamId,
        telegramUserId: raw.telegramUserId,
        title: refined.title,
        summary: refined.summary,
        refinedDescription: refined.refinedDescription,
        category: refined.category,
        priority: refined.priority,
        estimatedImpact: refined.estimatedImpact,
        suggestedNextSteps: refined.suggestedNextSteps,
        llmRawOutput: refined as any,
        status: "inbox",
        sentToPmAt: new Date(),
      })
      .returning();

    // Mark raw idea as processed
    await db
      .update(rawIdeas)
      .set({ status: "processed", processedAt: new Date() })
      .where(eq(rawIdeas.id, rawIdeaId));

    console.log(`[IdeaService] Processed rawIdea ${rawIdeaId} → processedIdea ${processed.id}`);
    return processed.id;
  } catch (err) {
    console.error(`[IdeaService] Failed to process rawIdea ${rawIdeaId}:`, err);
    await db
      .update(rawIdeas)
      .set({ status: "failed", errorMessage: String(err) })
      .where(eq(rawIdeas.id, rawIdeaId));
    return null;
  }
}

// ─── Batch Processing ─────────────────────────────────────────────────────────

/**
 * Process all pending raw ideas. Called by the cron job.
 */
export async function processPendingIdeas(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const pending = await db
    .select({ id: rawIdeas.id })
    .from(rawIdeas)
    .where(eq(rawIdeas.status, "pending"));

  console.log(`[IdeaService] Processing ${pending.length} pending idea(s)...`);

  for (const { id } of pending) {
    await processRawIdea(id);
  }
}

// ─── Push Notification Dispatch ───────────────────────────────────────────────

async function sendExpoPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify({ to: pushToken, sound: "default", title, body, data }),
    });
  } catch (err) {
    console.warn("[IdeaService] Push notification failed:", err);
  }
}

/**
 * Notify the PM(s) of this team about new ideas in their inbox.
 */
export async function notifyPMOfNewIdeas(teamId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Get unread inbox count
  const inbox = await db
    .select({ id: processedIdeas.id })
    .from(processedIdeas)
    .where(and(eq(processedIdeas.teamId, teamId), eq(processedIdeas.status, "inbox")));

  if (inbox.length === 0) return;

  // Find PM users in this team — role = 'pm' or 'admin'
  const pms = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(
      eq(teamMembers.teamId as any, teamId),
      inArray(teamMembers.officeRole as any, ["pm", "admin", "team_lead"]),
    ));

  const pmIds = pms.map((p) => p.id);
  if (pmIds.length === 0) return;

  const tokens = await db
    .select({ pushToken: userPushTokens.pushToken })
    .from(userPushTokens)
    .where(inArray(userPushTokens.userId, pmIds));

  const label = inbox.length === 1 ? "1 new idea" : `${inbox.length} new ideas`;
  await Promise.all(
    tokens.map((t) =>
      sendExpoPushNotification(t.pushToken, "💡 New Ideas", `${label} waiting in your inbox.`, {
        type: "ideas_inbox",
        teamId,
        count: inbox.length,
      })
    )
  );
}

// ─── Send to Conference Room ──────────────────────────────────────────────────

/**
 * PM sends a processed idea to the Conference Room as an approval item.
 * All team members get a push notification.
 */
export async function sendIdeaToConference(
  processedIdeaId: number,
  pmUserId: number,
  pmNotes: string
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [idea] = await db
    .select()
    .from(processedIdeas)
    .where(eq(processedIdeas.id, processedIdeaId))
    .limit(1);

  if (!idea) throw new Error("Processed idea not found");

  // Create an approval in the Conference Room
  const approval = await createApproval(
    {
      entityType: "project",
      entityId: processedIdeaId,
      teamId: idea.teamId!,
      fromStage: "idea",
      toStage: "project",
      comments: `${idea.refinedDescription}\n\nPM Notes: ${pmNotes}`,
      deliverables: [
        {
          title: idea.title,
          description: idea.summary,
          category: idea.category,
          priority: idea.priority,
          impact: idea.estimatedImpact,
          nextSteps: idea.suggestedNextSteps,
        },
      ],
    },
    pmUserId
  );

  // Mark idea as sent to conference
  await db
    .update(processedIdeas)
    .set({
      status: "sent_to_conference",
      pmNotes,
      sentToConferenceAt: new Date(),
      approvalId: approval.id,
    })
    .where(eq(processedIdeas.id, processedIdeaId));

  // Push notification to all team members
  const teamMembers_ = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(eq(teamMembers.teamId as any, idea.teamId!));

  const memberIds = teamMembers_.map((m) => m.id);
  if (memberIds.length > 0) {
    const tokens = await db
      .select({ pushToken: userPushTokens.pushToken })
      .from(userPushTokens)
      .where(inArray(userPushTokens.userId, memberIds));

    await Promise.all(
      tokens.map((t) =>
        sendExpoPushNotification(
          t.pushToken,
          "🏛️ Conference Room",
          `New idea for deliberation: "${idea.title}"`,
          { type: "conference_idea", approvalId: approval.id, ideaTitle: idea.title }
        )
      )
    );
  }

  return approval.id;
}

// ─── Push notifications for task events ──────────────────────────────────────

/**
 * Send a push notification to a specific team member about a task event.
 */
export async function notifyMemberAboutTask(
  userId: number,
  eventType: "task_assigned" | "task_updated" | "task_completed" | "task_deadline",
  taskTitle: string,
  taskId: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const tokens = await db
    .select({ pushToken: userPushTokens.pushToken })
    .from(userPushTokens)
    .where(eq(userPushTokens.userId, userId));

  const messages: Record<string, { title: string; body: string }> = {
    task_assigned:  { title: "📋 Task Assigned",   body: `You have been assigned: "${taskTitle}"` },
    task_updated:   { title: "✏️ Task Updated",    body: `"${taskTitle}" was updated` },
    task_completed: { title: "✅ Task Completed",   body: `"${taskTitle}" marked as done` },
    task_deadline:  { title: "⏰ Deadline Soon",    body: `"${taskTitle}" is due soon` },
  };

  const { title, body } = messages[eventType];

  await Promise.all(
    tokens.map((t) =>
      sendExpoPushNotification(t.pushToken, title, body, { type: eventType, taskId })
    )
  );
}

export { sendExpoPushNotification };
