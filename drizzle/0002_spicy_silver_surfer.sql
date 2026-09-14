CREATE TABLE `telegram_connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`chat_id` text NOT NULL,
	`username` text DEFAULT '' NOT NULL,
	`timezone` text DEFAULT 'Europe/Berlin' NOT NULL,
	`connected_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `telegram_connections_owner_id_unique` ON `telegram_connections` (`owner_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `telegram_connections_chat_id_unique` ON `telegram_connections` (`chat_id`);--> statement-breakpoint
CREATE TABLE `telegram_link_codes` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`timezone` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `telegram_link_codes_code_unique` ON `telegram_link_codes` (`code`);