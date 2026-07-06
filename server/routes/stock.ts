import { Router } from "express";
import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { stockItems, stockUnits, containers, containerUnits, users, itemAccessories, jobUnits, jobStock, jobs, insertStockItemSchema, insertStockUnitSchema } from "@shared/schema";
import { notifyCompany } from "../lib/notify";

export const stockRouter = Router();

// ─── Stock Items (หมวดหมู่อุปกรณ์) ───────────────────────

// GET /api/stock — ดึงรายการทั้งหมดพร้อม unitCount + availableCount จาก stock_units
stockRouter.get("/", async (req, res) => {
  try {
    const items = await db
      .select()
      .from(stockItems)
      .where(eq(stockItems.companyId, req.companyId));

    if (items.length === 0) return res.json([]);

    const itemIds   = items.map((i) => i.id);
    const unitItemIds = items.filter((i) => i.trackingMode === "unit").map((i) => i.id);
    const bulkItemIds = items.filter((i) => i.trackingMode === "bulk").map((i) => i.id);

    // Unit items — count individual stock_units as before
    const totalCounts     = new Map<string, number>();
    const availableCounts = new Map<string, number>();

    if (unitItemIds.length > 0) {
      const units = await db
        .select({ id: stockUnits.id, stockItemId: stockUnits.stockItemId, status: stockUnits.status })
        .from(stockUnits)
        .where(inArray(stockUnits.stockItemId, unitItemIds));

      for (const u of units) {
        totalCounts.set(u.stockItemId, (totalCounts.get(u.stockItemId) ?? 0) + 1);
        if (u.status === "available") {
          availableCounts.set(u.stockItemId, (availableCounts.get(u.stockItemId) ?? 0) + 1);
        }
      }
    }

    // Bulk items — availableCount = quantity - SUM(assigned to active jobs)
    if (bulkItemIds.length > 0) {
      const assigned = await db
        .select({
          stockItemId: jobStock.stockItemId,
          total: sql<number>`COALESCE(SUM(${jobStock.quantity}), 0)`.mapWith(Number),
        })
        .from(jobStock)
        .innerJoin(jobs, eq(jobs.id, jobStock.jobId))
        .where(and(
          inArray(jobStock.stockItemId, bulkItemIds),
          inArray(jobs.status, ["draft", "scheduled", "active"]),
        ))
        .groupBy(jobStock.stockItemId);

      const assignedMap = new Map(assigned.map((r) => [r.stockItemId, r.total]));

      for (const item of items.filter((i) => i.trackingMode === "bulk")) {
        const used = assignedMap.get(item.id) ?? 0;
        totalCounts.set(item.id, item.quantity);
        availableCounts.set(item.id, Math.max(0, item.quantity - used));
      }
    }

    res.json(items.map((i) => ({
      ...i,
      unitCount:      totalCounts.get(i.id)     ?? 0,
      availableCount: availableCounts.get(i.id) ?? 0,
    })));
  } catch {
    res.status(500).json({ message: "Failed to fetch stock items" });
  }
});

// GET /api/stock/all-with-units — stock items ทั้งหมดพร้อม units nested (ใช้ใน job stock picker)
stockRouter.get("/all-with-units", async (req, res) => {
  try {
    const items = await db
      .select()
      .from(stockItems)
      .where(eq(stockItems.companyId, req.companyId));

    if (items.length === 0) return res.json([]);

    const allUnits = await db
      .select()
      .from(stockUnits)
      .where(inArray(stockUnits.stockItemId, items.map((i) => i.id)));

    const unitsByItem: Record<string, typeof allUnits> = {};
    for (const u of allUnits) {
      if (!unitsByItem[u.stockItemId]) unitsByItem[u.stockItemId] = [];
      unitsByItem[u.stockItemId].push(u);
    }

    // Compute availableCount for bulk items
    const bulkIds = items.filter((i) => i.trackingMode === "bulk").map((i) => i.id);
    const bulkAvailMap = new Map<string, number>();
    if (bulkIds.length > 0) {
      const assigned = await db
        .select({
          stockItemId: jobStock.stockItemId,
          total: sql<number>`COALESCE(SUM(${jobStock.quantity}), 0)`.mapWith(Number),
        })
        .from(jobStock)
        .innerJoin(jobs, eq(jobs.id, jobStock.jobId))
        .where(and(
          inArray(jobStock.stockItemId, bulkIds),
          inArray(jobs.status, ["draft", "scheduled", "active"]),
        ))
        .groupBy(jobStock.stockItemId);
      for (const row of assigned) {
        bulkAvailMap.set(row.stockItemId, row.total);
      }
    }

    res.json(items.map((item) => {
      const itemUnits = unitsByItem[item.id] ?? [];
      const availableCount = item.trackingMode === "bulk"
        ? (item.quantity ?? 0) - (bulkAvailMap.get(item.id) ?? 0)
        : itemUnits.filter((u) => u.status === "available").length;
      return { ...item, units: itemUnits, availableCount };
    }));
  } catch {
    res.status(500).json({ message: "Failed to fetch stock with units" });
  }
});

// GET /api/stock/units/scan/:barcode — ค้นหา unit ด้วย barcode/RFID (ต้องอยู่ก่อน /:id)
stockRouter.get("/units/scan/:barcode", async (req, res) => {
  try {
    const [unit] = await db
      .select()
      .from(stockUnits)
      .where(and(
        eq(stockUnits.barcode, req.params.barcode),
        eq(stockUnits.companyId, req.companyId)
      ));

    if (!unit) return res.status(404).json({ message: `ไม่พบอุปกรณ์ barcode: ${req.params.barcode}` });

    const [item] = await db
      .select({ name: stockItems.name, category: stockItems.category })
      .from(stockItems)
      .where(eq(stockItems.id, unit.stockItemId));

    res.json({ ...unit, itemName: item?.name ?? "Unknown", category: item?.category ?? "" });
  } catch {
    res.status(500).json({ message: "Scan failed" });
  }
});

// GET /api/stock/:id — ดึง item เดียวพร้อม units
stockRouter.get("/:id", async (req, res) => {
  try {
    const [item] = await db
      .select()
      .from(stockItems)
      .where(and(
        eq(stockItems.id, req.params.id),
        eq(stockItems.companyId, req.companyId)
      ));

    if (!item) return res.status(404).json({ message: "Item not found" });

    const units = await db
      .select()
      .from(stockUnits)
      .where(eq(stockUnits.stockItemId, item.id));

    const unitIds = units.map((u) => u.id);

    // หาว่า unit ไหนอยู่ใน rack/container ไหนบ้าง
    const links = unitIds.length
      ? await db.select().from(containerUnits).where(inArray(containerUnits.stockUnitId, unitIds))
      : [];

    const containerIds = Array.from(new Set(links.map((l) => l.containerId)));
    const containerRows = containerIds.length
      ? await db.select({ id: containers.id, name: containers.name, type: containers.type })
          .from(containers).where(inArray(containers.id, containerIds))
      : [];

    const containerMap = Object.fromEntries(containerRows.map((c) => [c.id, c]));
    const unitContainerMap = Object.fromEntries(links.map((l) => [l.stockUnitId, l.containerId]));

    const unitsWithContainer = units.map((u) => {
      const cId = unitContainerMap[u.id] ?? null;
      const c = cId ? containerMap[cId] : null;
      return {
        ...u,
        containerId:   c?.id ?? null,
        containerName: c?.name ?? null,
        containerType: c?.type ?? null,
      };
    });

    res.json({ ...item, units: unitsWithContainer });
  } catch {
    res.status(500).json({ message: "Failed to fetch stock item" });
  }
});

// POST /api/stock — เพิ่มอุปกรณ์ใหม่
stockRouter.post("/", async (req, res) => {
  try {
    const data = insertStockItemSchema.parse({
      ...req.body,
      companyId: req.companyId,
    });

    const [item] = await db.insert(stockItems).values(data as typeof stockItems.$inferInsert).returning();

    const [actor] = await db.select({ name: users.name }).from(users).where(eq(users.id, req.userId));
    await notifyCompany({
      companyId: req.companyId,
      actorId: req.userId,
      type: "stock_added",
      meta: { itemName: item.name, actorName: actor?.name ?? "" },
      link: "Stock",
    });

    res.status(201).json(item);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/stock/:id — แก้ไขอุปกรณ์
stockRouter.put("/:id", async (req, res) => {
  try {
    const raw = req.body as Record<string, any>;

    // Fields ที่รับจาก client เป็น string (จาก JSON) แต่ Drizzle ต้องการ Date หรือ null
    const toDate = (v: any): Date | null => {
      if (!v || v === "") return null;
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    };

    // Fields ที่ห้าม overwrite จาก client
    const { id: _id, companyId: _cid, createdAt: _ca, ...rest } = raw;

    const payload = {
      ...rest,
      purchaseDate:   toDate(raw.purchaseDate),
      warrantyExpiry: toDate(raw.warrantyExpiry),
    };

    const [item] = await db
      .update(stockItems)
      .set(payload)
      .where(and(
        eq(stockItems.id, req.params.id),
        eq(stockItems.companyId, req.companyId)
      ))
      .returning();

    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
  } catch (err: any) {
    console.error("PUT /stock/:id error:", err);
    res.status(500).json({ message: err?.message ?? "Failed to update stock item" });
  }
});

// DELETE /api/stock/:id — ลบอุปกรณ์
stockRouter.delete("/:id", async (req, res) => {
  try {
    // ป้องกันการลบถ้ามี units ที่ยังอยู่ในงาน
    const units = await db
      .select({ id: stockUnits.id })
      .from(stockUnits)
      .where(eq(stockUnits.stockItemId, req.params.id));

    if (units.length > 0) {
      const unitIds = units.map((u) => u.id);
      const inJob = await db
        .select({ id: jobUnits.stockUnitId })
        .from(jobUnits)
        .where(inArray(jobUnits.stockUnitId, unitIds))
        .limit(1);
      if (inJob.length > 0) {
        return res.status(409).json({ message: `ไม่สามารถลบได้: มีอุปกรณ์ที่ยังอยู่ในงาน กรุณานำออกจากงานก่อน` });
      }

      const outUnits = await db
        .select({ id: stockUnits.id })
        .from(stockUnits)
        .where(and(eq(stockUnits.stockItemId, req.params.id), eq(stockUnits.status, "out")))
        .limit(1);
      if (outUnits.length > 0) {
        return res.status(409).json({ message: "ไม่สามารถลบได้: มีอุปกรณ์ที่ยังออกงานอยู่" });
      }
    }

    const [item] = await db
      .delete(stockItems)
      .where(and(
        eq(stockItems.id, req.params.id),
        eq(stockItems.companyId, req.companyId)
      ))
      .returning();

    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ message: "Failed to delete stock item" });
  }
});

// ─── Stock Units (หน่วยย่อยแต่ละชิ้น) ───────────────────

// POST /api/stock/:id/units — เพิ่ม unit ใหม่ให้ item
stockRouter.post("/:id/units", async (req, res) => {
  try {
    const data = insertStockUnitSchema.parse({
      ...req.body,
      stockItemId: req.params.id,
      companyId: req.companyId,
    });

    const [unit] = await db.insert(stockUnits).values(data).returning();

    const [item] = await db.select({ name: stockItems.name }).from(stockItems).where(eq(stockItems.id, req.params.id));
    const [actor] = await db.select({ name: users.name }).from(users).where(eq(users.id, req.userId));
    await notifyCompany({
      companyId: req.companyId,
      actorId: req.userId,
      type: "stock_added",
      meta: { itemName: item?.name ?? "", actorName: actor?.name ?? "" },
      link: "Stock",
    });

    res.status(201).json(unit);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/stock/units/:unitId — อัปเดต unit
stockRouter.put("/units/:unitId", async (req, res) => {
  try {
    const toDate = (v: any): Date | null => {
      if (!v || v === "") return null;
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    };

    const { id: _id, companyId: _cid, stockItemId: _sid, createdAt: _ca, ...rest } = req.body;

    const payload = {
      ...rest,
      purchasedAt:       toDate(req.body.purchasedAt),
      warrantyExpiresAt: toDate(req.body.warrantyExpiresAt),
    };

    const [unit] = await db
      .update(stockUnits)
      .set(payload)
      .where(and(
        eq(stockUnits.id, req.params.unitId),
        eq(stockUnits.companyId, req.companyId)
      ))
      .returning();

    if (!unit) return res.status(404).json({ message: "Unit not found" });
    res.json(unit);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to update unit" });
  }
});

// ─── Item Accessories ──────────────────────────────────────

// GET /api/stock/accessories/all — links ทั้งหมดของบริษัท (ใช้ใน ManageJobStockModal)
stockRouter.get("/accessories/all", async (req, res) => {
  try {
    const links = await db
      .select()
      .from(itemAccessories)
      .where(eq(itemAccessories.companyId, req.companyId));
    res.json(links);
  } catch {
    res.status(500).json({ message: "Failed to fetch accessory links" });
  }
});

// GET /api/stock/:id/accessories — links สำหรับ parent item เดียว พร้อม accessory name + availableCount
stockRouter.get("/:id/accessories", async (req, res) => {
  try {
    const links = await db
      .select()
      .from(itemAccessories)
      .where(and(
        eq(itemAccessories.parentStockItemId, req.params.id),
        eq(itemAccessories.companyId, req.companyId),
      ));

    const result = await Promise.all(links.map(async (link) => {
      const [acc] = await db
        .select({ name: stockItems.name })
        .from(stockItems)
        .where(eq(stockItems.id, link.accessoryStockItemId));
      const availableUnits = await db
        .select({ id: stockUnits.id })
        .from(stockUnits)
        .where(and(
          eq(stockUnits.stockItemId, link.accessoryStockItemId),
          eq(stockUnits.status, "available"),
        ));
      return { ...link, accessoryName: acc?.name ?? "—", availableCount: availableUnits.length };
    }));

    res.json(result);
  } catch {
    res.status(500).json({ message: "Failed to fetch accessories" });
  }
});

// POST /api/stock/:id/accessories — link accessory ใหม่ (Admin/Manager เท่านั้น)
stockRouter.post("/:id/accessories", async (req, res) => {
  if (req.userRole !== "admin" && req.userRole !== "manager") {
    return res.status(403).json({ message: "เฉพาะ Admin และ Manager เท่านั้น" });
  }
  try {
    const [link] = await db
      .insert(itemAccessories)
      .values({
        companyId:            req.companyId,
        parentStockItemId:    req.params.id,
        accessoryStockItemId: req.body.accessoryStockItemId,
        quantityPerUnit:      req.body.quantityPerUnit ?? 1,
        required:             req.body.required ?? true,
      })
      .returning();
    res.status(201).json(link);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/stock/accessories/:linkId — อัปเดต quantityPerUnit / required
stockRouter.put("/accessories/:linkId", async (req, res) => {
  if (req.userRole !== "admin" && req.userRole !== "manager") {
    return res.status(403).json({ message: "เฉพาะ Admin และ Manager เท่านั้น" });
  }
  try {
    const [link] = await db
      .update(itemAccessories)
      .set({ quantityPerUnit: req.body.quantityPerUnit, required: req.body.required })
      .where(and(
        eq(itemAccessories.id, req.params.linkId),
        eq(itemAccessories.companyId, req.companyId),
      ))
      .returning();
    if (!link) return res.status(404).json({ message: "Link not found" });
    res.json(link);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/stock/accessories/:linkId — ลบ link (Admin/Manager เท่านั้น)
stockRouter.delete("/accessories/:linkId", async (req, res) => {
  if (req.userRole !== "admin" && req.userRole !== "manager") {
    return res.status(403).json({ message: "เฉพาะ Admin และ Manager เท่านั้น" });
  }
  try {
    const [deleted] = await db
      .delete(itemAccessories)
      .where(and(
        eq(itemAccessories.id, req.params.linkId),
        eq(itemAccessories.companyId, req.companyId),
      ))
      .returning();
    if (!deleted) return res.status(404).json({ message: "Link not found" });
    res.json({ message: "Accessory link removed" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});
