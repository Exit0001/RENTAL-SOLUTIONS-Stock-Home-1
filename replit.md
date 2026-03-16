# STAK — AV Equipment Rental Management Platform

## Overview
A comprehensive dark-themed asset and equipment management platform for AV/event rental companies. Covers the full lifecycle: asset tracking, project management, finance, analytics, and team coordination.

## Tech Stack
- **Frontend**: React + TypeScript, Vite, TailwindCSS, shadcn/ui, wouter (routing), TanStack Query
- **Backend**: Express + TypeScript
- **Database**: PostgreSQL with Drizzle ORM

## Theme
- Background: `#0a0a0a` / `#111` (near-black)
- Accent: `#FFFF00` (yellow)
- Text: white with various opacity levels
- Borders: `white/[0.06]`
- Status badges use semantic colors (green, red, amber, blue, purple)

## App Structure

### Navigation
State-driven navigation via `active` state in `StockHome.tsx`. No full page reloads. Sidebar expands on hover from 3px to 48rem.

### Pages (6 main sections)

1. **Dashboard** (`DashboardPage.tsx`)
   - KPI cards, live notification feed, multi-site monitoring, quick actions

2. **Assets** (`AssetsPage.tsx`) — 4 tabs:
   - Inventory: Unit-level tracking (SN, barcode), asset hierarchy, health scores, status badges (Ready/Out/Maintenance)
   - Containers: Virtual cases & racks, scan-to-view contents
   - Maintenance: Lifecycle maintenance log with repair history
   - Sub-Rentals: Partner equipment with color-coded distinction (purple)

3. **Projects** (`ProjectsPage.tsx`) — 4 tabs:
   - Jobs: Multi-event management with expandable details
   - Pull Sheets: Digital pull sheet generation with LINE/PDF sharing
   - Crew & Tasks: Dynamic crew scheduling, personalized task dashboard
   - Incidents: Photo damage reporting with severity levels

4. **Finance** (`FinancePage.tsx`) — 4 tabs:
   - Quotes: Smart quoting linked to stock availability
   - Invoices: Invoice management with payment flow
   - Costing: Per-project cost breakdown & ROI
   - Loss Analysis: Leakage analytics, automated damage/loss billing

5. **Analytics** (`AnalyticsPage.tsx`) — 3 tabs:
   - Utilization: Equipment usage bars, idle asset alerts
   - Health Trends: Health score distribution, at-risk assets
   - Revenue: 6-month trend chart, profit margins

6. **Team** (`TeamPage.tsx`) — 3 tabs:
   - Schedule: Weekly crew scheduling grid
   - My Tasks: Personal task dashboard with priorities
   - Responsibility: Check-in/out accountability log with signatures

### Key Features Covered
- Unit-Level Tracking (SN/Barcode)
- Modular Asset Hierarchy
- Real-time Status Badges (Ready/Maintenance/Out)
- Lifecycle Maintenance Log
- Virtual Containerization (Cases/Racks)
- Asset Health Score
- Digital Pull Sheet Generation (LINE integration)
- Mobile Scanner Integration
- Multi-Site Remote Monitoring
- Smart Sub-Rental Bridge (color-coded)
- Dynamic Crew Scheduling
- Personalized Task Dashboard
- Responsibility Tracking
- Live Notification System
- Incident Photo Reporting
- Project Costing & ROI
- Smart Quoting System
- Invoicing & Payment Flow
- Leakage & Loss Analytics
- Utilization Analytics
- Automated Lost/Damage Billing
- Responsibility Assignment

### Key Directories
- `client/src/pages/StockHome.tsx` — Main app shell (header + sidebar + page router)
- `client/src/pages/sections/` — All page components
- `client/src/components/ui/` — shadcn/ui components

## Running
- `npm run dev` starts both Express backend and Vite frontend dev server
