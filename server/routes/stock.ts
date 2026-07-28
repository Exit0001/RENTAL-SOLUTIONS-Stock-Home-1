import { Router } from "express";
import { eq, and, inArray, notInArray, sql, ne, isNotNull, desc } from "drizzle-orm";
import { db } from "../db";
import { stockItems, stockUnits, containers, containerUnits, users, itemAccessories, jobUnits, jobStock, jobs, equipmentSets, equipmentSetItems, insertStockItemSchema, insertStockUnitSchema } from "@shared/schema";
import { notifyCompany } from "../lib/notify";

// เรียงชื่อ/บาร์โค้ดแบบ "natural sort" — เทียบเลขในสตริงเป็นจำนวนจริง ไม่ใช่ string
// (ป้องกัน "#10" ไปแทรกก่อน "#2" แบบ lexicographic, และกัน DB row order ที่ไม่มี ORDER BY
// ทำให้หน่วยที่เพิ่มเข้ามาทีหลังโผล่ผิดที่ เช่น #08 ไปอยู่หลัง #10)
function naturalCompare(a: string, b: string): number {
  const aParts = a.match(/(\d+)|(\D+)/g) ?? [];
  const bParts = b.match(/(\d+)|(\D+)/g) ?? [];
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const ap = aParts[i] ?? "";
    const bp = bParts[i] ?? "";
    const aIsNum = /^\d+$/.test(ap);
    const bIsNum = /^\d+$/.test(bp);
    if (aIsNum && bIsNum) {
      const diff = parseInt(ap, 10) - parseInt(bp, 10);
      if (diff !== 0) return diff;
    } else {
      const cmp = ap.localeCompare(bp);
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
}

// ─── Uniqueness helpers ───────────────────────────────────────────────────────

async function checkItemNameUnique(companyId: string, name: string, excludeId?: string) {
  const rows = await db
    .select({ id: stockItems.id })
    .from(stockItems)
    .where(and(
      eq(stockItems.companyId, companyId),
      sql`LOWER(${stockItems.name}) = LOWER(${name})`,
      ...(excludeId ? [ne(stockItems.id, excludeId)] : [])
    ))
    .limit(1);
  if (rows.length > 0) throw new Error(`ชื่ออุปกรณ์ "${name}" มีอยู่แล้วในระบบ`);
}

// carries which unit/item a serial/barcode collides with, so the client can show its name
// and jump straight to it instead of just a plain "already exists" string
export class DuplicateUnitError extends Error {
  constructor(
    message: string,
    public duplicateField:    "serialNumber" | "barcode",
    public duplicateUnitId:   string,
    public duplicateItemId:  string,
    public duplicateItemName: string,
  ) {
    super(message);
  }
}

async function checkUnitUnique(companyId: string, { serialNumber, barcode }: { serialNumber?: string | null; barcode?: string | null }, excludeId?: string) {
  if (serialNumber && serialNumber.trim() !== "") {
    const [row] = await db
      .select({ id: stockUnits.id, stockItemId: stockUnits.stockItemId, itemName: stockItems.name })
      .from(stockUnits)
      .innerJoin(stockItems, eq(stockItems.id, stockUnits.stockItemId))
      .where(and(
        eq(stockUnits.companyId, companyId),
        sql`LOWER(${stockUnits.serialNumber}) = LOWER(${serialNumber.trim()})`,
        ...(excludeId ? [ne(stockUnits.id, excludeId)] : [])
      ))
      .limit(1);
    if (row) {
      throw new DuplicateUnitError(
        `Serial number "${serialNumber.trim()}" มีอยู่แล้วในระบบ`,
        "serialNumber", row.id, row.stockItemId, row.itemName,
      );
    }
  }
  if (barcode && barcode.trim() !== "") {
    const [row] = await db
      .select({ id: stockUnits.id, stockItemId: stockUnits.stockItemId, itemName: stockItems.name })
      .from(stockUnits)
      .innerJoin(stockItems, eq(stockItems.id, stockUnits.stockItemId))
      .where(and(
        eq(stockUnits.companyId, companyId),
        sql`LOWER(${stockUnits.barcode}) = LOWER(${barcode.trim()})`,
        ...(excludeId ? [ne(stockUnits.id, excludeId)] : [])
      ))
      .limit(1);
    if (row) {
      throw new DuplicateUnitError(
        `Barcode "${barcode.trim()}" มีอยู่แล้วในระบบ`,
        "barcode", row.id, row.stockItemId, row.itemName,
      );
    }
  }
}

// เวอร์ชัน batch ของ checkUnitUnique — เช็ค serial/barcode ของหลาย unit พร้อมกันด้วย 2 query
// (IN แทนการวน await ทีละแถว) เพราะ round-trip ไปยัง Supabase pooler คือต้นทุนหลักที่ทำให้
// เพิ่มของทีละมาก ๆ ช้า ไม่ใช่ตัว query เอง (มี index lower(serial)/lower(barcode) อยู่แล้ว)
async function checkUnitsBatchUnique(companyId: string, rows: { serialNumber?: string | null; barcode?: string | null }[]) {
  const lowerSerials = Array.from(new Set(
    rows.map((r) => r.serialNumber?.trim()).filter((v): v is string => !!v).map((v) => v.toLowerCase())
  ));
  const lowerBarcodes = Array.from(new Set(
    rows.map((r) => r.barcode?.trim()).filter((v): v is string => !!v).map((v) => v.toLowerCase())
  ));

  if (lowerSerials.length > 0) {
    const [row] = await db
      .select({ id: stockUnits.id, stockItemId: stockUnits.stockItemId, itemName: stockItems.name, serialNumber: stockUnits.serialNumber })
      .from(stockUnits)
      .innerJoin(stockItems, eq(stockItems.id, stockUnits.stockItemId))
      .where(and(
        eq(stockUnits.companyId, companyId),
        inArray(sql`LOWER(${stockUnits.serialNumber})`, lowerSerials),
      ))
      .limit(1);
    if (row) {
      throw new DuplicateUnitError(
        `Serial number "${row.serialNumber}" มีอยู่แล้วในระบบ`,
        "serialNumber", row.id, row.stockItemId, row.itemName,
      );
    }
  }
  if (lowerBarcodes.length > 0) {
    const [row] = await db
      .select({ id: stockUnits.id, stockItemId: stockUnits.stockItemId, itemName: stockItems.name, barcode: stockUnits.barcode })
      .from(stockUnits)
      .innerJoin(stockItems, eq(stockItems.id, stockUnits.stockItemId))
      .where(and(
        eq(stockUnits.companyId, companyId),
        inArray(sql`LOWER(${stockUnits.barcode})`, lowerBarcodes),
      ))
      .limit(1);
    if (row) {
      throw new DuplicateUnitError(
        `Barcode "${row.barcode}" มีอยู่แล้วในระบบ`,
        "barcode", row.id, row.stockItemId, row.itemName,
      );
    }
  }
}

// แปลง error เป็น JSON response — เติม duplicateItemId/duplicateItemName ให้ client ถ้าเป็น
// DuplicateUnitError โดยเฉพาะ (ไม่กระทบ error ทั่วไปที่ยังส่งแค่ message เหมือนเดิม)
function unitErrorResponse(err: any): { status: number; body: Record<string, unknown> } {
  if (err instanceof DuplicateUnitError) {
    return {
      status: 409,
      body: {
        message: err.message,
        duplicateField:    err.duplicateField,
        duplicateUnitId:   err.duplicateUnitId,
        duplicateItemId:   err.duplicateItemId,
        duplicateItemName: err.duplicateItemName,
      },
    };
  }
  return { status: 400, body: { message: err?.message ?? "Request failed" } };
}

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

    const itemIds   = items.map((i) => i.id);
    const unitItemIds = items.filter((i) => i.trackingMode === "unit").map((i) => i.id);
    const bulkItemIds = items.filter((i) => i.trackingMode === "bulk").map((i) => i.id);

    // Unit items — count individual stock_units
    const totalCounts     = new Map<string, number>();
    const availableCounts = new Map<string, number>();
    const plannedCounts   = new Map<string, number>(); // available but reserved in a job plan

    if (unitItemIds.length > 0) {
      const units = await db
        .select({ id: stockUnits.id, stockItemId: stockUnits.stockItemId, status: stockUnits.status })
        .from(stockUnits)
        .where(inArray(stockUnits.stockItemId, unitItemIds));

      for (const u of units) {
        if (u.status === "sold" || u.status === "retired") continue;  // ตัดออกจากคลังแล้ว — ไม่นับใน total
        totalCounts.set(u.stockItemId, (totalCounts.get(u.stockItemId) ?? 0) + 1);
        if (u.status === "available") {
          availableCounts.set(u.stockItemId, (availableCounts.get(u.stockItemId) ?? 0) + 1);
        }
      }

      // plannedCount = available units that are assigned to a non-cancelled job
      const unitIds = units.filter((u) => u.status === "available").map((u) => u.id);
      if (unitIds.length > 0) {
        const planned = await db
          .select({ stockUnitId: jobUnits.stockUnitId, stockItemId: stockUnits.stockItemId })
          .from(jobUnits)
          .innerJoin(jobs, eq(jobs.id, jobUnits.jobId))
          .innerJoin(stockUnits, eq(stockUnits.id, jobUnits.stockUnitId))
          .where(and(
            inArray(jobUnits.stockUnitId, unitIds),
            sql`${jobs.status} != 'cancelled'`,
          ));
        for (const p of planned) {
          plannedCounts.set(p.stockItemId, (plannedCounts.get(p.stockItemId) ?? 0) + 1);
        }
      }
    }

    // Bulk items — availableCount = quantity - SUM(assigned to active jobs)
    if (bulkItemIds.length > 0) {
      const assigned = await db
        .select({
          stockItemId: jobStock.stockItemId,
          total: sql<number>`COALESCE(SUM(${jobStock.quantity}), 0)`.mapWith(Number),
        })
        .from(jobStock)
        .innerJoin(jobs, eq(jobs.id, jobStock.jobId))
        .where(and(
          inArray(jobStock.stockItemId, bulkItemIds),
          inArray(jobs.status, ["draft", "scheduled", "active"]),
        ))
        .groupBy(jobStock.stockItemId);

      const assignedMap = new Map(assigned.map((r) => [r.stockItemId, r.total]));

      for (const item of items.filter((i) => i.trackingMode === "bulk")) {
        const used = assignedMap.get(item.id) ?? 0;
        totalCounts.set(item.id, item.quantity);
        availableCounts.set(item.id, Math.max(0, item.quantity - used));
      }
    }

    // ชุดอุปกรณ์ที่อ้างถึงแต่ละ item (ทั้ง auto-pick และ pinned unit) → บอกในหน้าสต็อกว่าอยู่ชุดไหน
    const setsByItem = new Map<string, { id: string; name: string }[]>();
    const setRows = await db
      .select({ stockItemId: equipmentSetItems.stockItemId, setId: equipmentSets.id, setName: equipmentSets.name })
      .from(equipmentSetItems)
      .innerJoin(equipmentSets, eq(equipmentSets.id, equipmentSetItems.setId))
      .where(and(eq(equipmentSets.companyId, req.companyId), inArray(equipmentSetItems.stockItemId, itemIds)));
    for (const r of setRows) {
      const arr = setsByItem.get(r.stockItemId) ?? [];
      if (!arr.some((s) => s.id === r.setId)) arr.push({ id: r.setId, name: r.setName });
      setsByItem.set(r.stockItemId, arr);
    }

    res.json(items.map((i) => ({
      ...i,
      unitCount:      totalCounts.get(i.id)     ?? 0,
      availableCount: availableCounts.get(i.id) ?? 0,
      plannedCount:   plannedCounts.get(i.id)   ?? 0,
      sets:           setsByItem.get(i.id)      ?? [],
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

    const allUnits = await db
      .select()
      .from(stockUnits)
      .where(inArray(stockUnits.stockItemId, items.map((i) => i.id)));

    const unitsByItem: Record<string, typeof allUnits> = {};
    for (const u of allUnits) {
      if (!unitsByItem[u.stockItemId]) unitsByItem[u.stockItemId] = [];
      unitsByItem[u.stockItemId].push(u);
    }

    // Compute availableCount for bulk items
    const bulkIds = items.filter((i) => i.trackingMode === "bulk").map((i) => i.id);
    const bulkAvailMap = new Map<string, number>();
    if (bulkIds.length > 0) {
      const assigned = await db
        .select({
          stockItemId: jobStock.stockItemId,
          total: sql<number>`COALESCE(SUM(${jobStock.quantity}), 0)`.mapWith(Number),
        })
        .from(jobStock)
        .innerJoin(jobs, eq(jobs.id, jobStock.jobId))
        .where(and(
          inArray(jobStock.stockItemId, bulkIds),
          inArray(jobs.status, ["draft", "scheduled", "active"]),
        ))
        .groupBy(jobStock.stockItemId);
      for (const row of assigned) {
        bulkAvailMap.set(row.stockItemId, row.total);
      }
    }

    // lastPosition — most recently used zone (FOH/Mon/...) per stock item, for smart-default
    // prefill in the equipment picker cart. Unit-tracked items look at job_units (via their
    // units' stockItemId); bulk items look at job_stock directly. Both company-scoped.
    const lastPositionMap = new Map<string, string>();

    const unitLastPos = await db
      .selectDistinctOn([stockUnits.stockItemId], {
        stockItemId: stockUnits.stockItemId,
        position:    jobUnits.position,
      })
      .from(jobUnits)
      .innerJoin(stockUnits, eq(stockUnits.id, jobUnits.stockUnitId))
      .innerJoin(jobs, eq(jobs.id, jobUnits.jobId))
      .where(and(eq(jobs.companyId, req.companyId), isNotNull(jobUnits.position)))
      .orderBy(stockUnits.stockItemId, desc(jobs.startDate), desc(jobs.createdAt));
    for (const r of unitLastPos) {
      if (r.position) lastPositionMap.set(r.stockItemId, r.position);
    }

    const bulkLastPos = await db
      .selectDistinctOn([jobStock.stockItemId], {
        stockItemId: jobStock.stockItemId,
        position:    jobStock.position,
      })
      .from(jobStock)
      .innerJoin(jobs, eq(jobs.id, jobStock.jobId))
      .where(and(eq(jobs.companyId, req.companyId), isNotNull(jobStock.position)))
      .orderBy(jobStock.stockItemId, desc(jobs.startDate), desc(jobs.createdAt));
    for (const r of bulkLastPos) {
      if (r.position && !lastPositionMap.has(r.stockItemId)) lastPositionMap.set(r.stockItemId, r.position);
    }

    res.json(items.map((item) => {
      const itemUnits = (unitsByItem[item.id] ?? []).slice().sort((a, b) => naturalCompare(a.name ?? "", b.name ?? ""));
      const availableCount = item.trackingMode === "bulk"
        ? (item.quantity ?? 0) - (bulkAvailMap.get(item.id) ?? 0)
        : itemUnits.filter((u) => u.status === "available").length;
      return { ...item, units: itemUnits, availableCount, lastPosition: lastPositionMap.get(item.id) ?? null };
    }));
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

    const unitIds = units.map((u) => u.id);

    // หาว่า unit ไหนอยู่ใน rack/container ไหนบ้าง
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

    // Find which job(s) each unit is assigned to — plannedJob = nearest one (back-compat),
    // bookings = full schedule (past + upcoming) for the "ตารางการออกงาน" table
    const plannedJobMap = new Map<string, { id: string; name: string; startDate: Date | null; status: string }>();
    const bookingsMap    = new Map<string, { jobId: string; jobName: string; startDate: Date | null; endDate: Date | null; status: string }[]>();
    if (unitIds.length > 0) {
      const assignments = await db
        .select({
          stockUnitId: jobUnits.stockUnitId,
          jobId:       jobs.id,
          jobName:     jobs.name,
          startDate:   jobs.startDate,
          endDate:     jobs.endDate,
          jobStatus:   jobs.status,
        })
        .from(jobUnits)
        .innerJoin(jobs, eq(jobs.id, jobUnits.jobId))
        .where(and(
          inArray(jobUnits.stockUnitId, unitIds),
          sql`${jobs.status} != 'cancelled'`,
        ))
        .orderBy(jobs.startDate);
      for (const a of assignments) {
        // keep the first (earliest) job if somehow in multiple
        if (!plannedJobMap.has(a.stockUnitId)) {
          plannedJobMap.set(a.stockUnitId, { id: a.jobId, name: a.jobName, startDate: a.startDate, status: a.jobStatus });
        }
        if (!bookingsMap.has(a.stockUnitId)) bookingsMap.set(a.stockUnitId, []);
        bookingsMap.get(a.stockUnitId)!.push({ jobId: a.jobId, jobName: a.jobName, startDate: a.startDate, endDate: a.endDate, status: a.jobStatus });
      }
    }

    const unitsWithContainer = units.map((u) => {
      const cId = unitContainerMap[u.id] ?? null;
      const c = cId ? containerMap[cId] : null;
      return {
        ...u,
        containerId:   c?.id ?? null,
        containerName: c?.name ?? null,
        containerType: c?.type ?? null,
        plannedJob:    plannedJobMap.get(u.id) ?? null,
        bookings:      bookingsMap.get(u.id) ?? [],
      };
    });

    unitsWithContainer.sort((a, b) => naturalCompare(a.name ?? "", b.name ?? ""));
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

    await checkItemNameUnique(req.companyId, data.name);

    const [item] = await db.insert(stockItems).values(data as typeof stockItems.$inferInsert).returning();

    const [actor] = await db.select({ name: users.name }).from(users).where(eq(users.id, req.userId));
    // fire-and-forget — don't block the response on the notification write
    void notifyCompany({
      companyId: req.companyId,
      actorId: req.userId,
      type: "stock_added",
      meta: { itemName: item.name, actorName: actor?.name ?? "" },
      link: "Stock",
    }).catch(() => {});

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

    if (rest.name) await checkItemNameUnique(req.companyId, rest.name, req.params.id);

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
    // ป้องกันการลบถ้ามี units ที่ยังอยู่ในงาน
    const units = await db
      .select({ id: stockUnits.id })
      .from(stockUnits)
      .where(eq(stockUnits.stockItemId, req.params.id));

    if (units.length > 0) {
      const unitIds = units.map((u) => u.id);
      const inJob = await db
        .select({ id: jobUnits.stockUnitId })
        .from(jobUnits)
        .where(inArray(jobUnits.stockUnitId, unitIds))
        .limit(1);
      if (inJob.length > 0) {
        return res.status(409).json({ message: `ไม่สามารถลบได้: มีอุปกรณ์ที่ยังอยู่ในงาน กรุณานำออกจากงานก่อน` });
      }

      const outUnits = await db
        .select({ id: stockUnits.id })
        .from(stockUnits)
        .where(and(eq(stockUnits.stockItemId, req.params.id), eq(stockUnits.status, "out")))
        .limit(1);
      if (outUnits.length > 0) {
        return res.status(409).json({ message: "ไม่สามารถลบได้: มีอุปกรณ์ที่ยังออกงานอยู่" });
      }
    }

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

    await checkUnitUnique(req.companyId, { serialNumber: data.serialNumber, barcode: data.barcode });

    const [unit] = await db.insert(stockUnits).values(data).returning();

    const [item] = await db.select({ name: stockItems.name }).from(stockItems).where(eq(stockItems.id, req.params.id));
    const [actor] = await db.select({ name: users.name }).from(users).where(eq(users.id, req.userId));
    // fire-and-forget — don't block the response on the notification write
    void notifyCompany({
      companyId: req.companyId,
      actorId: req.userId,
      type: "stock_added",
      meta: { itemName: item?.name ?? "", actorName: actor?.name ?? "" },
      link: "Stock",
    }).catch(() => {});

    res.status(201).json(unit);
  } catch (err: any) {
    const { status, body } = unitErrorResponse(err);
    res.status(status).json(body);
  }
});

// POST /api/stock/:id/units/batch — เพิ่มหลาย unit พร้อมกัน (insert เดียว + notify เดียว)
// แทนการยิงทีละ unit จาก client — ลด round-trip + notify write เป็น N เท่า
stockRouter.post("/:id/units/batch", async (req, res) => {
  try {
    const list = Array.isArray(req.body?.units) ? req.body.units : [];
    if (list.length === 0) return res.status(400).json({ message: "ไม่มีหน่วยอุปกรณ์ที่จะเพิ่ม" });

    const rows = list.map((u: any) => insertStockUnitSchema.parse({
      ...u,
      stockItemId: req.params.id,
      companyId: req.companyId,
    }));

    // ตรวจ serial/barcode ซ้ำกันเองภายใน batch (checkUnitUnique เช็คกับ DB เท่านั้น)
    const lowerSerials  = rows.map((r: any) => r.serialNumber?.trim().toLowerCase()).filter(Boolean) as string[];
    const lowerBarcodes = rows.map((r: any) => r.barcode?.trim().toLowerCase()).filter(Boolean) as string[];
    const firstDup = (arr: string[]) => arr.find((v, i) => arr.indexOf(v) !== i);
    const dupS = firstDup(lowerSerials);
    if (dupS)  throw new Error(`Serial number "${dupS}" ซ้ำกันในรายการที่เพิ่ม`);
    const dupB = firstDup(lowerBarcodes);
    if (dupB)  throw new Error(`Barcode "${dupB}" ซ้ำกันในรายการที่เพิ่ม`);

    // ตรวจซ้ำกับ DB (ใช้ index lower(serial)/lower(barcode) จาก migration 0016) — 2 query รวม
    // ไม่ใช่วน await ทีละแถว (round-trip ไปยัง pooler คือต้นทุนหลัก ไม่ใช่ตัว query)
    await checkUnitsBatchUnique(req.companyId, rows);

    const inserted = await db.insert(stockUnits).values(rows).returning();

    const [item]  = await db.select({ name: stockItems.name }).from(stockItems).where(eq(stockItems.id, req.params.id));
    const [actor] = await db.select({ name: users.name }).from(users).where(eq(users.id, req.userId));
    void notifyCompany({
      companyId: req.companyId,
      actorId: req.userId,
      type: "stock_added",
      meta: { itemName: item?.name ?? "", actorName: actor?.name ?? "", count: inserted.length },
      link: "Stock",
    }).catch(() => {});

    res.status(201).json(inserted);
  } catch (err: any) {
    const { status, body } = unitErrorResponse(err);
    res.status(status).json(body);
  }
});

// PUT /api/stock/units/batch — แก้ไขหลาย unit พร้อมกัน (เฉพาะฟิลด์ที่ใช้ร่วมกันได้)
// ต้องมาก่อน "/units/:unitId" ไม่งั้น Express จับ "batch" เป็น unitId
stockRouter.put("/units/batch", async (req, res) => {
  if (req.userRole !== "admin" && req.userRole !== "manager") {
    return res.status(403).json({ message: "ต้องเป็นผู้ดูแล/ผู้จัดการเท่านั้น" });
  }
  try {
    const unitIds: string[] = Array.isArray(req.body?.unitIds) ? req.body.unitIds : [];
    const patch = (req.body?.patch ?? {}) as Record<string, any>;
    if (unitIds.length === 0) return res.status(400).json({ message: "ไม่มีหน่วยอุปกรณ์ที่เลือก" });

    // อนุญาตเฉพาะฟิลด์ที่แชร์กันได้ (ไม่รวม serial/barcode/name ที่ต้อง unique ต่อ unit)
    const toDate = (v: any): Date | null => {
      if (!v || v === "") return null;
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    };
    const payload: Record<string, any> = {};
    if ("location" in patch)          payload.location = patch.location || null;
    if ("status" in patch)            payload.status = patch.status;
    if ("purchasedAt" in patch)       payload.purchasedAt = toDate(patch.purchasedAt);
    if ("warrantyExpiresAt" in patch) payload.warrantyExpiresAt = toDate(patch.warrantyExpiresAt);
    if (Object.keys(payload).length === 0) return res.status(400).json({ message: "ไม่มีฟิลด์ที่จะแก้ไข" });

    const updated = await db
      .update(stockUnits)
      .set(payload)
      .where(and(inArray(stockUnits.id, unitIds), eq(stockUnits.companyId, req.companyId)))
      .returning();
    res.json({ updated: updated.length });
  } catch (err: any) {
    res.status(400).json({ message: err?.message ?? "แก้ไขไม่สำเร็จ" });
  }
});

// PUT /api/stock/units/batch-values — แก้ชื่อ/บาร์โค้ดของหลาย unit พร้อมกัน โดยแต่ละ unit
// มีค่าต่างกันได้ (ไม่ใช่ apply ค่าเดียวกับทุกตัวแบบ /units/batch) — อัปเดตครั้งเดียวด้วย
// CASE id WHEN...THEN...END ไม่ใช่วน await ทีละ unit
stockRouter.put("/units/batch-values", async (req, res) => {
  if (req.userRole !== "admin" && req.userRole !== "manager") {
    return res.status(403).json({ message: "ต้องเป็นผู้ดูแล/ผู้จัดการเท่านั้น" });
  }
  try {
    const rows: { id: string; name?: string; barcode?: string }[] = Array.isArray(req.body?.units) ? req.body.units : [];
    if (rows.length === 0) return res.status(400).json({ message: "ไม่มีหน่วยอุปกรณ์ที่จะแก้ไข" });

    const unitIds = rows.map((r) => r.id);

    const barcodeRows = rows.filter((r): r is { id: string; barcode: string } => typeof r.barcode === "string" && r.barcode.trim() !== "");
    const lowerBarcodes = barcodeRows.map((r) => r.barcode.trim().toLowerCase());

    // ตรวจบาร์โค้ดซ้ำกันเองภายใน batch นี้
    const dup = lowerBarcodes.find((v, i) => lowerBarcodes.indexOf(v) !== i);
    if (dup) throw new Error(`Barcode "${dup}" ซ้ำกันในรายการที่แก้`);

    // ตรวจว่าชนกับ unit อื่นที่ไม่ได้อยู่ใน batch นี้หรือไม่ (1 query)
    if (lowerBarcodes.length > 0) {
      const [conflict] = await db
        .select({ id: stockUnits.id, stockItemId: stockUnits.stockItemId, itemName: stockItems.name, barcode: stockUnits.barcode })
        .from(stockUnits)
        .innerJoin(stockItems, eq(stockItems.id, stockUnits.stockItemId))
        .where(and(
          eq(stockUnits.companyId, req.companyId),
          inArray(sql`LOWER(${stockUnits.barcode})`, lowerBarcodes),
          notInArray(stockUnits.id, unitIds),
        ))
        .limit(1);
      if (conflict) {
        throw new DuplicateUnitError(
          `Barcode "${conflict.barcode}" มีอยู่แล้วในระบบ`,
          "barcode", conflict.id, conflict.stockItemId, conflict.itemName,
        );
      }
    }

    const nameRows = rows.filter((r): r is { id: string; name: string } => typeof r.name === "string" && r.name.trim() !== "");

    const setPayload: Record<string, unknown> = {};
    if (nameRows.length > 0) {
      const cases = nameRows.map((r) => sql`WHEN ${r.id} THEN ${r.name.trim()}`);
      setPayload.name = sql.join([sql`CASE ${stockUnits.id}`, ...cases, sql`ELSE ${stockUnits.name} END`], sql` `);
    }
    if (barcodeRows.length > 0) {
      const cases = barcodeRows.map((r) => sql`WHEN ${r.id} THEN ${r.barcode.trim()}`);
      setPayload.barcode = sql.join([sql`CASE ${stockUnits.id}`, ...cases, sql`ELSE ${stockUnits.barcode} END`], sql` `);
    }
    if (Object.keys(setPayload).length === 0) return res.status(400).json({ message: "ไม่มีฟิลด์ที่จะแก้ไข" });

    const updated = await db
      .update(stockUnits)
      .set(setPayload)
      .where(and(inArray(stockUnits.id, unitIds), eq(stockUnits.companyId, req.companyId)))
      .returning({ id: stockUnits.id, name: stockUnits.name, barcode: stockUnits.barcode });

    res.json({ updated: updated.length, units: updated });
  } catch (err: any) {
    const { status, body } = unitErrorResponse(err);
    res.status(status).json(body);
  }
});

// DELETE /api/stock/units/batch — ลบหลาย unit พร้อมกัน (บล็อกถ้ามีตัวที่อยู่ในงาน)
stockRouter.delete("/units/batch", async (req, res) => {
  if (req.userRole !== "admin" && req.userRole !== "manager") {
    return res.status(403).json({ message: "ต้องเป็นผู้ดูแล/ผู้จัดการเท่านั้น" });
  }
  try {
    const unitIds: string[] = Array.isArray(req.body?.unitIds) ? req.body.unitIds : [];
    if (unitIds.length === 0) return res.status(400).json({ message: "ไม่มีหน่วยอุปกรณ์ที่เลือก" });

    const inJob = await db
      .select({ id: jobUnits.stockUnitId })
      .from(jobUnits)
      .where(inArray(jobUnits.stockUnitId, unitIds))
      .limit(1);
    if (inJob.length > 0) {
      return res.status(409).json({ message: "ไม่สามารถลบได้: มีหน่วยที่ยังอยู่ในงาน กรุณานำออกจากงานก่อน" });
    }

    const deleted = await db
      .delete(stockUnits)
      .where(and(inArray(stockUnits.id, unitIds), eq(stockUnits.companyId, req.companyId)))
      .returning({ id: stockUnits.id });
    res.json({ deleted: deleted.length });
  } catch {
    res.status(500).json({ message: "ลบไม่สำเร็จ" });
  }
});

// DELETE /api/stock/units/:unitId — ลบ unit เดี่ยว (บล็อกถ้าอยู่ในงาน)
stockRouter.delete("/units/:unitId", async (req, res) => {
  if (req.userRole !== "admin" && req.userRole !== "manager") {
    return res.status(403).json({ message: "ต้องเป็นผู้ดูแล/ผู้จัดการเท่านั้น" });
  }
  try {
    const inJob = await db
      .select({ id: jobUnits.stockUnitId })
      .from(jobUnits)
      .where(eq(jobUnits.stockUnitId, req.params.unitId))
      .limit(1);
    if (inJob.length > 0) {
      return res.status(409).json({ message: "ไม่สามารถลบได้: หน่วยนี้ยังอยู่ในงาน กรุณานำออกจากงานก่อน" });
    }

    const [unit] = await db
      .delete(stockUnits)
      .where(and(eq(stockUnits.id, req.params.unitId), eq(stockUnits.companyId, req.companyId)))
      .returning({ id: stockUnits.id });
    if (!unit) return res.status(404).json({ message: "Unit not found" });
    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ message: "ลบไม่สำเร็จ" });
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

    // ตรวจซ้ำเฉพาะฟิลด์ที่ "เปลี่ยนจริง" — แก้แค่ชื่อ/สถานที่ ไม่ควรถูกบล็อกด้วย serial/barcode เดิม
    const [current] = await db
      .select({ serialNumber: stockUnits.serialNumber, barcode: stockUnits.barcode })
      .from(stockUnits)
      .where(and(eq(stockUnits.id, req.params.unitId), eq(stockUnits.companyId, req.companyId)));
    if (!current) return res.status(404).json({ message: "Unit not found" });

    const norm = (v: any) => (v ?? "").toString().trim().toLowerCase();
    const serialChanged  = "serialNumber" in rest && norm(rest.serialNumber) !== norm(current.serialNumber);
    const barcodeChanged  = "barcode" in rest && norm(rest.barcode) !== norm(current.barcode);
    await checkUnitUnique(
      req.companyId,
      {
        serialNumber: serialChanged ? rest.serialNumber : null,
        barcode:      barcodeChanged ? rest.barcode : null,
      },
      req.params.unitId,
    );

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
    const { status, body } = unitErrorResponse(err);
    res.status(status).json(body);
  }
});

// ─── Item Accessories ──────────────────────────────────────

// GET /api/stock/accessories/all — links ทั้งหมดของบริษัท (ใช้ใน ManageJobStockModal)
stockRouter.get("/accessories/all", async (req, res) => {
  try {
    const links = await db
      .select()
      .from(itemAccessories)
      .where(eq(itemAccessories.companyId, req.companyId));
    res.json(links);
  } catch {
    res.status(500).json({ message: "Failed to fetch accessory links" });
  }
});

// GET /api/stock/:id/accessories — links สำหรับ parent item เดียว พร้อม accessory name + availableCount
stockRouter.get("/:id/accessories", async (req, res) => {
  try {
    const links = await db
      .select()
      .from(itemAccessories)
      .where(and(
        eq(itemAccessories.parentStockItemId, req.params.id),
        eq(itemAccessories.companyId, req.companyId),
      ));

    const result = await Promise.all(links.map(async (link) => {
      const [acc] = await db
        .select({ name: stockItems.name })
        .from(stockItems)
        .where(eq(stockItems.id, link.accessoryStockItemId));
      const availableUnits = await db
        .select({ id: stockUnits.id })
        .from(stockUnits)
        .where(and(
          eq(stockUnits.stockItemId, link.accessoryStockItemId),
          eq(stockUnits.status, "available"),
        ));
      return { ...link, accessoryName: acc?.name ?? "—", availableCount: availableUnits.length };
    }));

    res.json(result);
  } catch {
    res.status(500).json({ message: "Failed to fetch accessories" });
  }
});

// POST /api/stock/:id/accessories — link accessory ใหม่ (Admin/Manager เท่านั้น)
stockRouter.post("/:id/accessories", async (req, res) => {
  if (req.userRole !== "admin" && req.userRole !== "manager") {
    return res.status(403).json({ message: "เฉพาะ Admin และ Manager เท่านั้น" });
  }
  try {
    const [link] = await db
      .insert(itemAccessories)
      .values({
        companyId:            req.companyId,
        parentStockItemId:    req.params.id,
        accessoryStockItemId: req.body.accessoryStockItemId,
        quantityPerUnit:      req.body.quantityPerUnit ?? 1,
        required:             req.body.required ?? true,
      })
      .returning();
    res.status(201).json(link);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/stock/accessories/:linkId — อัปเดต quantityPerUnit / required
stockRouter.put("/accessories/:linkId", async (req, res) => {
  if (req.userRole !== "admin" && req.userRole !== "manager") {
    return res.status(403).json({ message: "เฉพาะ Admin และ Manager เท่านั้น" });
  }
  try {
    const [link] = await db
      .update(itemAccessories)
      .set({ quantityPerUnit: req.body.quantityPerUnit, required: req.body.required })
      .where(and(
        eq(itemAccessories.id, req.params.linkId),
        eq(itemAccessories.companyId, req.companyId),
      ))
      .returning();
    if (!link) return res.status(404).json({ message: "Link not found" });
    res.json(link);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/stock/accessories/:linkId — ลบ link (Admin/Manager เท่านั้น)
stockRouter.delete("/accessories/:linkId", async (req, res) => {
  if (req.userRole !== "admin" && req.userRole !== "manager") {
    return res.status(403).json({ message: "เฉพาะ Admin และ Manager เท่านั้น" });
  }
  try {
    const [deleted] = await db
      .delete(itemAccessories)
      .where(and(
        eq(itemAccessories.id, req.params.linkId),
        eq(itemAccessories.companyId, req.companyId),
      ))
      .returning();
    if (!deleted) return res.status(404).json({ message: "Link not found" });
    res.json({ message: "Accessory link removed" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});
