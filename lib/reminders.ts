import { and, asc, eq, gte } from "drizzle-orm";
import { getDb } from "../db";
import { reminders, telegramConnections } from "../db/schema";
import { scheduleTelegramDelivery } from "./telegram";

export type CreateReminderInput = {
  request: string;
  title: string;
  dueAt: string;
  timezone: string;
  notes?: string;
  link?: string;
  emailNotify?: boolean;
  phoneNotify?: boolean;
};

export async function resolveMemoOwnerId(explicitOwnerId?: string | null) {
  const explicit = explicitOwnerId?.trim();
  if (explicit) return explicit;

  const [connection] = await getDb().select({ ownerId: telegramConnections.ownerId })
    .from(telegramConnections)
    .limit(1);

  return connection?.ownerId ?? null;
}

export async function createReminder(ownerId: string, input: CreateReminderInput) {
  const title = input.title.trim();
  const original = input.request.trim();
  const timezone = input.timezone.trim();
  const dueAt = input.dueAt;

  if (!ownerId || !title || !original || !timezone || Number.isNaN(Date.parse(dueAt))) {
    throw new Error("Reminder text and a valid time are required.");
  }

  if (new Date(dueAt).getTime() <= Date.now()) {
    throw new Error("Reminder time must be in the future.");
  }

  const [created] = await getDb().insert(reminders).values({
    ownerId,
    request: original,
    title,
    dueAt,
    timezone,
    notes: input.notes?.trim() ?? "",
    link: input.link?.trim() ?? "",
    emailNotify: Boolean(input.emailNotify),
    phoneNotify: Boolean(input.phoneNotify),
    createdAt: new Date().toISOString(),
  }).returning();

  if (created.phoneNotify) {
    const scheduled = await scheduleTelegramDelivery(created.id, created.dueAt);
    if (!scheduled) {
      await getDb().delete(reminders).where(and(eq(reminders.id, created.id), eq(reminders.ownerId, ownerId)));
      throw new Error("Telegram notification could not be scheduled. The reminder was not saved.");
    }
  }

  return created;
}

export async function listUpcomingReminders(ownerId: string, limit = 20) {
  const now = new Date().toISOString();
  return getDb().select().from(reminders)
    .where(and(eq(reminders.ownerId, ownerId), eq(reminders.status, "scheduled"), gte(reminders.dueAt, now)))
    .orderBy(asc(reminders.dueAt))
    .limit(Math.max(1, Math.min(limit, 50)));
}

export async function completeReminder(ownerId: string, id: number) {
  const [updated] = await getDb().update(reminders)
    .set({ status: "done", completedAt: new Date().toISOString() })
    .where(and(eq(reminders.id, id), eq(reminders.ownerId, ownerId)))
    .returning();

  return updated ?? null;
}
