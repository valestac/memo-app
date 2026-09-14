CREATE TABLE `telegram_bot_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`next_update_id` integer DEFAULT 0 NOT NULL,
	`poll_schedule_id` text,
	`updated_at` text NOT NULL
);
