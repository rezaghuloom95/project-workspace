CREATE TABLE `auth_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`user_agent` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `organisation_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `auth_sessions_member_idx` ON `auth_sessions` (`member_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `login_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	`last_login_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `organisation_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `login_accounts_member_id_unique` ON `login_accounts` (`member_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `login_accounts_username_unique` ON `login_accounts` (`username`);--> statement-breakpoint
CREATE TABLE `system_migrations` (
	`id` text PRIMARY KEY NOT NULL,
	`applied_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
