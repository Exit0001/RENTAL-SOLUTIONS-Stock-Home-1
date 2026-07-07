-- ──────────────────────────────────────────────────────────────────────────────
-- 0016_uniqueness_constraints.sql
-- Enforce uniqueness per company on stock item names, unit serial numbers,
-- and unit barcodes. Partial indexes exclude NULLs and empty strings.
-- Run in Supabase SQL Editor.
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. stock_items.name — unique per company (case-insensitive via lower())
CREATE UNIQUE INDEX IF NOT EXISTS stock_items_name_company_uq
  ON stock_items (company_id, lower(name));

-- 2. stock_units.serial_number — unique per company when set
CREATE UNIQUE INDEX IF NOT EXISTS stock_units_serial_company_uq
  ON stock_units (company_id, lower(serial_number))
  WHERE serial_number IS NOT NULL AND serial_number <> '';

-- 3. stock_units.barcode — unique per company when set
CREATE UNIQUE INDEX IF NOT EXISTS stock_units_barcode_company_uq
  ON stock_units (company_id, lower(barcode))
  WHERE barcode IS NOT NULL AND barcode <> '';
