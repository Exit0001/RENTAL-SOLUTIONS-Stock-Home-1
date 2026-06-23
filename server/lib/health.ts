import { eq } from "drizzle-orm";
import { db } from "../db";
import { stockUnits, incidents, maintenanceLogs } from "@shared/schema";

const INCIDENT_PENALTY = {
  open:     { high: 25, medium: 15, low: 5 },
  resolved: { high: 10, medium: 5,  low: 2 },
} as const;

// คำนวณ health score ของ stock unit ใหม่ทั้งหมด จาก incident + maintenance history ของ unit นั้น
export async function recalculateUnitHealth(stockUnitId: string) {
  const [unitIncidents, unitMaintenance] = await Promise.all([
    db.select({ severity: incidents.severity, status: incidents.status })
      .from(incidents).where(eq(incidents.stockUnitId, stockUnitId)),
    db.select({ type: maintenanceLogs.type, status: maintenanceLogs.status })
      .from(maintenanceLogs).where(eq(maintenanceLogs.stockUnitId, stockUnitId)),
  ]);

  let score = 100;
  for (const inc of unitIncidents) {
    score -= inc.status === "open" ? INCIDENT_PENALTY.open[inc.severity] : INCIDENT_PENALTY.resolved[inc.severity];
  }
  for (const log of unitMaintenance) {
    if (log.status === "in_progress") score -= 10;
    else if (log.type === "repair") score -= 8;
  }
  score = Math.max(0, Math.min(100, score));

  await db.update(stockUnits).set({ healthScore: score }).where(eq(stockUnits.id, stockUnitId));
}
