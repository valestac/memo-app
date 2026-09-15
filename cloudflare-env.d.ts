declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_BOT_USERNAME?: string;
    TELEGRAM_WEBHOOK_SECRET?: string;
    QSTASH_TOKEN?: string;
    MEMO_DELIVERY_SECRET?: string;
    MEMO_BASE_URL?: string;
    OAI_SITES_BYPASS_TOKEN?: string;
    CHATGPT_INTEGRATION_SECRET?: string;
    CHATGPT_OWNER_ID?: string;
  }
}
