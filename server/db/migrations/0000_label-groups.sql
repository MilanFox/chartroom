CREATE TABLE `label_group_members` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`display_label` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `label_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `label_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`position` integer NOT NULL,
	`seeded` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
INSERT INTO `label_groups` (`id`, `display_name`, `position`, `seeded`) VALUES
	('triage-category', 'triage-category', 0, true),
	('triage-state', 'triage-state', 1, true),
	('wayfinder-type', 'wayfinder-type', 2, true);
--> statement-breakpoint
INSERT INTO `label_group_members` (`id`, `group_id`, `display_label`, `position`) VALUES
	('bug', 'triage-category', 'bug', 0),
	('enhancement', 'triage-category', 'enhancement', 1),
	('needs-triage', 'triage-state', 'needs-triage', 0),
	('needs-info', 'triage-state', 'needs-info', 1),
	('ready-for-agent', 'triage-state', 'ready-for-agent', 2),
	('ready-for-human', 'triage-state', 'ready-for-human', 3),
	('wontfix', 'triage-state', 'wontfix', 4),
	('wayfinder:research', 'wayfinder-type', 'wayfinder:research', 0),
	('wayfinder:prototype', 'wayfinder-type', 'wayfinder:prototype', 1),
	('wayfinder:grilling', 'wayfinder-type', 'wayfinder:grilling', 2),
	('wayfinder:task', 'wayfinder-type', 'wayfinder:task', 3);
