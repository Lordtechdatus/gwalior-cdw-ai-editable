CREATE TABLE `collection_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` text NOT NULL,
	`vehicle_number` text NOT NULL,
	`vehicle_type` text NOT NULL,
	`driver_name` text NOT NULL,
	`driver_contact_masked` text,
	`recycler_destination` text NOT NULL,
	`scheduled_at` text NOT NULL,
	`estimated_arrival_at` text,
	`status` text DEFAULT 'Scheduled' NOT NULL,
	`assigned_by_email` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `waste_reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collection_assignments_report_unique` ON `collection_assignments` (`report_id`);--> statement-breakpoint
CREATE INDEX `collection_assignments_scheduled_idx` ON `collection_assignments` (`scheduled_at`);--> statement-breakpoint
CREATE TABLE `material_estimates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` text NOT NULL,
	`material` text NOT NULL,
	`probability` real NOT NULL,
	`area_m2` real NOT NULL,
	`volume_m3` real NOT NULL,
	`mass_kg` real NOT NULL,
	`co2_kg` real NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `waste_reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `material_estimates_report_idx` ON `material_estimates` (`report_id`);--> statement-breakpoint
CREATE INDEX `material_estimates_material_idx` ON `material_estimates` (`material`);--> statement-breakpoint
CREATE TABLE `model_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`mode` text NOT NULL,
	`confidence_threshold` real DEFAULT 0.7 NOT NULL,
	`configuration_json` text NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`created_by_email` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `model_versions_active_idx` ON `model_versions` (`active`);--> statement-breakpoint
CREATE TABLE `recycling_receipts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` text NOT NULL,
	`recycler_email` text NOT NULL,
	`received_mass_kg` real NOT NULL,
	`recovered_mass_kg` real NOT NULL,
	`rejected_mass_kg` real DEFAULT 0 NOT NULL,
	`certificate_number` text,
	`evidence_object_key` text,
	`status` text DEFAULT 'Draft' NOT NULL,
	`received_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `waste_reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recycling_receipts_report_unique` ON `recycling_receipts` (`report_id`);--> statement-breakpoint
CREATE INDEX `recycling_receipts_recycler_idx` ON `recycling_receipts` (`recycler_email`);--> statement-breakpoint
CREATE TABLE `status_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` text NOT NULL,
	`status` text NOT NULL,
	`actor_email` text NOT NULL,
	`note` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `waste_reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `status_events_report_idx` ON `status_events` (`report_id`);--> statement-breakpoint
CREATE INDEX `status_events_created_idx` ON `status_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'generator' NOT NULL,
	`organization` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `waste_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`site_name` text NOT NULL,
	`ward` text NOT NULL,
	`latitude` real,
	`longitude` real,
	`camera_height_m` real NOT NULL,
	`horizontal_fov_deg` real NOT NULL,
	`image_object_key` text,
	`analysis_id` text NOT NULL,
	`analysis_mode` text DEFAULT 'prototype' NOT NULL,
	`model_version` text DEFAULT 'prototype-0.1' NOT NULL,
	`dominant_material` text NOT NULL,
	`confidence` real NOT NULL,
	`manual_review_required` integer DEFAULT true NOT NULL,
	`total_area_m2` real NOT NULL,
	`total_volume_m3` real NOT NULL,
	`total_mass_kg` real NOT NULL,
	`total_co2_kg` real NOT NULL,
	`status` text DEFAULT 'Submitted' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `waste_reports_owner_idx` ON `waste_reports` (`owner_email`);--> statement-breakpoint
CREATE INDEX `waste_reports_status_idx` ON `waste_reports` (`status`);--> statement-breakpoint
CREATE INDEX `waste_reports_created_idx` ON `waste_reports` (`created_at`);--> statement-breakpoint
CREATE INDEX `waste_reports_ward_idx` ON `waste_reports` (`ward`);