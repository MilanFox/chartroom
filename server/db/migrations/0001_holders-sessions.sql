CREATE TABLE `holder_secrets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`holder_slug` text NOT NULL,
	`hash` text NOT NULL,
	`created_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`holder_slug`) REFERENCES `holders`(`slug`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `holder_secrets_hash_unique` ON `holder_secrets` (`hash`);--> statement-breakpoint
CREATE TABLE `holders` (
	`slug` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`created_at` text NOT NULL,
	`revoked_at` text,
	`last_used_at` text,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`holder_slug` text,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`admin_until` text,
	FOREIGN KEY (`holder_slug`) REFERENCES `holders`(`slug`) ON UPDATE no action ON DELETE cascade
);
