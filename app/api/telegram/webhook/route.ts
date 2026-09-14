import { env } from "cloudflare:workers";
import { processTelegramUpdate, type TelegramUpdate } from "@/lib/telegram-updates";

export async function POST(request: Request) {
  if (!env.TELEGRAM_WEBHOOK_SECRET || request.headers.get("x-telegram-bot-api-secret-token") !== env.TELEGRAM_WEBHOOK_SECRET) return new Response("Unauthorized", { status: 401 });
  const update = await request.json() as TelegramUpdate;
  await processTelegramUpdate(update);
  return Response.json({ ok: true });
}
