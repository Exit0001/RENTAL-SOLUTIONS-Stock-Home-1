import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db";
import { asc } from "drizzle-orm";
import {
  brands, categories, subCategories, locations, containerTypes, positions, stockItems,
  insertBrandSchema, insertCategorySchema, insertSubCategorySchema, insertLocationSchema, insertContainerTypeSchema, insertPositionSchema,
} from "@shared/schema";

export const catalogRouter = Router();

// ─── Brands ───────────────────────────────────────────────

catalogRouter.get("/brands", async (req, res) => {
  try {
    const result = await db.select().from(brands).where(eq(brands.companyId, req.companyId));
    res.json(result);
  } catch {
    res.status(500).json({ message: "Failed to fetch brands" });
  }
});

catalogRouter.post("/brands", async (req, res) => {
  try {
    const data = insertBrandSchema.parse({ ...req.body, companyId: req.companyId });
    const [brand] = await db.insert(brands).values(data).onConflictDoNothing().returning();
    if (brand) return res.status(201).json(brand);
    const [existing] = await db.select().from(brands).where(and(eq(brands.companyId, req.companyId), sql`lower(${brands.name}) = lower(${data.name})`));
    res.status(200).json(existing);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

catalogRouter.put("/brands/:id", async (req, res) => {
  try {
    const data = insertBrandSchema.partial().parse(req.body);
    const [current] = await db.select().from(brands)
      .where(and(eq(brands.id, req.params.id), eq(brands.companyId, req.companyId)));
    if (!current) return res.status(404).json({ message: "Brand not found" });

    const brand = await db.transaction(async (tx) => {
      const [updated] = await tx.update(brands).set(data)
        .where(and(eq(brands.id, req.params.id), eq(brands.companyId, req.companyId)))
        .returning();
      // brand ถูกอ้างใน stock_items ด้วยชื่อ (TEXT) — rename ต้อง cascade กันชื่อหลุด
      if (data.name && data.name !== current.name) {
        await tx.update(stockItems).set({ brand: data.name })
          .where(and(eq(stockItems.brand, current.name), eq(stockItems.companyId, req.companyId)));
      }
      return updated;
    });
    res.json(brand);
  } catch (err: any) {
    if (err?.code === "23505") return res.status(409).json({ message: `แบรนด์ "${req.body?.name}" มีอยู่แล้ว` });
    res.status(400).json({ message: err.message });
  }
});

catalogRouter.delete("/brands/:id", async (req, res) => {
  try {
    const [brand] = await db.delete(brands)
      .where(and(eq(brands.id, req.params.id), eq(brands.companyId, req.companyId)))
      .returning();
    if (!brand) return res.status(404).json({ message: "Brand not found" });
    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ message: "Failed to delete brand" });
  }
});

// ─── Categories ───────────────────────────────────────────

catalogRouter.get("/categories", async (req, res) => {
  try {
    const result = await db.select().from(categories).where(eq(categories.companyId, req.companyId));
    res.json(result);
  } catch {
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

catalogRouter.post("/categories", async (req, res) => {
  try {
    const data = insertCategorySchema.parse({ ...req.body, companyId: req.companyId });
    const [category] = await db.insert(categories).values(data).onConflictDoNothing().returning();
    if (category) return res.status(201).json(category);
    const [existing] = await db.select().from(categories).where(and(eq(categories.companyId, req.companyId), sql`lower(${categories.name}) = lower(${data.name})`));
    res.status(200).json(existing);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

catalogRouter.put("/categories/:id", async (req, res) => {
  try {
    const name = (req.body?.name ?? "").toString().trim();
    if (!name) return res.status(400).json({ message: "ต้องระบุชื่อหมวดหมู่" });
    const [current] = await db.select().from(categories)
      .where(and(eq(categories.id, req.params.id), eq(categories.companyId, req.companyId)));
    if (!current) return res.status(404).json({ message: "Category not found" });
    if (current.name === name) return res.json(current);

    // category ถูกอ้างใน stock_items.category และ sub_categories.parent_category ด้วยชื่อ → cascade
    const updated = await db.transaction(async (tx) => {
      const [cat] = await tx.update(categories).set({ name })
        .where(and(eq(categories.id, req.params.id), eq(categories.companyId, req.companyId)))
        .returning();
      await tx.update(stockItems).set({ category: name })
        .where(and(eq(stockItems.category, current.name), eq(stockItems.companyId, req.companyId)));
      await tx.update(subCategories).set({ parentCategory: name })
        .where(and(eq(subCategories.parentCategory, current.name), eq(subCategories.companyId, req.companyId)));
      return cat;
    });
    res.json(updated);
  } catch (err: any) {
    if (err?.code === "23505") return res.status(409).json({ message: `หมวดหมู่ "${req.body?.name}" มีอยู่แล้ว` });
    res.status(400).json({ message: err?.message ?? "แก้ไขหมวดหมู่ไม่สำเร็จ" });
  }
});

catalogRouter.delete("/categories/:id", async (req, res) => {
  try {
    const [category] = await db.delete(categories)
      .where(and(eq(categories.id, req.params.id), eq(categories.companyId, req.companyId)))
      .returning();
    if (!category) return res.status(404).json({ message: "Category not found" });
    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ message: "Failed to delete category" });
  }
});

// ─── Sub-Categories ───────────────────────────────────────

catalogRouter.get("/subcategories", async (req, res) => {
  try {
    const result = await db.select().from(subCategories).where(eq(subCategories.companyId, req.companyId));
    res.json(result);
  } catch {
    res.status(500).json({ message: "Failed to fetch sub-categories" });
  }
});

catalogRouter.post("/subcategories", async (req, res) => {
  try {
    const data = insertSubCategorySchema.parse({ ...req.body, companyId: req.companyId });
    const [subCategory] = await db.insert(subCategories).values(data).onConflictDoNothing().returning();
    if (subCategory) return res.status(201).json(subCategory);
    const [existing] = await db.select().from(subCategories).where(and(
      eq(subCategories.companyId, req.companyId),
      sql`lower(${subCategories.name}) = lower(${data.name})`,
      eq(subCategories.parentCategory, data.parentCategory),
    ));
    res.status(200).json(existing);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

catalogRouter.put("/subcategories/:id", async (req, res) => {
  try {
    const [current] = await db.select().from(subCategories)
      .where(and(eq(subCategories.id, req.params.id), eq(subCategories.companyId, req.companyId)));
    if (!current) return res.status(404).json({ message: "Sub-category not found" });

    const name = req.body?.name != null ? req.body.name.toString().trim() : current.name;
    const parentCategory = req.body?.parentCategory != null ? req.body.parentCategory.toString().trim() : current.parentCategory;
    if (!name) return res.status(400).json({ message: "ต้องระบุชื่อหมวดหมู่ย่อย" });
    if (name === current.name && parentCategory === current.parentCategory) return res.json(current);

    const updated = await db.transaction(async (tx) => {
      const [sub] = await tx.update(subCategories).set({ name, parentCategory })
        .where(and(eq(subCategories.id, req.params.id), eq(subCategories.companyId, req.companyId)))
        .returning();
      // ชื่อหมวดย่อยถูกอ้างใน stock_items.sub_category — rename ต้อง cascade (สโคปด้วยหมวดแม่เดิม กันชนชื่อซ้ำข้ามหมวด)
      if (name !== current.name) {
        await tx.update(stockItems).set({ subCategory: name })
          .where(and(
            eq(stockItems.subCategory, current.name),
            eq(stockItems.category, current.parentCategory),
            eq(stockItems.companyId, req.companyId),
          ));
      }
      return sub;
    });
    res.json(updated);
  } catch (err: any) {
    if (err?.code === "23505") return res.status(409).json({ message: `หมวดหมู่ย่อย "${req.body?.name}" มีอยู่แล้วในหมวดนี้` });
    res.status(400).json({ message: err?.message ?? "แก้ไขหมวดหมู่ย่อยไม่สำเร็จ" });
  }
});

catalogRouter.delete("/subcategories/:id", async (req, res) => {
  try {
    const [subCategory] = await db.delete(subCategories)
      .where(and(eq(subCategories.id, req.params.id), eq(subCategories.companyId, req.companyId)))
      .returning();
    if (!subCategory) return res.status(404).json({ message: "Sub-category not found" });
    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ message: "Failed to delete sub-category" });
  }
});

// ─── Locations ────────────────────────────────────────────

catalogRouter.get("/locations", async (req, res) => {
  try {
    const result = await db.select().from(locations).where(eq(locations.companyId, req.companyId));
    res.json(result);
  } catch {
    res.status(500).json({ message: "Failed to fetch locations" });
  }
});

catalogRouter.post("/locations", async (req, res) => {
  try {
    const data = insertLocationSchema.parse({ ...req.body, companyId: req.companyId });
    const [location] = await db.insert(locations).values(data).returning();
    res.status(201).json(location);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

catalogRouter.delete("/locations/:id", async (req, res) => {
  try {
    const [location] = await db.delete(locations)
      .where(and(eq(locations.id, req.params.id), eq(locations.companyId, req.companyId)))
      .returning();
    if (!location) return res.status(404).json({ message: "Location not found" });
    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ message: "Failed to delete location" });
  }
});

// ─── Positions (โซนในงาน: FOH / Monitors / Power / Stage) ──

catalogRouter.get("/positions", async (req, res) => {
  try {
    const result = await db.select().from(positions)
      .where(eq(positions.companyId, req.companyId))
      .orderBy(asc(positions.sortOrder), asc(positions.name));
    res.json(result);
  } catch {
    res.status(500).json({ message: "Failed to fetch positions" });
  }
});

catalogRouter.post("/positions", async (req, res) => {
  try {
    const data = insertPositionSchema.parse({ ...req.body, companyId: req.companyId });
    const [position] = await db.insert(positions).values(data).returning();
    res.status(201).json(position);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

catalogRouter.delete("/positions/:id", async (req, res) => {
  try {
    const [position] = await db.delete(positions)
      .where(and(eq(positions.id, req.params.id), eq(positions.companyId, req.companyId)))
      .returning();
    if (!position) return res.status(404).json({ message: "Position not found" });
    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ message: "Failed to delete position" });
  }
});

// ─── Container Types ───────────────────────────────────────

catalogRouter.get("/container-types", async (req, res) => {
  try {
    const result = await db.select().from(containerTypes).where(eq(containerTypes.companyId, req.companyId));
    res.json(result);
  } catch {
    res.status(500).json({ message: "Failed to fetch container types" });
  }
});

catalogRouter.post("/container-types", async (req, res) => {
  try {
    const data = insertContainerTypeSchema.parse({ ...req.body, companyId: req.companyId });
    const [containerType] = await db.insert(containerTypes).values(data).returning();
    res.status(201).json(containerType);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

catalogRouter.delete("/container-types/:id", async (req, res) => {
  try {
    const [containerType] = await db.delete(containerTypes)
      .where(and(eq(containerTypes.id, req.params.id), eq(containerTypes.companyId, req.companyId)))
      .returning();
    if (!containerType) return res.status(404).json({ message: "Container type not found" });
    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ message: "Failed to delete container type" });
  }
});
