CREATE TABLE `reminders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`request` text NOT NULL,
	`title` text NOT NULL,
	`due_at` text NOT NULL,
	`timezone` text NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_reminders_owner_due` ON `reminders` (`owner_id`,`due_at`);
--> statement-breakpoint
PRAGMA optimize;
