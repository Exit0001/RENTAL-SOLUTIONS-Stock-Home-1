import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { stockItems, stockUnits, insertStockItemSchema, insertStockUnitSchema } from "@shared/schema";

export const stockRouter = Router();

// ─── Stock Items (หมวดหมู่อุปกรณ์) ───────────────────────

// GET /api/stock — ดึงรายการทั้งหมดของบริษัท
stockRouter.get("/", async (req, res) => {
  try {
    const items = await db
      .select()
      .from(stockItems)
      .where(eq(stockItems.companyId, req.companyId));
    res.json(items);
  } catch {
    res.status(500).json({ message: "Failed to fetch stock items" });
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

    res.json({ ...item, units });
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
    const [item] = await db
      .update(stockItems)
      .set(req.body)
      .where(and(
        eq(stockItems.id, req.params.id),
        eq(stockItems.companyId, req.companyId)
      ))
      .returning();

    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
  } catch {
    res.status(500).json({ message: "Failed to update stock item" });
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

// PUT /api/stock/units/:unitId — อัปเดต unit (เช่น เปลี่ยน status)
stockRouter.put("/units/:unitId", async (req, res) => {
  try {
    const [unit] = await db
      .update(stockUnits)
      .set(req.body)
      .where(and(
        eq(stockUnits.id, req.params.unitId),
        eq(stockUnits.companyId, req.companyId)
      ))
      .returning();

    if (!unit) return res.status(404).json({ message: "Unit not found" });
    res.json(unit);
  } catch {
    res.status(500).json({ message: "Failed to update unit" });
  }
});
