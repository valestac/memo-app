import { env } from "cloudflare:workers";
import { createReminder, listUpcomingReminders, resolveMemoOwnerId } from "@/lib/reminders";

function authorized(request: Request) {
  const secret = env.CHATGPT_INTEGRATION_SECRET;
  if (!secret) return false;
  const authorization = request.headers.get("authorization");
  return authorization === `Bearer ${secret}`;
}

async function ownerId() {
  return resolveMemoOwnerId(env.CHATGPT_OWNER_ID);
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const owner = await ownerId();
  if (!owner) return Response.json({ error: "Memo owner is not configured." }, { status: 503 });
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 20);
  const rows = await listUpcomingReminders(owner, Number.isFinite(limit) ? limit : 20);
  return Response.json({ reminders: rows });
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const owner = await ownerId();
  if (!owner) return Response.json({ error: "Memo owner is not configured." }, { status: 503 });

  try {
    const body = await request.json() as {
      text?: string;
      title?: string;
      scheduledAt?: string;
      timezone?: string;
      telegram?: boolean;
      email?: boolean;
      notes?: string;
      link?: string;
    };

    const title = (body.title ?? body.text ?? "").trim();
    const requestText = (body.text ?? body.title ?? "").trim();
    const dueAt = body.scheduledAt ?? "";
    const timezone = body.timezone?.trim() || "Europe/Berlin";

    const reminder = await createReminder(owner, {
      request: requestText,
      title,
      dueAt,
      timezone,
      notes: body.notes,
      link: body.link,
      emailNotify: Boolean(body.email),
      phoneNotify: body.telegram !== false,
    });

    return Response.json({
      ok: true,
      reminder: {
        id: reminder.id,
        text: reminder.title,
        scheduledAt: reminder.dueAt,
        timezone: reminder.timezone,
        telegram: reminder.phoneNotify,
        email: reminder.emailNotify,
      },
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Memo could not create this reminder.";
    const status = message.includes("required") || message.includes("future") ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
