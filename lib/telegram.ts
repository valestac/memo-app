import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { telegramBotState } from "../db/schema";

type TelegramButton = { text: string; callback_data?: string; url?: string };

export function telegramStatus() {
  return {
    configured: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BOT_USERNAME && env.TELEGRAM_WEBHOOK_SECRET),
    deliveryConfigured: Boolean(env.QSTASH_TOKEN && env.MEMO_DELIVERY_SECRET && env.MEMO_BASE_URL && env.OAI_SITES_BYPASS_TOKEN),
    username: env.TELEGRAM_BOT_USERNAME ?? null,
  };
}

export async function ensureTelegramPollingSchedule() {
  if (!env.QSTASH_TOKEN || !env.MEMO_DELIVERY_SECRET || !env.MEMO_BASE_URL || !env.OAI_SITES_BYPASS_TOKEN) return false;
  const db = getDb();
  const now = new Date().toISOString();
  await db.insert(telegramBotState).values({ id: 1, updatedAt: now }).onConflictDoNothing();
  const [state] = await db.select().from(telegramBotState).where(eq(telegramBotState.id, 1)).limit(1);
  const scheduleId = "memo-telegram-poll-v2";
  if (state?.pollScheduleId === scheduleId) return true;

  const destination = `${env.MEMO_BASE_URL}/api/telegram/poll`;
  const response = await fetch(`https://qstash.upstash.io/v2/schedules/${destination}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.QSTASH_TOKEN}`,
      "Content-Type": "application/json",
      "Upstash-Cron": "*/2 * * * *",
      "Upstash-Schedule-Id": scheduleId,
      "Upstash-Timeout": "110s",
      "Upstash-Forward-X-Memo-Secret": env.MEMO_DELIVERY_SECRET,
      "Upstash-Forward-OAI-Sites-Authorization": `Bearer ${env.OAI_SITES_BYPASS_TOKEN}`,
    },
    body: JSON.stringify({ source: "memo-telegram-poller" }),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("QStash schedule setup failed", { status: response.status, detail });
    return false;
  }
  const result = await response.json() as { scheduleId?: string };
  if (!result.scheduleId) {
    console.error("QStash schedule setup returned no schedule id", { result });
    return false;
  }
  await db.update(telegramBotState).set({ pollScheduleId: result.scheduleId, updatedAt: now }).where(eq(telegramBotState.id, 1));
  if (state?.pollScheduleId && state.pollScheduleId !== result.scheduleId) {
    await fetch(`https://qstash.upstash.io/v2/schedules/${state.pollScheduleId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${env.QSTASH_TOKEN}` },
    });
  }
  return true;
}

export async function sendTelegram(chatId: string, text: string, buttons?: TelegramButton[][]) {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("Telegram is not configured");
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, reply_markup: buttons ? { inline_keyboard: buttons } : undefined }),
  });
  if (!response.ok) throw new Error("Telegram could not send the message");
}

export async function answerTelegramCallback(callbackQueryId: string, text: string) {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

export function reminderButtons(id: number): TelegramButton[][] {
  const base = env.MEMO_BASE_URL ?? "https://memo-valerio.valestac.chatgpt.site";
  return [[
    { text: "Done", callback_data: `done:${id}` },
    { text: "Snooze 10m", callback_data: `snooze10:${id}` },
    { text: "Edit", url: base },
  ]];
}

export async function scheduleTelegramDelivery(id: number, dueAt: string) {
  if (!env.QSTASH_TOKEN || !env.MEMO_DELIVERY_SECRET || !env.MEMO_BASE_URL || !env.OAI_SITES_BYPASS_TOKEN) return false;
  const destination = `${env.MEMO_BASE_URL}/api/telegram/deliver`;
  const response = await fetch(`https://qstash.upstash.io/v2/publish/${destination}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.QSTASH_TOKEN}`,
      "Content-Type": "application/json",
      "Upstash-Not-Before": String(Math.floor(new Date(dueAt).getTime() / 1000)),
      "Upstash-Forward-X-Memo-Secret": env.MEMO_DELIVERY_SECRET,
      "Upstash-Forward-OAI-Sites-Authorization": `Bearer ${env.OAI_SITES_BYPASS_TOKEN}`,
    },
    body: JSON.stringify({ id, dueAt }),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("QStash Telegram delivery setup failed", { status: response.status, detail, reminderId: id });
  }
  return response.ok;
}
