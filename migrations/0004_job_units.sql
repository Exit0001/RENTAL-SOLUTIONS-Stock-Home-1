CREATE TABLE IF NOT EXISTS "job_units" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  "stock_unit_id" uuid NOT NULL REFERENCES "stock_units"("id") ON DELETE CASCADE
);
