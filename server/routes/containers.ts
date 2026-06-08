import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { containers, insertContainerSchema } from "@shared/schema";

export const containersRouter = Router();

// GET /api/containers — ดึง containers ทั้งหมดของบริษัท
containersRouter.get("/", async (req, res) => {
  try {
    const result = await db
      .select()
      .from(containers)
      .where(eq(containers.companyId, req.companyId));
    res.json(result);
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
