CREATE TABLE `research_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`issue` integer NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`origin` text NOT NULL,
	FOREIGN KEY (`issue`) REFERENCES `issues`(`number`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `research_notes_issue_slug_unique` ON `research_notes` (`issue`,`slug`);