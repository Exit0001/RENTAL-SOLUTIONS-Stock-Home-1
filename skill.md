# STAK v2.0 — Project Knowledge Base

> AV/audio-visual rental equipment management SaaS  
> Multi-tenant · Dark theme · Yellow accent `#FFFF00`  
> Built for 1 company now, scaling to 100+

---

## สารบัญ

1. [Tech Stack](#1-tech-stack)
2. [Architecture Overview](#2-architecture-overview)
3. [Commands](#3-commands)
4. [Environment Variables](#4-environment-variables)
5. [Database Schema (16 tables)](#5-database-schema-16-tables)
6. [API Endpoints ทั้งหมด](#6-api-endpoints-ทั้งหมด)
7. [Auth System (2 flows)](#7-auth-system-2-flows)
8. [Frontend Structure](#8-frontend-structure)
9. [Key Patterns & Rules](#9-key-patterns--rules)
10. [Known Bugs & Gotchas](#10-known-bugs--gotchas)
11. [How to Add a New Feature](#11-how-to-add-a-new-feature)

---

## 1. Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite 7 + TypeScript |
| Backend | Express 5 + TypeScript |
| Database | PostgreSQL (Supabase) |
| ORM | Drizzle ORM |
| Auth | Supabase Auth (JWT) |
| State | Zustand (global) + useState (local UI) |
| Data fetching | TanStack Query v5 |
| UI components | shadcn/ui (Radix UI + Tailwind CSS) |
| Icons | Lucide React |
| Routing | Wouter (client-side) |
| Schema validation | Zod (via drizzle-zod) |
| Dev server | `tsx` (no transpile step) |

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│  Browser (React + Vite)                              │
│  client/src/                                         │
│    App.tsx → AuthGate → StockHome (main shell)       │
│    pages/sections/  ← 6 pages                        │
│    api/index.ts     ← typed API functions            │
│    api/client.ts    ← base fetch + auto Bearer token │
│    store/appStore.ts← Zustand (auth + nav)           │
└───────────────────┬──────────────────────────────────┘
                    │ HTTP /api/*
┌───────────────────▼──────────────────────────────────┐
│  Express 5 (server/)                                 │
│    index.ts     ← bootstrap + auto-migrations        │
│    routes.ts    ← mount all routers                  │
│    routes/*.ts  ← 10 route files                     │
│    middleware/requireAuth.ts ← JWT verify + DB lookup│
│    db.ts        ← Drizzle + pg Pool + runMigrations() │
└───────────────────┬──────────────────────────────────┘
                    │ SQL (Supabase Session Pooler)
┌───────────────────▼──────────────────────────────────┐
│  Supabase PostgreSQL                                 │
│    16 tables · RLS enabled · all have company_id     │
│    Auth: Supabase Auth (separate from app DB)        │
└──────────────────────────────────────────────────────┘
```

**Single repo, single port (5000).** Express serves both the API and the Vite dev server (HMR proxied).

---

## 3. Commands

```bash
npm run dev          # Start dev server — port 5000 (tsx watch, auto-restarts on server changes)
npm run check        # TypeScript type check (no emit)
npm run build        # Production build

npm run db:generate  # Generate SQL migration from schema changes → /migrations/
npm run db:migrate   # Apply pending migrations
npm run db:push      # Push schema directly (no migration file, use for quick experiments)
npm run db:studio    # Open Drizzle Studio (visual DB browser)
```

**Kill server (Windows):**
```powershell
Stop-Process -Name "node" -Force
```

**Database note:** Supabase direct connection (port 5432) is blocked by IPv6.  
Use **Session Pooler** URL in `.env`: `aws-1-ap-northeast-1.pooler.supabase.com:5432`

---

## 4. Environment Variables

File: `.env` (ไม่ commit)

```env
DATABASE_URL=postgresql://postgres.xxx:[PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...   # ต้องการสำหรับ invite users
NODE_ENV=development
PORT=5000
APP_URL=http://localhost:5000        # redirectTo URL สำหรับ invite email
```

**URL-encode special chars in password:** `%` → `%25`, `?` → `%3F`, `@` → `%40`

---

## 5. Database Schema (16 tables)

ทุก table ที่เก็บข้อมูลธุรกิจมี `company_id uuid NOT NULL` — รองรับ multi-tenant

### Relationship diagram

```
companies
  ├── users (admin / manager / crew)
  ├── stock_items → stock_units → container_units → containers
  ├── jobs → job_stock (อุปกรณ์ที่ใช้)
  │       → job_crew  (พนักงานที่ assign)
  │       → pull_sheets (ใบเบิก)
  │       → sub_rentals (ยืมจากบริษัทอื่น)
  │       → quotes (ใบเสนอราคา)
  │       → invoices (ใบแจ้งหนี้)
  │       → incidents (รายงานความเสียหาย)
  ├── maintenance_logs (ประวัติซ่อม)
  └── activity_log (ประวัติทุกการกระทำ)
```

### Tables ทั้งหมด

| # | Table | ใช้สำหรับ | Primary fields |
|---|-------|-----------|----------------|
| 1 | `companies` | บริษัทที่ใช้แอป | id, name, slug, plan |
| 2 | `users` | พนักงานของแต่ละบริษัท | id, company_id, auth_id (Supabase), name, role |
| 3 | `stock_items` | หมวดหมู่อุปกรณ์ (เช่น "J8 Loudspeaker") | id, company_id, name, brand, category, sub_category, quantity |
| 4 | `stock_units` | ชิ้นย่อยแต่ละตัว (เช่น "J8 Top1") | id, company_id, stock_item_id, serial_number, barcode, status, health_score |
| 5 | `containers` | ลัง/ราก ที่บรรจุอุปกรณ์ | id, company_id, name, type, location, is_out |
| 6 | `container_units` | junction: unit ไหนอยู่ใน container ไหน | container_id, stock_unit_id |
| 7 | `jobs` | งานให้เช่า (events) | id, company_id, name, client, start_date, end_date, status |
| 8 | `job_stock` | อุปกรณ์ที่ assign ให้งาน | job_id, stock_item_id, quantity |
| 9 | `job_crew` | พนักงานที่ assign ให้งาน | job_id, user_id, role (บทบาทในงาน) |
| 10 | `pull_sheets` | ใบเบิกอุปกรณ์ | id, company_id, job_id, created_by, assignee_id, status |
| 11 | `maintenance_logs` | ประวัติซ่อมบำรุง | id, company_id, stock_unit_id, type, status, cost, tech_id |
| 12 | `sub_rentals` | อุปกรณ์ยืมจากบริษัทอื่น | id, company_id, job_id, partner, due_back, daily_rate, status |
| 13 | `quotes` | ใบเสนอราคา | id, company_id, job_id, quote_number, client, total_value, status |
| 14 | `invoices` | ใบแจ้งหนี้ | id, company_id, job_id, invoice_number, client, amount, issued_date, due_date, status |
| 15 | `incidents` | รายงานความเสียหาย/สูญหาย | id, company_id, stock_unit_id, job_id, reporter_id, severity, status |
| 16 | `activity_log` | ประวัติทุกการกระทำ | id, company_id, user_id, type, action, detail |

### Enums (enforced at DB level)

| Enum | Values |
|------|--------|
| `plan` | free, pro, enterprise |
| `user_role` | admin, manager, crew |
| `stock_unit_status` | available, out, maintenance, retired |
| `container_type` | rack, case, bag, box, other |
| `job_status` | draft, scheduled, active, completed, cancelled |
| `pull_sheet_status` | draft, pending, dispatched, returned |
| `maintenance_type` | repair, preventive, inspection |
| `maintenance_status` | in_progress, completed |
| `sub_rental_status` | active, pending, returned |
| `quote_status` | draft, sent, accepted, declined |
| `invoice_status` | pending, paid, overdue |
| `incident_severity` | low, medium, high |
| `incident_status` | open, resolved |
| `activity_type` | stock, finance, maintenance, jobs |

---

## 6. API Endpoints ทั้งหมด

### Auth (ไม่ต้องมี token)

| Method | Path | ใช้สำหรับ |
|--------|------|-----------|
| POST | `/api/auth/register` | Admin สร้าง company + user ครั้งแรก |
| POST | `/api/auth/invite` | Admin เชิญพนักงาน (ต้องมี token + role=admin) |
| POST | `/api/auth/accept-invite` | พนักงานยืนยัน invite + สร้าง DB record |
| GET | `/api/auth/me` | ดึงข้อมูล user ปัจจุบัน (ต้องมี token) |

### Companies (ไม่ต้องมี token)

| Method | Path | ใช้สำหรับ |
|--------|------|-----------|
| POST | `/api/companies` | สร้าง company (เรียกจาก register flow) |
| GET | `/api/companies/:id` | ดึงข้อมูล company |

### Stock (ต้องมี token)

| Method | Path | ใช้สำหรับ |
|--------|------|-----------|
| GET | `/api/stock` | ดึง stock items ทั้งหมด |
| GET | `/api/stock/:id` | ดึง item เดียว + units |
| POST | `/api/stock` | เพิ่มอุปกรณ์ใหม่ |
| PUT | `/api/stock/:id` | แก้ไขอุปกรณ์ |
| DELETE | `/api/stock/:id` | ลบอุปกรณ์ |
| POST | `/api/stock/:id/units` | เพิ่ม unit ใหม่ให้ item |
| PUT | `/api/stock/units/:unitId` | อัปเดต unit (status, health_score, etc.) |

### Containers (ต้องมี token)

| Method | Path | ใช้สำหรับ |
|--------|------|-----------|
| GET | `/api/containers` | ดึง containers ทั้งหมด |
| POST | `/api/containers` | สร้าง container ใหม่ |
| PUT | `/api/containers/:id/checkout` | toggle is_out |
| DELETE | `/api/containers/:id` | ลบ container |

### Jobs (ต้องมี token)

| Method | Path | ใช้สำหรับ |
|--------|------|-----------|
| GET | `/api/jobs` | ดึงงานทั้งหมด |
| GET | `/api/jobs/pullsheets` | Pull sheets + job name + assignee name + item count |
| GET | `/api/jobs/crew` | Crew members + tasks + responsibility log |
| GET | `/api/jobs/:id` | ดึงงานเดียว + stock + crew + pull sheets |
| POST | `/api/jobs` | สร้างงานใหม่ |
| PUT | `/api/jobs/:id` | อัปเดตงาน (เช่น เปลี่ยน status) |
| GET | `/api/jobs/all/incidents` | ดึง incident reports ทั้งหมด |
| POST | `/api/jobs/:id/incidents` | รายงาน incident ใหม่ |

### Finance (ต้องมี token)

| Method | Path | ใช้สำหรับ |
|--------|------|-----------|
| GET | `/api/finance/quotes` | ใบเสนอราคาทั้งหมด |
| POST | `/api/finance/quotes` | สร้างใบเสนอราคา |
| PUT | `/api/finance/quotes/:id` | อัปเดต quote (draft→sent→accepted) |
| GET | `/api/finance/invoices` | ใบแจ้งหนี้ทั้งหมด |
| POST | `/api/finance/invoices` | สร้างใบแจ้งหนี้ |
| PUT | `/api/finance/invoices/:id` | อัปเดต invoice (mark paid/overdue) |
| GET | `/api/finance/costing` | Revenue vs cost per job + ROI |
| GET | `/api/finance/loss` | Loss analysis + auto-billing items |

### Maintenance (ต้องมี token)

| Method | Path | ใช้สำหรับ |
|--------|------|-----------|
| GET | `/api/maintenance` | Maintenance logs ทั้งหมด |
| POST | `/api/maintenance` | บันทึกการซ่อมใหม่ |
| PUT | `/api/maintenance/:id` | อัปเดต status (in_progress→completed) |
| GET | `/api/maintenance/subrentals` | Sub-rentals ทั้งหมด |
| POST | `/api/maintenance/subrentals` | เพิ่ม sub-rental |

### Activity, Stats, Analytics (ต้องมี token)

| Method | Path | ใช้สำหรับ |
|--------|------|-----------|
| GET | `/api/activity` | Activity log ล่าสุด 100 รายการ |
| POST | `/api/activity` | บันทึก activity ใหม่ |
| GET | `/api/stats` | KPI สำหรับหน้า Home (4 stats + recent activity) |
| GET | `/api/analytics` | Analytics: utilization, health, revenue trend |

---

## 7. Auth System (2 flows)

### Flow 1 — Company Admin (Register / Login)

```
1. User กรอก email + password ใน RegisterPage
2. supabase.auth.signUp() → ได้ Supabase user + access_token (JWT)
3. POST /api/auth/register { authId, companyName, slug, userName, email, token }
   → สร้าง companies record
   → สร้าง users record (role=admin, authId=Supabase UID)
4. เก็บ token + userInfo ใน Zustand store (persist ไปยัง localStorage ด้วย "stak-store")
```

### Flow 2 — Employee (Invite-based)

```
1. Admin เปิดหน้า Settings → Team → กรอก email + role → กด ส่ง
2. POST /api/auth/invite { email, role }
   → supabaseAdmin.auth.admin.inviteUserByEmail(email, { data: { role, companyId } })
   → Supabase ส่ง magic link ไปยัง email ของพนักงาน
3. พนักงานคลิก link ในอีเมล → redirect กลับมาที่ APP_URL/#type=invite&...
4. App.tsx ตรวจ URL hash → แสดง InvitePage
5. พนักงานกรอกชื่อ → POST /api/auth/accept-invite { name, token }
   → ดึง companyId + role จาก Supabase user metadata
   → สร้าง users record ใน DB
6. เก็บ token ใน Zustand → เข้าใช้งาน
```

### requireAuth Middleware

ทุก request ที่ต้องการ auth จะผ่าน `server/middleware/requireAuth.ts`:

```
Authorization: Bearer <token>
  ↓
supabase.auth.getUser(token)  ← ตรวจกับ Supabase
  ↓
db.select().from(users).where(eq(users.authId, user.id))  ← ดึงจาก DB ของเรา
  ↓
req.companyId = dbUser.companyId
req.userId    = dbUser.id
req.userRole  = dbUser.role
```

---

## 8. Frontend Structure

```
client/src/
  App.tsx                     ← AuthGate: entry → login/register/invite flow
  pages/
    AuthEntryPage.tsx         ← Landing: 2 ปุ่ม (Admin Login / สร้างบริษัท)
    LoginPage.tsx             ← Admin/Manager/Crew login
    RegisterPage.tsx          ← Admin สร้างบริษัทใหม่ (เฉพาะเจ้าของ)
    InvitePage.tsx            ← พนักงานยืนยัน invite
    StockHome.tsx             ← Main shell (sidebar + content area)
    sections/
      HomePage.tsx            ← Dashboard KPI (API: /stats)
      StockPage.tsx           ← Stock management (API: /stock)
      JobsPage.tsx            ← Jobs + Pull sheets + Crew (API: /jobs, /jobs/pullsheets, /jobs/crew)
      FinancePage.tsx         ← Finance + Quotes + Invoices (API: /finance/*)
      HistoryPage.tsx         ← Activity log + Analytics (API: /activity, /analytics)
      SettingsPage.tsx        ← Company settings + Invite team (API: /auth/invite)
      [Many modal components] ← Add/Edit modals
  api/
    client.ts                 ← Base fetch wrapper (auto Bearer token จาก Zustand)
    index.ts                  ← Typed API functions (stockApi, jobsApi, financeApi, etc.)
  store/
    appStore.ts               ← Zustand: auth state (persisted) + navigation + containers UI
  lib/
    supabase.ts               ← Supabase client (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY)
    queryClient.ts            ← TanStack Query client config
  components/ui/              ← shadcn/ui components (ไม่แก้ไข)
```

### Pages ↔ API Mapping

| Page | Data Source | Query Key |
|------|-------------|-----------|
| HomePage | `statsApi.get()` | `["stats"]` |
| StockPage | `stockApi.getAll()` | `["stock"]` |
| JobsPage (jobs tab) | `jobsApi.getAll()` | `["jobs"]` |
| JobsPage (pull sheets tab) | `jobsApi.getPullSheets()` | `["pull-sheets"]` |
| JobsPage (crew tab) | `jobsApi.getCrew()` | `["crew"]` |
| FinancePage (quotes) | `financeApi.getQuotes()` | `["quotes"]` |
| FinancePage (invoices) | `financeApi.getInvoices()` | `["invoices"]` |
| FinancePage (costing) | `financeApi.getCosting()` | `["finance-costing"]` |
| FinancePage (loss) | `financeApi.getLoss()` | `["finance-loss"]` |
| HistoryPage (activity) | `activityApi.getAll()` | `["activity"]` |
| HistoryPage (analytics) | `analyticsApi.get()` | `["analytics"]` |

### Global State (Zustand — `useAppStore`)

```typescript
// สิ่งที่เก็บใน Zustand
auth: {
  token, userId, userName, userInitials, userRole,
  companyId, companyName
}
activePage: string            // ใช้ navigate ระหว่างหน้า
expandedContainers: string[]  // containers ที่ expand ใน UI
checkedOutContainers: Set     // containers ที่ checked out
```

`auth` persist ลง localStorage ด้วย key `"stak-store"` — login ไม่หายตอน refresh

---

## 9. Key Patterns & Rules

### Multi-tenant isolation

ทุก query ต้อง filter ด้วย `company_id` **เสมอ**:

```typescript
// ✅ ถูก
db.select().from(stockItems).where(eq(stockItems.companyId, req.companyId))

// ❌ ผิด — ดึงข้อมูลของทุกบริษัท
db.select().from(stockItems)
```

### Schema → Types → Validation (single source of truth)

ทุกอย่างเริ่มจาก `shared/schema.ts`:

```typescript
// 1. Define table
export const stockItems = pgTable("stock_items", { ... })

// 2. Drizzle auto-generates Zod schema
export const insertStockItemSchema = createInsertSchema(stockItems).omit({ id: true, createdAt: true })

// 3. TypeScript types inferred from Drizzle
export type StockItem       = typeof stockItems.$inferSelect
export type InsertStockItem = z.infer<typeof insertStockItemSchema>
```

ใช้ในทั้ง server (validate request body) และ client (type checking):
```typescript
// server: validate ก่อน insert
const data = insertStockItemSchema.parse({ ...req.body, companyId: req.companyId })

// client/api/index.ts: type-safe function signatures
create: (data: Omit<InsertStockItem, "companyId">) => api.post<StockItem>("/stock", data)
```

### Route ordering in Express

Route เฉพาะต้องมาก่อน `/:id` เสมอ:

```typescript
// ✅ ถูก — pullsheets ก่อน /:id
jobsRouter.get("/pullsheets", ...)
jobsRouter.get("/crew", ...)
jobsRouter.get("/:id", ...)

// ❌ ผิด — Express จะจับ "pullsheets" เป็น :id
jobsRouter.get("/:id", ...)
jobsRouter.get("/pullsheets", ...)
```

### Drizzle JOIN column conflict

เมื่อ JOIN 2 tables ที่มี column ชื่อเดียวกัน (เช่น `jobs.name` + `users.name`) ให้ใช้ **separate queries + inArray()** แทน:

```typescript
// ❌ ผิด — Drizzle/SQL ไม่รู้จะเลือก name ของใคร
db.select().from(pullSheets).leftJoin(jobs, ...).leftJoin(users, ...)

// ✅ ถูก — แยก 3 queries แล้วค่อย map
const sheets    = await db.select().from(pullSheets).where(...)
const jobIds    = Array.from(new Set(sheets.map(s => s.jobId).filter(Boolean))) as string[]
const jobRows   = jobIds.length ? await db.select({ id: jobs.id, name: jobs.name }).from(jobs).where(inArray(jobs.id, jobIds)) : []
const jobNameMap = Object.fromEntries(jobRows.map(j => [j.id, j.name]))
```

### TanStack Query pattern

```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ["stock"],         // unique key — ใช้ invalidate cache ได้
  queryFn: stockApi.getAll,   // function ที่ return Promise
  enabled: !!token,            // อย่า fetch ถ้ายังไม่ login
})
```

### Frontend API client

`client/src/api/client.ts` ส่ง Bearer token อัตโนมัติ:

```typescript
const token = useAppStore.getState().token  // อ่านนอก React component ได้
fetch(`/api${path}`, {
  headers: { Authorization: `Bearer ${token}` }
})
```

ไม่ต้องส่ง `companyId` จาก frontend — server อ่านจาก JWT เสมอ

### Error handling

ใช้ `catch (err: any)` เสมอ (ไม่ใช่ `catch {}`) เพื่อให้ error message ขึ้น:

```typescript
// ✅ ถูก
} catch (err: any) {
  res.status(500).json({ message: err?.message ?? "Failed to fetch" })
}

// ❌ ผิด — ไม่รู้ว่า error อะไร
} catch {
  res.status(500).json({ message: "Failed to fetch" })
}
```

### TypeScript Set spread

ใช้ `Array.from(new Set(...))` แทน `[...new Set(...)]`:

```typescript
// ✅ ถูก
const ids = Array.from(new Set(items.map(i => i.id).filter(Boolean))) as string[]

// ❌ ผิด — TypeScript downlevelIteration error
const ids = [...new Set(items.map(i => i.id))]
```

---

## 10. Known Bugs & Gotchas

### 1. Thai characters in Supabase invite metadata

**ปัญหา:** `inviteUserByEmail` กับ metadata ที่มีตัวอักษรไทย → `TypeError: Cannot convert argument to a ByteString`  
**สาเหตุ:** Supabase SDK ใส่ metadata ใน HTTP headers บางจุด — headers ต้องเป็น ASCII เท่านั้น  
**แก้ไข:** ไม่ส่ง Thai text ใน metadata เลย — เฉพาะ ASCII (`role`, `companyId`):

```typescript
// ✅ ถูก
await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
  data: { role, companyId: req.companyId },  // ASCII เท่านั้น
  redirectTo: process.env.APP_URL ?? "http://localhost:5000",
})

// ❌ ผิด — name เป็นภาษาไทย → ByteString error
data: { role, name: name, companyId: req.companyId }
```

### 2. Server ไม่ auto-restart ตอนแก้ code (เดิม)

**ปัญหา:** `npm run dev` เดิมใช้ `tsx server/index.ts` (ไม่มี `--watch`) → แก้ code แล้วต้อง restart เอง  
**แก้ไข (2026-06-07):** เปลี่ยนเป็น `tsx watch server/index.ts` → auto-restart เมื่อ server files เปลี่ยน

### 3. Supabase IPv6 blocking

**ปัญหา:** Direct connection (port 5432) ถูกบล็อคโดย IPv6  
**แก้ไข:** ใช้ Session Pooler URL: `aws-1-ap-northeast-1.pooler.supabase.com:5432`

### 4. Finance costing — staff/transport costs missing

**สถานะ:** `staff` และ `transport` columns ยังไม่มีใน schema — ปัจจุบัน return `0`  
**แก้ไขในอนาคต:** เพิ่ม columns ใน `jobs` table และ migration

---

## 11. How to Add a New Feature

### ขั้นตอนมาตรฐาน

```
1. shared/schema.ts
   └── เพิ่ม table / column / enum
   └── เพิ่ม Zod schema: createInsertSchema(...)
   └── เพิ่ม TypeScript type: typeof table.$inferSelect

2. npm run db:generate → commit migration file ใน /migrations/

3. server/routes/[domain].ts
   └── เพิ่ม route ใหม่
   └── filter ด้วย req.companyId เสมอ
   └── ใช้ Zod schema.parse() ก่อน insert
   └── ใช้ catch (err: any) ไม่ใช่ catch {}

4. server/routes.ts
   └── mount router ถ้าเป็น router ใหม่

5. client/src/api/index.ts
   └── เพิ่ม typed function ใหม่

6. client/src/pages/sections/XxxPage.tsx
   └── useQuery({ queryKey: [...], queryFn: xxxApi.getXxx, enabled: !!token })
   └── render data จาก useQuery แทน mock data
```

### ตัวอย่าง: เพิ่ม endpoint ใหม่

```typescript
// server/routes/stock.ts
stockRouter.get("/low-stock", async (req, res) => {
  try {
    const items = await db
      .select()
      .from(stockItems)
      .where(and(
        eq(stockItems.companyId, req.companyId),
        // เพิ่ม condition ที่ต้องการ
      ))
    res.json(items)
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed" })
  }
})

// client/src/api/index.ts
export const stockApi = {
  // ... existing ...
  getLowStock: () => api.get<StockItem[]>("/stock/low-stock"),
}

// ใน component
const { data: lowStock } = useQuery({
  queryKey: ["low-stock"],
  queryFn: stockApi.getLowStock,
  enabled: !!token,
})
```

### ตัวอย่าง: เพิ่ม table ใหม่

```typescript
// shared/schema.ts
export const newTable = pgTable("new_table", {
  id:        uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  name:      text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const insertNewTableSchema = createInsertSchema(newTable).omit({ id: true, createdAt: true })
export type NewTable       = typeof newTable.$inferSelect
export type InsertNewTable = z.infer<typeof insertNewTableSchema>
```

จากนั้น `npm run db:generate` → commit migration → implement routes

---

## Quick Reference

### Path aliases

| Alias | จุดปลาย |
|-------|---------|
| `@/` | `client/src/` |
| `@shared/` | `shared/` |
| `@assets/` | `attached_assets/` |

### UI Design tokens

| ใช้สำหรับ | Value |
|-----------|-------|
| Background | `#0a0a0a` |
| Card/Panel | `#111` |
| Border | `border-white/[0.06]` |
| Accent (yellow) | `#FFFF00` |
| Text primary | `text-white` |
| Text muted | `text-white/30` |
| Success | `text-emerald-400` |
| Warning | `text-amber-400` |
| Error | `text-red-400` |

### Role permissions

| Role | สิทธิ์ |
|------|--------|
| `admin` | ทำได้ทุกอย่าง + invite members |
| `manager` | จัดการ jobs, stock, finance |
| `crew` | ดูข้อมูล + report incidents |
