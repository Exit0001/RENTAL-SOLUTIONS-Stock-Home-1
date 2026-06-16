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
