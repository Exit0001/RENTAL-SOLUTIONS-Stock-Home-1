-- Index on jobs.company_id — supports the new "last used position" lookup
-- (join through jobs, filtered by company) and general per-company job queries.
-- Apply via Supabase SQL Editor. Safe to re-run.

CREATE INDEX IF NOT EXISTS "jobs_company_id_idx" ON "jobs" USING btree ("company_id");
