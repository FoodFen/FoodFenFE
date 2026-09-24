PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_activity_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`activity_type` text NOT NULL,
	`calories_burned` integer NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`logged_at` integer NOT NULL,
	`logged_on` text NOT NULL,
	`remote_id` text,
	`updated_at` integer NOT NULL,
	`synced_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_activity_log`("id", "user_id", "activity_type", "calories_burned", "source", "logged_at", "logged_on", "remote_id", "updated_at", "synced_at", "deleted_at") SELECT "id", "user_id", "activity_type", "calories_burned", "source", "logged_at", "logged_on", "remote_id", "updated_at", "synced_at", "deleted_at" FROM `activity_log`;--> statement-breakpoint
DROP TABLE `activity_log`;--> statement-breakpoint
ALTER TABLE `__new_activity_log` RENAME TO `activity_log`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `activity_log_user_day_idx` ON `activity_log` (`user_id`,`logged_on`);--> statement-breakpoint
CREATE TABLE `__new_coin_transaction` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	`remote_id` text,
	`updated_at` integer NOT NULL,
	`synced_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_coin_transaction`("id", "user_id", "amount", "reason", "created_at", "remote_id", "updated_at", "synced_at", "deleted_at") SELECT "id", "user_id", "amount", "reason", "created_at", "remote_id", "updated_at", "synced_at", "deleted_at" FROM `coin_transaction`;--> statement-breakpoint
DROP TABLE `coin_transaction`;--> statement-breakpoint
ALTER TABLE `__new_coin_transaction` RENAME TO `coin_transaction`;--> statement-breakpoint
CREATE INDEX `coin_transaction_user_idx` ON `coin_transaction` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_daily_goal` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`target_kcal` integer NOT NULL,
	`target_carbs_g` real NOT NULL,
	`target_protein_g` real NOT NULL,
	`target_fat_g` real NOT NULL,
	`target_water_ml` integer DEFAULT 2000 NOT NULL,
	`effective_date` text NOT NULL,
	`remote_id` text,
	`updated_at` integer NOT NULL,
	`synced_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_daily_goal`("id", "user_id", "target_kcal", "target_carbs_g", "target_protein_g", "target_fat_g", "target_water_ml", "effective_date", "remote_id", "updated_at", "synced_at", "deleted_at") SELECT "id", "user_id", "target_kcal", "target_carbs_g", "target_protein_g", "target_fat_g", "target_water_ml", "effective_date", "remote_id", "updated_at", "synced_at", "deleted_at" FROM `daily_goal`;--> statement-breakpoint
DROP TABLE `daily_goal`;--> statement-breakpoint
ALTER TABLE `__new_daily_goal` RENAME TO `daily_goal`;--> statement-breakpoint
CREATE INDEX `daily_goal_user_date_idx` ON `daily_goal` (`user_id`,`effective_date`);--> statement-breakpoint
CREATE TABLE `__new_food_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`emoji` text,
	`input_method` text NOT NULL,
	`image_url` text,
	`total_kcal` integer DEFAULT 0 NOT NULL,
	`carbs_g` real DEFAULT 0 NOT NULL,
	`protein_g` real DEFAULT 0 NOT NULL,
	`fat_g` real DEFAULT 0 NOT NULL,
	`fiber_g` real,
	`amount` real,
	`amount_unit` text,
	`ai_feedback` text,
	`meal_type` text NOT NULL,
	`logged_at` integer NOT NULL,
	`logged_on` text NOT NULL,
	`remote_id` text,
	`updated_at` integer NOT NULL,
	`synced_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_food_entry`("id", "user_id", "name", "emoji", "input_method", "image_url", "total_kcal", "carbs_g", "protein_g", "fat_g", "fiber_g", "amount", "amount_unit", "ai_feedback", "meal_type", "logged_at", "logged_on", "remote_id", "updated_at", "synced_at", "deleted_at") SELECT "id", "user_id", "name", "emoji", "input_method", "image_url", "total_kcal", "carbs_g", "protein_g", "fat_g", "fiber_g", "amount", "amount_unit", "ai_feedback", "meal_type", "logged_at", "logged_on", "remote_id", "updated_at", "synced_at", "deleted_at" FROM `food_entry`;--> statement-breakpoint
DROP TABLE `food_entry`;--> statement-breakpoint
ALTER TABLE `__new_food_entry` RENAME TO `food_entry`;--> statement-breakpoint
CREATE INDEX `food_entry_user_day_idx` ON `food_entry` (`user_id`,`logged_on`);--> statement-breakpoint
CREATE TABLE `__new_ingredient` (
	`id` text PRIMARY KEY NOT NULL,
	`food_entry_id` text NOT NULL,
	`name` text NOT NULL,
	`quantity_g` real NOT NULL,
	`kcal` integer NOT NULL,
	`carbs_g` real DEFAULT 0 NOT NULL,
	`protein_g` real DEFAULT 0 NOT NULL,
	`fat_g` real DEFAULT 0 NOT NULL,
	`fiber_g` real,
	`catalog_food_id` text,
	`remote_id` text,
	`updated_at` integer NOT NULL,
	`synced_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`food_entry_id`) REFERENCES `food_entry`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_ingredient`("id", "food_entry_id", "name", "quantity_g", "kcal", "carbs_g", "protein_g", "fat_g", "fiber_g", "catalog_food_id", "remote_id", "updated_at", "synced_at", "deleted_at") SELECT "id", "food_entry_id", "name", "quantity_g", "kcal", "carbs_g", "protein_g", "fat_g", "fiber_g", "catalog_food_id", "remote_id", "updated_at", "synced_at", "deleted_at" FROM `ingredient`;--> statement-breakpoint
DROP TABLE `ingredient`;--> statement-breakpoint
ALTER TABLE `__new_ingredient` RENAME TO `ingredient`;--> statement-breakpoint
CREATE INDEX `ingredient_entry_idx` ON `ingredient` (`food_entry_id`);--> statement-breakpoint
CREATE TABLE `__new_quest` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`quest_type` text NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`target` integer NOT NULL,
	`reward_coins` integer NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`cadence` text DEFAULT 'daily' NOT NULL,
	`completion_ratio` real DEFAULT 1 NOT NULL,
	`quest_date` text NOT NULL,
	`remote_id` text,
	`updated_at` integer NOT NULL,
	`synced_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_quest`("id", "user_id", "quest_type", "progress", "target", "reward_coins", "completed", "cadence", "completion_ratio", "quest_date", "remote_id", "updated_at", "synced_at", "deleted_at") SELECT "id", "user_id", "quest_type", "progress", "target", "reward_coins", "completed", "cadence", "completion_ratio", "quest_date", "remote_id", "updated_at", "synced_at", "deleted_at" FROM `quest`;--> statement-breakpoint
DROP TABLE `quest`;--> statement-breakpoint
ALTER TABLE `__new_quest` RENAME TO `quest`;--> statement-breakpoint
CREATE INDEX `quest_user_date_idx` ON `quest` (`user_id`,`quest_date`);--> statement-breakpoint
CREATE TABLE `__new_streak` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`current_streak` integer DEFAULT 0 NOT NULL,
	`longest_streak` integer DEFAULT 0 NOT NULL,
	`last_active_date` text,
	`remote_id` text,
	`updated_at` integer NOT NULL,
	`synced_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_streak`("id", "user_id", "current_streak", "longest_streak", "last_active_date", "remote_id", "updated_at", "synced_at", "deleted_at") SELECT "id", "user_id", "current_streak", "longest_streak", "last_active_date", "remote_id", "updated_at", "synced_at", "deleted_at" FROM `streak`;--> statement-breakpoint
DROP TABLE `streak`;--> statement-breakpoint
ALTER TABLE `__new_streak` RENAME TO `streak`;--> statement-breakpoint
CREATE TABLE `__new_subscription` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan_type` text NOT NULL,
	`status` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`price` real NOT NULL,
	`remote_id` text,
	`updated_at` integer NOT NULL,
	`synced_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_subscription`("id", "user_id", "plan_type", "status", "start_date", "end_date", "price", "remote_id", "updated_at", "synced_at", "deleted_at") SELECT "id", "user_id", "plan_type", "status", "start_date", "end_date", "price", "remote_id", "updated_at", "synced_at", "deleted_at" FROM `subscription`;--> statement-breakpoint
DROP TABLE `subscription`;--> statement-breakpoint
ALTER TABLE `__new_subscription` RENAME TO `subscription`;--> statement-breakpoint
CREATE TABLE `__new_water_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount_ml` integer NOT NULL,
	`logged_at` integer NOT NULL,
	`logged_on` text NOT NULL,
	`remote_id` text,
	`updated_at` integer NOT NULL,
	`synced_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_water_log`("id", "user_id", "amount_ml", "logged_at", "logged_on", "remote_id", "updated_at", "synced_at", "deleted_at") SELECT "id", "user_id", "amount_ml", "logged_at", "logged_on", "remote_id", "updated_at", "synced_at", "deleted_at" FROM `water_log`;--> statement-breakpoint
DROP TABLE `water_log`;--> statement-breakpoint
ALTER TABLE `__new_water_log` RENAME TO `water_log`;--> statement-breakpoint
CREATE INDEX `water_log_user_day_idx` ON `water_log` (`user_id`,`logged_on`);--> statement-breakpoint
CREATE TABLE `__new_weight_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`weight` real NOT NULL,
	`recorded_at` text NOT NULL,
	`remote_id` text,
	`updated_at` integer NOT NULL,
	`synced_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_weight_log`("id", "user_id", "weight", "recorded_at", "remote_id", "updated_at", "synced_at", "deleted_at") SELECT "id", "user_id", "weight", "recorded_at", "remote_id", "updated_at", "synced_at", "deleted_at" FROM `weight_log`;--> statement-breakpoint
DROP TABLE `weight_log`;--> statement-breakpoint
ALTER TABLE `__new_weight_log` RENAME TO `weight_log`;--> statement-breakpoint
CREATE INDEX `weight_log_user_date_idx` ON `weight_log` (`user_id`,`recorded_at`);