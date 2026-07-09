import { Router } from "express";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { db } from "../db";
import {
  equipmentSets, equipmentSetItems, stockItems, stockUnits,
} from "@shared/schema";

export const equipmentSetsRouter = Router();

// GET /api/equipment-sets — รายการชุดอุปกรณ์พร้อมจำนวนรายการ/ชิ้นรวม
equipmentSetsRouter.get("/", async (req, res) => {
  try {
    const sets = await db.select().from(equipmentSets)
      .where(eq(equipmentSets.companyId, req.companyId))
      .orderBy(desc(equipmentSets.createdAt));

    if (sets.length === 0) return res.json([]);

    const counts = await db
      .select({
        setId:     equipmentSetItems.setId,
        itemCount: sql<number>`count(*)::int`,
        totalQty:  sql<number>`coalesce(sum(${equipmentSetItems.quantity}),0)::int`,
      })
      .from(equipmentSetItems)
      .where(inArray(equipmentSetItems.setId, sets.map((s) => s.id)))
      .groupBy(equipmentSetItems.setId);
    const countMap = Object.fromEntries(counts.map((c) => [c.setId, c]));

    res.json(sets.map((s) => ({
      ...s,
      itemCount: countMap[s.id]?.itemCount ?? 0,
      totalQty:  countMap[s.id]?.totalQty ?? 0,
    })));
  } catch {
    res.status(500).json({ message: "Failed to fetch equipment sets" });
  }
});

// GET /api/equipment-sets/:id — ชุดเดียวพร้อมรายการอุปกรณ์ (ชื่อ item + serial ถ้าปักหมุด unit)
equipmentSetsRouter.get("/:id", async (req, res) => {
  try {
    const [set] = await db.select().from(equipmentSets)
      .where(and(eq(equipmentSets.id, req.params.id), eq(equipmentSets.companyId, req.companyId)));
    if (!set) return res.status(404).json({ message: "ไม่พบชุดอุปกรณ์" });

    const items = await db.select().from(equipmentSetItems).where(eq(equipmentSetItems.setId, set.id));

    const itemIds = Array.from(new Set(items.map((i) => i.stockItemId)));
    const unitIds = items.map((i) => i.unitId).filter((u): u is string => !!u);

    const names = itemIds.length
      ? await db.select({ id: stockItems.id, name: stockItems.name, trackingMode: stockItems.trackingMode })
          .from(stockItems).where(inArray(stockItems.id, itemIds))
      : [];
    const nameMap = Object.fromEntries(names.map((n) => [n.id, n]));

    const units = unitIds.length
      ? await db.select({ id: stockUnits.id, name: stockUnits.name, serialNumber: stockUnits.serialNumber })
          .from(stockUnits).where(inArray(stockUnits.id, unitIds))
      : [];
    const unitMap = Object.fromEntries(units.map((u) => [u.id, u]));

    res.json({
      ...set,
      items: items.map((i) => ({
        ...i,
        itemName:     nameMap[i.stockItemId]?.name ?? "Unknown",
        trackingMode: nameMap[i.stockItemId]?.trackingMode ?? "unit",
        unitName:     i.unitId ? (unitMap[i.unitId]?.name ?? null) : null,
        serialNumber: i.unitId ? (unitMap[i.unitId]?.serialNumber ?? null) : null,
      })),
    });
  } catch {
    res.status(500).json({ message: "Failed to fetch equipment set" });
  }
});

// รับ items จาก body → rows สำหรับ insert (กรอง/normalize) — ใช้ทั้ง create และ update
function toItemRows(setId: string, items: unknown): { setId: string; stockItemId: string; quantity: number; unitId: string | null }[] {
  return (Array.isArray(items) ? items : [])
    .filter((i: any) => i?.stockItemId)
    .map((i: any) => {
      const unitId = i.unitId ?? null;
      // ปักหมุด unit → quantity บังคับ 1; ไม่งั้นใช้จำนวนที่ส่งมา (>=1)
      const quantity = unitId ? 1 : Math.max(1, Number(i.quantity) || 0);
      return { setId, stockItemId: i.stockItemId as string, quantity, unitId: unitId as string | null };
    })
    .filter((r) => r.unitId !== null || r.quantity > 0);
}

// POST /api/equipment-sets — สร้างชุดจากรายการที่ส่งมา
equipmentSetsRouter.post("/", async (req, res) => {
  try {
    const { name, description, imageUrl, items } = req.body ?? {};
    if (typeof name !== "string" || !name.trim())
      return res.status(400).json({ message: "ต้องระบุชื่อชุดอุปกรณ์" });

    const [set] = await db.insert(equipmentSets)
      .values({
        companyId:   req.companyId,
        name:        name.trim(),
        description: description?.trim() || null,
        imageUrl:    imageUrl || null,
      })
      .returning();

    const rows = toItemRows(set.id, items);
    if (rows.length) await db.insert(equipmentSetItems).values(rows);

    res.status(201).json(set);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/equipment-sets/:id — แก้ชื่อ/หมายเหตุ/รูป + replace-all รายการอุปกรณ์
equipmentSetsRouter.put("/:id", async (req, res) => {
  try {
    const [set] = await db.select().from(equipmentSets)
      .where(and(eq(equipmentSets.id, req.params.id), eq(equipmentSets.companyId, req.companyId)));
    if (!set) return res.status(404).json({ message: "ไม่พบชุดอุปกรณ์" });

    const { name, description, imageUrl, items } = req.body ?? {};
    if (name !== undefined && (typeof name !== "string" || !name.trim()))
      return res.status(400).json({ message: "ต้องระบุชื่อชุดอุปกรณ์" });

    await db.update(equipmentSets)
      .set({
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(imageUrl !== undefined ? { imageUrl: imageUrl || null } : {}),
      })
      .where(eq(equipmentSets.id, set.id));

    // replace-all items เฉพาะเมื่อส่ง items มา
    if (items !== undefined) {
      await db.delete(equipmentSetItems).where(eq(equipmentSetItems.setId, set.id));
      const rows = toItemRows(set.id, items);
      if (rows.length) await db.insert(equipmentSetItems).values(rows);
    }

    const [updated] = await db.select().from(equipmentSets).where(eq(equipmentSets.id, set.id));
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/equipment-sets/:id — Admin/Manager เท่านั้น (cascade ลบ items เอง)
equipmentSetsRouter.delete("/:id", async (req, res) => {
  try {
    if (req.userRole !== "admin" && req.userRole !== "manager")
      return res.status(403).json({ message: "เฉพาะ Admin และ Manager เท่านั้น" });

    await db.delete(equipmentSets)
      .where(and(eq(equipmentSets.id, req.params.id), eq(equipmentSets.companyId, req.companyId)));
    res.json({ message: "ลบชุดอุปกรณ์แล้ว" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});
