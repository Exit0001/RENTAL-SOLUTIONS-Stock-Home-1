-- รูปเดียวต่ออัน สำหรับ งาน / ทีมงาน / รถ
-- (brands.logo_url และ stock_items.image_url มีอยู่แล้ว; รูปเก็บที่ระดับสินค้า ไม่ใช่รายยูนิต)
-- รันใน Supabase SQL Editor (db:migrate ใช้ไม่ได้ตาม CLAUDE.md)

ALTER TABLE "jobs"         ADD COLUMN IF NOT EXISTS "image_url" text;
ALTER TABLE "crew_members" ADD COLUMN IF NOT EXISTS "image_url" text;
ALTER TABLE "vehicles"     ADD COLUMN IF NOT EXISTS "image_url" text;
