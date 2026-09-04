CREATE TABLE `activity_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`activity_type` text NOT NULL,
	`calories_burned` integer NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`logged_at` integer NOT NULL,
	`logged_on` text NOT NULL,
	`remote_id` integer,
	`updated_at` integer NOT NULL,
	`synced_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `activity_log_user_day_idx` ON `activity_log` (`user_id`,`logged_on`);--> statement-breakpoint
CREATE TABLE `coin_transaction` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	`remote_id` integer,
	`updated_at` integer NOT NULL,
	`synced_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `coin_transaction_user_idx` ON `coin_transaction` (`user_id`);--> statement-breakpoint
CREATE TABLE `daily_goal` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`target_kcal` integer NOT NULL,
	`target_carbs_g` real NOT NULL,
	`target_protein_g` real NOT NULL,
	`target_fat_g` real NOT NULL,
	`target_water_ml` integer DEFAULT 2000 NOT NULL,
	`effective_date` text NOT NULL,
	`remote_id` integer,
	`updated_at` integer NOT NULL,
	`synced_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `daily_goal_user_date_idx` ON `daily_goal` (`user_id`,`effective_date`);--> statement-breakpoint
CREATE TABLE `food_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`input_method` text NOT NULL,
	`image_url` text,
	`total_kcal` integer DEFAULT 0 NOT NULL,
	`carbs_g` real DEFAULT 0 NOT NULL,
	`protein_g` real DEFAULT 0 NOT NULL,
	`fat_g` real DEFAULT 0 NOT NULL,
	`fiber_g` real,
	`ai_feedback` text,
	`meal_type` text NOT NULL,
	`logged_at` integer NOT NULL,
	`logged_on` text NOT NULL,
	`remote_id` integer,
	`updated_at` integer NOT NULL,
	`synced_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `food_entry_user_day_idx` ON `food_entry` (`user_id`,`logged_on`);--> statement-breakpoint
CREATE TABLE `ingredient` (
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
	`remote_id` integer,
	`updated_at` integer NOT NULL,
	`synced_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`food_entry_id`) REFERENCES `food_entry`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ingredient_entry_idx` ON `ingredient` (`food_entry_id`);--> statement-breakpoint
CREATE TABLE `quest` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`quest_type` text NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`target` integer NOT NULL,
	`reward_coins` integer NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`quest_date` text NOT NULL,
	`remote_id` integer,
	`updated_at` integer NOT NULL,
	`synced_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quest_user_date_idx` ON `quest` (`user_id`,`quest_date`);--> statement-breakpoint
CREATE TABLE `streak` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`current_streak` integer DEFAULT 0 NOT NULL,
	`longest_streak` integer DEFAULT 0 NOT NULL,
	`last_active_date` text,
	`remote_id` integer,
	`updated_at` integer NOT NULL,
	`synced_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `subscription` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan_type` text NOT NULL,
	`status` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`price` real NOT NULL,
	`remote_id` integer,
	`updated_at` integer NOT NULL,
	`synced_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`display_name` text,
	`gender` text NOT NULL,
	`birth_year` integer NOT NULL,
	`unit_system` text DEFAULT 'metric' NOT NULL,
	`height` real NOT NULL,
	`weight_current` real NOT NULL,
	`weight_goal` real NOT NULL,
	`activity_level` text NOT NULL,
	`diet_type` text DEFAULT 'balanced' NOT NULL,
	`calorie_calc_mode` text DEFAULT 'auto' NOT NULL,
	`subscription_tier` text DEFAULT 'free' NOT NULL,
	`weekly_rate_kg` real DEFAULT 0.5 NOT NULL,
	`created_at` integer NOT NULL,
	`remote_id` integer,
	`updated_at` integer NOT NULL,
	`synced_at` integer,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `water_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount_ml` integer NOT NULL,
	`logged_at` integer NOT NULL,
	`logged_on` text NOT NULL,
	`remote_id` integer,
	`updated_at` integer NOT NULL,
	`synced_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `water_log_user_day_idx` ON `water_log` (`user_id`,`logged_on`);--> statement-breakpoint
CREATE TABLE `weight_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`weight` real NOT NULL,
	`recorded_at` text NOT NULL,
	`remote_id` integer,
	`updated_at` integer NOT NULL,
	`synced_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `weight_log_user_date_idx` ON `weight_log` (`user_id`,`recorded_at`);