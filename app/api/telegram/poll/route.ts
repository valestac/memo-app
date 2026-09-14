import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { telegramBotState } from "../../../../db/schema";
import { processTelegramUpdate, type TelegramUpdate } from "@/lib/telegram-updates";
import { ensureTelegramPollingSchedule } from "@/lib/telegram";

export async function POST(request: Request) {
  if (!env.MEMO_DELIVERY_SECRET || request.headers.get("x-memo-secret") !== env.MEMO_DELIVERY_SECRET) return new Response("Unauthorized", { status: 401 });
  if (!env.TELEGRAM_BOT_TOKEN) return new Response("Telegram is not configured", { status: 503 });
  await ensureTelegramPollingSchedule();
  const db = getDb();
  const now = new Date().toISOString();
  await db.insert(telegramBotState).values({ id: 1, updatedAt: now }).onConflictDoNothing();
  const [state] = await db.select().from(telegramBotState).where(eq(telegramBotState.id, 1)).limit(1);
  const url = new URL(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getUpdates`);
  url.searchParams.set("offset", String(state?.nextUpdateId ?? 0));
  url.searchParams.set("limit", "100");
  url.searchParams.set("timeout", "90");
  url.searchParams.set("allowed_updates", JSON.stringify(["message", "callback_query"]));
  const response = await fetch(url);
  const result = await response.json() as { ok: boolean; result?: TelegramUpdate[]; description?: string };
  if (!response.ok || !result.ok) return Response.json({ error: result.description ?? "Telegram polling failed" }, { status: 502 });

  let nextUpdateId = state?.nextUpdateId ?? 0;
  for (const update of result.result ?? []) {
    await processTelegramUpdate(update);
    nextUpdateId = update.update_id + 1;
    await db.update(telegramBotState).set({ nextUpdateId, updatedAt: new Date().toISOString() }).where(eq(telegramBotState.id, 1));
  }
  return Response.json({ ok: true, processed: result.result?.length ?? 0, nextUpdateId });
}
