CREATE TABLE `issue_blockers` (
	`issue` integer NOT NULL,
	`blocker` integer NOT NULL,
	PRIMARY KEY(`issue`, `blocker`),
	FOREIGN KEY (`issue`) REFERENCES `issues`(`number`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`blocker`) REFERENCES `issues`(`number`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `issue_labels` (
	`issue` integer NOT NULL,
	`label` text NOT NULL,
	PRIMARY KEY(`issue`, `label`),
	FOREIGN KEY (`issue`) REFERENCES `issues`(`number`) ON UPDATE no action ON DELETE cascade
);
