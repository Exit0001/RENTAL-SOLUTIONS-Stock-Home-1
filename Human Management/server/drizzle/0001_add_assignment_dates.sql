DROP INDEX `uq_job_staff`;--> statement-breakpoint
ALTER TABLE `job_staff_assignments` ADD `date` text NOT NULL DEFAULT '';--> statement-breakpoint
CREATE UNIQUE INDEX `uq_job_staff` ON `job_staff_assignments` (`job_id`,`staff_id`,`date`);--> statement-breakpoint
DROP INDEX `uq_job_vehicle`;--> statement-breakpoint
ALTER TABLE `job_vehicle_assignments` ADD `date` text NOT NULL DEFAULT '';--> statement-breakpoint
CREATE UNIQUE INDEX `uq_job_vehicle` ON `job_vehicle_assignments` (`job_id`,`vehicle_id`,`date`);