export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  // Telegram Idea Bot
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? "team-manager-secret",
  // Cron schedule for batching ideas to PM (default = every hour)
  ideaCronSchedule: process.env.IDEA_CRON_SCHEDULE ?? "0 * * * *",
  // Default team ID for Telegram ideas (users override with /register)
  defaultTeamId: parseInt(process.env.DEFAULT_TEAM_ID ?? "0", 10),
  // Public base URL for Telegram webhook registration
  serverBaseUrl: process.env.SERVER_BASE_URL ?? "https://team-management-system-zq6x.onrender.com",
};
