ALTER TABLE "pull_sheets" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;
ALTER TABLE "pull_sheets" ADD COLUMN IF NOT EXISTS "name" text;

CREATE TABLE IF NOT EXISTS "pull_sheet_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pull_sheet_id" uuid NOT NULL,
	"category" text NOT NULL,
	"item_name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"zone" text
);

ALTER TABLE "pull_sheet_items" ADD CONSTRAINT "pull_sheet_items_pull_sheet_id_fk" FOREIGN KEY ("pull_sheet_id") REFERENCES "public"."pull_sheets"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "pull_sheet_items_sheet_id_idx" ON "pull_sheet_items" ("pull_sheet_id");
CREATE INDEX IF NOT EXISTS "pull_sheets_job_id_idx" ON "pull_sheets" ("job_id");

UPDATE "pull_sheets" ps
SET "version" = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY created_at) AS rn
  FROM "pull_sheets"
) sub
WHERE ps.id = sub.id;
