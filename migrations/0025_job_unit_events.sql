CREATE TYPE "public"."job_unit_event_type" AS ENUM('added', 'removed', 'dispatched', 'returned');

CREATE TABLE IF NOT EXISTS "job_unit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"stock_unit_id" uuid NOT NULL,
	"event_type" "job_unit_event_type" NOT NULL,
	"actor_user_id" uuid,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "job_unit_events" ADD CONSTRAINT "job_unit_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "job_unit_events" ADD CONSTRAINT "job_unit_events_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "job_unit_events" ADD CONSTRAINT "job_unit_events_stock_unit_id_stock_units_id_fk" FOREIGN KEY ("stock_unit_id") REFERENCES "public"."stock_units"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "job_unit_events" ADD CONSTRAINT "job_unit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "job_unit_events_job_id_idx" ON "job_unit_events" USING btree ("job_id");
CREATE INDEX IF NOT EXISTS "job_unit_events_stock_unit_id_idx" ON "job_unit_events" USING btree ("stock_unit_id");
