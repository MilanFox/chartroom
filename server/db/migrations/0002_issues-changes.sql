CREATE TABLE `changes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`issue` integer NOT NULL,
	`actor` text NOT NULL,
	`origin` text NOT NULL,
	`at` text NOT NULL,
	`field` text NOT NULL,
	`before` text,
	`after` text,
	FOREIGN KEY (`issue`) REFERENCES `issues`(`number`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `issues` (
	`number` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`assignee` text,
	`parent` integer,
	`name` text,
	`test_instructions` text,
	`created_by` text NOT NULL,
	`origin` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`closed_at` text,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `issues_name_unique` ON `issues` (`name`);