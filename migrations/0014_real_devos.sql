CREATE TABLE "item_accessories" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "company_id" uuid NOT NULL,
    "parent_stock_item_id" uuid NOT NULL,
    "accessory_stock_item_id" uuid NOT NULL,
    "quantity_per_unit" integer DEFAULT 1 NOT NULL,
    "required" boolean DEFAULT true NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "item_accessories" ADD CONSTRAINT "item_accessories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "item_accessories" ADD CONSTRAINT "item_accessories_parent_stock_item_id_stock_items_id_fk" FOREIGN KEY ("parent_stock_item_id") REFERENCES "public"."stock_items"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "item_accessories" ADD CONSTRAINT "item_accessories_accessory_stock_item_id_stock_items_id_fk" FOREIGN KEY ("accessory_stock_item_id") REFERENCES "public"."stock_items"("id") ON DELETE cascade ON UPDATE no action;
