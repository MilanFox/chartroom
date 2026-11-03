CREATE TABLE `comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`issue` integer NOT NULL,
	`author` text NOT NULL,
	`body` text NOT NULL,
	`origin` text NOT NULL,
	`resolution` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`issue`) REFERENCES `issues`(`number`) ON UPDATE no action ON DELETE cascade
);
