import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import {
  brands, categories, subCategories, locations, containerTypes,
  insertBrandSchema, insertCategorySchema, insertSubCategorySchema, insertLocationSchema, insertContainerTypeSchema,
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
    const [brand] = await db.insert(brands).values(data).returning();
    res.status(201).json(brand);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

catalogRouter.put("/brands/:id", async (req, res) => {
  try {
    const data = insertBrandSchema.partial().parse(req.body);
    const [brand] = await db.update(brands)
      .set(data)
      .where(and(eq(brands.id, req.params.id), eq(brands.companyId, req.companyId)))
      .returning();
    if (!brand) return res.status(404).json({ message: "Brand not found" });
    res.json(brand);
  } catch (err: any) {
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
    const [category] = await db.insert(categories).values(data).returning();
    res.status(201).json(category);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
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
    const [subCategory] = await db.insert(subCategories).values(data).returning();
    res.status(201).json(subCategory);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
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
