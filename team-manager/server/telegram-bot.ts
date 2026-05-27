/**
 * Telegram Bot Handler
 *
 * Receives webhook updates from Telegram. Each message is:
 *   1. Identified (which team member sent it)
 *   2. Stored as a raw_idea
 *   3. Immediately queued for LLM processing
 *   4. Acknowledged back to the sender
 *
 * Supported message types: text, photo, voice/audio, document
 *
 * Bot commands:
 *   /start   — welcome message
 *   /register <teamId> <whatsapp> — link Telegram to team + WhatsApp number
 *   /help    — usage guide
 */

import type { Request, Response, Express } from "express";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { telegramUsers, rawIdeas } from "../drizzle/schema";
import { processRawIdea } from "./idea-service";
import { ENV } from "./_core/env";

// ─── Telegram API helpers ─────────────────────────────────────────────────────

async function sendTelegramMessage(chatId: number | string, text: string): Promise<void> {
  if (!ENV.telegramBotToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${ENV.telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });
  } catch (err) {
    console.error("[TelegramBot] Failed to send message:", err);
  }
}

/**
 * Get the public download URL for a Telegram file.
 * We store this URL in rawIdeas.mediaUrl (Telegram URLs expire after 1 hour —
 * production should download and re-upload to S3 instead).
 */
async function getTelegramFileUrl(fileId: string): Promise<string | null> {
  if (!ENV.telegramBotToken) return null;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${ENV.telegramBotToken}/getFile?file_id=${fileId}`
    );
    const json = (await res.json()) as any;
    if (!json.ok) return null;
    return `https://api.telegram.org/file/bot${ENV.telegramBotToken}/${json.result.file_path}`;
  } catch {
    return null;
  }
}

// ─── User resolution ──────────────────────────────────────────────────────────

async function getOrCreateTelegramUser(
  telegramId: string,
  username: string | undefined,
  firstName: string | undefined
) {
  const db = await getDb();
  if (!db) return null;

  const [existing] = await db
    .select()
    .from(telegramUsers)
    .where(eq(telegramUsers.telegramId, telegramId))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(telegramUsers)
    .values({
      telegramId,
      telegramUsername: username,
      telegramFirstName: firstName,
      teamId: ENV.defaultTeamId || null,
      isRegistered: false,
    })
    .returning();

  return created;
}

// ─── Command handlers ─────────────────────────────────────────────────────────

async function handleStart(chatId: number, firstName: string) {
  await sendTelegramMessage(
    chatId,
    `👋 Welcome to *Team Manager Idea Bot*, ${firstName}!\n\n` +
    `Drop any idea here as *text*, *photo*, *voice message*, or *document* — I'll process it and send it to your project manager.\n\n` +
    `First, register yourself:\n` +
    `\`/register <teamId> <your WhatsApp number>\`\n` +
    `Example: \`/register 3 2348012345678\`\n\n` +
    `Your team ID is shown in the Team Manager web app under Settings.\n` +
    `Your WhatsApp number lets the PM reach you for more context.`
  );
}

async function handleRegister(chatId: number, telegramId: string, args: string[]) {
  const [teamIdStr, whatsapp] = args;
  const teamId = parseInt(teamIdStr, 10);

  if (!teamId || !whatsapp) {
    await sendTelegramMessage(
      chatId,
      "❌ Usage: `/register <teamId> <whatsappNumber>`\nExample: `/register 3 2348012345678`"
    );
    return;
  }

  const db = await getDb();
  if (!db) {
    await sendTelegramMessage(chatId, "⚠️ Service temporarily unavailable. Try again soon.");
    return;
  }

  await db
    .update(telegramUsers)
    .set({ teamId, whatsappNumber: whatsapp, isRegistered: true })
    .where(eq(telegramUsers.telegramId, telegramId));

  await sendTelegramMessage(
    chatId,
    `✅ You're registered!\n\n` +
    `*Team ID:* ${teamId}\n` +
    `*WhatsApp:* ${whatsapp}\n\n` +
    `Now just send your ideas anytime — text, voice note, photo, or document. 🚀`
  );
}

async function handleHelp(chatId: number) {
  await sendTelegramMessage(
    chatId,
    `*Team Manager Idea Bot — Help*\n\n` +
    `*Commands:*\n` +
    `• /start — Welcome message\n` +
    `• /register <teamId> <whatsapp> — Link your account\n` +
    `• /help — This message\n\n` +
    `*Submitting ideas:*\n` +
    `Just send any message!\n` +
    `• 💬 *Text* — type your idea directly\n` +
    `• 🖼️ *Photo* — screenshot, diagram, or image with caption\n` +
    `• 🎙️ *Voice note* — speak your idea freely\n` +
    `• 📄 *Document* — attach a file with context\n\n` +
    `Your idea will be refined by AI and delivered to your PM. 🧠`
  );
}

// ─── Idea capture ─────────────────────────────────────────────────────────────

async function captureIdea(
  tgUser: NonNullable<Awaited<ReturnType<typeof getOrCreateTelegramUser>>>,
  type: string,
  rawText: string | null,
  mediaUrl: string | null,
  chatId: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const [saved] = await db
    .insert(rawIdeas)
    .values({
      telegramUserId: tgUser.id,
      teamId: tgUser.teamId,
      type,
      rawText,
      mediaUrl,
      status: "pending",
    })
    .returning();

  // Acknowledge immediately
  const firstName = tgUser.telegramFirstName ?? "there";
  await sendTelegramMessage(
    chatId,
    `✅ Got it, ${firstName}! Your idea has been captured.\n\nOur AI is refining it now — your PM will review it shortly. 🚀`
  );

  // Kick off async processing (non-blocking)
  processRawIdea(saved.id).catch((err) =>
    console.error(`[TelegramBot] processRawIdea(${saved.id}) failed:`, err)
  );
}

// ─── Main webhook handler ─────────────────────────────────────────────────────

export async function handleTelegramWebhook(req: Request, res: Response): Promise<void> {
  // Respond immediately so Telegram doesn't retry
  res.status(200).json({ ok: true });

  const update = req.body as any;
  const message = update.message || update.edited_message;
  if (!message) return;

  const chatId: number = message.chat.id;
  const from = message.from ?? {};
  const telegramId = String(from.id);
  const firstName: string = from.first_name ?? "User";
  const username: string | undefined = from.username;

  const tgUser = await getOrCreateTelegramUser(telegramId, username, firstName);
  if (!tgUser) return;

  // ── Commands ──────────────────────────────────────────────────────────────
  const text: string = message.text ?? message.caption ?? "";

  if (text.startsWith("/start")) {
    await handleStart(chatId, firstName);
    return;
  }

  if (text.startsWith("/help")) {
    await handleHelp(chatId);
    return;
  }

  if (text.startsWith("/register")) {
    const args = text.split(" ").slice(1);
    await handleRegister(chatId, telegramId, args);
    return;
  }

  // ── Registration check ────────────────────────────────────────────────────
  if (!tgUser.isRegistered) {
    await sendTelegramMessage(
      chatId,
      `👋 Hi ${firstName}! Please register first:\n\n\`/register <teamId> <whatsappNumber>\`\n\nGet your team ID from the Team Manager web app.`
    );
    return;
  }

  // ── Idea capture ──────────────────────────────────────────────────────────

  // Text message
  if (message.text && !message.text.startsWith("/")) {
    await captureIdea(tgUser, "text", message.text, null, chatId);
    return;
  }

  // Photo (with optional caption)
  if (message.photo) {
    const largest = message.photo[message.photo.length - 1];
    const mediaUrl = await getTelegramFileUrl(largest.file_id);
    await captureIdea(tgUser, "image", message.caption ?? null, mediaUrl, chatId);
    return;
  }

  // Voice note / audio
  const audioObj = message.voice ?? message.audio;
  if (audioObj) {
    const mediaUrl = await getTelegramFileUrl(audioObj.file_id);
    await captureIdea(tgUser, "audio", message.caption ?? null, mediaUrl, chatId);
    return;
  }

  // Document / file
  if (message.document) {
    const mediaUrl = await getTelegramFileUrl(message.document.file_id);
    await captureIdea(
      tgUser,
      "document",
      message.caption ?? message.document.file_name ?? null,
      mediaUrl,
      chatId
    );
    return;
  }
}

// ─── Webhook registration ─────────────────────────────────────────────────────

/**
 * Register our webhook URL with Telegram on server start.
 * Safe to call on every startup — Telegram ignores duplicate registrations.
 */
export async function registerTelegramWebhook(): Promise<void> {
  if (!ENV.telegramBotToken) {
    console.log("[TelegramBot] TELEGRAM_BOT_TOKEN not set — bot disabled.");
    return;
  }

  const webhookUrl = `${ENV.serverBaseUrl}/api/telegram/webhook`;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${ENV.telegramBotToken}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: ENV.telegramWebhookSecret,
          allowed_updates: ["message", "edited_message"],
        }),
      }
    );
    const json = await res.json() as any;
    if (json.ok) {
      console.log(`[TelegramBot] Webhook registered: ${webhookUrl}`);
    } else {
      console.warn("[TelegramBot] Webhook registration failed:", json);
    }
  } catch (err) {
    console.error("[TelegramBot] Could not register webhook:", err);
  }
}

// ─── Express route registration ───────────────────────────────────────────────

export function registerTelegramRoutes(app: Express): void {
  app.post(
    "/api/telegram/webhook",
    (req: Request, res: Response) => {
      // Verify secret header (Telegram sends X-Telegram-Bot-Api-Secret-Token)
      const secret = req.headers["x-telegram-bot-api-secret-token"];
      if (ENV.telegramWebhookSecret && secret !== ENV.telegramWebhookSecret) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      handleTelegramWebhook(req, res).catch((err) => {
        console.error("[TelegramBot] Webhook handler error:", err);
      });
    }
  );
}
