import { Router } from "express";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { db } from "../db";
import {
  jobTemplates, jobTemplateItems, jobs, jobStock, jobUnits,
  stockItems, stockUnits, pullSheets, insertJobSchema,
} from "@shared/schema";

export const jobTemplatesRouter = Router();

// GET /api/job-templates — รายการเทมเพลตพร้อมจำนวนรายการ/ชิ้นรวม
jobTemplatesRouter.get("/", async (req, res) => {
  try {
    const temps = await db.select().from(jobTemplates)
      .where(eq(jobTemplates.companyId, req.companyId))
      .orderBy(desc(jobTemplates.createdAt));

    if (temps.length === 0) return res.json([]);

    const counts = await db
      .select({
        templateId: jobTemplateItems.templateId,
        itemCount:  sql<number>`count(*)::int`,
        totalQty:   sql<number>`coalesce(sum(${jobTemplateItems.quantity}),0)::int`,
      })
      .from(jobTemplateItems)
      .where(inArray(jobTemplateItems.templateId, temps.map((t) => t.id)))
      .groupBy(jobTemplateItems.templateId);
    const countMap = Object.fromEntries(counts.map((c) => [c.templateId, c]));

    res.json(temps.map((t) => ({
      ...t,
      itemCount: countMap[t.id]?.itemCount ?? 0,
      totalQty:  countMap[t.id]?.totalQty ?? 0,
    })));
  } catch {
    res.status(500).json({ message: "Failed to fetch job templates" });
  }
});

// GET /api/job-templates/:id — เทมเพลตเดียวพร้อมรายการอุปกรณ์ (พร้อมชื่อ item)
jobTemplatesRouter.get("/:id", async (req, res) => {
  try {
    const [tpl] = await db.select().from(jobTemplates)
      .where(and(eq(jobTemplates.id, req.params.id), eq(jobTemplates.companyId, req.companyId)));
    if (!tpl) return res.status(404).json({ message: "ไม่พบเทมเพลต" });

    const items = await db.select().from(jobTemplateItems).where(eq(jobTemplateItems.templateId, tpl.id));
    const itemIds = items.map((i) => i.stockItemId);
    const names = itemIds.length
      ? await db.select({ id: stockItems.id, name: stockItems.name, trackingMode: stockItems.trackingMode })
          .from(stockItems).where(inArray(stockItems.id, itemIds))
      : [];
    const nameMap = Object.fromEntries(names.map((n) => [n.id, n]));

    res.json({
      ...tpl,
      items: items.map((i) => ({
        ...i,
        itemName:     nameMap[i.stockItemId]?.name ?? "Unknown",
        trackingMode: nameMap[i.stockItemId]?.trackingMode ?? "unit",
      })),
    });
  } catch {
    res.status(500).json({ message: "Failed to fetch job template" });
  }
});

// POST /api/job-templates — สร้างเทมเพลตจากรายการที่ส่งมา
jobTemplatesRouter.post("/", async (req, res) => {
  try {
    const { name, notes, items } = req.body ?? {};
    if (typeof name !== "string" || !name.trim())
      return res.status(400).json({ message: "ต้องระบุชื่อเทมเพลต" });

    const [tpl] = await db.insert(jobTemplates)
      .values({ companyId: req.companyId, name: name.trim(), notes: notes?.trim() || null })
      .returning();

    const rows = (Array.isArray(items) ? items : [])
      .filter((i: any) => i?.stockItemId && Number(i.quantity) > 0)
      .map((i: any) => ({ templateId: tpl.id, stockItemId: i.stockItemId, quantity: Number(i.quantity) }));
    if (rows.length) await db.insert(jobTemplateItems).values(rows);

    res.status(201).json(tpl);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/job-templates/from-job/:jobId — บันทึกอุปกรณ์ของงานที่มีอยู่เป็นเทมเพลต (ระดับ item)
jobTemplatesRouter.post("/from-job/:jobId", async (req, res) => {
  try {
    const { name, notes } = req.body ?? {};
    if (typeof name !== "string" || !name.trim())
      return res.status(400).json({ message: "ต้องระบุชื่อเทมเพลต" });

    const [job] = await db.select().from(jobs)
      .where(and(eq(jobs.id, req.params.jobId), eq(jobs.companyId, req.companyId)));
    if (!job) return res.status(404).json({ message: "ไม่พบงานต้นฉบับ" });

    // นับ unit ต่อ stock item (จาก job_units) + รวมกับ bulk (job_stock)
    const [assignedUnits, bulk] = await Promise.all([
      db.select().from(jobUnits).where(eq(jobUnits.jobId, job.id)),
      db.select().from(jobStock).where(eq(jobStock.jobId, job.id)),
    ]);

    const qtyByItem: Record<string, number> = {};
    if (assignedUnits.length) {
      const unitIds = assignedUnits.map((u) => u.stockUnitId);
      const units = await db.select({ id: stockUnits.id, stockItemId: stockUnits.stockItemId })
        .from(stockUnits).where(inArray(stockUnits.id, unitIds));
      for (const u of units) qtyByItem[u.stockItemId] = (qtyByItem[u.stockItemId] ?? 0) + 1;
    }
    for (const b of bulk) qtyByItem[b.stockItemId] = (qtyByItem[b.stockItemId] ?? 0) + b.quantity;

    const [tpl] = await db.insert(jobTemplates)
      .values({ companyId: req.companyId, name: name.trim(), notes: notes?.trim() || null })
      .returning();

    const rows = Object.entries(qtyByItem)
      .filter(([, qty]) => qty > 0)
      .map(([stockItemId, quantity]) => ({ templateId: tpl.id, stockItemId, quantity }));
    if (rows.length) await db.insert(jobTemplateItems).values(rows);

    res.status(201).json({ ...tpl, itemCount: rows.length });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/job-templates/:id
jobTemplatesRouter.delete("/:id", async (req, res) => {
  try {
    await db.delete(jobTemplates)
      .where(and(eq(jobTemplates.id, req.params.id), eq(jobTemplates.companyId, req.companyId)));
    res.json({ message: "ลบเทมเพลตแล้ว" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/job-templates/:id/create-job — สร้างงานใหม่จากเทมเพลต + auto-assign อุปกรณ์ที่ว่าง
jobTemplatesRouter.post("/:id/create-job", async (req, res) => {
  try {
    const [tpl] = await db.select().from(jobTemplates)
      .where(and(eq(jobTemplates.id, req.params.id), eq(jobTemplates.companyId, req.companyId)));
    if (!tpl) return res.status(404).json({ message: "ไม่พบเทมเพลต" });

    const data = insertJobSchema.parse({
      ...req.body,
      companyId:     req.companyId,
      rehearsalDate: req.body.rehearsalDate ? new Date(req.body.rehearsalDate) : null,
      startDate:     new Date(req.body.startDate),
      endDate:       new Date(req.body.endDate),
    });
    const [job] = await db.insert(jobs).values(data).returning();

    // ดึงรายการ template + trackingMode ของแต่ละ item
    const tItems = await db.select().from(jobTemplateItems).where(eq(jobTemplateItems.templateId, tpl.id));
    const itemIds = tItems.map((i) => i.stockItemId);
    const modes = itemIds.length
      ? await db.select({ id: stockItems.id, trackingMode: stockItems.trackingMode })
          .from(stockItems).where(inArray(stockItems.id, itemIds))
      : [];
    const modeMap = Object.fromEntries(modes.map((m) => [m.id, m.trackingMode]));

    const bulkRows: { jobId: string; stockItemId: string; quantity: number }[] = [];
    const unitRows: { jobId: string; stockUnitId: string; phase: "planned" }[] = [];
    const shortfall: { stockItemId: string; wanted: number; got: number }[] = [];

    for (const it of tItems) {
      if (modeMap[it.stockItemId] === "bulk") {
        bulkRows.push({ jobId: job.id, stockItemId: it.stockItemId, quantity: it.quantity });
      } else {
        // เลือก unit ที่ว่างสูงสุด quantity ชิ้น (ไม่แตะ status ตาม Sync Contract)
        const avail = await db.select({ id: stockUnits.id }).from(stockUnits)
          .where(and(
            eq(stockUnits.companyId, req.companyId),
            eq(stockUnits.stockItemId, it.stockItemId),
            eq(stockUnits.status, "available"),
          ))
          .limit(it.quantity);
        for (const u of avail) unitRows.push({ jobId: job.id, stockUnitId: u.id, phase: "planned" });
        if (avail.length < it.quantity)
          shortfall.push({ stockItemId: it.stockItemId, wanted: it.quantity, got: avail.length });
      }
    }

    if (bulkRows.length) await db.insert(jobStock).values(bulkRows);
    if (unitRows.length) await db.insert(jobUnits).values(unitRows);

    // scheduled → สร้าง pull sheet draft ให้อัตโนมัติ (ถ้ายังไม่มี)
    if (job.status === "scheduled") {
      const [existing] = await db.select({ id: pullSheets.id }).from(pullSheets).where(eq(pullSheets.jobId, job.id));
      if (!existing) await db.insert(pullSheets).values({ jobId: job.id, companyId: req.companyId, createdById: req.userId, status: "draft" });
    }

    res.status(201).json({ ...job, shortfall });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});
