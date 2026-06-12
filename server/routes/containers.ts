import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../db";
import { containers, containerUnits, stockUnits, stockItems, insertContainerSchema } from "@shared/schema";

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
    const links = await db
      .select()
      .from(containerUnits)
      .where(inArray(containerUnits.containerId, containerIds));

    if (links.length === 0) {
      return res.json(result.map((c) => ({ ...c, items: [] })));
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

    const [updated] = await db
      .update(containers)
      .set({ isOut: !current.isOut })
      .where(eq(containers.id, req.params.id))
      .returning();

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

// DELETE /api/containers/:id — ลบ container
containersRouter.delete("/:id", async (req, res) => {
  try {
    const [container] = await db
      .delete(containers)
      .where(and(
        eq(containers.id, req.params.id),
        eq(containers.companyId, req.companyId)
      ))
      .returning();

    if (!container) return res.status(404).json({ message: "Container not found" });
    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ message: "Failed to delete container" });
  }
});
