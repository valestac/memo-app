# ChatGPT → Memo integration

Memo now exposes a dedicated authenticated reminder API that reuses the same D1 reminder records and QStash → Telegram delivery path as the web UI.

## Endpoint

`POST /api/integrations/chatgpt/reminders`

Authorization header:

`Authorization: Bearer <CHATGPT_INTEGRATION_SECRET>`

Example body:

```json
{
  "text": "Call Anna",
  "scheduledAt": "2026-09-16T18:00:00+02:00",
  "timezone": "Europe/Berlin",
  "telegram": true,
  "email": false
}
```

The endpoint also accepts an optional `title`, `notes`, and `link`. Telegram defaults to enabled.

`GET /api/integrations/chatgpt/reminders?limit=20` returns upcoming reminders for the configured Memo owner.

## Required hosted environment variables

- `CHATGPT_INTEGRATION_SECRET`: a new random secret used only by the ChatGPT integration. Do not reuse `QSTASH_TOKEN`, `TELEGRAM_BOT_TOKEN`, or `MEMO_DELIVERY_SECRET`.
- `CHATGPT_OWNER_ID`: optional. If omitted, Memo resolves the owner from the existing Telegram connection. Set it explicitly if the app ever has more than one owner.

The existing Telegram variables remain unchanged.

## ChatGPT tool contract

Expose the POST endpoint to ChatGPT as a tool named `create_reminder` with this logical input shape:

```ts
{
  text: string;
  scheduledAt: string; // ISO-8601 timestamp with timezone offset
  timezone?: string;   // default Europe/Berlin
  telegram?: boolean;  // default true
  email?: boolean;     // default false
}
```

ChatGPT should resolve natural-language dates before calling Memo. For example, "tomorrow at 18" in Europe/Berlin becomes a concrete ISO-8601 timestamp.

## Security

Never expose the Telegram bot token, QStash token, delivery secret, or Sites bypass token to the ChatGPT tool. Only the dedicated `CHATGPT_INTEGRATION_SECRET` belongs at this boundary.

## Current email status

The existing Memo database has an `emailNotify` flag, but this repository currently contains no email-delivery provider implementation. The integration therefore preserves the email preference but does not claim that email delivery is active. Telegram delivery is the working notification channel.

## Deployment checklist

1. Deploy the current `main` branch to the existing Memo Site.
2. Add `CHATGPT_INTEGRATION_SECRET` to the hosted environment.
3. Optionally add `CHATGPT_OWNER_ID`.
4. Test the endpoint with a future timestamp and confirm the reminder appears in Memo and is delivered through RemmeBot.
5. Register the endpoint through the ChatGPT custom integration/MCP surface available to the account.

The repository contains no actual integration secret. Secrets must remain in the hosting environment.
