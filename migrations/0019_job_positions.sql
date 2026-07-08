-- Phase 3a: per-job position zones (FOH / Monitors / Power / Stage / Backline).
-- Apply via Supabase SQL Editor. Safe to re-run.

ALTER TABLE "job_units" ADD COLUMN IF NOT EXISTS "position" text;
ALTER TABLE "job_stock" ADD COLUMN IF NOT EXISTS "position" text;

CREATE TABLE IF NOT EXISTS "positions" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "name"       text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "positions" ADD CONSTRAINT "positions_company_id_companies_id_fk"
    FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "positions_company_id_idx" ON "positions" USING btree ("company_id");

-- Seed default zones for every existing company (only if that company has none yet)
INSERT INTO "positions" ("company_id", "name", "sort_order")
SELECT c.id, z.name, z.ord
FROM "companies" c
CROSS JOIN (VALUES ('FOH',1),('Monitors',2),('Power',3),('Stage',4),('Backline',5)) AS z(name, ord)
WHERE NOT EXISTS (SELECT 1 FROM "positions" p WHERE p.company_id = c.id);
