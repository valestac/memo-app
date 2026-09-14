ALTER TABLE `reminders` ADD `notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `reminders` ADD `link` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `reminders` ADD `email_notify` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `reminders` ADD `phone_notify` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `reminders` ADD `completed_at` text;