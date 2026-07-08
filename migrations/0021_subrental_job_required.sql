-- Sub-rentals now always belong to a job (matches job_expenses / job_vehicles).
-- If this fails with a not-null violation, some existing sub_rentals rows have
-- no job_id — assign them to a job (or delete them) before re-running.
-- Apply via Supabase SQL Editor.

ALTER TABLE "sub_rentals" DROP CONSTRAINT IF EXISTS "sub_rentals_job_id_jobs_id_fk";
ALTER TABLE "sub_rentals" ALTER COLUMN "job_id" SET NOT NULL;
ALTER TABLE "sub_rentals" ADD CONSTRAINT "sub_rentals_job_id_jobs_id_fk"
  FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
