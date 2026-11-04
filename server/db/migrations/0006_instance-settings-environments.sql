CREATE TABLE `credential_pointers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`account_name` text NOT NULL,
	`where_to_find` text NOT NULL,
	`environment` integer,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	FOREIGN KEY (`environment`) REFERENCES `environments`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `environments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`notes` text,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `instance_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_name` text NOT NULL,
	`effort_singular` text NOT NULL,
	`effort_plural` text,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
UPDATE `label_group_members` SET `display_label` = CASE `id`
	WHEN 'needs-triage' THEN 'Needs triage'
	WHEN 'needs-info' THEN 'Needs info'
	WHEN 'ready-for-agent' THEN 'Ready for agent'
	WHEN 'ready-for-human' THEN 'Ready for human'
	WHEN 'wontfix' THEN 'Won''t fix'
END WHERE `group_id` = 'triage-state';
