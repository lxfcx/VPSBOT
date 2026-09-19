CREATE TABLE `accounts` (
	`owner` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`salt` text NOT NULL,
	`password` text NOT NULL,
	`changed` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_username_unique` ON `accounts` (`username`);--> statement-breakpoint
CREATE TABLE `analyses` (
	`server` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`time` integer DEFAULT 0 NOT NULL,
	`sample` integer DEFAULT 0 NOT NULL,
	`provider` text DEFAULT 'rules' NOT NULL,
	`text` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `auth_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`server` text DEFAULT '' NOT NULL,
	`time` integer NOT NULL,
	`category` text NOT NULL,
	`action` text NOT NULL,
	`detail` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_owner_time` ON `audit` (`owner`,`time`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`owner` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sessions_owner` ON `sessions` (`owner`);--> statement-breakpoint
ALTER TABLE `events` ADD `payload` text;--> statement-breakpoint
ALTER TABLE `servers` ADD `first_seen` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `servers` ADD `online_seconds` integer DEFAULT 0 NOT NULL;