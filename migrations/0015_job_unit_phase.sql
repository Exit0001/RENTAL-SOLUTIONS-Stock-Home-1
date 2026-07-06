CREATE TYPE "job_unit_phase" AS ENUM('planned', 'prepared', 'dispatched');
ALTER TABLE "job_units" ADD COLUMN "phase" "job_unit_phase" DEFAULT 'planned' NOT NULL;
