-- Sell / dispose stock out of inventory (permanent). Idempotent — safe to re-run.
-- Run in Supabase SQL Editor (db:migrate is out of sync — see CLAUDE.md).
ALTER TYPE "public"."stock_unit_status" ADD VALUE IF NOT EXISTS 'sold';
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."disposal_reason" AS ENUM('sold', 'damaged', 'lost', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_disposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"stock_item_id" uuid,
	"stock_unit_id" uuid,
	"item_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"reason" "disposal_reason" NOT NULL,
	"sale_price" numeric(12, 2),
	"note" text,
	"disposed_by" uuid,
	"disposed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "stock_disposals" ADD CONSTRAINT "stock_disposals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "stock_disposals" ADD CONSTRAINT "stock_disposals_stock_item_id_stock_items_id_fk" FOREIGN KEY ("stock_item_id") REFERENCES "public"."stock_items"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "stock_disposals" ADD CONSTRAINT "stock_disposals_stock_unit_id_stock_units_id_fk" FOREIGN KEY ("stock_unit_id") REFERENCES "public"."stock_units"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "stock_disposals" ADD CONSTRAINT "stock_disposals_disposed_by_users_id_fk" FOREIGN KEY ("disposed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_disposals_company_id_idx" ON "stock_disposals" USING btree ("company_id");
