CREATE TABLE `enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`server` text NOT NULL,
	`owner` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `enrollments_server` ON `enrollments` (`server`);