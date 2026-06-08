import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { companies, insertCompanySchema } from "@shared/schema";

export const companiesRouter = Router();

// POST /api/companies — สร้างบริษัทใหม่ (ไม่ต้องมี company_id ก่อน)
companiesRouter.post("/", async (req, res) => {
  try {
    const data = insertCompanySchema.parse(req.body);
    const [company] = await db.insert(companies).values(data).returning();
    res.status(201).json(company);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/companies/:id — ดึงข้อมูลบริษัท
companiesRouter.get("/:id", async (req, res) => {
  try {
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, req.params.id));

    if (!company) return res.status(404).json({ message: "Company not found" });
    res.json(company);
  } catch {
    res.status(500).json({ message: "Failed to fetch company" });
  }
});
