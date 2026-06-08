import { Router } from "express";
import { eq, and, gte, sql, count, avg } from "drizzle-orm";
import { db } from "../db";
import { stockItems, stockUnits, invoices, maintenanceLogs } from "@shared/schema";

export const analyticsRouter = Router();

// GET /api/analytics — ข้อมูล analytics สำหรับหน้า History
analyticsRouter.get("/", async (req, res) => {
  try {
    const cid = req.companyId;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [
      unitsByCategory,
      healthData,
      monthlyRevenue,
      maintenanceStats,
    ] = await Promise.all([

      // utilization by category: count units per category
      db.select({
        category:   stockItems.category,
        total:      count(stockUnits.id),
        outCount:   sql<number>`count(case when ${stockUnits.status} = 'out' then 1 end)`,
      })
      .from(stockItems)
      .leftJoin(stockUnits, eq(stockItems.id, stockUnits.stockItemId))
      .where(eq(stockItems.companyId, cid))
      .groupBy(stockItems.category),

      // fleet health: average health score
      db.select({ avgHealth: avg(stockUnits.healthScore) })
        .from(stockUnits)
        .where(eq(stockUnits.companyId, cid)),

      // revenue trend: monthly for last 6 months
      db.select({
        month:   sql<string>`to_char(${invoices.issuedDate}, 'Mon')`,
        revenue: sql<number>`sum(${invoices.amount}::numeric)`,
      })
      .from(invoices)
      .where(and(
        eq(invoices.companyId, cid),
        eq(invoices.status, "paid"),
        gte(invoices.issuedDate, sixMonthsAgo),
      ))
      .groupBy(sql`to_char(${invoices.issuedDate}, 'Mon'), date_trunc('month', ${invoices.issuedDate})`)
      .orderBy(sql`date_trunc('month', ${invoices.issuedDate})`),

      // maintenance stats
      db.select({ status: maintenanceLogs.status, count: count() })
        .from(maintenanceLogs)
        .where(eq(maintenanceLogs.companyId, cid))
        .groupBy(maintenanceLogs.status),
    ]);

    // คำนวณ utilization % ต่อ category
    const utilizationData = unitsByCategory.map((cat) => ({
      category: cat.category,
      pct: cat.total > 0 ? Math.round((Number(cat.outCount) / Number(cat.total)) * 100) : 0,
    }));

    const avgHealth = Number(healthData[0]?.avgHealth ?? 100);
    const atRisk = unitsByCategory.reduce((sum, c) => sum + Number(c.outCount ?? 0), 0);

    const inProgress = maintenanceStats.find(m => m.status === "in_progress")?.count ?? 0;

    res.json({
      utilizationData,
      healthMetrics: {
        overall: Math.round(avgHealth),
        atRisk,
        maintenanceInProgress: inProgress,
      },
      revenueMonths: monthlyRevenue.map(r => ({
        month:   r.month,
        revenue: Number(r.revenue ?? 0),
        profit:  Math.round(Number(r.revenue ?? 0) * 0.6), // estimate 60% margin
      })),
    });
  } catch {
    res.status(500).json({ message: "Failed to fetch analytics" });
  }
});
