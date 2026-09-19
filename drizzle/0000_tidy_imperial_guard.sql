CREATE TABLE `alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`active` integer DEFAULT 0 NOT NULL,
	`since` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`server` text NOT NULL,
	`time` integer NOT NULL,
	`kind` text NOT NULL,
	`message` text NOT NULL,
	`delivered` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_owner_time` ON `events` (`owner`,`time`);--> statement-breakpoint
CREATE TABLE `samples` (
	`id` text PRIMARY KEY NOT NULL,
	`server` text NOT NULL,
	`time` integer NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `samples_server_time` ON `samples` (`server`,`time`);--> statement-breakpoint
CREATE TABLE `servers` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`token` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`meta` text NOT NULL,
	`metrics` text,
	`seen` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `servers_owner` ON `servers` (`owner`);--> statement-breakpoint
CREATE INDEX `servers_token` ON `servers` (`token`);--> statement-breakpoint
CREATE TABLE `settings` (
	`owner` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
