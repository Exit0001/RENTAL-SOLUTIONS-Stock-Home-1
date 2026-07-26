import { db } from "../db";
import { jobUnitEvents } from "@shared/schema";

// บันทึกประวัติการเปลี่ยนแปลงอุปกรณ์ต่องาน — ใช้ตรวจจับของกลับก่อนกำหนด/เพิ่มเข้ามาทีหลัง
// เป็นข้อมูลเสริม (ไม่ใช่ critical path) — กลืน error เอง กันไม่ให้การเพิ่ม/ดิสแพตช์/คืนของจริง
// ล้มไปด้วยถ้า log เขียนไม่ได้ (เช่น migration ยังไม่รัน)
export async function logJobUnitEvents(
  companyId: string,
  jobId: string,
  stockUnitIds: string[],
  eventType: "added" | "removed" | "dispatched" | "returned",
  actorUserId: string | null,
  note?: string | null,
) {
  if (stockUnitIds.length === 0) return;
  try {
    await db.insert(jobUnitEvents).values(
      stockUnitIds.map((stockUnitId) => ({ companyId, jobId, stockUnitId, eventType, actorUserId, note: note ?? null }))
    );
  } catch (err) {
    console.error("logJobUnitEvents failed (non-fatal):", err);
  }
}
