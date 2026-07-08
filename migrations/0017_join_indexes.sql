-- Phase 1a: performance indexes on hot FK / join columns.
-- Apply via Supabase SQL Editor (db:migrate is unusable due to the 0004 journal conflict).
-- All use IF NOT EXISTS so this is safe to re-run.

CREATE INDEX IF NOT EXISTS "stock_items_company_id_idx"        ON "stock_items"     USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "stock_units_company_id_idx"        ON "stock_units"     USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "stock_units_stock_item_id_idx"     ON "stock_units"     USING btree ("stock_item_id");
CREATE INDEX IF NOT EXISTS "job_units_job_id_idx"              ON "job_units"       USING btree ("job_id");
CREATE INDEX IF NOT EXISTS "job_units_stock_unit_id_idx"       ON "job_units"       USING btree ("stock_unit_id");
CREATE INDEX IF NOT EXISTS "job_stock_job_id_idx"              ON "job_stock"       USING btree ("job_id");
CREATE INDEX IF NOT EXISTS "job_stock_stock_item_id_idx"       ON "job_stock"       USING btree ("stock_item_id");
CREATE INDEX IF NOT EXISTS "job_crew_job_id_idx"               ON "job_crew"        USING btree ("job_id");
CREATE INDEX IF NOT EXISTS "job_crew_user_id_idx"              ON "job_crew"        USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "job_containers_job_id_idx"         ON "job_containers"  USING btree ("job_id");
CREATE INDEX IF NOT EXISTS "job_containers_container_id_idx"   ON "job_containers"  USING btree ("container_id");
CREATE INDEX IF NOT EXISTS "container_units_container_id_idx"  ON "container_units" USING btree ("container_id");
CREATE INDEX IF NOT EXISTS "container_units_stock_unit_id_idx" ON "container_units" USING btree ("stock_unit_id");
CREATE INDEX IF NOT EXISTS "notifications_user_id_idx"         ON "notifications"   USING btree ("user_id");
