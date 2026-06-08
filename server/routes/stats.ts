import { Router } from "express";
import { eq, and, count, sum } from "drizzle-orm";
import { db } from "../db";
import { stockItems, stockUnits, jobs, maintenanceLogs, invoices, activityLog } from "@shared/schema";

export const statsRouter = Router();

// GET /api/stats — KPI สำหรับหน้า Home
statsRouter.get("/", async (req, res) => {
  try {
    const cid = req.companyId;

    const [
      [assetRow],
      [activeJobRow],
      [maintRow],
      [revenueRow],
      recentActivity,
    ] = await Promise.all([
      // จำนวน stock units ทั้งหมด
      db.select({ total: count() }).from(stockUnits).where(eq(stockUnits.companyId, cid)),

      // งานที่กำลัง active
      db.select({ total: count() }).from(jobs)
        .where(and(eq(jobs.companyId, cid), eq(jobs.status, "active"))),

      // อุปกรณ์ที่ซ่อมอยู่
      db.select({ total: count() }).from(maintenanceLogs)
        .where(and(eq(maintenanceLogs.companyId, cid), eq(maintenanceLogs.status, "in_progress"))),

      // รายได้เดือนนี้ (invoices ที่ paid)
      db.select({ total: sum(invoices.amount) }).from(invoices)
        .where(and(eq(invoices.companyId, cid), eq(invoices.status, "paid"))),

      // activity ล่าสุด 6 รายการ (สำหรับ notifications)
      db.select().from(activityLog)
        .where(eq(activityLog.companyId, cid))
        .orderBy(activityLog.createdAt)
        .limit(6),
    ]);

    res.json({
      totalAssets:    assetRow?.total  ?? 0,
      activeJobs:     activeJobRow?.total ?? 0,
      inMaintenance:  maintRow?.total  ?? 0,
      monthlyRevenue: revenueRow?.total ?? "0",
      recentActivity,
    });
  } catch {
    res.status(500).json({ message: "Failed to fetch stats" });
  }
});
