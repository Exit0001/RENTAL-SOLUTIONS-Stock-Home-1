import { db } from "../db";
import { jobUnitEvents } from "@shared/schema";

// บันทึกประวัติการเปลี่ยนแปลงอุปกรณ์ต่องาน — ใช้ตรวจจับของกลับก่อนกำหนด/เพิ่มเข้ามาทีหลัง
export async function logJobUnitEvents(
  companyId: string,
  jobId: string,
  stockUnitIds: string[],
  eventType: "added" | "removed" | "dispatched" | "returned",
  actorUserId: string | null,
  note?: string | null,
) {
  if (stockUnitIds.length === 0) return;
  await db.insert(jobUnitEvents).values(
    stockUnitIds.map((stockUnitId) => ({ companyId, jobId, stockUnitId, eventType, actorUserId, note: note ?? null }))
  );
}
