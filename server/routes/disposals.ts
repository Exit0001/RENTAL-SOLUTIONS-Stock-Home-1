import { Router } from "express";
import { eq, and, inArray, desc } from "drizzle-orm";
import { db } from "../db";
import { stockItems, stockUnits, stockDisposals, users } from "@shared/schema";

export const disposalsRouter = Router();

const canWrite = (role?: string) => role === "admin" || role === "manager";

// GET /api/disposals — ประวัติการขาย/ตัดของออก (ล่าสุดก่อน)
disposalsRouter.get("/", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: stockDisposals.id, stockItemId: stockDisposals.stockItemId, stockUnitId: stockDisposals.stockUnitId,
        itemName: stockDisposals.itemName, quantity: stockDisposals.quantity, reason: stockDisposals.reason,
        salePrice: stockDisposals.salePrice, note: stockDisposals.note, disposedAt: stockDisposals.disposedAt,
        disposedByName: users.name,
      })
      .from(stockDisposals)
      .leftJoin(users, eq(stockDisposals.disposedById, users.id))
      .where(eq(stockDisposals.companyId, req.companyId))
      .orderBy(desc(stockDisposals.disposedAt));
    res.json(rows);
  } catch {
    res.status(500).json({ message: "Failed to fetch disposals" });
  }
});

// POST /api/disposals — ขาย/ตัดของออกจากสต็อก
//  body: { stockItemId, stockUnitIds?: string[], quantity?, reason, salePrice?, note? }
//  unit  → มาร์ค status ('sold' ถ้า reason=sold, ไม่งั้น 'retired'); bulk → ลด quantity
disposalsRouter.post("/", async (req, res) => {
  try {
    if (!canWrite(req.userRole)) return res.status(403).json({ message: "เฉพาะ Admin และ Manager เท่านั้น" });
    const { stockItemId, stockUnitIds, quantity, reason, salePrice, note } = req.body ?? {};
    if (!stockItemId || !reason) return res.status(400).json({ message: "ต้องระบุ stockItemId และ reason" });

    const [item] = await db.select().from(stockItems)
      .where(and(eq(stockItems.id, stockItemId), eq(stockItems.companyId, req.companyId)));
    if (!item) return res.status(404).json({ message: "ไม่พบอุปกรณ์" });

    const soldStatus = reason === "sold" ? "sold" : "retired";
    let qty = 0;
    let singleUnitId: string | null = null;

    if (item.trackingMode === "bulk") {
      qty = Math.max(1, Number(quantity) || 0);
      if (qty > (item.quantity ?? 0)) return res.status(400).json({ message: `จำนวนเกินที่มี (${item.quantity})` });
      await db.update(stockItems).set({ quantity: (item.quantity ?? 0) - qty }).where(eq(stockItems.id, item.id));
    } else {
      const ids: string[] = Array.isArray(stockUnitIds) ? stockUnitIds : [];
      if (ids.length === 0) return res.status(400).json({ message: "ต้องเลือก unit อย่างน้อย 1 ตัว" });
      // อัปเดตเฉพาะ unit ของอุปกรณ์+บริษัทนี้
      const owned = await db.select({ id: stockUnits.id }).from(stockUnits)
        .where(and(eq(stockUnits.companyId, req.companyId), eq(stockUnits.stockItemId, item.id), inArray(stockUnits.id, ids)));
      const ownedIds = owned.map((u) => u.id);
      if (ownedIds.length === 0) return res.status(400).json({ message: "ไม่พบ unit ที่เลือก" });
      await db.update(stockUnits).set({ status: soldStatus }).where(inArray(stockUnits.id, ownedIds));
      qty = ownedIds.length;
      singleUnitId = ownedIds.length === 1 ? ownedIds[0] : null;
    }

    const [rec] = await db.insert(stockDisposals).values({
      companyId: req.companyId,
      stockItemId: item.id,
      stockUnitId: singleUnitId,
      itemName: item.name,
      quantity: qty,
      reason,
      salePrice: salePrice != null && salePrice !== "" ? String(salePrice) : null,
      note: note?.trim() || null,
      disposedById: req.userId,
    }).returning();

    res.status(201).json(rec);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});
