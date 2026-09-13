ALTER TABLE `quest` ADD `cadence` text DEFAULT 'daily' NOT NULL;--> statement-breakpoint
ALTER TABLE `quest` ADD `completion_ratio` real DEFAULT 1 NOT NULL;