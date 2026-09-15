import { and, asc, desc, eq, gte, lt, or } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "../../../db";
import { reminders } from "../../../db/schema";
import { createReminder } from "@/lib/reminders";
import { scheduleTelegramDelivery } from "@/lib/telegram";

async function ownerId() {
  return (await headers()).get("oai-authenticated-user-id");
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table")) return "Reminder storage is not ready yet.";
  return "Memo could not save this reminder. Please try again.";
}

export async function GET(request: Request) {
  const owner = await ownerId();
  if (!owner) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const view = new URL(request.url).searchParams.get("view") ?? "upcoming";
    const now = new Date().toISOString();
    const rows = view === "history"
      ? await getDb().select().from(reminders)
          .where(and(eq(reminders.ownerId, owner), or(eq(reminders.status, "done"), lt(reminders.dueAt, now))))
          .orderBy(desc(reminders.dueAt)).limit(100)
      : await getDb().select().from(reminders)
          .where(and(eq(reminders.ownerId, owner), eq(reminders.status, "scheduled"), gte(reminders.dueAt, now)))
          .orderBy(asc(reminders.dueAt)).limit(50);
    return Response.json({ reminders: rows });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const owner = await ownerId();
  if (!owner) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const body = (await request.json()) as {
      request?: string; title?: string; dueAt?: string; timezone?: string;
      notes?: string; link?: string; emailNotify?: boolean; phoneNotify?: boolean;
    };
    const created = await createReminder(owner, {
      request: body.request ?? "",
      title: body.title ?? "",
      dueAt: body.dueAt ?? "",
      timezone: body.timezone ?? "",
      notes: body.notes,
      link: body.link,
      emailNotify: body.emailNotify,
      phoneNotify: body.phoneNotify,
    });
    return Response.json({ reminder: created }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const owner = await ownerId();
  if (!owner) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const body = (await request.json()) as {
      id?: number; status?: "done" | "scheduled"; title?: string; dueAt?: string;
      timezone?: string; notes?: string; link?: string; emailNotify?: boolean; phoneNotify?: boolean;
    };
    if (!Number.isInteger(body.id)) {
      return Response.json({ error: "Invalid update." }, { status: 400 });
    }
    const updates = body.status === "done"
      ? { status: "done" as const, completedAt: new Date().toISOString() }
      : {
          title: body.title?.trim(), dueAt: body.dueAt, timezone: body.timezone?.trim(),
          notes: body.notes?.trim() ?? "", link: body.link?.trim() ?? "",
          emailNotify: Boolean(body.emailNotify), phoneNotify: Boolean(body.phoneNotify),
        };
    if (body.status !== "done" && (!updates.title || !updates.dueAt || Number.isNaN(Date.parse(updates.dueAt)))) {
      return Response.json({ error: "A title and valid time are required." }, { status: 400 });
    }
    const [updated] = await getDb().update(reminders).set(updates)
      .where(and(eq(reminders.id, body.id!), eq(reminders.ownerId, owner))).returning();
    if (updated?.status === "scheduled" && updated.phoneNotify) {
      const scheduled = await scheduleTelegramDelivery(updated.id, updated.dueAt);
      if (!scheduled) return Response.json({ error: "The reminder was updated, but its Telegram notification could not be scheduled." }, { status: 502 });
    }
    return Response.json({ ok: true, reminder: updated });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
