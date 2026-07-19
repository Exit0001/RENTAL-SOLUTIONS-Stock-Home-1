# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## Database Schema (36 tables)

```
companies → users, stock_items, containers, jobs, maintenance_logs, quotes, invoices, incidents, activity_log
stock_items → stock_units → container_units → containers
stock_items → item_accessories (goes-with links)
jobs → job_stock, job_crew_members, job_units, job_containers, job_expenses, job_vehicles, pull_sheets, sub_rentals, quotes, invoices, incidents
job_templates → job_template_items          (named item+qty lists → create a NEW job)
equipment_sets → equipment_set_items         (reusable kits → add to ANY job)
crew_members (roster, all types) → job_crew_members    (crew assigned to jobs — see "Crew & Vehicles")
vehicles (roster) → job_vehicles.vehicle_id            (vehicles assigned to jobs, + driver)
catalog: brands, categories, sub_categories, locations, positions, container_types
notifications, push_subscriptions
job_crew (LEGACY, users↔jobs) — superseded by job_crew_members; kept for the /jobs/crew data endpoint
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
| JobSubRentalsModal add/delete/return | `["job-subrentals", jobId]`, `["subrentals"]`, `["finance-costing"]` |
| EditContainerModal / batch AddContainerModal | `["containers"]` |
| SetBuilderModal create/update, StockPage deleteSet | `["equipment-sets"]` |
| AddSetToJobModal apply-set / AddJobModal applySet | `["job-units", jobId]`, `["job-bulk-stock", jobId]`, `["stock"]`, `["stock-with-units"]` |

### Legacy data ⚠️ run this in Supabase SQL Editor

Units assigned to jobs before 2026-07-06 have `status="available"` in the DB (the sync was added later).
Run once to fix:
```sql
UPDATE stock_units su
SET status = 'out'
WHERE su.status = 'available'
  AND EXISTS (SELECT 1 FROM job_units ju WHERE ju.stock_unit_id = su.id);
```

## Current State (as of 2026-07-19)

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

**Pending (2026-07-09)** — `jobs.company_id` index and `sub_rentals.job_id` made required.
Already in `shared/schema.ts` and `migrations/0020_jobs_company_index.sql` /
`migrations/0021_subrental_job_required.sql`. Run in Supabase SQL Editor:
```sql
CREATE INDEX IF NOT EXISTS "jobs_company_id_idx" ON "jobs" USING btree ("company_id");

ALTER TABLE "sub_rentals" DROP CONSTRAINT IF EXISTS "sub_rentals_job_id_jobs_id_fk";
ALTER TABLE "sub_rentals" ALTER COLUMN "job_id" SET NOT NULL;
ALTER TABLE "sub_rentals" ADD CONSTRAINT "sub_rentals_job_id_jobs_id_fk"
  FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
```
The `SET NOT NULL` statement fails if any existing `sub_rentals` row has a null `job_id` —
assign it to a job or delete it first (see "Sub-Rentals — Moved to Job-Scoped Management" below
for why `jobId` is now required). Until run, the schema/DB are out of sync and `db:generate`
will complain on next run; the app itself still works either way since the client now always
sends a `jobId`.

**Pending (2026-07-09)** — `containers.image_url` column (reference photo per rack/container).
Already in `shared/schema.ts` and `migrations/0022_container_image.sql`. Run in Supabase SQL Editor:
```sql
ALTER TABLE "containers" ADD COLUMN IF NOT EXISTS "image_url" text;
```
Until run, editing a container's photo will fail (column doesn't exist) — creating/listing containers
still works since `imageUrl` is optional and simply omitted from the row.

**Already applied (2026-07-19)** — `equipment_sets` + `equipment_set_items` tables for the
Equipment Sets (ชุดอุปกรณ์ / Kits) feature. In `shared/schema.ts` and
`migrations/0014_modern_impossible_man.sql` (the `.sql` was hand-trimmed to ONLY the two new
tables — `db:generate` regenerated a polluted file full of drift because the journal is out of
sync; do the same trim if you regenerate). Applied to Supabase via a direct-connection script,
already created. `equipment_set_items.unit_id` is nullable — `null` = auto-pick line
(quantity of a model), non-null = pinned specific unit. See "Equipment Sets" below.

### Migration script state
`npm run db:migrate` fails because of a duplicate `0004_` migration tag conflict in the journal. Workaround: run SQL statements directly in Supabase SQL Editor.

### Containers tab (`client/src/pages/sections/StockPage.tsx`)
- **Card grid layout** (like the Equipment Sets tab) instead of list rows — each card shows a
  photo thumbnail (or a `Layers` icon placeholder), name/type/checked-out badges, location/barcode/
  ready-count, and the assign/checkout/edit/delete actions. Clicking the card body still
  expands/collapses the assigned-units list inline (same interaction as before, just inside a
  card instead of a full-width row). Grid uses `items-start` so an expanded card doesn't stretch
  its row neighbors.
- **Container photo** — `containers.imageUrl`, uploaded via `FileUploadField` (`folder="containers"`)
  in both `AddContainerModal.tsx` and `EditContainerModal.tsx`; batch-add applies the same photo
  to every container created in that batch. `PUT /api/containers/:id` accepts `imageUrl`.
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
  no role gate — matches existing subrental routes), sets `status: "returned"`. Originally
  triggered only from `StockPage.tsx`'s Sub-Rentals list; also available from `JobSubRentalsModal.tsx`
  now — see "Sub-Rentals — Moved to Job-Scoped Management" below for the full picture.
- **Quote/Invoice creation**: previously had zero creation UI (only display tables, with a
  non-functional "Send" icon) — `POST /api/finance/quotes` / `/invoices` already existed
  server-side but were never called from the client. Added `AddQuoteModal.tsx` /
  `AddInvoiceModal.tsx` (compact field/select modal, with an
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

### Equipment Picker — Two-Pane Redesign (`ManageJobStockModal.tsx`)
Replaced the old single-column nested tree (category → model → unit, all in one scrolling list)
with two independently-scrolling panes so adding gear across categories doesn't require
re-scrolling past collapsed headers each time:

- **Left pane** (`ManageJobStockCatalogPane.tsx`): category chip filter bar (always full list,
  never collapses — switching categories just narrows the visible models). When a category is
  selected, **Brand** and **Sub-Category** chip rows appear too, scoped to that category so the
  list stays short (no new API calls — derived client-side from the already-fetched item list).
  Search now auto-expands matching model groups too, not just categories.
- **Right pane** (`ManageJobStockCartPane.tsx`): persistent "selected items" cart, grouped by
  category → model, with a per-unit position `<select>` (see below) so browsing the left pane
  never hides the cart.
- **Per-unit position** (FOH/Monitor/Power/Stage/etc.): position is now stored per **unit**
  (`CartUnitLine.position`), not per stock-item/model — two identical units of the same model can
  go to two different zones in the same job. Bulk items can be split across multiple zones too
  (`CartBulkLine`, keyed by a synthetic `lineId` not `stockItemId`, so one model can have several
  quantity lines each with its own zone).
- **Active zone selector**: a "เพิ่มเข้าโซน:" chip row in the catalog pane — pick a zone once, then
  every unit checked / bulk qty incremented while it's active gets that zone immediately, instead
  of setting position per-row after the fact. "อัตโนมัติ" (auto) falls back to each item's
  `lastPosition` (smart default, computed server-side — most recent non-null position used for
  that stock item, company-scoped). A "+" button creates a brand-new zone on the fly via
  `catalogApi.createPosition` (existing API, previously had no UI consumer) and auto-selects it.
- **Cart zone tabs** (`ManageJobStockCartPane.tsx`): "ทั้งหมด" / each zone in use / "ไม่ระบุโซน" —
  narrows the cart to just that zone's lines, so you can see "what's going to FOH" at a glance.
- Backend: `GET /stock/all-with-units` gained `lastPosition` (per item, via `DISTINCT ON` over
  `job_units`/`job_stock` joined through `jobs`, company-scoped). `POST /jobs/:id/stock` no
  longer collapses position to one value per stock item — it trusts whatever `position` each
  line in the payload sends, which is what makes bulk position-splitting possible. `handleSave`
  now always calls `setJobStock` (previously skipped if the cart had zero bulk lines — meant
  clearing all bulk items never actually cleared `job_stock` server-side).
- New index: `jobs.company_id` (`migrations/0020_jobs_company_index.sql`) — supports the
  `lastPosition` lookup's join through `jobs`.

### Item Detail — Centered Modal, Real Specs, Per-Unit Schedule (`ItemDetailPanel.tsx`)
- Changed from a docked right-side sliding panel (`w-80`) to a centered modal (`max-w-3xl`,
  matching every other modal's `fixed inset-0` + backdrop pattern) — more room, and the Units
  tab now renders as a 2-column card grid instead of a single stacked list.
- **Header thumbnail**: `item.imageUrl` (already fetched, previously unused here) now renders as an
  8×8 rounded thumbnail next to the item name when set, falling back to the yellow `Package` icon
  square otherwise.
- **Specs tab fix**: previously rendered `Object.entries(item.specs.fields)` with the raw field
  key as the label (e.g. literally "impedance") and rendered nothing at all if no specs were
  filled in. Now looks up the item's `specs.template` (sound/lighting/video) via
  `getSpecTemplates()` (exported from `AddNewItemModal.tsx`, now shared instead of duplicated)
  to show the real Thai label for every field in that template, with a "ยังไม่ได้กรอก" placeholder
  when empty — plus Protocol Tags (Dante/AES-EBU/Milan/etc.), which weren't rendered anywhere
  before.
- **Units tab**: each unit card now shows a "→ จัดเตรียมสำหรับงาน: [Job] (date)" line when
  `plannedJob` is set (the data was already being fetched via `GET /stock/:id`, just never read
  client-side — `units` was typed as plain `StockUnit[]`, now `StockUnitWithPlan[]`). Cards are
  now **clickable** — opens `UnitDetailModal.tsx` (general info, purchase date/warranty
  expiry, and maintenance history filtered from `maintenanceApi.getAll()` by `stockUnitId`).
- **New "ตารางการออกงาน" (Schedule) tab**: `UnitScheduleGantt.tsx`, adapted from the Jobs page's
  `CrewScheduleView.tsx` Gantt pattern — one row per unit, job bookings as colored bars across a
  35-day scrollable window, instead of crew members. Backend: `GET /stock/:id` now also returns
  `bookings: UnitBooking[]` per unit (previously only kept the single earliest non-cancelled job
  per unit as `plannedJob` — `bookings` keeps **all** of them so the Gantt can show a unit's full
  schedule, not just its next job).
- Removed the footer's "แก้ไขรายการ" (Edit) and "เก็บถาวร" (Archive, never had a working handler)
  buttons — editing an item is still available via the pencil icon on its row in the main
  Inventory table.

### Containers — Edit & Batch Add
- **Edit**: pencil icon per container row (Admin/Manager only) opens `EditContainerModal.tsx` —
  name/type/location/barcode, backed by new `PUT /api/containers/:id`.
- **Batch add**: `AddContainerModal.tsx` gained a quantity stepper — creating N at once
  auto-numbers names (`Rack A #1`, `Rack A #2`, ...) and generates distinct barcodes per item
  (avoids the old single-item fallback barcode scheme colliding when looped). `StockPage.tsx`'s
  `createContainer` mutation now takes an array and does one `Promise.all` + one invalidation.

### Inventory — Search by Serial/Barcode
`StockItemsTableSection.tsx`'s search previously only matched `name`/`brand`/`category`/
`subCategory` on the lightweight `GET /stock` payload (no nested units, so no serial/barcode
data existed client-side to match against). Now also fetches `stockApi.getAllWithUnits()`
(only while the user is actively typing a search — same `["stock-with-units"]` query already
warm from the Maintenance tab) and additionally matches if any of an item's units has a
matching `serialNumber`/`barcode`. Badge/counts still come from the original `["stock"]` query —
this is purely an additional match predicate, not a swap of the main data source.

### Sub-Rentals — Moved to Job-Scoped Management
Sub-rentals (equipment rented **from another company** to cover a job's shortage) are now added
and managed from inside the job that needs them, not from a standalone Stock-page form:

- **`sub_rentals.jobId` is now required** (`NOT NULL`, `onDelete: cascade` — matches
  `job_expenses`/`job_vehicles`, previously nullable/optional). Migration:
  `migrations/0021_subrental_job_required.sql`. This closes a real gap: Finance → Costing's ROI
  calc already filtered sub-rentals by `jobId` to attribute cost per job — an unlinked sub-rental
  silently never counted toward any job's cost/profit.
- **`JobsPage.tsx`**: new "ของเช่าจากภายนอก" section in the job's expanded row (after Vehicles) —
  a button opens `JobSubRentalsModal.tsx` (self-contained add/list/delete/mark-returned, mirrors
  `JobExpensesModal.tsx`'s pattern), job is implicit from context so there's no job picker.
- Backend: `GET/POST /api/jobs/:id/subrentals` + `DELETE /api/jobs/subrentals/:subRentalId`
  (Admin/Manager only, mirrors the expenses/vehicles route shape exactly).
- **`StockPage.tsx`'s "เช่าจากภายนอก" tab** is now a **read-only overview** across all jobs — the
  "+" add button and `AddSubRentalModal.tsx` were removed entirely. `GET /api/maintenance/
  subrentals` now joins `jobs` server-side so the row shows the actual job name instead of a raw
  UUID (`sr.jobId ?? "—"` before). "Mark Returned" still works from here via the existing
  `PUT /api/maintenance/subrentals/:id`.
- Renamed the Thai label throughout (tab, buttons, modal titles, hints): **"เช่าช่วง" →
  "เช่าจากภายนอก"** — clearer that it's gear from an external company, not an internal sub-lease.
  English label unchanged ("Sub-Rentals").

### Equipment Sets (ชุดอุปกรณ์ / Kits) — reusable bundles added to a job in one action
A named, reusable kit (e.g. "ชุดกลอง Yamaha BG2" = drums + hardware, or "ชุดถ่าน+ชาร์จ") with an
image + note, added to any job in one click. Distinct from the three older grouping concepts:
**Containers** (specific physical units in a real case, one job at a time, no bulk), **Job
Templates** (item+qty list that only *creates a new job*), **Item Accessories** (per-item goes-with).

- **Data** (`shared/schema.ts`): `equipment_sets` (companyId, name, description, imageUrl) +
  `equipment_set_items` (setId, stockItemId, quantity, `unitId` nullable). `unitId = null` →
  **auto-pick** line (quantity of a model; for `trackingMode='bulk'` items this is a bulk qty);
  `unitId` set → **pinned** specific serial unit (quantity forced to 1). A set stores both kinds.
- **Backend** (`server/routes/equipmentSets.ts`, `/api/equipment-sets`): GET list (+`itemCount`/
  `totalQty`), GET `/:id` (items + itemName/trackingMode + pinned unit serial), POST create,
  PUT (edit meta + **replace-all** items), DELETE (Admin/Manager). Forked from
  `jobTemplates.ts`.
- **Add to an existing job** (`server/routes/jobs.ts`): `POST /api/jobs/:id/apply-set/:setId` —
  **merge** (dedups against units already on the job), pinned units used exactly, auto lines pick
  available units up to `quantity`, bulk lines upsert `job_stock`. **Does NOT touch
  `stock_units.status`** (Sync Contract). Returns `{ shortfall: [{stockItemId, wanted, got}] }`
  when stock is insufficient — mirror this pattern for any future "expand onto job" flow.
- **Client** (`client/src/api/index.ts`): `equipmentSetsApi` (getAll/getById/create/update/delete)
  + `jobsApi.applySet(jobId, setId)`. Query keys `["equipment-sets"]`, `["equipment-sets", id]`.
  Invalidate `["equipment-sets"]` on any set mutation; on apply-set invalidate `["job-units",
  jobId]`, `["job-bulk-stock", jobId]`, `["stock"]`, `["stock-with-units"]`.
- **UI**: 5th Stock tab **"ชุดอุปกรณ์"** (`StockPage.tsx`, card grid + create/edit/delete);
  `SetBuilderModal.tsx` (create/edit); `AddSetToJobModal.tsx` (one-click add + shortfall warning,
  opened from the Jobs page "เพิ่มชุด" button next to "Add Rack"); a "จากชุดอุปกรณ์" `<select>` in
  `AddJobModal.tsx` (creates the job then calls `applySet`). Image upload reuses `FileUploadField`
  with the new `folder="sets"`.

### Reusable two-pane equipment picker (`EquipmentPicker.tsx`)
Any feature that lets the user "pick equipment by quantity-per-model + optional pinned units"
should reuse this instead of building its own list. Exports `EquipmentCatalogPane` (left: search +
category→brand→sub-category chip filters + grouped list with a per-model `[− N +]` stepper and
expandable unit rows for pinning serials) and `EquipmentCartPane` (right: persistent "selected"
summary, editable/removable), plus `maxAvailFor(item)` and the `PickerAutoMap`/`PickerPinMap`
types. Selection model = `autoQty: Map<stockItemId, number>` + `pinned: Map<unitId, stockItemId>`.
`SetBuilderModal.tsx` is the reference consumer. (This is a *different* selection model from
`ManageJobStockModal`'s `cartUnits`/`cartBulkLines`+zones, which stays job-specific — don't try to
merge them.)

### Crew & Vehicles — dedicated resource-management page (`Crew` nav, separate from Jobs)
Crew/team + vehicle management is its own top-level section (`StockHome.tsx` navItems key `"Crew"`,
`CrewPage.tsx`), split from Jobs so **operations (jobs) and resources (people+vehicles) are separate**.
People and vehicles can be assigned to a job **in advance** (a job needs only a name/dates, no
equipment) — assignment happens from `JobDetailModal.tsx`'s Crew & Vehicles sections.

- **Data**: `crew_members` (roster of ALL people: `crew_type` enum `own_crew|freelancer|outsource|loader`;
  own-crew optionally links a `users` account via `user_id` for login + notifications; freelancers/
  loaders need no account). `vehicles` (roster: name/type/plate/capacity). `job_crew_members`
  (crew↔job, **replaces the old `job_crew` which was users↔job**). `job_vehicles` gained `vehicle_id`
  (→ roster) + `driver_crew_member_id`; `vehicle_type` text kept for ad-hoc + as the roster-name label.
  Migration `0015_youthful_rictor.sql` + `scripts/migrate-crew.mjs` (seeds crew_members from users,
  migrates job_crew → job_crew_members). Already applied to the live DB.
- **Backend** `server/routes/crew.ts` (`/api/crew`): roster CRUD `GET/POST/PUT/DELETE /` (crew) and
  `/vehicles` (write = Admin/Manager); `GET /matrix` → `{jobId, crewMemberId}[]` and
  `GET /vehicles/matrix` → `{jobId, vehicleId}[]` feed the schedule Gantt. Job assignment moved in
  `jobs.ts`: `GET/POST /jobs/:id/crew` (`{crewMemberId}`) + `DELETE /jobs/:id/crew/:crewMemberId` now
  use `job_crew_members`; **notify() fires only when the crew_member has a linked `user_id`**.
  `POST /jobs/:id/vehicles` accepts `{vehicleId?, driverCrewMemberId?, vehicleType?, note?}`; `GET`
  joins vehicle plate + driver name (self-join `alias`).
- **Client** (`client/src/api/index.ts`): `crewApi` + `vehiclesApi` (roster CRUD + `getMatrix`);
  `jobsApi.assignCrew(jobId, crewMemberId)`. Types `CrewMemberRow`/`VehicleRow`/`JobVehicleRow`/
  `CrewType` (note: the older `CrewMember` type = the `/jobs/crew` payload, kept separate). Query keys
  `["crew-members"]`, `["vehicles"]`, `["crew-matrix"]`, `["vehicle-matrix"]`, `["job-crew", jobId]`,
  `["job-vehicles", jobId]`.
- **UI**: `CrewPage.tsx` = 3 tabs — **ทีมงาน** (roster grouped by 4 types), **รถ** (vehicle roster),
  **ตารางงาน** (`ResourceScheduleView.tsx` — the old CrewScheduleView generalized to any resource;
  rows = crew grouped by type + a vehicles section, bars from job dates, bar click → `JobDetailModal`).
  Modals: `AddCrewMemberModal`, `AddVehicleRosterModal`, reworked `AssignCrewModal` (roster + type
  filter, exports `CREW_TYPE_LABEL`), new `AssignVehicleModal` (roster vehicle + driver). The old Jobs
  "crew" sub-tab and `CrewScheduleView.tsx` were removed.

### Backup / Data Export (Admin-only, company-scoped)
Per-company data export as a single downloadable JSON — the **multi-tenant-safe** way to let a
customer keep their own backup (a full `pg_dump` would leak other tenants; Supabase already does
server-level DB backups as a separate layer).

- **Backend** (`server/routes/backup.ts`, `/api/backup`): `GET /export` — **Admin only**
  (`req.userRole !== "admin"` → 403). Gathers all 24 company-scoped tables (filtered by
  `companyId`) + 7 child tables (filtered via parent ids: container_units, job_stock/crew/units/
  containers, job_template_items, equipment_set_items) into one JSON `{ meta, data }`
  (`meta.rowCount` per table), sent as an `attachment` download. **Excludes `push_subscriptions`**
  (transient device tokens / secrets). Every query is `company_id`-scoped — no cross-tenant leak.
- **Client**: `backupApi.exportData()` → `fetchBlob("/backup/export")`. UI = an admin-only
  "สำรองข้อมูล" card in **Settings → General** (`SettingsPage.tsx`); the click handler creates an
  object URL and triggers a `stak-backup-{company}-{date}.json` download.
- Export-only for now (no restore/import).

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
