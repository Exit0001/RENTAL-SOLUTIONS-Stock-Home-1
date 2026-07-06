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

## Database Schema (25 tables)

```
companies → users, stock_items, containers, jobs, maintenance_logs, quotes, invoices, incidents, activity_log
stock_items → stock_units → container_units → containers
jobs → job_stock, job_crew, job_units, job_containers, pull_sheets, sub_rentals, quotes, invoices, incidents
catalog: brands, categories, sub_categories, locations, container_types
notifications, push_subscriptions
```

All enums are `pgEnum` (enforced at DB level): `userRoleEnum`, `jobStatusEnum`, `stockUnitStatusEnum`, `containerTypeEnum`, `maintenanceTypeEnum`, `quoteStatusEnum`, `invoiceStatusEnum`, `incidentSeverityEnum`, `activityTypeEnum`, `maintenanceStatusEnum`, `subRentalStatusEnum`, `incidentStatusEnum`, `pullSheetStatusEnum`.

## Current State (as of 2026-06-16)

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
- Click model row → expand to see individual units
- Each unit row: Name · Serial · Barcode · Location · Purchased · Warranty Exp. · Status
- **Edit button per unit** — inline edit form with Save/Cancel
- Filter sidebar (`StockFilterSidebarSection.tsx`) fetches brands/categories from DB (real data, not hardcoded)
- Filter sidebar has search box inside Brand section (145 brands) + collapsible sections
- Table sorted A→Z via `localeCompare`

### Schema extra fields
```typescript
// stock_units
purchasedAt:       timestamp("purchased_at"),        // วันที่ซื้อ
warrantyExpiresAt: timestamp("warranty_expires_at"), // ประกันหมดอายุ

// jobs
rehearsalDate: timestamp("rehearsal_date"),          // วันซ้อม (optional)
```

### Loading states
- Global yellow progress bar at top of screen (`GlobalLoadingBar` in `StockHome.tsx`) using `useIsFetching()`
- Skeleton rows on all main tables (Inventory, Jobs, Maintenance)

### API additions
- `GET /api/stock` now returns `availableCount` per item (count of units with `status = 'available'`)
- `PUT /api/stock/units/:unitId` handles date string → Date conversion for `purchasedAt` / `warrantyExpiresAt`

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

### Item Accessories — Auto-suggest accessories when adding stock to a job (2026-07-06)

**Problem:** Many stock items must always travel with a specific accessory that is
*itself* a real stock item with its own stock/quantity — not just a text note. e.g.
`GSL8` (line array speaker) needs `Frame แขวน GSL8` + `สายแปลงผู้-ผู้`; `Y8` needs
`Y Frame`. These accessories must be pulled and returned together with the parent,
and must be trackable in stock like anything else (so a real stock_item, not a
checklist string).

**Decision:** Don't build a parallel checklist/pull-sheet system. An accessory is
just a normal `stock_item` — link it to a parent `stock_item` so the UI can
auto-suggest + pre-check it when the parent is added to a job. Once added, it
becomes a normal `job_unit`/`job_stock` row and flows through the existing pull
sheet / dispatch / return lifecycle with zero extra code.

**✅ Already done (prototyped in a throwaway clone, re-apply to real repo):**
- Schema: `item_accessories` table in `shared/schema.ts` (below `container_units`,
  section 6b) — `parentStockItemId`, `accessoryStockItemId` (both FK →
  `stock_items`), `quantityPerUnit` (default 1), `required` (default true).
  `insertItemAccessorySchema` + `ItemAccessory`/`InsertItemAccessory` types added
  next to the other `stock_items`-related exports.
- Migration: generated via `npm run db:generate` → `migrations/0014_real_devos.sql`
  (plain `CREATE TABLE item_accessories` + 3 FKs, no destructive changes). **Run
  this in Supabase SQL Editor** (same workaround as the existing `0004_` journal
  conflict — `db:migrate` is already broken per the note above):
  ```sql
  CREATE TABLE "item_accessories" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "company_id" uuid NOT NULL,
      "parent_stock_item_id" uuid NOT NULL,
      "accessory_stock_item_id" uuid NOT NULL,
      "quantity_per_unit" integer DEFAULT 1 NOT NULL,
      "required" boolean DEFAULT true NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
  );
  ALTER TABLE "item_accessories" ADD CONSTRAINT "item_accessories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "item_accessories" ADD CONSTRAINT "item_accessories_parent_stock_item_id_stock_items_id_fk" FOREIGN KEY ("parent_stock_item_id") REFERENCES "public"."stock_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "item_accessories" ADD CONSTRAINT "item_accessories_accessory_stock_item_id_stock_items_id_fk" FOREIGN KEY ("accessory_stock_item_id") REFERENCES "public"."stock_items"("id") ON DELETE cascade ON UPDATE no action;
  ```
- Backend (`server/routes/stock.ts`):
  - `GET /api/stock/:id/accessories` — links for one parent item, joined with
    accessory name + live `availableCount` (counts `stock_units` with
    `status = 'available'`).
  - `POST /api/stock/:id/accessories` — link a new accessory
    (`{ accessoryStockItemId, quantityPerUnit?, required? }`).
  - `PUT /api/stock/accessories/:linkId` — update `quantityPerUnit`/`required`.
  - `DELETE /api/stock/accessories/:linkId` — unlink.
  - `GET /api/stock/accessories/all` — **all** links for the company in one call
    (no joins — client already has `stock/all-with-units` loaded, so it looks up
    accessory name/availableCount itself). This is the one the job-stock modal
    should use (see pending work below).
- Client API (`client/src/api/index.ts`): `ItemAccessory`/`InsertItemAccessory`
  imported from `@shared/schema`; `ItemAccessoryWithInfo` type added
  (`ItemAccessory & { accessoryName: string; availableCount: number }`).
  `stockApi.getAccessories`, `getAllAccessoryLinks`, `addAccessory`,
  `updateAccessory`, `removeAccessory` added.
- UI — **setup side, done**: `ItemDetailPanel.tsx` (Inventory → click an item)
  has a new **"Accessories" tab** (between Units and Details) — search existing
  stock items, link as accessory with a qty-per-unit stepper and a
  Required/Optional toggle, remove button. Locale keys added to both
  `client/src/locales/th/stock.json` and `en/stock.json` (`tabAccessories`,
  `accessoriesHint`, `noAccessoriesYet`, `addAccessory`,
  `searchAccessoryPlaceholder`, `availableCountLabel`, `requiredLabel`,
  `optionalLabel`, `requiredToggleHint`).

**⏳ Pending — the actual "auto-suggest on job add" wiring (not started):**

This is the whole point of the feature and is **not done yet**. Target file:
`client/src/pages/sections/ManageJobStockModal.tsx` (the modal opened from a
job to pick which stock units go on that job — selection is unit-level via a
`Set<string> selectedIds` of `stock_unit.id`, toggled by `toggleUnit()`,
saved via `jobsApi.setUnits(jobId, Array.from(selectedIds))`).

Implementation plan:
1. On modal open, fetch `stockApi.getAllAccessoryLinks()` once → build a map
   `Map<parentStockItemId, { accessoryStockItemId, quantityPerUnit, required }[]>`.
2. In `toggleUnit(unitId)`: when a unit is being turned **on**, look up its
   `stockItemId` (need the parent group, not just the unit — `stockGroups` already
   has `unit.stockItemId` via the nested structure) in the accessory map. For each
   linked accessory with `required = true`, auto-select `quantityPerUnit` number of
   **available** units from that accessory's own group in `stockGroups` (skip ones
   already `selectedIds`) — same pattern as `toggleSelectAll`. Optional accessories
   (`required = false`) should be suggested but not auto-ticked — surface them as a
   dismissible inline hint under the parent group's row ("+ Frame แขวน GSL8 พร้อม 5
   ชิ้น — เพิ่มไหม?") that adds on click.
3. When a unit is turned **off**, do NOT auto-remove its accessories (crew may want
   to keep a spare Frame on a job even if a specific GSL8 unit was swapped out) —
   only auto-add, never auto-remove. Simpler and avoids surprising deletions.
4. Visually, an auto-added accessory unit should look the same as any other
   selected unit in the tree (no special styling needed) — the "why is this
   ticked" question is answered well enough by the group being visibly nested
   under the same category. A small toast/inline note the first time
   ("✓ เพิ่ม Frame แขวน GSL8 ให้อัตโนมัติ") is a nice-to-have, not required.
5. No new pull-sheet/return code needed — once an accessory's unit is in
   `job_units`, the existing Pull Sheet, dispatch, and return flow already
   handles it exactly like any other assigned unit.
6. Same pattern can later be applied to `containers` (rack-level accessories,
   e.g. every rack needs its own power cable) via a `container_accessories`
   table — deliberately not built now since it wasn't asked for; mirror
   `item_accessories` if/when needed.

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
