# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**STAK v2.0** — Multi-tenant AV/audio-visual rental equipment management SaaS. Built for 1 company now, scaling to 100+ companies. Each company's data is isolated via `company_id` on every database table.

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

**Database note:** Supabase direct connection (port 5432) is blocked by IPv6. Use the **Session Pooler** URL (`aws-1-ap-northeast-1.pooler.supabase.com:5432`) in `.env`. Running migrations via SQL Editor in Supabase dashboard works as an alternative to `npm run db:migrate`.

## Architecture

Single repo, full-stack TypeScript:

```
client/src/          ← React 18 frontend (Vite)
  data/              ← All mock/seed data (8 files, one per domain)
  store/appStore.ts  ← Zustand global state (navigation + containers)
  pages/sections/    ← 5 main pages + modal components
  components/ui/     ← shadcn/ui primitives (don't modify)

server/              ← Express 5 backend
  index.ts           ← App bootstrap; auto-runs migrations if DATABASE_URL set
  db.ts              ← Drizzle + pg Pool connection; runMigrations()
  routes.ts          ← API routes (prefix all with /api)
  storage.ts         ← IStorage interface + MemStorage (in-memory fallback)

shared/schema.ts     ← Single source of truth: Drizzle schema + Zod validators + TS types
migrations/          ← SQL migration files (commit these to git)
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

**Data layer separation:** Mock data lives in `client/src/data/*.ts` (never inside components). Components import from there. When connecting real APIs, swap `data/` imports for TanStack Query hooks.

**Global state:** `useAppStore()` from `client/src/store/appStore.ts` holds navigation (`activePage`) and containers state. Local `useState` is for UI-only state (modals, filters, search).

**Path aliases:** `@/` → `client/src/`, `@shared/` → `shared/`, `@assets/` → `attached_assets/`

## Database Schema (16 tables)

```
companies → users, stock_items, containers, jobs, maintenance_logs, quotes, invoices, incidents, activity_log
stock_items → stock_units → container_units → containers
jobs → job_stock, job_crew, pull_sheets, sub_rentals, quotes, invoices, incidents
```

All enums are `pgEnum` (enforced at DB level): `userRoleEnum`, `jobStatusEnum`, `stockUnitStatusEnum`, `containerTypeEnum`, `maintenanceTypeEnum`, `quoteStatusEnum`, `invoiceStatusEnum`, `incidentSeverityEnum`, `activityTypeEnum`.

## Adding a New Feature

1. Add table/columns to `shared/schema.ts`
2. Run `npm run db:generate` → commit the new migration file
3. Add API route in `server/routes.ts` (use `db` from `server/db.ts`)
4. Add data types to `client/src/data/` if needed
5. Add to Zustand store if state needs to be shared across components

## Environment

Requires `.env` (not committed):
```
DATABASE_URL=postgresql://...  # Supabase Session Pooler URL with encoded special chars
NODE_ENV=development
PORT=5000
```

URL-encode special chars in passwords: `%` → `%25`, `?` → `%3F`
