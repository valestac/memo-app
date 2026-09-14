import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../db";
import { reminders, telegramConnections } from "../../../../db/schema";
import { formatInTimezone } from "@/lib/timezone";
import { reminderButtons, sendTelegram } from "@/lib/telegram";

export async function POST(request: Request) {
  if (!env.MEMO_DELIVERY_SECRET || request.headers.get("x-memo-secret") !== env.MEMO_DELIVERY_SECRET) return new Response("Unauthorized", { status: 401 });
  const body = await request.json() as { id?: number; dueAt?: string };
  if (!Number.isInteger(body.id) || !body.dueAt) return new Response("Bad request", { status: 400 });
  const [reminder] = await getDb().select().from(reminders).where(and(eq(reminders.id, body.id!), eq(reminders.status, "scheduled"))).limit(1);
  if (!reminder || reminder.dueAt !== body.dueAt || !reminder.phoneNotify) return Response.json({ skipped: true });
  const [connection] = await getDb().select().from(telegramConnections).where(eq(telegramConnections.ownerId, reminder.ownerId)).limit(1);
  if (!connection) return Response.json({ skipped: true });
  await sendTelegram(connection.chatId, `Reminder\n\n${reminder.title}\n${formatInTimezone(reminder.dueAt, connection.timezone)}`, reminderButtons(reminder.id));
  return Response.json({ delivered: true });
}
