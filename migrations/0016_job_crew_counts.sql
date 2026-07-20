-- Per-job headcount for outsource / loader crew (จำนวนคนแบบเหมา — ไม่ระบุชื่อ).
-- Idempotent — safe to re-run. Run in Supabase SQL Editor (db:migrate is out of sync — see CLAUDE.md).
CREATE TABLE IF NOT EXISTS "job_crew_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"type" "crew_type" NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "job_crew_counts" ADD CONSTRAINT "job_crew_counts_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_crew_counts_job_id_idx" ON "job_crew_counts" USING btree ("job_id");
