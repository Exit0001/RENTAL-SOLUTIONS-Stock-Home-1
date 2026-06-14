import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../db";
import { stockItems, stockUnits, containers, containerUnits, insertStockItemSchema, insertStockUnitSchema } from "@shared/schema";

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

    const itemIds = items.map((i) => i.id);

    const units = await db
      .select({ stockItemId: stockUnits.stockItemId, status: stockUnits.status })
      .from(stockUnits)
      .where(inArray(stockUnits.stockItemId, itemIds));

    const totalCounts     = new Map<string, number>();
    const availableCounts = new Map<string, number>();

    for (const u of units) {
      totalCounts.set(u.stockItemId, (totalCounts.get(u.stockItemId) ?? 0) + 1);
      if (u.status === "available") {
        availableCounts.set(u.stockItemId, (availableCounts.get(u.stockItemId) ?? 0) + 1);
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

    const units = await db
      .select()
      .from(stockUnits)
      .where(inArray(stockUnits.stockItemId, items.map((i) => i.id)));

    const unitsByItem: Record<string, typeof units> = {};
    for (const u of units) {
      if (!unitsByItem[u.stockItemId]) unitsByItem[u.stockItemId] = [];
      unitsByItem[u.stockItemId].push(u);
    }

    res.json(items.map((item) => ({ ...item, units: unitsByItem[item.id] ?? [] })));
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

    // หาว่า unit ไหนอยู่ใน rack/container ไหนบ้าง
    const unitIds = units.map((u) => u.id);
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
