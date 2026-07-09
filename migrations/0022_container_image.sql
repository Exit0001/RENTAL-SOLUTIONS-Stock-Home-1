-- Phase 3b: container photo (reference image per rack/container).
-- Apply via Supabase SQL Editor. Safe to re-run.

ALTER TABLE "containers" ADD COLUMN IF NOT EXISTS "image_url" text;
