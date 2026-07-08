import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../db";
import { containers, containerUnits, stockUnits, stockItems, jobContainers, jobs, insertContainerSchema, companies } from "@shared/schema";
import { setUnitsOut, setUnitsAvailable } from "../lib/stockUnitStatus";
import { generatePackingSheetPdf } from "../lib/packingSheetPdf";

export const containersRouter = Router();

// GET /api/containers — ดึง containers ทั้งหมดของบริษัท พร้อมของที่อยู่ข้างใน
containersRouter.get("/", async (req, res) => {
  try {
    const result = await db
      .select()
      .from(containers)
      .where(eq(containers.companyId, req.companyId));

    if (result.length === 0) return res.json([]);

    const containerIds = result.map((c) => c.id);

    // หา job ที่ container แต่ละตัวถูก assign อยู่ (ถ้ามี)
    const jobLinks = await db
      .select()
      .from(jobContainers)
      .where(inArray(jobContainers.containerId, containerIds));

    const linkedJobIds = Array.from(new Set(jobLinks.map((l) => l.jobId)));
    const jobRows = linkedJobIds.length
      ? await db.select({ id: jobs.id, name: jobs.name }).from(jobs).where(inArray(jobs.id, linkedJobIds))
      : [];
    const jobNameMap = Object.fromEntries(jobRows.map((j) => [j.id, j.name]));
    const containerJobMap = Object.fromEntries(jobLinks.map((l) => [l.containerId, l.jobId]));

    const withJobInfo = (c: typeof result[number]) => ({
      jobId:   containerJobMap[c.id] ?? null,
      jobName: containerJobMap[c.id] ? (jobNameMap[containerJobMap[c.id]] ?? null) : null,
    });

    const links = await db
      .select()
      .from(containerUnits)
      .where(inArray(containerUnits.containerId, containerIds));

    if (links.length === 0) {
      return res.json(result.map((c) => ({ ...c, ...withJobInfo(c), items: [] })));
    }

    const unitIds = Array.from(new Set(links.map((l) => l.stockUnitId)));
    const units   = await db
      .select()
      .from(stockUnits)
      .where(inArray(stockUnits.id, unitIds));

    const itemIds = Array.from(new Set(units.map((u) => u.stockItemId)));
    const items   = itemIds.length
      ? await db.select({ id: stockItems.id, name: stockItems.name, category: stockItems.category })
          .from(stockItems).where(inArray(stockItems.id, itemIds))
      : [];

    const unitMap = Object.fromEntries(units.map((u) => [u.id, u]));
    const itemMap = Object.fromEntries(items.map((i) => [i.id, i]));

    res.json(result.map((c) => ({
      ...c,
      ...withJobInfo(c),
      items: links
        .filter((l) => l.containerId === c.id)
        .map((l) => unitMap[l.stockUnitId])
        .filter(Boolean)
        .map((u) => ({
          ...u,
          itemName: itemMap[u.stockItemId]?.name ?? "Unknown",
          category: itemMap[u.stockItemId]?.category ?? "Uncategorized",
        })),
    })));
  } catch {
    res.status(500).json({ message: "Failed to fetch containers" });
  }
});

// POST /api/containers — สร้าง container ใหม่
containersRouter.post("/", async (req, res) => {
  try {
    const data = insertContainerSchema.parse({
      ...req.body,
      companyId: req.companyId,
    });

    const [container] = await db.insert(containers).values(data).returning();
    res.status(201).json(container);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/containers/:id — แก้ไขชื่อ/ประเภท/ตำแหน่ง/บาร์โค้ดของ container
containersRouter.put("/:id", async (req, res) => {
  try {
    const [current] = await db
      .select()
      .from(containers)
      .where(and(eq(containers.id, req.params.id), eq(containers.companyId, req.companyId)));
    if (!current) return res.status(404).json({ message: "Container not found" });

    const { name, type, location, barcode } = req.body as {
      name?: string; type?: string; location?: string | null; barcode?: string | null;
    };

    const [updated] = await db
      .update(containers)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(location !== undefined ? { location } : {}),
        ...(barcode !== undefined ? { barcode } : {}),
      })
      .where(eq(containers.id, req.params.id))
      .returning();

    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/containers/packing-sheet/pdf — All-Racks Summary PDF สำหรับบริษัท
containersRouter.get("/packing-sheet/pdf", async (req, res) => {
  try {
    const [company] = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, req.companyId));

    const result = await db
      .select()
      .from(containers)
      .where(eq(containers.companyId, req.companyId));

    const containerIds = result.map((c) => c.id);
    const links = containerIds.length
      ? await db.select().from(containerUnits).where(inArray(containerUnits.containerId, containerIds))
      : [];

    const unitIds = Array.from(new Set(links.map((l) => l.stockUnitId)));
    const units = unitIds.length
      ? await db.select().from(stockUnits).where(inArray(stockUnits.id, unitIds))
      : [];

    const itemIds = Array.from(new Set(units.map((u) => u.stockItemId)));
    const items = itemIds.length
      ? await db.select({ id: stockItems.id, name: stockItems.name, category: stockItems.category })
          .from(stockItems).where(inArray(stockItems.id, itemIds))
      : [];

    const unitMap = Object.fromEntries(units.map((u) => [u.id, u]));
    const itemMap = Object.fromEntries(items.map((i) => [i.id, i]));

    const containersWithItems = result.map((c) => ({
      ...c,
      items: links
        .filter((l) => l.containerId === c.id)
        .map((l) => unitMap[l.stockUnitId])
        .filter(Boolean)
        .map((u) => ({
          ...u,
          itemName: itemMap[u.stockItemId]?.name ?? "Unknown",
          category: itemMap[u.stockItemId]?.category ?? "Uncategorized",
        })),
    }));

    const doc = generatePackingSheetPdf({
      companyName: company?.name ?? "Company",
      containers: containersWithItems,
    });

    const safeName = (company?.name ?? "racks").replace(/[^a-z0-9-_]+/gi, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="packing-sheet-${safeName}.pdf"`);
    doc.pipe(res);
    doc.end();
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to generate packing sheet PDF" });
  }
});

// POST /api/containers/:id/units/add — เพิ่ม unit ชิ้นเดียว (auto-move จาก container อื่น)
containersRouter.post("/:id/units/add", async (req, res) => {
  try {
    const { unitId }: { unitId: string } = req.body;
    if (!unitId) return res.status(400).json({ message: "unitId required" });

    // ตรวจสอบว่า container นี้อยู่ในบริษัทนี้
    const [container] = await db
      .select()
      .from(containers)
      .where(and(eq(containers.id, req.params.id), eq(containers.companyId, req.companyId)));
    if (!container) return res.status(404).json({ message: "Container not found" });

    // ลบออกจาก container อื่น (auto-move)
    await db.delete(containerUnits).where(eq(containerUnits.stockUnitId, unitId));

    // เพิ่มเข้า container นี้
    await db.insert(containerUnits).values({ containerId: req.params.id, stockUnitId: unitId });

    // ถ้า container check out อยู่ → sync สถานะ unit
    if (container.isOut) {
      await setUnitsOut([unitId]);
    }

    res.json({ message: "Unit added" });
  } catch (err: any) {
    res.status(400).json({ message: err?.message ?? "Failed to add unit" });
  }
});

// DELETE /api/containers/:id/units/:unitId — ลบ unit ชิ้นเดียวออกจาก container
containersRouter.delete("/:id/units/:unitId", async (req, res) => {
  try {
    const [container] = await db
      .select()
      .from(containers)
      .where(and(eq(containers.id, req.params.id), eq(containers.companyId, req.companyId)));
    if (!container) return res.status(404).json({ message: "Container not found" });

    await db.delete(containerUnits).where(
      and(
        eq(containerUnits.containerId, req.params.id),
        eq(containerUnits.stockUnitId, req.params.unitId)
      )
    );

    if (container.isOut) {
      await setUnitsAvailable([req.params.unitId]);
    }

    res.json({ message: "Unit removed" });
  } catch {
    res.status(500).json({ message: "Failed to remove unit" });
  }
});

// PUT /api/containers/:id/checkout — toggle check in/out
containersRouter.put("/:id/checkout", async (req, res) => {
  try {
    const [current] = await db
      .select()
      .from(containers)
      .where(and(
        eq(containers.id, req.params.id),
        eq(containers.companyId, req.companyId)
      ));

    if (!current) return res.status(404).json({ message: "Container not found" });

    const nextIsOut = !current.isOut;

    // ถ้ากำลัง check in ให้ล้างการผูกกับ job ด้วย
    if (!nextIsOut) {
      await db.delete(jobContainers).where(eq(jobContainers.containerId, req.params.id));
    }

    const [updated] = await db
      .update(containers)
      .set({ isOut: nextIsOut })
      .where(eq(containers.id, req.params.id))
      .returning();

    // sync สถานะของอุปกรณ์ทุกชิ้นในแร็คนี้ให้ตรงกับสถานะ check out/in ของแร็ค
    const unitLinks = await db
      .select({ stockUnitId: containerUnits.stockUnitId })
      .from(containerUnits)
      .where(eq(containerUnits.containerId, req.params.id));
    const unitIds = unitLinks.map((l) => l.stockUnitId);

    if (nextIsOut) {
      await setUnitsOut(unitIds);
    } else {
      await setUnitsAvailable(unitIds);
    }

    res.json(updated);
  } catch {
    res.status(500).json({ message: "Failed to update container" });
  }
});

// POST /api/containers/:id/units — set ของที่อยู่ใน container นี้ (replace ทั้งหมด)
// unit ที่เลือกจะถูกย้ายออกจาก container เดิม (ถ้ามี) มาอยู่ใน container นี้แทน
containersRouter.post("/:id/units", async (req, res) => {
  try {
    const { unitIds }: { unitIds: string[] } = req.body;

    if (unitIds && unitIds.length > 0) {
      await db.delete(containerUnits).where(inArray(containerUnits.stockUnitId, unitIds));
    }
    await db.delete(containerUnits).where(eq(containerUnits.containerId, req.params.id));

    if (unitIds && unitIds.length > 0) {
      await db.insert(containerUnits).values(
        unitIds.map((uid) => ({ containerId: req.params.id, stockUnitId: uid }))
      );
    }

    res.json({ message: "Units updated" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/containers/:id — ลบ container (Admin/Manager เท่านั้น)
containersRouter.delete("/:id", async (req, res) => {
  if (req.userRole !== "admin" && req.userRole !== "manager") {
    return res.status(403).json({ message: "เฉพาะ Admin และ Manager เท่านั้น" });
  }

  try {
    const [current] = await db
      .select()
      .from(containers)
      .where(and(
        eq(containers.id, req.params.id),
        eq(containers.companyId, req.companyId)
      ));

    if (!current) return res.status(404).json({ message: "Container not found" });

    // ป้องกันการลบแร็คที่ยังอยู่ในงาน
    const [jobLink] = await db
      .select({ jobId: jobContainers.jobId })
      .from(jobContainers)
      .where(eq(jobContainers.containerId, req.params.id))
      .limit(1);
    if (jobLink) {
      return res.status(409).json({ message: "ไม่สามารถลบได้: แร็คนี้ยังอยู่ในงาน กรุณานำออกจากงานก่อน" });
    }

    // ถ้าแร็คเช็คเอาท์อยู่ — คืนสถานะอุปกรณ์ข้างในเป็น "พร้อมใช้งาน" ก่อนลบ
    if (current.isOut) {
      const unitLinks = await db
        .select({ stockUnitId: containerUnits.stockUnitId })
        .from(containerUnits)
        .where(eq(containerUnits.containerId, req.params.id));
      await setUnitsAvailable(unitLinks.map((l) => l.stockUnitId));
    }

    await db.delete(containers).where(eq(containers.id, req.params.id));

    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ message: "Failed to delete container" });
  }
});
