import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db";
import {
  quotes, invoices, insertQuoteSchema, insertInvoiceSchema,
  jobs, subRentals, incidents, maintenanceLogs,
} from "@shared/schema";

export const financeRouter = Router();

// ─── Quotes ──────────────────────────────────────────────

// GET /api/finance/quotes
financeRouter.get("/quotes", async (req, res) => {
  try {
    const result = await db
      .select()
      .from(quotes)
      .where(eq(quotes.companyId, req.companyId))
      .orderBy(desc(quotes.createdAt));
    res.json(result);
  } catch {
    res.status(500).json({ message: "Failed to fetch quotes" });
  }
});

// POST /api/finance/quotes
financeRouter.post("/quotes", async (req, res) => {
  try {
    const data = insertQuoteSchema.parse({
      ...req.body,
      companyId: req.companyId,
    });

    const [quote] = await db.insert(quotes).values(data).returning();
    res.status(201).json(quote);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/finance/quotes/:id — เปลี่ยน status (draft → sent → accepted)
financeRouter.put("/quotes/:id", async (req, res) => {
  try {
    const [quote] = await db
      .update(quotes)
      .set(req.body)
      .where(and(
        eq(quotes.id, req.params.id),
        eq(quotes.companyId, req.companyId)
      ))
      .returning();

    if (!quote) return res.status(404).json({ message: "Quote not found" });
    res.json(quote);
  } catch {
    res.status(500).json({ message: "Failed to update quote" });
  }
});

// ─── Invoices ─────────────────────────────────────────────

// GET /api/finance/invoices
financeRouter.get("/invoices", async (req, res) => {
  try {
    const result = await db
      .select()
      .from(invoices)
      .where(eq(invoices.companyId, req.companyId))
      .orderBy(desc(invoices.issuedDate));
    res.json(result);
  } catch {
    res.status(500).json({ message: "Failed to fetch invoices" });
  }
});

// POST /api/finance/invoices
financeRouter.post("/invoices", async (req, res) => {
  try {
    const data = insertInvoiceSchema.parse({
      ...req.body,
      companyId: req.companyId,
    });

    const [invoice] = await db.insert(invoices).values(data).returning();
    res.status(201).json(invoice);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/finance/invoices/:id — mark as paid / overdue
financeRouter.put("/invoices/:id", async (req, res) => {
  try {
    const [invoice] = await db
      .update(invoices)
      .set(req.body)
      .where(and(
        eq(invoices.id, req.params.id),
        eq(invoices.companyId, req.companyId)
      ))
      .returning();

    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    res.json(invoice);
  } catch {
    res.status(500).json({ message: "Failed to update invoice" });
  }
});

// ─── Costing & ROI ────────────────────────────────────────

// GET /api/finance/costing — revenue vs cost per job (computed from invoices + sub_rentals)
financeRouter.get("/costing", async (req, res) => {
  try {
    const allJobs = await db
      .select()
      .from(jobs)
      .where(eq(jobs.companyId, req.companyId))
      .orderBy(desc(jobs.startDate));

    const results = await Promise.all(allJobs.map(async (job) => {
      const [jobInvoices, jobSubRentals] = await Promise.all([
        db.select({ amount: invoices.amount })
          .from(invoices)
          .where(and(eq(invoices.jobId, job.id), eq(invoices.companyId, req.companyId))),
        db.select({ dailyRate: subRentals.dailyRate })
          .from(subRentals)
          .where(and(eq(subRentals.jobId, job.id), eq(subRentals.companyId, req.companyId))),
      ]);

      const revenue       = jobInvoices.reduce((s, i) => s + Number(i.amount ?? 0), 0);
      const subRentalCost = jobSubRentals.reduce((s, sr) => s + Number(sr.dailyRate ?? 0), 0);
      const totalCost     = subRentalCost; // staff/transport/equipment columns not in schema yet
      const profit        = revenue - totalCost;
      const roi           = totalCost > 0
        ? Math.round((profit / totalCost) * 100)
        : revenue > 0 ? 100 : 0;

      return {
        project:    job.name,
        jobId:      job.id,
        revenue,
        costs:      0,
        staff:      0,
        transport:  0,
        subRentals: subRentalCost,
        roi,
      };
    }));

    // คืนเฉพาะงานที่มีข้อมูลการเงิน
    res.json(results.filter((r) => r.revenue > 0 || r.subRentals > 0));
  } catch {
    res.status(500).json({ message: "Failed to fetch costing data" });
  }
});

// ─── Loss Analysis ────────────────────────────────────────

// GET /api/finance/loss — สรุปความเสียหาย + auto-billing จาก incidents
financeRouter.get("/loss", async (req, res) => {
  try {
    const now = new Date();

    const [allIncidents, allMaintenance, allSubRentals] = await Promise.all([
      db.select({
        id: incidents.id, description: incidents.description,
        severity: incidents.severity, status: incidents.status,
        stockUnitId: incidents.stockUnitId, jobId: incidents.jobId, date: incidents.date,
      }).from(incidents).where(eq(incidents.companyId, req.companyId)).orderBy(desc(incidents.date)),

      db.select({ status: maintenanceLogs.status, cost: maintenanceLogs.cost })
        .from(maintenanceLogs).where(eq(maintenanceLogs.companyId, req.companyId)),

      db.select({ dailyRate: subRentals.dailyRate, dueBack: subRentals.dueBack, status: subRentals.status })
        .from(subRentals).where(eq(subRentals.companyId, req.companyId)),
    ]);

    const completedMaint = allMaintenance.filter((m) => m.status === "completed");
    const damageCost     = completedMaint.reduce((s, m) => s + Number(m.cost ?? 0), 0);

    const overdueSubs   = allSubRentals.filter((sr) => new Date(sr.dueBack) < now && sr.status !== "returned");
    const overdueAmount = overdueSubs.reduce((s, sr) => s + Number(sr.dailyRate ?? 0), 0);

    const openIncidents     = allIncidents.filter((i) => i.status === "open");
    const openHighIncidents = openIncidents.filter((i) => i.severity === "high");

    const lossItems = [
      {
        category: "Damaged Equipment",
        amount:   `£${damageCost.toLocaleString()}`,
        items:    completedMaint.length,
        trend:    completedMaint.length > 0 ? "up" : "same",
        desc:     completedMaint.length > 0
          ? `${completedMaint.length} completed repair(s) — total cost £${damageCost.toLocaleString()}`
          : "No completed repairs recorded",
      },
      {
        category: "Lost Equipment",
        amount:   "£0",
        items:    0,
        trend:    "same",
        desc:     "Track lost equipment via incident reports",
      },
      {
        category: "Late Returns",
        amount:   `£${overdueAmount.toLocaleString()}`,
        items:    overdueSubs.length,
        trend:    overdueSubs.length > 0 ? "up" : "down",
        desc:     overdueSubs.length > 0
          ? `${overdueSubs.length} sub-rental(s) past due date`
          : "All sub-rentals returned on time",
      },
      {
        category: "Open Incidents",
        amount:   `${openHighIncidents.length} High`,
        items:    openIncidents.length,
        trend:    openIncidents.length > 0 ? "up" : "same",
        desc:     `${openIncidents.length} open incident(s), ${openHighIncidents.length} high severity`,
      },
    ];

    // auto-billing table — incidents พร้อมชื่อ client จาก job
    const incidentsWithClient = await db
      .select({
        id:          incidents.id,
        severity:    incidents.severity,
        status:      incidents.status,
        stockUnitId: incidents.stockUnitId,
        jobClient:   jobs.client,
        date:        incidents.date,
      })
      .from(incidents)
      .leftJoin(jobs, eq(incidents.jobId, jobs.id))
      .where(eq(incidents.companyId, req.companyId))
      .orderBy(desc(incidents.date));

    const autoBillingItems = incidentsWithClient.map((inc) => ({
      id:       inc.id.slice(0, 8).toUpperCase(),
      client:   inc.jobClient ?? "—",
      asset:    inc.stockUnitId ?? "—",
      type:     "Damage",
      amount:   "—",
      contract: "Review required",
      status:   inc.status === "open" ? "Pending" : "Sent",
    }));

    res.json({ lossItems, autoBillingItems });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});
