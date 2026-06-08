CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sub_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"parent_category" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_items" ADD COLUMN "manufacturer" text;--> statement-breakpoint
ALTER TABLE "stock_items" ADD COLUMN "manufacturer_country" text;--> statement-breakpoint
ALTER TABLE "stock_items" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "stock_items" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "stock_items" ADD COLUMN "purchase_cost" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "stock_items" ADD COLUMN "purchase_date" timestamp;--> statement-breakpoint
ALTER TABLE "stock_items" ADD COLUMN "daily_rate" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "stock_items" ADD COLUMN "weekly_rate" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "stock_items" ADD COLUMN "replacement_value" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "stock_items" ADD COLUMN "security_deposit" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "stock_items" ADD COLUMN "weight" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "stock_items" ADD COLUMN "dimensions" text;--> statement-breakpoint
ALTER TABLE "stock_items" ADD COLUMN "specs" jsonb;--> statement-breakpoint
ALTER TABLE "stock_items" ADD COLUMN "warranty_expiry" timestamp;--> statement-breakpoint
ALTER TABLE "stock_items" ADD COLUMN "supplier_name" text;--> statement-breakpoint
ALTER TABLE "stock_items" ADD COLUMN "support_contact" text;--> statement-breakpoint
ALTER TABLE "stock_items" ADD COLUMN "manual_url" text;--> statement-breakpoint
ALTER TABLE "stock_items" ADD COLUMN "cert_url" text;--> statement-breakpoint
ALTER TABLE "stock_items" ADD COLUMN "invoice_url" text;--> statement-breakpoint
ALTER TABLE "brands" ADD CONSTRAINT "brands_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_categories" ADD CONSTRAINT "sub_categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;