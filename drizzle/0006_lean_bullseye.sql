ALTER TABLE `quest` ADD `unit` text DEFAULT 'count' NOT NULL;--> statement-breakpoint
ALTER TABLE `quest` ADD `title` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `quest` ADD `description` text DEFAULT '' NOT NULL;