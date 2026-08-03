-- job_units: กันยูนิตเดียวถูกใส่ซ้ำในงานเดียวกัน
--
-- เดิมกันไว้ที่ระดับโค้ดเท่านั้น (POST /jobs/:id/units, apply-set, load container ต่างก็ dedupe เอง)
-- ถ้ามี code path ใหม่หรือ race condition แทรกซ้ำได้ จะทำให้ plannedCount/pull sheet นับเกิน
-- ตรวจแล้วว่าไม่มีข้อมูลซ้ำอยู่ก่อน (0 rows) จึงสร้าง unique index ได้เลย
--
-- หมายเหตุ: ยูนิตเดียวอยู่ได้ในหลาย "งาน" (คนละ job_id) — นั่นคือการจองซ้ำข้ามงาน
-- ซึ่งเป็นเรื่องที่ต้องให้ผู้ใช้เห็นและตัดสินใจเอง ไม่ใช่สิ่งที่ constraint นี้ห้าม
CREATE UNIQUE INDEX IF NOT EXISTS "job_units_job_unit_unique"
  ON "job_units" ("job_id", "stock_unit_id");
