CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`input_json` text NOT NULL,
	`result_json` text,
	`error_json` text,
	`last_error_json` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer NOT NULL,
	`available_at` integer NOT NULL,
	`locked_at` integer,
	`locked_by` text,
	`created_at` integer DEFAULT (cast(strftime('%s', 'now') as integer) * 1000) NOT NULL,
	`updated_at` integer DEFAULT (cast(strftime('%s', 'now') as integer) * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `jobs_status_available_at_created_at_idx` ON `jobs` (`status`,`available_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `jobs_status_locked_at_idx` ON `jobs` (`status`,`locked_at`);