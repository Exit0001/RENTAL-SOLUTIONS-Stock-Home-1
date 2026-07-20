-- Crew & Vehicle resource management — reusable crew roster (all types) + vehicle roster + job assignments.
-- Run in Supabase SQL Editor (db:migrate is out of sync — see CLAUDE.md).
-- Idempotent: safe to re-run (guards for existing type/tables/constraints).
DO $$ BEGIN
  CREATE TYPE "public"."crew_type" AS ENUM('own_crew', 'freelancer', 'outsource', 'loader');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crew_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "crew_type" DEFAULT 'own_crew' NOT NULL,
	"phone" text,
	"role" text,
	"note" text,
	"day_rate" numeric(10, 2),
	"user_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text,
	"plate" text,
	"capacity" text,
	"note" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_crew_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"crew_member_id" uuid NOT NULL,
	"role" text
);
--> statement-breakpoint
ALTER TABLE "job_vehicles" ADD COLUMN IF NOT EXISTS "vehicle_id" uuid;--> statement-breakpoint
ALTER TABLE "job_vehicles" ADD COLUMN IF NOT EXISTS "driver_crew_member_id" uuid;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "job_crew_members" ADD CONSTRAINT "job_crew_members_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "job_crew_members" ADD CONSTRAINT "job_crew_members_crew_member_id_crew_members_id_fk" FOREIGN KEY ("crew_member_id") REFERENCES "public"."crew_members"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "job_vehicles" ADD CONSTRAINT "job_vehicles_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "job_vehicles" ADD CONSTRAINT "job_vehicles_driver_crew_member_id_crew_members_id_fk" FOREIGN KEY ("driver_crew_member_id") REFERENCES "public"."crew_members"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crew_members_company_id_idx" ON "crew_members" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicles_company_id_idx" ON "vehicles" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_crew_members_job_id_idx" ON "job_crew_members" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_crew_members_crew_member_id_idx" ON "job_crew_members" USING btree ("crew_member_id");
