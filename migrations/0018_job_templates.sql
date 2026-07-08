-- Phase 2c: Job templates (reusable equipment presets, e.g. "Full Band", "Small PA").
-- Apply via Supabase SQL Editor. Safe to re-run (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS "job_templates" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "name"       text NOT NULL,
  "notes"      text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "job_template_items" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "template_id"   uuid NOT NULL,
  "stock_item_id" uuid NOT NULL,
  "quantity"      integer NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "job_templates" ADD CONSTRAINT "job_templates_company_id_companies_id_fk"
    FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "job_template_items" ADD CONSTRAINT "job_template_items_template_id_job_templates_id_fk"
    FOREIGN KEY ("template_id") REFERENCES "public"."job_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "job_template_items" ADD CONSTRAINT "job_template_items_stock_item_id_stock_items_id_fk"
    FOREIGN KEY ("stock_item_id") REFERENCES "public"."stock_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "job_templates_company_id_idx"      ON "job_templates"      USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "job_template_items_template_id_idx" ON "job_template_items" USING btree ("template_id");
