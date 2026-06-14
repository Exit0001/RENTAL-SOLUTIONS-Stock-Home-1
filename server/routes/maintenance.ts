import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db";
import { maintenanceLogs, subRentals, insertMaintenanceLogBatchSchema } from "@shared/schema";

export const maintenanceRouter = Router();

// ─── Maintenance Logs ─────────────────────────────────────

// GET /api/maintenance
maintenanceRouter.get("/", async (req, res) => {
  try {
    const result = await db
      .select()
      .from(maintenanceLogs)
      .where(eq(maintenanceLogs.companyId, req.companyId))
      .orderBy(desc(maintenanceLogs.date));
    res.json(result);
  } catch {
    res.status(500).json({ message: "Failed to fetch maintenance logs" });
  }
});

// POST /api/maintenance/batch — บันทึกการซ่อมหลายชิ้นพร้อมกัน
maintenanceRouter.post("/batch", async (req, res) => {
  try {
    const { stockUnitIds, ...rest } = insertMaintenanceLogBatchSchema.parse(req.body);

    const uniqueIds = Array.from(new Set(stockUnitIds));
    const targetIds: (string | null)[] = uniqueIds.length > 0 ? uniqueIds : [null];

    const rows = targetIds.map((stockUnitId) => ({
      ...rest,
      stockUnitId,
      companyId: req.companyId,
    }));

    const logs = await db.insert(maintenanceLogs).values(rows).returning();
    res.status(201).json(logs);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/maintenance/:id — อัปเดต status (in_progress → completed)
maintenanceRouter.put("/:id", async (req, res) => {
  try {
    const [log] = await db
      .update(maintenanceLogs)
      .set(req.body)
      .where(and(
        eq(maintenanceLogs.id, req.params.id),
        eq(maintenanceLogs.companyId, req.companyId)
      ))
      .returning();

    if (!log) return res.status(404).json({ message: "Log not found" });
    res.json(log);
  } catch {
    res.status(500).json({ message: "Failed to update maintenance log" });
  }
});

// ─── Sub Rentals ──────────────────────────────────────────

// GET /api/maintenance/subrentals
maintenanceRouter.get("/subrentals", async (req, res) => {
  try {
    const result = await db
      .select()
      .from(subRentals)
      .where(eq(subRentals.companyId, req.companyId))
      .orderBy(desc(subRentals.dueBack));
    res.json(result);
  } catch {
    res.status(500).json({ message: "Failed to fetch sub-rentals" });
  }
});

// POST /api/maintenance/subrentals
maintenanceRouter.post("/subrentals", async (req, res) => {
  try {
    const [rental] = await db
      .insert(subRentals)
      .values({ ...req.body, companyId: req.companyId })
      .returning();
    res.status(201).json(rental);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});
