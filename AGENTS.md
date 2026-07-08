# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**STAK v2.0** — Multi-tenant AV/audio-visual rental equipment management SaaS. Built for 1 company now, scaling to 100+ companies. Each company's data is isolated via `company_id` on every database table.

Dark theme, yellow (`#FFFF00`) accent color throughout.

## Commands

```bash
npm run dev          # Start dev server (Express + Vite HMR) on port 5000
npm run check        # TypeScript type check (no emit)
npm run build        # Production build

npm run db:generate  # Generate SQL migration from schema changes → /migrations/
npm run db:migrate   # Apply pending migrations to database
npm run db:studio    # Open Drizzle Studio (visual DB browser)
```

**Windows note:** `npm run dev` uses `cross-env` to set `NODE_ENV=development`. If port 5000 is busy: `Stop-Process -Name "node" -Force`

**Windows note (dev script):** `dev` runs via `node --import tsx --watch server/index.ts` (NOT `tsx watch`). `tsx watch`'s own watcher/IPC deadlocks with the esbuild service spawned by the dynamic `await import("./vite")` in `server/index.ts` — the process hangs forever right after "Migration skipped", never reaching "serving on port 5000", with a stuck `esbuild.exe --service --ping` child (0% CPU). `node --watch` + `--import tsx` uses Node's native watch/restart instead and avoids this deadlock.

**Database note:** Supabase direct connection (port 5432) is blocked by IPv6. Use the **Session Pooler** URL (`aws-1-ap-northeast-1.pooler.supabase.com:5432`) in `.env`. Running migrations via SQL Editor in Supabase dashboard works as an alternative to `npm run db:migrate`.

## Architecture

Single repo, full-stack TypeScript:

```
client/src/          ← React 18 frontend (Vite)
  api/               ← All API calls (client.ts + index.ts) — TanStack Query hooks
  store/appStore.ts  ← Zustand global state (navigation + containers)
  pages/sections/    ← Main pages + modal components
  components/ui/     ← shadcn/ui primitives (don't modify)

server/              ← Express 5 backend
  index.ts           ← App bootstrap; auto-runs migrations if DATABASE_URL set
  db.ts              ← Drizzle + pg Pool connection; runMigrations()
  routes.ts          ← Mounts all sub-routers (prefix /api)
  routes/            ← One file per domain: stock.ts, jobs.ts, maintenance.ts, etc.

shared/schema.ts     ← Single source of truth: Drizzle schema + Zod validators + TS types
migrations/          ← SQL migration files (commit these to git)
scripts/             ← One-off scripts (e.g. data migration)
```

## Key Patterns

**Multi-tenant isolation:** Every business table has `company_id uuid NOT NULL` referencing `companies.id`. Row Level Security (RLS) enabled on Supabase. Never query without filtering by `company_id`.

**Schema → Types → Validation pipeline:**
```typescript
// shared/schema.ts defines everything in one place:
export const stockItems = pgTable(...)           // Drizzle table
export const insertStockItemSchema = createInsertSchema(stockItems)  // Zod
export type StockItem = typeof stockItems.$inferSelect  // TypeScript type
```

**API layer:** All fetch calls go through `client/src/api/index.ts`. Components use TanStack Query (`useQuery` / `useMutation`) — never raw `fetch` inside components.

**Global state:** `useAppStore()` from `client/src/store/appStore.ts` holds navigation (`activePage`) and containers state. Local `useState` is for UI-only state (modals, filters, search).

**Path aliases:** `@/` → `client/src/`, `@shared/` → `shared/`, `@assets/` → `attached_assets/`

**Button style standard** (all action buttons):
```tsx
className="h-9 px-4 text-sm font-bold gap-2 hover:opacity-90"
style={{ backgroundColor: "#FFFF00" }}
// icon: w-4 h-4
```

**Top action bar style** (tabs with action buttons):
```tsx
className="flex flex-row items-center gap-3 w-full px-4 py-3 border-b border-white/10 bg-[#0f0f0f] flex-shrink-0"
```

## Database Schema (25 tables)

```
companies → users, stock_items, containers, jobs, maintenance_logs, quotes, invoices, incidents, activity_log
stock_items → stock_units → container_units → containers
jobs → job_stock, job_crew, job_units, job_containers, pull_sheets, sub_rentals, quotes, invoices, incidents
catalog: brands, categories, sub_categories, locations, container_types
notifications, push_subscriptions
```

All enums are `pgEnum` (enforced at DB level): `userRoleEnum`, `jobStatusEnum`, `stockUnitStatusEnum`, `containerTypeEnum`, `maintenanceTypeEnum`, `quoteStatusEnum`, `invoiceStatusEnum`, `incidentSeverityEnum`, `activityTypeEnum`, `maintenanceStatusEnum`, `subRentalStatusEnum`, `incidentStatusEnum`, `pullSheetStatusEnum`, `stockTrackingModeEnum`.

## Stock Unit Status — Sync Contract

`stock_units.status` reflects **physical location** only (warehouse vs dispatched).
**Job plan assignment does NOT touch status.** Only ScanModal events change status.

### Rules (enforce in every new route / feature)

| Event | Status change |
|---|---|
| Unit added to job plan (`POST /jobs/:id/units`) | **none** — status unchanged |
| Unit removed from job plan | **none** — status unchanged |
| Container added to job (`POST /jobs/:id/containers`) | **none** — status unchanged |
| Container removed from job | **none** — status unchanged |
| Job deleted (`DELETE /jobs/:id`) | `setUnitsAvailable(allUnitIds)` — safety net for any 'out' units |
| ScanModal checkout | `stockApi.updateUnit(id, { status:"out" })` + `jobsApi.updatePhase(id,"dispatched")` |
| ScanModal return | `stockApi.updateUnit(id, { status:"available" })` + `jobsApi.updatePhase(id,"planned")` |

### availableCount / plannedCount display

`GET /api/stock` returns three fields per unit item:
- `availableCount` = `COUNT(status = 'available')` — physical warehouse availability
- `plannedCount` = count of available units that are assigned to a non-cancelled job plan
- `unitCount` = total units

The inventory badge (`AvailabilityBadge`) shows:
- Green "พร้อมใช้งานทั้งหมด" when `availableCount - plannedCount === unitCount`
- Amber partial count when some are out or planned
- Blue "N จัดเตรียม" pill when `plannedCount > 0`

Each expanded unit row shows a blue "→ งาน: [Job Name] (date)" indicator when `plannedJob` is set.

A unit can legitimately be in `job_units` with `status='available'` — this is the normal "planned"
state (assigned to a job but physically still in the warehouse). `plannedJob` is populated from
`GET /api/stock/:id` via a JOIN on `job_units + jobs`.

### Client cache invalidation rule

Every client mutation that changes unit assignment or status **must** invalidate `["stock"]`
so the Inventory badge (`availableCount / plannedCount`) reflects the change immediately.
For per-item detail views also invalidate `["stock", stockItemId]`.

| Mutation | Required invalidations |
|---|---|
| ManageJobStockModal save | `["job-units", jobId]`, `["stock"]`, `["stock-with-units"]`, `["stock", stockItemId]` |
| AssignContainerModal assign | `["job-containers"]`, `["containers"]`, `["job-units"]`, `["stock"]` |
| JobsPage removeContainer | `["job-containers"]`, `["containers"]`, `["stock"]` |
| JobsPage deleteJob | `["jobs"]`, `["pull-sheets"]`, `["stock"]` |
| ScanModal scan (any mode) | `["job-units", jobId]`, `["stock"]`, `["stock", unit.stockItemId]` |

### Legacy data ⚠️ run this in Supabase SQL Editor

Units assigned to jobs before 2026-07-06 have `status="available"` in the DB (the sync was added later).
Run once to fix:
```sql
UPDATE stock_units su
SET status = 'out'
WHERE su.status = 'available'
  AND EXISTS (SELECT 1 FROM job_units ju WHERE ju.stock_unit_id = su.id);
```

## Current State (as of 2026-07-07)

### Data
- **2,188 stock_units** and **793 stock_items** migrated from `tenyear_backup_2026-06-09.sql` via `scripts/migrate-tenyear.js`
- **145 brands**, **19 categories**, **90 sub-categories** populated from backup
- Company in DB: `"test1"` (single tenant for now)

### Pending DB Migration ⚠️
`stock_units` needs 2 new columns, and `users` needs 1 new column — run in **Supabase SQL Editor**:
```sql
ALTER TABLE stock_units ADD COLUMN IF NOT EXISTS purchased_at TIMESTAMP;
ALTER TABLE stock_units ADD COLUMN IF NOT EXISTS warranty_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
```
These are already in `shared/schema.ts` and `migrations/0004_medical_stone_men.sql` /
`migrations/0007_lonely_famine.sql`.
Until run, `GET /api/stock/:id` (fetch units) will fail → unit sub-rows won't show in Inventory,
and `PUT /api/auth/me` (header profile/avatar update) will fail.

Also pending — new `notifications` table + `notification_type` enum (per-user notifications,
e.g. job assign/remove/update, pull sheet assign, maintenance assign, stock added), already in
`shared/schema.ts` and `migrations/0008_dark_blink.sql`:
```sql
CREATE TYPE "public"."notification_type" AS ENUM('job_assigned', 'job_removed', 'job_updated', 'pullsheet_assigned', 'maintenance_assigned', 'stock_added');

CREATE TABLE "notifications" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "company_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "actor_id" uuid,
    "type" "notification_type" NOT NULL,
    "meta" jsonb DEFAULT '{}'::jsonb,
    "link" text,
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
```
Until run, `/api/notifications/*` endpoints and the header Bell dropdown will fail (table doesn't exist).

**Pending (2026-06-16)** — `jobs.rehearsal_date` column, migration `0011_slim_typhoid_mary.sql`:
```sql
ALTER TABLE "jobs" ADD COLUMN "rehearsal_date" timestamp;
```
Until run, creating a job with a rehearsal date will fail.

**Already applied** — `companies` columns for LINE group push notifications (Settings →
General → LINE Notifications card, admin-only), in `shared/schema.ts` and
`migrations/0009_early_professor_monster.sql`. Already created in Supabase, no action needed.
Until an admin fills in both fields (Channel Access Token from a LINE Official Account's
Messaging API settings, and the target group's Group ID), `sendLineMessage()`
(`server/lib/line.ts`) is a no-op — no push is sent when a job is created.

**Already applied** — `push_subscriptions` table for Web Push (Settings → Profile → Push
Notifications card), in `shared/schema.ts` and `migrations/0010_ambiguous_miss_america.sql`.
Already created in Supabase, no action needed.

**Already applied** — `job_expenses` table for real ROI costing (Finance → Costing tab,
Staff/Transport columns), in `shared/schema.ts` and `migrations/0012_chief_speed_demon.sql`.
Already created in Supabase, no action needed.

**Already applied** — `job_vehicles` table for job logistics (Jobs page, Vehicles section),
in `shared/schema.ts` and `migrations/0013_brief_riptide.sql`. Already created in Supabase,
no action needed.

**Pending (2026-07-07)** — `stock_tracking_mode` enum + `stock_items.tracking_mode` column
for Bulk Quantity Mode (cables/consumables tracked by count, not individual units).
Already in `shared/schema.ts`. Run in Supabase SQL Editor:
```sql
CREATE TYPE "public"."stock_tracking_mode" AS ENUM('unit', 'bulk');
ALTER TABLE "stock_items" ADD COLUMN "tracking_mode" stock_tracking_mode DEFAULT 'unit' NOT NULL;
```
Until run, creating/editing a bulk-mode item will fail (column doesn't exist).

### Migration script state
`npm run db:migrate` fails because of a duplicate `0004_` migration tag conflict in the journal. Workaround: run SQL statements directly in Supabase SQL Editor.

### Containers tab (`client/src/pages/sections/StockPage.tsx`)
- **Delete container** — Trash2 icon button (Admin/Manager only), AlertDialog confirmation before delete
- Backend `DELETE /api/containers/:id` — role-gated, calls `setUnitsAvailable()` on container units if container was checked out before deleting
- FK cascade on `container_units` and `job_containers` cleans up join rows automatically

### Maintenance page (`client/src/pages/sections/StockPage.tsx`)
- Logs **grouped by Category** of the associated stock item — collapsed by default, click header to expand
- Each category header shows: record count + amber "กำลังซ่อม N รายการ" / green "เสร็จสิ้นทั้งหมด" badge
- **Bulk-select** (Admin/Manager only): custom yellow checkbox per row + per-category select-all checkbox + global select-all in `<thead>`
  - Checkboxes use custom `<div>` style matching `AddMaintenanceLogModal` — `border-2 border-[#FFFF00] bg-[#FFFF00]` when checked, dash for indeterminate
  - Action bar shows "Mark Completed" + "Delete Selected" buttons when any rows selected
- Backend: `PUT /api/maintenance/batch-status` (bulk status change + per-unit sync), `DELETE /api/maintenance/batch` (bulk delete + per-unit revert)
- Logs without `stockUnitId` grouped under "ทั่วไป" (General) category, sorted last

### Jobs — Rehearsal Date
- `rehearsalDate` optional field added to `jobs` table (`rehearsal_date TIMESTAMP`)
- Shown in **Add Job modal** between Location and Start Date fields (not required)
- `InsertJob` type auto-includes the field; POST route coerces string → Date if provided

### Inventory page (`client/src/pages/sections/StockItemsTableSection.tsx`)
- Items grouped by **Category** (19 groups, collapsed by default)
- Click category header → expand to see models
- Click model row → expand to see individual units (unit items) or inline count badge (bulk items)
- Each unit row: Name · Serial · Barcode · Location · Purchased · Warranty Exp. · Status
- **Edit button per unit** — inline edit form with Save/Cancel
- **Pencil icon (item-level)** — opens Edit Item modal (NOT Detail Panel); uses separate `editingItem` state in `StockPage.tsx`
- Filter sidebar (`StockFilterSidebarSection.tsx`) has three sections: Brand (145, with search), Category (19), Sub-Category (90, with search)
- Table sorted A→Z via `localeCompare`

### Schema extra fields
```typescript
// stock_units
purchasedAt:       timestamp("purchased_at"),        // วันที่ซื้อ
warrantyExpiresAt: timestamp("warranty_expires_at"), // ประกันหมดอายุ

// stock_items
trackingMode: stockTrackingModeEnum("tracking_mode").default("unit").notNull(),
// "unit" = individual stock_units (default), "bulk" = count-only via job_stock

// jobs
rehearsalDate: timestamp("rehearsal_date"),          // วันซ้อม (optional)
```

### Loading states
- Global yellow progress bar at top of screen (`GlobalLoadingBar` in `StockHome.tsx`) using `useIsFetching()`
- Skeleton rows on all main tables (Inventory, Jobs, Maintenance)

### API additions
- `GET /api/stock` — returns `availableCount` per item; bulk items compute it from `job_stock` aggregation
- `GET /api/stock/all-with-units` — same `availableCount` logic for bulk items
- `PUT /api/stock/units/:unitId` — handles date string → Date conversion for `purchasedAt` / `warrantyExpiresAt`
- `GET /api/jobs/:id/stock` — bulk job assignments (`JobBulkEntry[]`)
- `POST /api/jobs/:id/stock` — replace-all bulk assignments for a job
- `GET /api/jobs/crew-matrix` — all `{ jobId, userId }` pairs for the company (used by Gantt)

### Web Push Notifications
- `server/lib/push.ts` — `sendPushToUser()` (sends via `web-push` to all of a user's stored
  `push_subscriptions`, deleting expired ones) and `formatPushText()` (Thai title/body per
  `notification_type`, mirrors `client/src/locales/th/notifications.json`)
- `server/lib/notify.ts`'s `notify()` now also calls `sendPushToUser()` for each recipient — all 6
  existing notification types (job assign/remove/update, pull sheet, maintenance, stock added)
  trigger an OS push automatically
- `server/routes/push.ts` (`/api/push`) — `GET /vapid-public-key`, `POST /subscribe`,
  `POST /unsubscribe`
- `client/public/sw.js` — service worker (served at `/sw.js`), handles `push` (shows OS
  notification) and `notificationclick` (focuses/opens the app)
- Settings → Profile → "Push Notifications" card — enable/disable toggle, registers the service
  worker and subscribes via `pushApi`

### Finance — Real ROI Costing & Equipment Health Score
- **ROI** (`server/routes/finance.ts` `/costing`): `revenue` (sum of `invoices.amount`),
  `subRentals` (sum of `sub_rentals.dailyRate`), and `staff`/`transport` (sum of `job_expenses`
  rows by category) — `totalCost = subRentals + staff + transport`. Equipment owned by the
  company is intentionally excluded (sunk cost, not an incremental job cost).
- `job_expenses` table — one row per staff/transport payment (e.g. loading crew, Lalamove),
  each with optional `note` + `receiptUrl` (slip photo via Supabase Storage, same pattern as
  maintenance/sub-rental receipts). Endpoints: `GET/POST /api/jobs/:id/expenses`,
  `DELETE /api/jobs/expenses/:expenseId` (write ops Admin/Manager only).
- Finance → Costing tab: clicking the Staff/Transport amount opens `JobExpensesModal.tsx` to
  view/add/delete expense line items with slips for that job.
- **Health score** (`stock_units.health_score`): now actually computed by
  `recalculateUnitHealth()` in `server/lib/health.ts` — starts at 100, deducts per open/resolved
  incident (by severity) and per maintenance log (`-10` while `in_progress`, `-8` per completed
  `repair`). Called automatically after incident/maintenance create/update/delete (mirrors the
  existing `markUnitsInMaintenance`/`revertUnitIfNoOpenMaintenance` pattern in
  `server/lib/stockUnitStatus.ts`). Feeds both the per-unit badge in `ItemDetailPanel.tsx` and
  the Analytics "Overall Health" average — no changes needed in either place.

### Jobs — Auto Pull Sheet, Vehicles, Outsourced Crew
- **Auto pull sheet**: `ensurePullSheetForJob()` in `server/routes/jobs.ts` creates a draft
  pull sheet the first time a job's status becomes `"scheduled"` (checked in both `POST /jobs`
  and `PUT /jobs/:id`) — skips if one already exists for that job. No manual "Create Pull
  Sheet" step needed for the common case; the global Pull Sheets tab / `CreatePullSheetModal`
  still works for ad-hoc/extra sheets.
- **Vehicles**: `job_vehicles` table — free-text `vehicleType` (e.g. "รถ 6 ล้อ") + optional
  `note`, no driver field, purely informational/logistics (not linked to `job_expenses` cost).
  Shown in the Jobs page's expanded row (`JobsPage.tsx` → `JobDetailRow`), added via
  `AddVehicleModal.tsx`. Endpoints: `GET/POST /api/jobs/:id/vehicles`,
  `DELETE /api/jobs/vehicles/:vehicleId`.
- **Outsourced crew** (เด็กโหลด/external workers): no new entity — reuses `job_expenses`
  (category `"staff"`, no user account needed, just a `note` + `amount` + optional slip).
  Exposed directly on the Jobs page via an "Outsource / Expenses" button next to Crew (opens
  the same `JobExpensesModal.tsx` used by Finance → Costing), so it doesn't require Finance
  access just to log a loading-crew payment.

### Bulk Quantity Mode (`trackingMode: 'unit' | 'bulk'`)
For cables, consumables, and other items where individual unit tracking adds no value.

- **`trackingMode = 'unit'`** (default): works identically to before — individual `stock_units`,
  serial numbers, scan workflow, unit checkboxes in ManageJobStockModal.
- **`trackingMode = 'bulk'`**: no `stock_units` rows — just a total count (`stock_items.quantity`)
  and per-job quantities via the `job_stock` table (`jobId`, `stockItemId`, `quantity`).

**`availableCount` for bulk items** = `quantity - SUM(job_stock.quantity WHERE job.status IN ('draft','scheduled','active'))`.
Computed in `GET /api/stock` and `GET /api/stock/all-with-units` (same logic, added `job_stock` join).

**UI differences for bulk items:**
- Inventory table (`StockItemsTableSection.tsx`): amber `BULK` badge + `Layers` icon, no expand chevron, badge shows `N / total` count not units
- Add/Edit Item modal (`AddNewItemModal.tsx`): tracking mode toggle (pill buttons) + "Total Quantity" number input shown when bulk selected
- ManageJobStockModal (`ManageJobStockModal.tsx`): stepper `[ − ][ N ][ + ]` instead of unit checkboxes; pre-populated from `GET /api/jobs/:id/stock`; saves via `jobsApi.setJobStock()`

**Endpoints:**
- `GET /api/jobs/:id/stock` — returns `JobBulkEntry[]` (`{ id, jobId, stockItemId, quantity }`)
- `POST /api/jobs/:id/stock` — replace-all bulk assignments for that job (`{ items: [{stockItemId, quantity}] }`)

**Client types** (`client/src/api/index.ts`):
```ts
export type JobBulkEntry = { id: string; jobId: string; stockItemId: string; quantity: number };
```

**Cache key** for bulk assignments: `["job-bulk-stock", jobId]` — invalidate alongside `["stock"]` on any bulk save.

### Inventory — Filter Sidebar Sub-Category
`StockFilterSidebarSection.tsx` now has a third filter section: **Sub-Category** (90 sub-categories,
with a search box inside the section, same pattern as Brand).

- Props added: `selectedSubCategories: string[]`, `onSubCategoryChange: (id: string) => void`
- Data from `catalogApi.getSubCategories()` (existing endpoint)
- `StockPage.tsx` manages `selectedSubCategories` state + `toggleSubCategory` handler; passes down to sidebar + table
- `StockItemsTableSection.tsx` filters by `subCategoryId` when `selectedSubCategories` is non-empty

### Inventory — Edit Button Fix
Previously clicking the pencil icon opened the Detail Panel (not the Edit modal) because both
shared the same `selectedItem` state.

Fix (`StockPage.tsx`): separate `editingItem` state that only opens the Edit modal —
clicking pencil sets `editingItem` and `editItemOpen=true` without touching `selectedItem`.
`StockItemsTableSection.tsx` has a separate `onEditItem` prop for this.

### Inventory — Accessories Search Position
In `ItemDetailPanel.tsx`, the accessories tab search input was moved to the **top** of the tab
(above the hint text and list), so it's immediately visible without scrolling.

### Jobs — Crew Tab (Gantt Timeline)
The "ทีมงานและการมอบหมาย" section previously shown inside the Jobs tab was moved to its own
**Crew tab** (`activeTab === "crew"` in `JobsPage.tsx`).

The Crew tab renders `CrewScheduleView` — a **Gantt timeline calendar**:

**Layout:**
- Top toolbar: ← → week navigation + "วันนี้" button + date range label + status legend
- Left sticky column: crew member avatar + name + role (stays fixed while timeline scrolls horizontally)
- Right scrollable area: 35-day window (5 weeks), navigable by week

**Timeline features:**
- Month header row (groups day columns by month, Thai locale)
- Day header row: DOW abbreviation (จ/อ/พ/พฤ/ศ/ส/อา) + date number; today gets yellow filled circle
- Today column: faint yellow background tint + yellow vertical hairline through all rows
- Weekend columns: slightly dimmed background
- Job bars: rounded rectangles colored by status, show job name + colored dot, clip at view edges
- Bars span `startDate` → `endDate`; single-day bar if no `endDate` (falls back to `startDate`)
- Click a bar → `onAssignCrew(job)` → opens `AssignCrewModal`

**Status colors for bars:**

| Status | Background | Border | Text |
|---|---|---|---|
| draft | white/7% | white/12% | white/45% |
| scheduled | blue/28% | blue/35% | blue-200/90% |
| active | amber/30% | amber/40% | amber-200/90% |
| completed | emerald/25% | emerald/35% | emerald-200/90% |
| cancelled | red/8% | red/12% | red/30% |

**Data source:** `GET /api/jobs/crew-matrix` → `{ jobId, userId }[]` (all job-crew assignments for
the company). Endpoint is in `server/routes/jobs.ts` and must appear **before** the `/:id` routes.
Client function: `jobsApi.getCrewMatrix()`, query key `["crew-matrix"]`.

**`AssignCrewModal`** is still the assignment UI — triggered from `JobsPage.tsx` via
`assignCrewTabJob` state when clicking a job bar in the Gantt.

### Lifecycle Close-Out: Job Status, Incident Resolve, Sub-Rental Return, Quotes/Invoices
- **Job status**: `JobsPage.tsx` main table — Admin/Manager see a `<select>` over the status
  badge (all 5 `jobStatusEnum` values), calling the existing `PUT /api/jobs/:id`. Non-managers
  still see the read-only badge.
- **Incident resolve**: `PUT /api/jobs/incidents/:incidentId` (Admin/Manager only) sets
  `status: "resolved"` and calls `recalculateUnitHealth()` if linked to a stock unit. "Mark
  Resolved" button shown on open incidents in `JobsPage.tsx`'s Incidents tab.
- **Sub-rental return**: `PUT /api/maintenance/subrentals/:id` (generic status/field update,
  no role gate — matches existing subrental routes). "Mark Returned" button in `StockPage.tsx`'s
  Sub-Rentals list, sets `status: "returned"`.
- **Quote/Invoice creation**: previously had zero creation UI (only display tables, with a
  non-functional "Send" icon) — `POST /api/finance/quotes` / `/invoices` already existed
  server-side but were never called from the client. Added `AddQuoteModal.tsx` /
  `AddInvoiceModal.tsx` (mirrors `AddSubRentalModal.tsx`'s field/select pattern, with an
  optional job-link dropdown), wired to "+ New Quote" / "+ New Invoice" buttons in
  `FinancePage.tsx`'s tab headers. Quote/invoice number fields are pre-filled with a suggested
  next number (`QT-001`/`INV-001` style) but freely editable.
- **Quote/Invoice status update**: status badges in `FinancePage.tsx` replaced with `<select>`
  dropdowns calling the existing `financeApi.updateQuote`/`updateInvoice`.
- **Quote/Invoice PDF export**: `server/lib/financePdf.ts` (`generateQuotePdf`/
  `generateInvoicePdf`, same `pdfkit` pattern as `pullsheetPdf.ts`) + `GET
  /api/finance/quotes/:id/pdf` / `/invoices/:id/pdf`. Since `quotes`/`invoices` have no
  line-item tables (`totalValue`/`amount` are single decimal fields), these are **summary
  documents** (number, client, linked job, total, dates, status) — not itemized equipment
  breakdowns. Download icon button per row in `FinancePage.tsx`.

## Adding a New Feature

1. Add table/columns to `shared/schema.ts`
2. Run `npm run db:generate` → commit the new migration file
3. Add API route in `server/routes/` (use `db` from `server/db.ts`)
4. Add API function to `client/src/api/index.ts`
5. Use `useQuery` / `useMutation` from TanStack Query in the component
6. Add to Zustand store if state needs to be shared across components

## Environment

Requires `.env` (not committed):
```
DATABASE_URL=postgresql://...  # Supabase Session Pooler URL with encoded special chars
NODE_ENV=development
PORT=5000

# Web Push (VAPID keys — generate once with `npx web-push generate-vapid-keys`)
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@example.com
```

URL-encode special chars in passwords: `%` → `%25`, `?` → `%3F`
