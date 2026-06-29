import { Router } from "express";
import { eq, and, desc, inArray } from "drizzle-orm";
import { db } from "../db";
import { maintenanceLogs, subRentals, insertMaintenanceLogBatchSchema } from "@shared/schema";
import { notify } from "../lib/notify";
import { markUnitsInMaintenance, revertUnitIfNoOpenMaintenance } from "../lib/stockUnitStatus";
import { recalculateUnitHealth } from "../lib/health";

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

    // อุปกรณ์ที่กำลังซ่อม (in_progress) — sync สถานะเป็น "maintenance"
    const inProgressUnitIds = logs
      .filter((l) => l.status === "in_progress" && l.stockUnitId)
      .map((l) => l.stockUnitId as string);
    await markUnitsInMaintenance(inProgressUnitIds);

    // คำนวณ health score ใหม่ของทุก unit ที่มีบันทึกซ่อมเพิ่มมา
    const affectedUnitIds = Array.from(new Set(logs.filter((l) => l.stockUnitId).map((l) => l.stockUnitId as string)));
    await Promise.all(affectedUnitIds.map(recalculateUnitHealth));

    // แจ้งเตือนช่างที่ถูก assign งานซ่อมบำรุง
    const techCounts = new Map<string, number>();
    for (const log of logs) {
      if (log.techId) techCounts.set(log.techId, (techCounts.get(log.techId) ?? 0) + 1);
    }
    for (const [techId, taskCount] of Array.from(techCounts.entries())) {
      await notify({
        companyId: req.companyId,
        userIds: [techId],
        actorId: req.userId,
        type: "maintenance_assigned",
        meta: { count: taskCount },
        link: "Maintenance",
      });
    }

    res.status(201).json(logs);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/maintenance/batch-status — เปลี่ยนสถานะหลายรายการพร้อมกัน
maintenanceRouter.put("/batch-status", async (req, res) => {
  try {
    const { ids, status } = req.body as { ids: string[]; status: "in_progress" | "completed" };
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "ids required" });
    }

    const before = await db
      .select({ id: maintenanceLogs.id, status: maintenanceLogs.status, stockUnitId: maintenanceLogs.stockUnitId })
      .from(maintenanceLogs)
      .where(and(inArray(maintenanceLogs.id, ids), eq(maintenanceLogs.companyId, req.companyId)));
    const beforeStatusById = new Map(before.map((l) => [l.id, l.status]));

    const updated = await db
      .update(maintenanceLogs)
      .set({ status })
      .where(and(inArray(maintenanceLogs.id, ids), eq(maintenanceLogs.companyId, req.companyId)))
      .returning();

    // sync สถานะอุปกรณ์ของแต่ละรายการที่สถานะเปลี่ยนจริง
    if (status === "completed") {
      for (const log of updated) {
        if (log.stockUnitId && beforeStatusById.get(log.id) !== "completed") {
          await revertUnitIfNoOpenMaintenance(log.stockUnitId);
        }
      }
    } else if (status === "in_progress") {
      const unitIds = updated
        .filter((l) => l.stockUnitId && beforeStatusById.get(l.id) !== "in_progress")
        .map((l) => l.stockUnitId as string);
      await markUnitsInMaintenance(unitIds);
    }

    const affectedUnitIds = Array.from(new Set(updated.filter((l) => l.stockUnitId).map((l) => l.stockUnitId as string)));
    await Promise.all(affectedUnitIds.map(recalculateUnitHealth));

    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/maintenance/batch — ลบหลายรายการพร้อมกัน (Admin/Manager เท่านั้น)
maintenanceRouter.delete("/batch", async (req, res) => {
  if (req.userRole !== "admin" && req.userRole !== "manager") {
    return res.status(403).json({ message: "เฉพาะ Admin และ Manager เท่านั้น" });
  }

  try {
    const { ids } = req.body as { ids: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "ids required" });
    }

    const deleted = await db
      .delete(maintenanceLogs)
      .where(and(inArray(maintenanceLogs.id, ids), eq(maintenanceLogs.companyId, req.companyId)))
      .returning();

    for (const log of deleted) {
      if (log.status === "in_progress" && log.stockUnitId) {
        await revertUnitIfNoOpenMaintenance(log.stockUnitId);
      }
    }

    const affectedUnitIds = Array.from(new Set(deleted.filter((l) => l.stockUnitId).map((l) => l.stockUnitId as string)));
    await Promise.all(affectedUnitIds.map(recalculateUnitHealth));

    res.json({ message: "Maintenance logs deleted", count: deleted.length });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete maintenance logs" });
  }
});

// PUT /api/maintenance/:id — อัปเดต status (in_progress → completed)
maintenanceRouter.put("/:id", async (req, res) => {
  try {
    const [before] = await db
      .select()
      .from(maintenanceLogs)
      .where(and(eq(maintenanceLogs.id, req.params.id), eq(maintenanceLogs.companyId, req.companyId)));

    if (!before) return res.status(404).json({ message: "Log not found" });

    const [log] = await db
      .update(maintenanceLogs)
      .set(req.body)
      .where(and(
        eq(maintenanceLogs.id, req.params.id),
        eq(maintenanceLogs.companyId, req.companyId)
      ))
      .returning();

    // sync สถานะอุปกรณ์ตามการเปลี่ยนสถานะงานซ่อม
    if (log.stockUnitId && log.status !== before.status) {
      if (log.status === "completed") {
        await revertUnitIfNoOpenMaintenance(log.stockUnitId);
      } else if (log.status === "in_progress") {
        await markUnitsInMaintenance([log.stockUnitId]);
      }
    }

    if (log.stockUnitId) await recalculateUnitHealth(log.stockUnitId);

    res.json(log);
  } catch {
    res.status(500).json({ message: "Failed to update maintenance log" });
  }
});

// DELETE /api/maintenance/:id — ลบบันทึกซ่อมบำรุง (Admin/Manager เท่านั้น)
maintenanceRouter.delete("/:id", async (req, res) => {
  if (req.userRole !== "admin" && req.userRole !== "manager") {
    return res.status(403).json({ message: "เฉพาะ Admin และ Manager เท่านั้น" });
  }

  try {
    const [deleted] = await db
      .delete(maintenanceLogs)
      .where(and(
        eq(maintenanceLogs.id, req.params.id),
        eq(maintenanceLogs.companyId, req.companyId)
      ))
      .returning();

    if (!deleted) return res.status(404).json({ message: "Log not found" });

    // ลบบันทึกซ่อมที่ยังเปิดอยู่ — คืนสถานะอุปกรณ์ถ้าไม่มีบันทึกซ่อมอื่นเหลืออยู่
    if (deleted.status === "in_progress" && deleted.stockUnitId) {
      await revertUnitIfNoOpenMaintenance(deleted.stockUnitId);
    }

    if (deleted.stockUnitId) await recalculateUnitHealth(deleted.stockUnitId);

    res.json({ message: "Maintenance log deleted" });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete maintenance log" });
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
      .values({ ...req.body, dueBack: new Date(req.body.dueBack), companyId: req.companyId })
      .returning();
    res.status(201).json(rental);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/maintenance/subrentals/:id — เปลี่ยนสถานะ (เช่น คืนของแล้ว)
maintenanceRouter.put("/subrentals/:id", async (req, res) => {
  try {
    const [rental] = await db
      .update(subRentals)
      .set(req.body)
      .where(and(eq(subRentals.id, req.params.id), eq(subRentals.companyId, req.companyId)))
      .returning();

    if (!rental) return res.status(404).json({ message: "Sub-rental not found" });
    res.json(rental);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to update sub-rental" });
  }
});
