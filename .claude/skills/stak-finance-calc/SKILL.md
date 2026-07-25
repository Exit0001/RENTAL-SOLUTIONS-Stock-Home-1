---
name: stak-finance-calc
description: "STAK equipment finance & health calculations — the single source of truth for per-model ROI, rental-value revenue, payback, utilization, dashboard rankings (top earners / best ROI / underperformers), overall fleet health %, and maintenance-due alerts. Use for ANY task that computes, ranks, displays, reviews, or explains equipment profitability or service-due logic. Triggers: ROI, คำนวณ, กำไร (profit), ต้นทุน (cost), ค่าเช่า (daily rate), payback, utilization, revenue, ranking/อันดับ, dashboard, health score, สุขภาพอุปกรณ์, maintenance due, ควรตรวจเช็ค, ประกันหมดอายุ (warranty), แนะนำขาย (sell recommendation). Covers exact schema columns, formulas, edge cases, rounding, and where each endpoint belongs."
---

# STAK Finance Calc — ROI / Health / Maintenance-due

Single source of truth for STAK v2.0's equipment finance math. Every formula here references
**real columns** in `shared/schema.ts`. When implementing, reviewing, or explaining any of these
numbers, use these definitions verbatim so results stay consistent across API, dashboard, and PDF.

STAK is a **multi-tenant** rental SaaS: **every query MUST filter by `company_id`**. All formulas
below are implicitly company-scoped.

## When to apply

- Building/reviewing per-item ROI, profitability rankings, or "should we sell this?" logic
- Computing fleet **Overall Health %** or **maintenance-due** alerts
- Any dashboard card, Finance tab, or report that shows revenue/cost/ROI/health per equipment
- Explaining to the user why a number is what it is

## Core principle: revenue is per-JOB, value is per-ITEM

Actual money (`invoices.amount`) is recorded per **job**, never per equipment piece. So per-item
profitability uses **rental value generated** (`dailyRate × rentalDays`) as the revenue proxy — the
only figure that can be attributed to a specific model accurately. Job-level ROI already exists in
`GET /api/finance/costing` (`server/routes/finance.ts`) and is a **different** metric — do not
conflate the two.

## Data sources (exact columns — all `company_id`-scoped)

| Table | Columns used |
|---|---|
| `stock_items` | `purchaseCost`, `dailyRate`, `replacementValue`, `quantity`, `trackingMode` (`unit`\|`bulk`), `category`, `brand`, `name` |
| `stock_units` | `stockItemId`, `status`, `healthScore`, `warrantyExpiresAt`, `purchasedAt`, `createdAt` |
| `job_units` | `stockUnitId`, `jobId` — unit-tracked usage history |
| `job_stock` | `stockItemId`, `jobId`, `quantity` — bulk usage history |
| `jobs` | `startDate`, `endDate`, `status` (`draft`\|`scheduled`\|`active`\|`completed`\|`cancelled`) |
| `maintenanceLogs` | `stockUnitId`, `cost`, `status` (`in_progress`\|`completed`), `type` (e.g. `repair`), `date` |

**Proposed new column (NOT created yet — for the later build):**
`stock_items.roi_revenue_override numeric(14,2)` nullable — manual custom revenue per model.
Migration must be run in Supabase SQL Editor (`db:migrate` is broken per CLAUDE.md).

**Status exclusions (apply everywhere):**
- `stock_units.status IN ('sold','retired')` → excluded from counts, capital, health, usage.
- `jobs.status = 'cancelled'` → excluded from all usage/rental-day sums.

## 1. ROI per model

All amounts in ฿ (THB). Computed **per `stock_item`** (model), aggregating its units.

```
jobDays(job)     = max(1, round((job.endDate − job.startDate) / 1 day))
                   // calendar span, minimum 1 day; cancelled jobs excluded upstream

unitCount        = count of the model's stock_units where status NOT IN ('sold','retired')
                   // trackingMode='bulk' → unitCount = stock_items.quantity

rentalDays       = Σ jobDays(job) over every job_units row of the model's units (non-cancelled jobs)
                   // bulk → Σ (job_stock.quantity × jobDays(job)) over the model's job_stock rows

revenueGenerated = roiRevenueOverride ?? (dailyRate × rentalDays)      // ← the "custom" override
capital          = purchaseCost × unitCount                            // total money sunk into the model
maintCost        = Σ maintenanceLogs.cost where status='completed' for the model's units

netProfit        = revenueGenerated − capital − maintCost
roiPct           = capital > 0 ? round(netProfit / capital × 100) : null
payback          = capital > 0 ? round(revenueGenerated / capital, 1) : null   // ≥ 1.0 ⇒ paid off
paidOff          = revenueGenerated ≥ capital

daysOwned        = today − min(purchasedAt ?? createdAt) across the model's units   (in days)
utilizationPct   = daysOwned > 0 ? round(rentalDays / (unitCount × daysOwned) × 100) : null
```

### The custom override (`roiRevenueOverride`)
- Blank/null → revenue auto-computes as `dailyRate × rentalDays`.
- Set → that value **replaces** the computed revenue (a manual total, e.g. to reflect real
  negotiated prices/discounts the daily rate doesn't capture).
- Editable per model in the ROI UI; persisted via `PUT /api/finance/item-roi/:itemId`.
- **Alternative design** (document, not default): store a per-model *ROI daily rate* instead of a
  total — it keeps auto-updating as usage grows. Chosen default is the **total-revenue override**
  because it maps directly to "type in my own number."

### Worked example
Amp model: `purchaseCost` ฿50,000, `unitCount` 1, `dailyRate` ฿1,500, used across jobs totalling
`rentalDays` 180, no completed repairs.
```
revenueGenerated = 1,500 × 180 = 270,000
capital          = 50,000 × 1  = 50,000
netProfit        = 270,000 − 50,000 − 0 = 220,000
roiPct           = round(220,000 / 50,000 × 100) = 440   → +440%
payback          = round(270,000 / 50,000, 1)    = 5.4   → paid off ✓
```

## 2. Dashboard rankings

From the per-model ROI list (company-scoped):
- 💰 **ทำเงินสูงสุด / Top earners** — sort `revenueGenerated` desc.
- 📈 **ROI ดีสุด / Best ROI** — sort `roiPct` desc; include only models with `capital > 0`.
- 🐢 **ไม่คุ้ม / Underperformers ("แนะนำขาย")** — `roiPct < 0`, or lowest `utilizationPct` among
  paid-for models. Pairs naturally with the existing Stock → "ขายออก" (dispose) tab.

Models missing `purchaseCost` or `dailyRate` show `—` for ROI/payback and are **excluded from
ROI-based ranks** (they may still appear in Top earners if `dailyRate` exists).

## 3. Overall Health %

```
overallHealth = round(avg(stock_units.healthScore))   over units NOT IN ('sold','retired')
```
Already computed in `server/routes/analytics.ts` (`avgHealth`). Display bands:
- **≥ 80** — good (green)
- **50–79** — watch (amber)
- **< 50** — critical (red)

`healthScore` itself is maintained by `recalculateUnitHealth()` in `server/lib/health.ts`
(starts 100, deducts per open/resolved incident by severity and per maintenance log). Do **not**
re-derive health here — read the stored `healthScore`.

## 4. Maintenance-due alerts

A unit is **due for a check** if **A OR B** holds:

```
A) Warranty expired:
     warrantyExpiresAt IS NOT NULL AND warrantyExpiresAt < now

B) Heavy usage since last service:
     lastService(unit)  = MAX(maintenanceLogs.date WHERE stockUnitId = unit AND status='completed')
                          ?? unit.purchasedAt ?? unit.createdAt
     usageSinceService  = Σ jobDays(job) over the unit's job_units rows
                          where job.startDate > lastService(unit) AND job.status != 'cancelled'
     due if usageSinceService > THRESHOLD_DAYS
```

- `THRESHOLD_DAYS` default = **60** rental-days (configurable; expose as a constant/company
  setting when built).
- **No migration** — "last service" is derived from `maintenanceLogs`, not a stored column.
- Output per flagged unit: `itemName`, `category`, `healthScore`, `reason[]` (`warranty` /
  `heavy_use`) → feeds the dashboard card **"🔧 ควรตรวจเช็ค N ชิ้น"** with a link to create a
  maintenance log for that unit.

## 5. Edge cases & rounding (enforce everywhere)

- Exclude `sold`/`retired` units from counts, `capital`, health, and usage.
- Exclude `cancelled` jobs from every rental-day / usage sum.
- `jobDays` minimum **1** (a same-day job still counts as one rental-day).
- Null `purchaseCost` **or** `dailyRate` ⇒ `roiPct` and `payback` = `null` ⇒ render `—`;
  excluded from ROI ranks.
- **Bulk** (`trackingMode='bulk'`) items have **no** `stock_units`: use `stock_items.quantity` for
  `unitCount` and `job_stock.quantity` for usage. Bulk items are not eligible for maintenance-due
  (no per-unit `warrantyExpiresAt`/`healthScore`).
- Rounding for display: currency ฿ → whole numbers; ratios (payback) → 1 decimal; percentages →
  whole numbers.
- Decimal columns come back as **strings** from Drizzle/pg — wrap in `Number(...)` before math
  (see the `Number(i.amount ?? 0)` pattern in `server/routes/finance.ts`).

## 6. Reference implementation notes (for the later build — not part of this skill)

- `GET /api/finance/item-roi` in `server/routes/finance.ts` — mirror the existing `/costing`
  handler shape (per-row aggregation, `company_id`-scoped, `Number()` coercion).
- `PUT /api/finance/item-roi/:itemId` — save `roiRevenueOverride` (Admin/Manager only).
- Maintenance-due + Overall Health — extend `server/routes/analytics.ts` (already returns
  `healthMetrics.overall`); add a `maintenanceDue` array.
- Migration: `ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS roi_revenue_override numeric(14,2);`
  run in Supabase SQL Editor.
- Client (`client/src/api/index.ts`): add `financeApi.getItemRoi` / `saveItemRoiOverride`;
  query keys `["item-roi"]`, `["maintenance-due"]`. Follow the TanStack Query + cache-invalidation
  conventions in CLAUDE.md.
- All Thai UI labels: put through i18n (`t("key")`) like the rest of the app.
