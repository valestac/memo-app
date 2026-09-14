import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "../../../../db";
import { telegramConnections, telegramLinkCodes } from "../../../../db/schema";
import { ensureTelegramPollingSchedule, telegramStatus } from "@/lib/telegram";

async function ownerId() { return (await headers()).get("oai-authenticated-user-id"); }

export async function GET() {
  const owner = await ownerId();
  if (!owner) return Response.json({ error: "Sign in required" }, { status: 401 });
  const [connection] = await getDb().select().from(telegramConnections).where(eq(telegramConnections.ownerId, owner)).limit(1);
  return Response.json({ ...telegramStatus(), connected: Boolean(connection), connection: connection ? { username: connection.username, connectedAt: connection.connectedAt } : null });
}

export async function POST(request: Request) {
  const owner = await ownerId();
  if (!owner) return Response.json({ error: "Sign in required" }, { status: 401 });
  const status = telegramStatus();
  if (!status.configured || !status.username) return Response.json({ error: "Telegram activation is not finished yet." }, { status: 503 });
  if (!(await ensureTelegramPollingSchedule())) return Response.json({ error: "Telegram scheduling could not be started. Please try again." }, { status: 503 });
  const body = await request.json().catch(() => ({})) as { timezone?: string };
  const timezone = body.timezone || "Europe/Berlin";
  const code = crypto.randomUUID().replaceAll("-", "").slice(0, 20);
  await getDb().insert(telegramLinkCodes).values({ ownerId: owner, code, timezone, expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() })
    .onConflictDoUpdate({ target: telegramLinkCodes.ownerId, set: { code, timezone, expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() } });
  return Response.json({ url: `https://t.me/${status.username}?start=${code}` });
}

export async function DELETE() {
  const owner = await ownerId();
  if (!owner) return Response.json({ error: "Sign in required" }, { status: 401 });
  await getDb().delete(telegramConnections).where(eq(telegramConnections.ownerId, owner));
  return Response.json({ ok: true });
}
