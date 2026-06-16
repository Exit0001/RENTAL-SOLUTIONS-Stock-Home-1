import { eq, and, inArray, ne } from "drizzle-orm";
import { db } from "../db";
import { stockUnits, maintenanceLogs } from "@shared/schema";

// ของออกงาน — เซ็ต unit ที่ "available" ให้เป็น "out" (ไม่แตะ unit ที่กำลังซ่อมหรือ retired)
export async function setUnitsOut(stockUnitIds: string[]) {
  if (stockUnitIds.length === 0) return;
  await db
    .update(stockUnits)
    .set({ status: "out" })
    .where(and(inArray(stockUnits.id, stockUnitIds), eq(stockUnits.status, "available")));
}

// เช็คอินของกลับคลัง — เซ็ต unit ที่ "out" ให้กลับเป็น "available"
export async function setUnitsAvailable(stockUnitIds: string[]) {
  if (stockUnitIds.length === 0) return;
  await db
    .update(stockUnits)
    .set({ status: "available" })
    .where(and(inArray(stockUnits.id, stockUnitIds), eq(stockUnits.status, "out")));
}

// เปิดบันทึกซ่อมบำรุง — เซ็ต unit เป็น "maintenance" (ไม่แตะ unit ที่ retired)
export async function markUnitsInMaintenance(stockUnitIds: string[]) {
  if (stockUnitIds.length === 0) return;
  await db
    .update(stockUnits)
    .set({ status: "maintenance" })
    .where(and(inArray(stockUnits.id, stockUnitIds), ne(stockUnits.status, "retired")));
}

// ปิดบันทึกซ่อมบำรุง (เสร็จ/ลบ) — คืน unit เป็น "available" ถ้าไม่มีบันทึกซ่อมที่ยัง in_progress เหลืออยู่
export async function revertUnitIfNoOpenMaintenance(stockUnitId: string) {
  const [openLog] = await db
    .select({ id: maintenanceLogs.id })
    .from(maintenanceLogs)
    .where(and(eq(maintenanceLogs.stockUnitId, stockUnitId), eq(maintenanceLogs.status, "in_progress")));

  if (!openLog) {
    await db
      .update(stockUnits)
      .set({ status: "available" })
      .where(and(eq(stockUnits.id, stockUnitId), eq(stockUnits.status, "maintenance")));
  }
}
