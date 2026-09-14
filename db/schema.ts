import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const reminders = sqliteTable(
  "reminders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerId: text("owner_id").notNull(),
    request: text("request").notNull(),
    title: text("title").notNull(),
    dueAt: text("due_at").notNull(),
    timezone: text("timezone").notNull(),
    notes: text("notes").notNull().default(""),
    link: text("link").notNull().default(""),
    emailNotify: integer("email_notify", { mode: "boolean" }).notNull().default(false),
    phoneNotify: integer("phone_notify", { mode: "boolean" }).notNull().default(false),
    status: text("status", { enum: ["scheduled", "done"] }).notNull().default("scheduled"),
    createdAt: text("created_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [index("idx_reminders_owner_due").on(table.ownerId, table.dueAt)]
);

export const telegramConnections = sqliteTable(
  "telegram_connections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerId: text("owner_id").notNull().unique(),
    chatId: text("chat_id").notNull().unique(),
    username: text("username").notNull().default(""),
    timezone: text("timezone").notNull().default("Europe/Berlin"),
    connectedAt: text("connected_at").notNull(),
  }
);

export const telegramLinkCodes = sqliteTable(
  "telegram_link_codes",
  {
    ownerId: text("owner_id").primaryKey(),
    code: text("code").notNull().unique(),
    timezone: text("timezone").notNull(),
    expiresAt: text("expires_at").notNull(),
  }
);

export const telegramBotState = sqliteTable(
  "telegram_bot_state",
  {
    id: integer("id").primaryKey(),
    nextUpdateId: integer("next_update_id").notNull().default(0),
    pollScheduleId: text("poll_schedule_id"),
    updatedAt: text("updated_at").notNull(),
  }
);
