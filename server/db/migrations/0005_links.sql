CREATE TABLE `links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`issue` integer NOT NULL,
	`role` text NOT NULL,
	`type` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`added_by` text NOT NULL,
	`origin` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`issue`) REFERENCES `issues`(`number`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `links_issue_url_unique` ON `links` (`issue`,`url`);