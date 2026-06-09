CREATE TABLE "job_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"stock_unit_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_units" ADD COLUMN "purchased_at" timestamp;--> statement-breakpoint
ALTER TABLE "stock_units" ADD COLUMN "warranty_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "job_units" ADD CONSTRAINT "job_units_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_units" ADD CONSTRAINT "job_units_stock_unit_id_stock_units_id_fk" FOREIGN KEY ("stock_unit_id") REFERENCES "public"."stock_units"("id") ON DELETE cascade ON UPDATE no action;