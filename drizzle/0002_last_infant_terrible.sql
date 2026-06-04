--> Hand-adjusted from the drizzle-kit default: SQLite forbids `ADD COLUMN ... NOT NULL
--> DEFAULT (unixepoch())` ("Cannot add a column with non-constant default"), so the three
--> tables that gain NOT NULL timestamp columns are rebuilt (CREATE/SELECT/DROP/RENAME) to
--> get the correct `(unixepoch())` default. Existing rows backfill `updated_at = created_at`
--> (list_items, which never had timestamps, gets `unixepoch()` for both). FKs are OFF on the
--> connection, so the rebuild is safe. `deleted_at` is nullable → plain ADD COLUMN is fine.
CREATE TABLE `__new_list_items` (
	`id` text PRIMARY KEY NOT NULL,
	`list_id` text NOT NULL,
	`name` text NOT NULL,
	`store_name` text,
	`checked` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_list_items`(`id`, `list_id`, `name`, `store_name`, `checked`, `sort_order`, `created_at`, `updated_at`, `deleted_at`) SELECT `id`, `list_id`, `name`, `store_name`, `checked`, `sort_order`, (unixepoch()), (unixepoch()), NULL FROM `list_items`;--> statement-breakpoint
DROP TABLE `list_items`;--> statement-breakpoint
ALTER TABLE `__new_list_items` RENAME TO `list_items`;--> statement-breakpoint
CREATE INDEX `list_items_list_id_idx` ON `list_items` (`list_id`);--> statement-breakpoint
CREATE TABLE `__new_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`set_id` text,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`set_id`) REFERENCES `sets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_lists`(`id`, `user_id`, `set_id`, `name`, `status`, `created_at`, `updated_at`, `deleted_at`) SELECT `id`, `user_id`, `set_id`, `name`, `status`, `created_at`, `created_at`, NULL FROM `lists`;--> statement-breakpoint
DROP TABLE `lists`;--> statement-breakpoint
ALTER TABLE `__new_lists` RENAME TO `lists`;--> statement-breakpoint
CREATE INDEX `lists_user_id_idx` ON `lists` (`user_id`);--> statement-breakpoint
CREATE INDEX `lists_status_idx` ON `lists` (`status`);--> statement-breakpoint
CREATE TABLE `__new_set_items` (
	`id` text PRIMARY KEY NOT NULL,
	`set_id` text NOT NULL,
	`name` text NOT NULL,
	`store_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`set_id`) REFERENCES `sets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_set_items`(`id`, `set_id`, `name`, `store_id`, `sort_order`, `created_at`, `updated_at`, `deleted_at`) SELECT `id`, `set_id`, `name`, `store_id`, `sort_order`, `created_at`, `created_at`, NULL FROM `set_items`;--> statement-breakpoint
DROP TABLE `set_items`;--> statement-breakpoint
ALTER TABLE `__new_set_items` RENAME TO `set_items`;--> statement-breakpoint
CREATE INDEX `set_items_set_id_idx` ON `set_items` (`set_id`);--> statement-breakpoint
ALTER TABLE `sets` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `stores` ADD `deleted_at` integer;