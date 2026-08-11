CREATE TABLE `activity_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`event_id` text,
	`member_id` text NOT NULL,
	`action` text NOT NULL,
	`message` text NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `activity_event_idx` ON `activity_logs` (`event_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`title` text NOT NULL,
	`objective` text DEFAULT '' NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`owner_id` text,
	`audience` text DEFAULT 'Supporters' NOT NULL,
	`channels` text DEFAULT 'Instagram, X' NOT NULL,
	`status` text DEFAULT 'Planned' NOT NULL,
	`priority` text DEFAULT 'Normal' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `organisation_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `campaigns_org_dates_idx` ON `campaigns` (`organisation_id`,`start_date`);--> statement-breakpoint
CREATE TABLE `content_items` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`event_id` text,
	`campaign_id` text,
	`title` text NOT NULL,
	`platform` text NOT NULL,
	`content_type` text NOT NULL,
	`publish_at` text NOT NULL,
	`assignee_id` text,
	`status` text DEFAULT 'Idea' NOT NULL,
	`approval_status` text DEFAULT 'Draft' NOT NULL,
	`asset_url` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignee_id`) REFERENCES `organisation_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `content_org_publish_idx` ON `content_items` (`organisation_id`,`publish_at`);--> statement-breakpoint
CREATE TABLE `equipment_items` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`event_id` text NOT NULL,
	`title` text NOT NULL,
	`confirmed` integer DEFAULT false NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `equipment_event_idx` ON `equipment_items` (`event_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `event_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`event_id` text NOT NULL,
	`member_id` text NOT NULL,
	`responsibility` text NOT NULL,
	`confirmation_status` text DEFAULT 'Assigned' NOT NULL,
	`required_arrival_at` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `organisation_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assignment_event_member_role_uq` ON `event_assignments` (`event_id`,`member_id`,`responsibility`);--> statement-breakpoint
CREATE INDEX `assignment_member_idx` ON `event_assignments` (`member_id`);--> statement-breakpoint
CREATE TABLE `event_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`name` text NOT NULL,
	`colour` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_org_name_uq` ON `event_categories` (`organisation_id`,`name`);--> statement-breakpoint
CREATE TABLE `event_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`event_id` text NOT NULL,
	`member_id` text NOT NULL,
	`body` text NOT NULL,
	`important` integer DEFAULT false NOT NULL,
	`parent_id` text,
	`edited_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `comments_event_idx` ON `event_comments` (`event_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `event_requirements` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`event_id` text NOT NULL,
	`photography` integer DEFAULT false NOT NULL,
	`video` integer DEFAULT false NOT NULL,
	`social` integer DEFAULT false NOT NULL,
	`graphic_design` integer DEFAULT false NOT NULL,
	`live_updates` integer DEFAULT false NOT NULL,
	`interview` integer DEFAULT false NOT NULL,
	`sponsor_coverage` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`category_id` text,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text,
	`arrival_at` text,
	`venue` text DEFAULT '' NOT NULL,
	`maps_url` text,
	`opponent` text,
	`competition` text,
	`home_away` text,
	`priority` text DEFAULT 'Normal' NOT NULL,
	`status` text DEFAULT 'Planned' NOT NULL,
	`readiness` text DEFAULT 'Needs attention' NOT NULL,
	`readiness_reason` text DEFAULT 'Assignments need confirmation' NOT NULL,
	`owner_id` text,
	`campaign_id` text,
	`client_request_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	`archived_at` text,
	`created_by` text,
	`updated_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `event_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `organisation_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `organisation_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `organisation_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `events_org_start_idx` ON `events` (`organisation_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `events_org_status_idx` ON `events` (`organisation_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `events_client_request_uq` ON `events` (`organisation_id`,`client_request_id`);--> statement-breakpoint
CREATE TABLE `media_items` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`event_id` text,
	`campaign_id` text,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`url` text NOT NULL,
	`tags` text DEFAULT '' NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `media_org_kind_idx` ON `media_items` (`organisation_id`,`kind`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`member_id` text NOT NULL,
	`event_id` text,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`kind` text DEFAULT 'Information' NOT NULL,
	`read_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `notifications_member_idx` ON `notifications` (`member_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `organisation_members` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`email` text NOT NULL,
	`full_name` text NOT NULL,
	`initials` text NOT NULL,
	`role` text NOT NULL,
	`department` text DEFAULT 'Media' NOT NULL,
	`phone` text,
	`avatar_colour` text DEFAULT '#315C50' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_org_email_uq` ON `organisation_members` (`organisation_id`,`email`);--> statement-breakpoint
CREATE INDEX `members_org_role_idx` ON `organisation_members` (`organisation_id`,`role`);--> statement-breakpoint
CREATE TABLE `organisations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`timezone` text DEFAULT 'Asia/Bahrain' NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`primary_colour` text DEFAULT '#163D33' NOT NULL,
	`accent_colour` text DEFAULT '#F2B84B' NOT NULL,
	`settings_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organisations_slug_unique` ON `organisations` (`slug`);--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`event_id` text NOT NULL,
	`member_id` text NOT NULL,
	`scheduled_at` text NOT NULL,
	`offset_code` text NOT NULL,
	`channel` text NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	`uniqueness_key` text NOT NULL,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`sent_at` text,
	`read_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reminder_uniqueness_uq` ON `reminders` (`uniqueness_key`);--> statement-breakpoint
CREATE INDEX `reminder_due_idx` ON `reminders` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `shot_list_items` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`event_id` text NOT NULL,
	`phase` text NOT NULL,
	`title` text NOT NULL,
	`mandatory` integer DEFAULT false NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`assignee_id` text,
	`notes` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shot_items_event_idx` ON `shot_list_items` (`event_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `sync_mutations` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`member_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`received_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_mutation_id_uq` ON `sync_mutations` (`id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`event_id` text,
	`campaign_id` text,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`assignee_id` text,
	`due_at` text NOT NULL,
	`priority` text DEFAULT 'Normal' NOT NULL,
	`status` text DEFAULT 'To do' NOT NULL,
	`approval_required` integer DEFAULT false NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`completed_at` text,
	`created_by` text,
	`updated_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assignee_id`) REFERENCES `organisation_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tasks_org_due_idx` ON `tasks` (`organisation_id`,`due_at`);--> statement-breakpoint
CREATE INDEX `tasks_assignee_status_idx` ON `tasks` (`assignee_id`,`status`);