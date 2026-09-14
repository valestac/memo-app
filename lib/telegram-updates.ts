import { and, eq, or } from "drizzle-orm";
import { getDb } from "../db";
import { reminders, telegramConnections, telegramLinkCodes } from "../db/schema";
import { formatInTimezone, parseReminderInTimezone } from "./timezone";
import { answerTelegramCallback, reminderButtons, scheduleTelegramDelivery, sendTelegram } from "./telegram";

export type TelegramUpdate = {
  update_id: number;
  message?: { text?: string; chat: { id: number }; from?: { username?: string } };
  callback_query?: { id: string; data?: string; message?: { chat: { id: number } } };
};

export async function processTelegramUpdate(update: TelegramUpdate) {
  const db = getDb();
  if (update.callback_query?.message && update.callback_query.data) {
    const chatId = String(update.callback_query.message.chat.id);
    const [connection] = await db.select().from(telegramConnections).where(eq(telegramConnections.chatId, chatId)).limit(1);
    if (!connection) return;
    const [action, rawId] = update.callback_query.data.split(":");
    const id = Number(rawId);
    const [reminder] = await db.select().from(reminders).where(and(eq(reminders.id, id), eq(reminders.ownerId, connection.ownerId))).limit(1);
    if (!reminder) { await answerTelegramCallback(update.callback_query.id, "Reminder not found"); return; }
    if (action === "done") {
      await db.update(reminders).set({ status: "done", completedAt: new Date().toISOString() }).where(eq(reminders.id, id));
      await answerTelegramCallback(update.callback_query.id, "Completed");
    } else if (action === "snooze10") {
      const dueAt = new Date(Date.now() + 10 * 60_000).toISOString();
      await db.update(reminders).set({ dueAt, status: "scheduled", completedAt: null }).where(eq(reminders.id, id));
      await scheduleTelegramDelivery(id, dueAt);
      await answerTelegramCallback(update.callback_query.id, "Snoozed for 10 minutes");
    }
    return;
  }

  const message = update.message;
  if (!message?.text) return;
  const chatId = String(message.chat.id);
  const start = message.text.match(/^\/start\s+([A-Za-z0-9]+)/);
  if (start) {
    const [link] = await db.select().from(telegramLinkCodes).where(eq(telegramLinkCodes.code, start[1])).limit(1);
    if (!link || link.expiresAt < new Date().toISOString()) { await sendTelegram(chatId, "This connection link expired. Create a new one in Memo."); return; }
    await db.delete(telegramConnections).where(or(eq(telegramConnections.ownerId, link.ownerId), eq(telegramConnections.chatId, chatId)));
    await db.insert(telegramConnections).values({ ownerId: link.ownerId, chatId, username: message.from?.username ?? "", timezone: link.timezone, connectedAt: new Date().toISOString() });
    await db.delete(telegramLinkCodes).where(eq(telegramLinkCodes.ownerId, link.ownerId));
    await sendTelegram(chatId, "Connected. Text me a task and time, for example:\n\nRemind me to call Anna tomorrow at 18");
    return;
  }

  const [connection] = await db.select().from(telegramConnections).where(eq(telegramConnections.chatId, chatId)).limit(1);
  if (!connection) { await sendTelegram(chatId, "Connect this chat from the Channels page in Memo first."); return; }
  const parsed = parseReminderInTimezone(message.text, connection.timezone);
  if (!parsed) { await sendTelegram(chatId, "I’m missing a task or time. Try “call Anna tomorrow at 18” or “check the oven in 45 mins”."); return; }
  const dueAt = parsed.dueAt.toISOString();
  const [created] = await db.insert(reminders).values({ ownerId: connection.ownerId, request: message.text, title: parsed.title, dueAt, timezone: connection.timezone, phoneNotify: true, createdAt: new Date().toISOString() }).returning();
  const scheduled = await scheduleTelegramDelivery(created.id, created.dueAt);
  if (!scheduled) {
    await db.delete(reminders).where(eq(reminders.id, created.id));
    await sendTelegram(chatId, "I couldn't schedule that reminder. It was not saved. Please try again.");
    return;
  }
  await sendTelegram(chatId, `Got it\n\n${created.title}\n${formatInTimezone(created.dueAt, connection.timezone)}`, reminderButtons(created.id));
}
