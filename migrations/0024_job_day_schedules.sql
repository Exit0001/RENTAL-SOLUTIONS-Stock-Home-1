CREATE TABLE IF NOT EXISTS "job_day_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"date" timestamp NOT NULL,
	"departure_time" text,
	"arrival_time" text,
	"end_time" text,
	"note" text
);

CREATE TABLE IF NOT EXISTS "job_day_crew" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"date" timestamp NOT NULL,
	"crew_member_id" uuid NOT NULL,
	"role" text
);

ALTER TABLE "job_day_schedules" ADD CONSTRAINT "job_day_schedules_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "job_day_crew" ADD CONSTRAINT "job_day_crew_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "job_day_crew" ADD CONSTRAINT "job_day_crew_crew_member_id_crew_members_id_fk" FOREIGN KEY ("crew_member_id") REFERENCES "public"."crew_members"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "job_day_schedules_job_id_idx" ON "job_day_schedules" USING btree ("job_id");
CREATE INDEX IF NOT EXISTS "job_day_crew_job_id_idx" ON "job_day_crew" USING btree ("job_id");
CREATE INDEX IF NOT EXISTS "job_day_crew_crew_member_id_idx" ON "job_day_crew" USING btree ("crew_member_id");
