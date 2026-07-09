-- Equipment Sets (ชุดอุปกรณ์ / Kits) — reusable named bundles added to jobs in one action.
-- Run in Supabase SQL Editor (db:migrate is out of sync — see CLAUDE.md).
CREATE TABLE "equipment_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_set_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_id" uuid NOT NULL,
	"stock_item_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_id" uuid
);
--> statement-breakpoint
ALTER TABLE "equipment_sets" ADD CONSTRAINT "equipment_sets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_set_items" ADD CONSTRAINT "equipment_set_items_set_id_equipment_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."equipment_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_set_items" ADD CONSTRAINT "equipment_set_items_stock_item_id_stock_items_id_fk" FOREIGN KEY ("stock_item_id") REFERENCES "public"."stock_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_set_items" ADD CONSTRAINT "equipment_set_items_unit_id_stock_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."stock_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "equipment_sets_company_id_idx" ON "equipment_sets" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "equipment_set_items_set_id_idx" ON "equipment_set_items" USING btree ("set_id");
