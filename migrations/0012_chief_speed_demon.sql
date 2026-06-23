CREATE TYPE "public"."job_expense_category" AS ENUM('staff', 'transport');--> statement-breakpoint
CREATE TABLE "job_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"category" "job_expense_category" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"note" text,
	"receipt_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_expenses" ADD CONSTRAINT "job_expenses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_expenses" ADD CONSTRAINT "job_expenses_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;