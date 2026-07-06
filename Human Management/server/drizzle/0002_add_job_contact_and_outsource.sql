CREATE TABLE `job_day_extras` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`date` text NOT NULL,
	`outsource_crew_count` integer DEFAULT 0 NOT NULL,
	`outsource_truck_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_job_day_extras` ON `job_day_extras` (`job_id`,`date`);--> statement-breakpoint
ALTER TABLE `jobs` ADD `contact_name` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `contact_phone` text;