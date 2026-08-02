---
name: stak-mobile-responsive
description: "STAK v2.0 mobile/tablet responsive contract — the single source of truth for making any part of this app work on phones and tablets. Use for ANY task touching layout, breakpoints, or small screens. Triggers: mobile, มือถือ, responsive, จอเล็ก, hamburger, drawer, breakpoint, tablet, แท็บเล็ต, touch target, ปุ่มเล็กเกินไป, ตารางบนมือถือ, table to card, bottom sheet, overflow, ล้นจอ, เลื่อนแนวนอน, WorkspaceShell, ScrollTabs, MasterDetail, CenteredModal, PaneTabs, useBreakpoint, dvh, safe-area. Also use when adding ANY new page, modal, table, or tab bar — new code must be born responsive, not retrofitted."
---

# STAK v2.0 — Mobile Responsive Contract

**Read this before writing any layout code in this repo.** The app was desktop-only until 2026-07-29; this document is the plan, the API reference, and the progress tracker for making it work everywhere.

Full plan (Thai, with rationale): `C:\Users\tcgmc\.claude\plans\hamburgers-100-radiant-mountain.md`

---

## 0. Progress tracker — UPDATE THIS AT THE END OF EVERY PHASE

| Phase | Scope | Status |
|---|---|---|
| 0 | This skill file | ✅ done 2026-07-29 |
| 1 | Shell + hamburger + 8 primitives | ✅ done 2026-07-29 — `npm run check` clean, verified live. Only the shell (rail/hamburger/drawer/header) + the primitives were touched. |
| 2 | 7 pages responsive | ✅ done 2026-07-29 — all 7 done. See per-page notes below. |
| 3 | 8 tables → cards | ✅ done 2026-08-03 — all 8 done. **Maintenance** done 2026-07-29 (see below). **RackBuild** (`RackBuildModal.tsx`) done 2026-08-03 as part of Phase 4a — see that row. |
| 3.5 | StockPage mobile tab nav upgrade | ✅ done 2026-08-02 — `StockPage.tsx`'s top `<ScrollTabs>` is now `hidden md:block`; mobile gets a fixed bottom tab bar instead (6-col grid, icon + label, `.safe-b`, thumb reach) plus left/right swipe (touchstart/touchend, wraps at ends) to move between tabs. Same `activeTab`/`setActiveTab` drives both — not a separate state. Superseded the plain-ScrollTabs note from Phase 2's per-page table below. |
| 4a | WorkspaceShell + 11 workspace modals | ✅ done 2026-08-03 — all 11 done. See per-modal notes below. |
| 4b | CenteredModal + 24 dialogs | ⬜ not started — **next up.** `CenteredModal` primitive exists and is unused so far. |
| 5 | Gantt + touch targets + polish | ⬜ not started |

Mark `🔄 in progress` / `✅ done <date>` and note anything that deviated from the plan.

### Phase 2 per-page record (what was actually done)

| File | Change |
|---|---|
| `HomePage.tsx` | KPI `grid-cols-4`→`grid-cols-2 lg:grid-cols-4`; `grid-cols-12`→`grid-cols-1 lg:grid-cols-12`; summary `grid-cols-3`→`grid-cols-1 md:grid-cols-3`; quick-nav 2-col→1-col full-width rows w/ `min-h-[44px]`. **Header quickStats hidden below `lg`** — they duplicate the KPI cards value-for-value, so this removes duplication, not data. |
| `StockPage.tsx` | Tab bar → `<ScrollTabs>`; filter rail → `Sheet side="left"` on mobile (`hidden md:block` for the inline rail); disposals table → `DataCard`; maintenance table → `.h-scroll min-w-[900px]`; action-bar buttons `h-11 md:h-9 rounded-xl md:rounded-lg`. |
| `StockFilterControlsSection.tsx` | Rewritten as the reference mobile action bar: `[filter icon][search flex-1][+ icon][⋯ menu]`. |
| `StockItemsTableSection.tsx` | Full mobile card tree (category accordion → model cards → `UnitRows` in a nested `.h-scroll` table). `MobileActionRow` replaces the 4 icon-only 28px buttons. **Removed `table-fixed` + the % `<colgroup>`** and set `min-w-[900px]` — this is R10, the desktop table never scrolled before. |
| `FinancePage.tsx` | All 4 tables → `DataCard`; summary + loss grids `grid-cols-4`→`grid-cols-2 lg:grid-cols-4`; tabs → `<ScrollTabs>`. |
| `HistoryPage.tsx` | `grid-cols-12`→`grid-cols-1 lg:grid-cols-12`; filter tabs → `<ScrollTabs>`; search moved to its own row on mobile. |
| `SettingsPage.tsx` | `p-3 md:p-6`; tabs → `<ScrollTabs>`; logout button `min-h-[44px]`. |
| `JobsPage.tsx` | → `<MasterDetail>` with `mobileDetailOpen` state. Status legend gets its own `.h-scroll` strip below `sm` rather than being hidden. |
| `JobDetailPanel.tsx` | Sub-tabs → `<ScrollTabs>`; overview `grid-cols-2`→`grid-cols-1 sm:grid-cols-2`; the three `p-1.5` icon buttons got `.tap-target` + `aria-label`. |
| `CrewPage.tsx` | 3 columns → 3 `<ScrollTabs>` panes (`hidden`, never unmounted). **The job picker strip is hoisted above the tabs on mobile** — without it the roster tab can't assign anyone, because assignment is gated on a job selected in the centre pane. |

### Phase 4a per-modal record (what was actually done, 2026-08-03)

| File | Change |
|---|---|
| `BrandCategoryModal.tsx` | No pane work needed (no `sidebar`, no internal split). Found and fixed a real bug: category/brand card edit/delete icons were `group-hover`-only → unreachable on touch. Now `opacity-100 md:opacity-0 md:group-hover:opacity-100`. Touch targets + `px-3 md:px-6` padding. |
| `AddResourcesModal.tsx` | `sidebar` + real `tabs`/`activeTab` (crew/vehicle) — `children` reachable on mobile from the first render since `activeTab` already matches a `tabs` entry. Row grids `grid-cols-2/3` → `grid-cols-1 sm:grid-cols-2/3`, inputs `h-11 md:h-9`. |
| `AddJobsModal.tsx` | Initially built like AddResourcesModal but with **no `tabs` prop** (single form, no mode-switching) — this left `children` permanently hidden on mobile behind the sidebar pill (see the `WorkspaceShell.sidebar` warning above). Fixed 2026-08-03: main content built once as `mainContent`, exposed via a `mobilePanes` entry on mobile / `children` on desktop. `JobDailyScheduleDraftEditor`'s nested `grid-cols-3` of native `type="time"` inputs left as-is — narrow columns are fine for a native time picker. |
| `QuickAddItemsModal.tsx` | Same `sidebar`-without-`tabs` bug as AddJobsModal, same `mainContent`/`mobilePanes` fix (2026-08-03). Kept the dense rem-based compact grid (spreadsheet-style entry, intentionally small even on desktop) — added `.tap-target` to every icon button instead of resizing, so the 44px hit area exists without changing visual density. |
| `ScanModal.tsx` | Fixed 2-col (manifest flex-1 + 280px scan panel) → `flex-col md:flex-row` with the **scan panel first** on mobile (thumb reach, stays visible without a tab switch mid-scan), manifest below in its own scroll region. |
| `EquipmentPicker.tsx` (shared by SetBuilderModal + AddSetsModal) | `EquipmentCatalogPane`/`EquipmentCartPane` width classes made dual-purpose: full-width when `<PaneTabs>` shows one at a time on mobile, original `flex-1`/`w-72 lg:w-80` when `PaneTabs` renders both in a plain row on desktop (byte-identical desktop DOM). Catalog pane's local `search`/filter state → its `PaneTabs` entry is `keepMounted: true` wherever it's used. |
| `SetBuilderModal.tsx`, `AddSetsModal.tsx` | Wrapped the catalog+cart split in `<PaneTabs>` (catalog `keepMounted`, cart gets an item-count badge). AddSetsModal's outer per-draft-set tabs were already handled by `WorkspaceShell.tabs` — only the inner split needed `PaneTabs`. |
| `RackBuildModal.tsx` | Rack list ⇄ active rack contents is a **master-detail** flow, not co-equal panes → used `<MasterDetail>` instead of `PaneTabs` (full list on mobile until a rack is tapped, then a pushed detail view with a back bar). Items-in-rack table (the last Phase 3 holdout, deferred here since it lives in a workspace modal) converted to `<ResponsiveTable>`/`<DataCard>`. **Follow-up 2026-08-03**: the "scan a rack barcode" input originally lived only in the detail pane's empty state — unreachable on mobile before a rack is picked (chicken-and-egg, `MasterDetail` shows the master until `detailOpen`). Moved it into the master (list) pane permanently, with its own ref/state (`rackScanRef`/`rackScanValue`) separate from the detail pane's item-scan input, since both are mounted simultaneously on desktop. |
| `ManageContainerUnitsModal.tsx` | 3-way split: `sidebar` (rack picker) + catalog + cart. **Initially shipped with the same `sidebar`-without-`tabs` bug** (children permanently hidden on mobile) — fixed 2026-08-03 with the `mainContent`/`mobilePanes` pattern, same as AddJobsModal. Cart pane width `w-[38%]` → `w-full md:w-[38%]`. |
| `ManageJobStockModal.tsx` | **The reference case for the `keepMounted` warning.** Cart was a persistent column *outside* the items/racks/sets tab swap — unreachable on mobile before this. Built once as `cartPaneNode`, rendered either inside the row (desktop, `!isMobile &&`) or as a `WorkspaceShell.mobilePanes` entry (mobile) — never both, so never double-mounted. `keepMounted: true` since the cart owns local zone-filter/selection state. |
| `JobOperationsModal.tsx` | Largest file (1200+ lines). All 3 tabs (Pack/Dispatch/Return) shared one layout: fixed `w-[400px]` scanner rail + `flex-1` list. Each → `flex-col md:flex-row` with the scanner rail `w-full md:w-[400px]` + `max-h-[36vh] md:max-h-none` (caps its height on mobile so its internal log feed can still scroll; tightened from an initial 42vh 2026-08-03 after screenshots showed too much dead space above the download button) stacked above the list. Also fixed a real overflow bug in the dispatch tab's rack-load row (icon + name + 128px progress bar + status + button in one non-wrapping row, silently clipped past ~400px by the app's global `overflow-x-hidden`) — now `flex-wrap` with a narrower mobile progress bar. **Follow-up 2026-08-03**: de-emphasized the pack tab's "download packing sheet" button to a ghost style (was full-width brand-yellow, competing visually with the empty scan-log state above it) and fixed stale "เลือกจากรายการทางขวา" copy that no longer matched the stacked mobile layout (now `md:hidden`/`hidden md:inline` variants). Verified via the `grep -c onClick` before/after check (18 → 18, no handlers dropped) both times. |

**Pattern used to choose `PaneTabs` vs `MasterDetail` vs `mobilePanes`:** co-equal panes the user flips between (catalog↔cart, manifest↔scanner) → `PaneTabs` (or plain CSS stacking if one side is clearly primary, like ScanModal/JobOperationsModal's scanner-first layouts). A list where picking one item reveals its own workspace → `MasterDetail`. An extra pane that isn't part of an existing `WorkspaceShell.tabs` switch (e.g. a cart sitting outside an items/racks/sets tab set) → `WorkspaceShell.mobilePanes`.

### Known-good verification result (re-run after any change)

`grep -c onClick` before/after showed `-1` on exactly 4 files (StockPage, HistoryPage,
SettingsPage, JobDetailPanel). All four are the tab bars replaced by `<ScrollTabs>`, whose
handler now lives in `onChange`. **A `-1` on a file you converted to ScrollTabs is expected;
any other decrease is a real regression.**

---

## 1. Breakpoint contract — memorize this

Tailwind `theme.screens` is **NOT customized** in `tailwind.config.ts`, so stock defaults apply.

| Tier | Width | Tailwind prefix that turns it ON |
|---|---|---|
| **mobile** | < 768px | (unprefixed — mobile is the base) |
| **tablet** | 768–1023px | `md:` |
| **desktop** | ≥ 1024px | `lg:` |

- **`md:` = the mobile boundary.** Anything that must change on a phone gets `md:` for the non-phone value.
- **`lg:` = the tablet boundary.** Only for desktop-only widening.
- **`sm:` (640px) maps to NO tier.** Use it only to refine *within* mobile (e.g. 1-col → 2-col cards at 640). Never use `sm:` to decide a tier.
- Tablet deliberately gets the **desktop** layout plus narrower fixed panes. The 64px nav rail stays at tablet; only phones get the hamburger.

**Write mobile-first.** `p-3 md:p-6`, not `p-6 max-md:p-3`.

---

## 2. The one rule: CSS or JS?

> **Use Tailwind `md:`/`lg:` prefixes (CSS) by default. Escalate to `useBreakpoint()` (JS) only when the hidden branch would run a hook, fire a query, register an effect/observer, render more than ~50 nodes, or duplicate an `id`/`data-testid`.**

**CSS (default):** grid column counts · padding/gap/type scale · flex direction & wrap · hiding small leaf nodes · fixed pane widths (`w-[280px]` → `w-full md:w-[280px]`) · overflow · modal sizing.

**JS (exactly 4 exceptions):**
1. Table → cards (`ResponsiveTable`) — heavy trees, duplicate testids
2. Master-detail push/pop (`MasterDetail`) — `JobDetailPanel` fires TanStack queries; mounting it hidden = phantom network traffic
3. Workspace-modal pane switching (`WorkspaceShell.mobilePanes` / `PaneTabs`) — panes own queries + ResizeObservers
4. Nav drawer vs rail (`AppNavDrawer`) — portal, focus trap, scroll lock

**Never mix both strategies for the same decision in one component.** A node chosen by JS must not also carry `md:hidden` — that produces an element that is mounted but invisible and steals taps.

---

## 3. Design contract — DO NOT TOUCH

This work is **layout only**. Colors, fonts, and the theme system are locked.

- Tokens: `--brand` / `--brand-rgb` / `--fg-rgb` / `--surface-0|1|2` in `client/src/index.css`
- Tailwind colors: `brand`, `fg`, `surface-0/1/2`. Never write literal white/black hex or `text-white`.
- Two themes: `:root` = dark + yellow · `[data-theme="red"]` = **full light theme** + red accent.
  ⚠️ **`[data-theme="red"]` is LIGHT.** Any new `rgba(0,0,0,.85)` backdrop or `text-black` must be checked in both themes.
- Existing style standards in `CLAUDE.md` still apply (button style, `border-fg/[0.06]` dividers, card grid action row).

### Z-index scale (documented in `index.css`)
```
10    — sidebar rail (StockHome.tsx)
50    — overlays: WorkspaceShell, the 24 dialogs, Radix dropdowns
60    — nested overlays (StockItemsTableSection portal, UnitDetailModal)
70    — AppNavDrawer
9999  — GlobalLoadingBar
```

### The three global utility classes (`index.css`, `@layer components`)

| Class | Purpose |
|---|---|
| `.h-scroll` | The **only** approved way to make something scroll horizontally. Adds `overflow-x:auto` + `overscroll-behavior-x:contain` + a 3px visible scrollbar (the app hides all scrollbars globally, so mobile users otherwise get no affordance). |
| `.tap-target` | Expands the hit area to 44×44 via `::after` under `@media (pointer:coarse)` **without changing a single visible pixel**. Also sets `touch-action:manipulation` (kills the 300ms tap delay). |
| `.safe-b` | `padding-bottom: max(0.75rem, env(safe-area-inset-bottom))` for any bottom-pinned footer. |
| `.scroll-fade-r` | Right-edge gradient marking that an `.h-scroll` strip continues off-screen. Parent must be `relative`. Uses `var(--surface-1)` so it works in both themes. |

⚠️ `.tap-target`'s `::after` can intercept taps meant for a **neighbouring** control when two icons sit <44px apart. For tight clusters (e.g. `ActionIcons`), increase real spacing on mobile instead (gap ≥ 8px).

### Mobile control sizing — "responsive" is not the same as "mobile"

Shrinking a desktop layout until it fits produces something that technically works and
still feels wrong. Real feedback from this project: *"the interface isn't a mobile web
app, it's just scaled down."* Concretely, on mobile:

| Element | Desktop | Mobile minimum |
|---|---|---|
| Tab in a tab bar | `px-3 py-2 text-xs` | `px-3.5 min-h-[48px] text-[13px] font-semibold` |
| Action button | `h-9 rounded-lg` | `h-11 rounded-xl` |
| Text input | `h-9` | `h-11` (plus the global 16px font rule, or iOS zooms on focus) |
| Icon inside a control | `w-3.5 h-3.5` | `w-4 h-4` / `w-[18px]` |

And **a scrolling strip of full-width labelled buttons is not an acceptable mobile action
bar** — it forces a swipe to reach a primary action. Instead: keep 1 primary + 1 filter as
icon-only buttons, let the search field flex, and push secondary actions into a `⋯`
`DropdownMenu`. `StockFilterControlsSection.tsx` is the reference implementation.

---

## 4. THE CONTRACT that makes everything else testable

`client/src/pages/StockHome.tsx` has `overflow-x-hidden` on the page container. **Keep it.**

> **No page-level horizontal scroll, ever. Every wide thing owns its own local `.h-scroll`.**

This means content that doesn't fit is **clipped, silently, with no scrollbar** — the rightmost button in an action bar just vanishes. That is the #1 way this app loses functionality on mobile.

So the fix for "content is cut off" is **always** to add a local `.h-scroll` (or wrap/stack), **never** to relax `overflow-x-hidden`.

Debug helper (already in `index.css`):
```js
document.documentElement.toggleAttribute('data-debug-overflow')  // outlines every element
```

---

## 5. Primitives API

All live in `client/src/components/` unless noted. **Reuse these — do not hand-roll a variant.**

### `useBreakpoint()` — `client/src/hooks/use-breakpoint.ts`
```ts
type Tier = "mobile" | "tablet" | "desktop";
useBreakpoint(): { tier: Tier; isMobile; isTablet; isDesktop; isMobileOrTablet }
```
Uses `useSyncExternalStore` + a synchronous `matchMedia` read, so **the value is correct on the first paint** (no desktop-layout flash). `use-mobile.tsx` now re-exports `useIsMobile = () => useBreakpoint().isMobile` — never reimplement it.

### `<ScrollTabs>` — the fix for every tab bar
```tsx
<ScrollTabs tabs={[{ key, label, Icon?, count?, badge? }]} active={k} onChange={setK}
            variant="underline" | "pill" size="sm" | "md" />
```
`underline` = page tab bars · `pill` = WorkspaceShell header. Auto-scrolls the active tab into view so tab 6 of 6 is never stranded. **Any new tab bar must use this.**

### `<ResponsiveTable>` + `<DataCard>` — the fix for every table
```tsx
<ResponsiveTable breakpoint="md" table={<Table>…</Table>} cards={rows.map(r => <DataCard … />)} />

<DataCard title subtitle? badge? accent? onClick?
          fields={[{ label, value, full? }]}   // 2-col grid; full = span 2
          actions? children? />
```
Renders **one branch only** (JS). Every `<th>` on desktop must have a matching entry in `fields` — that is the "nothing dropped" audit.

### `<MasterDetail>` — list ⇄ detail push/pop
```tsx
<MasterDetail master={…} detail={…} detailOpen={bool} onBack={fn} detailTitle={…}
              masterClassName="w-full md:w-[280px] lg:w-[320px]" />
```
Mobile: renders exactly one side, plus a 44px sticky back bar. Tablet/desktop: the original flex row, both mounted.

### `<CenteredModal>` — the fix for every small dialog
```tsx
<CenteredModal onClose title subtitle? icon? size="md" layer="base"|"nested" footer={…}>
```
Mobile = full-width bottom sheet (`items-end` + `rounded-t-2xl`), desktop = centered card. `layer="nested"` → `z-[60]` for dialogs that open on top of another dialog. Also exports `MODAL_CX = { overlay, card, body, footer }` for the 2–3 files whose internals resist refactoring.

### `<PaneTabs>` + `WorkspaceShell.mobilePanes` — the fix for multi-pane workspaces
```tsx
// inner 2-pane bodies inside WorkspaceShell children:
<PaneTabs panes={[{ key, label, node, keepMounted? }]} active={k} onChange={setK} />

// panes owned by the shell itself:
<WorkspaceShell … mobilePanes={[{ key, label, badge?, content, keepMounted? }]} />
```
Desktop: renders every pane in a flex row with its original widths → **byte-identical to today**. Mobile: one `ScrollTabs` strip + the active pane only.

> **`keepMounted` is a correctness requirement, not an optimization.** Panes holding uncommitted local state must be hidden with `hidden`, never unmounted. `EquipmentPicker` and `ManageJobStockCatalogPane` hold a local `search` string — unmounting on tab switch silently clears what the user typed.

> ⚠️ **`WorkspaceShell.sidebar` + no `tabs` = `children` permanently hidden on mobile.** This bit
> Phase 4a: `WorkspaceShell`'s mobile strip shows `sidebar` first, and `children` only becomes
> visible if it matches a `tabs` entry (or there's no `sidebar`/`mobilePanes` at all — see the
> component's own visibility condition). A modal that passes `sidebar` but no `tabs` (e.g. a
> "defaults panel + one form", no mode-switching) has `children` stuck behind the sidebar pill
> forever, on every device — this shipped and passed `npm run check` because it's a *visibility*
> bug, not a type error; it only showed up in real screenshots. **Whenever you pass `sidebar`,
> either also pass a real `tabs` set the main content can be reached through, or wrap `children`
> in a `mobilePanes` entry** (build it once as a variable, e.g. `mainContent`, then
> `{!isMobile && mainContent}` for desktop's `children` slot and `content: mainContent` in
> `mobilePanes` — never both at once, see `ManageJobStockModal`'s `cartPaneNode` pattern in the
> table above). `AddJobsModal`, `QuickAddItemsModal`, and `ManageContainerUnitsModal` all needed
> this retrofit 2026-08-03.
>
> Related: the sidebar's own mobile strip tab used to be a **permanent no-op once you tapped away
> from it** — `WorkspaceShell`'s `handleMobileTabChange` intentionally doesn't forward the
> synthetic `__sidebar` key to the parent's `onTabChange` (it has no domain meaning there), but
> the component also had no *other* way to remember "user tapped back to sidebar." Fixed
> 2026-08-03 with a local `manualMobileKey` override inside `WorkspaceShell` itself — already
> fixed for every consumer, no per-modal action needed, just don't reintroduce a `mobileActive`
> computation that ignores manual taps if you ever touch this file.

### `<AppNavDrawer>` + `lib/navItems.ts`
Hamburger drawer, mobile only. Built on the already-installed shadcn `ui/sheet.tsx` (Radix Dialog — no new dependency). `NAV_ITEMS` / `navItemsForRole(role)` is the **single source** for nav items; the rail and the drawer both read it.

---

## 6. Recipes

### Tab bar
```tsx
// ❌ before
<div className="flex items-center gap-1 border-b border-fg/[0.06]">{tabs.map(...)}</div>
// ✅ after
<ScrollTabs tabs={TABS} active={activeTab} onChange={setActiveTab} variant="underline" />
```

### Table
```tsx
<ResponsiveTable
  table={<table className="w-full text-sm">…unchanged…</table>}
  cards={rows.map(r => (
    <DataCard key={r.id} title={r.name} badge={<StatusPill s={r.status} />}
      fields={[{ label: "ลูกค้า", value: r.client }, { label: "มูลค่า", value: fmt(r.amount) }]}
      actions={<><IconBtn className="tap-target" …/></>} />
  ))} />
```

### Fixed side pane
```tsx
// ❌ w-[280px] flex-shrink-0        ✅ w-full md:w-[280px] lg:w-[320px] md:flex-shrink-0
```

### Grid
```tsx
// ❌ grid grid-cols-4               ✅ grid grid-cols-2 lg:grid-cols-4
// ❌ grid grid-cols-12 + col-span-7 ✅ grid grid-cols-1 lg:grid-cols-12 + lg:col-span-7
```

### Padding
```tsx
// ❌ p-6                            ✅ p-3 md:p-6
```

### Action bar
```tsx
// ❌ five labelled buttons in a .h-scroll strip  (swipe required to reach the primary action)
// ✅ one row: [filter icon] [search flex-1] [primary + icon] [⋯ DropdownMenu]
//    Labels stay visible on desktop via `hidden md:inline`; the ⋯ menu is `md:hidden`
//    and holds the SAME handlers, so nothing becomes unreachable.
```
See `StockFilterControlsSection.tsx`. For simple bars with ≤2 buttons,
`flex flex-wrap items-center gap-2 md:gap-3` + `h-11 md:h-9` is enough.

### Full-height container
```tsx
// ❌ h-screen / max-h-[90vh]        ✅ h-[100dvh] / max-h-[90dvh]
```
The iOS URL bar makes `100vh` taller than the visible viewport — a footer's primary Save button ends up **under** it and is unreachable, while looking perfect in DevTools.

### Gantt timelines
All three already have `.h-scroll` + `useResponsiveDayCount(ref, dayW, labelW, minDays, fallback)`. To adapt: pass a smaller `labelWidth` on mobile (one-line change). Keep `sticky left-0` on the label column.

---

## 7. Accessibility (do it while you're in the file — it's free)

- Icon-only buttons **must** have `aria-label`
- Decorative icons get `aria-hidden="true"`
- Never `focus:outline-none` alone — always pair with `focus-visible:ring-2 focus-visible:ring-brand/50`
- Mobile inputs are forced to `font-size: 16px` below 768px. This is **required**: the viewport meta no longer sets `maximum-scale=1` (WCAG 1.4.4), which re-enables iOS Safari's zoom-on-focus for any input under 16px. Do not "fix" this by shrinking inputs again.

---

## 8. Risk register — the ones that fail silently

| # | Risk | Check |
|---|---|---|
| R1 | `overflow-x-hidden` **clips** instead of scrolling → buttons vanish | overflow detector (§9) on every page |
| R2 | `100vh` under the iOS URL bar hides the primary Save button | real iOS Safari, not DevTools |
| R3 | Unmounting a pane loses uncommitted input | type in search → switch tab → back → text must survive |
| R5 | An `overflow-x-auto` strip traps vertical scroll on iOS | `.h-scroll` includes `overscroll-behavior-x: contain` |
| R6 | Radix scroll-lock orphaned if an open Sheet unmounts → whole app unscrollable | always close the drawer before it unmounts (`useEffect` on `!isMobile`) |
| R8 | Thai strings are longer than English — a header that fits in EN overflows in TH | test both languages |
| R9 | `[data-theme="red"]` is a **light** theme | toggle theme on every page |
| R10 | `table-fixed` + percentage `<colgroup>` means the table can never overflow, so `overflow-x-auto` never activates. Adding `min-w-[900px]` alone **changes nothing** | must remove `table-fixed` AND the colgroup together |
| R11 | `pl-16` indents = 18% of a 360px screen | indent nested cards with a border, not padding |
| R12 | Nested overlays need `z-[60]` | `layer="nested"` |
| R13 | `WorkspaceShell.sidebar` with no `tabs` prop → `children` permanently `hidden` on mobile (no strip entry it can ever match). `tsc` is silent; this is a visibility bug, not a type error | on mobile, actually tap through: does the modal's main content ever appear, or only the sidebar/defaults pane? See §5's `WorkspaceShell.sidebar` warning |

---

## 9. Verification (no headless browser on this machine)

```bash
npm run check     # tsc — catches prop/import errors only. Necessary, not sufficient.
```

**Overflow detector** — paste in the console on every page at 360px. This is the check that finds dropped functionality:
```js
document.documentElement.scrollWidth > window.innerWidth   // must be false

[...document.querySelectorAll('*')]
  .filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'hidden')
  .map(e => [e.tagName, e.className, e.scrollWidth, e.clientWidth])   // must be []
```

**Touch-target audit:**
```js
[...document.querySelectorAll('button,a,select,input,[role="button"]')]
  .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 44 || r.height < 44) })
  .map(e => [e.className, e.getBoundingClientRect().width|0, e.getBoundingClientRect().height|0])
```

**"Nothing dropped" audit:** before editing a file record `grep -c "onClick" <file>`; after editing the count must be **equal or greater**. For tables, additionally walk the `<th>` list against the `DataCard` `fields` array.

**Viewports:** 360×640, 390×844, 768×1024, 1024×768 — **and test at the exact boundaries 767/768 and 1023/1024**, where off-by-one breakpoint bugs live. Real device pass (one iOS, one Android) after phases 1, 4, 5.

---

## 10. Known pre-existing issues (NOT caused by mobile work)

- **JobsPage dead code:** `setActiveTab` is never called and `jobTabs` is never rendered, so the **ใบเบิก** and **เหตุการณ์** tabs are unreachable; `CreatePullSheetModal`, `handleExportPdf`, and `AddIncidentModal` are all unreachable too. Being restored in Phase 2.
- **`WorkspaceShell.rightPanel` / `rightPanelTitle`** — no consumer ever passed them. Deleted in Phase 4a.
- **`ResourceScheduleView` status colors** are hard-coded inline `rgba()` → wrong in the light theme. Fixed in Phase 5.
- **Duplicate `@tailwind` directives** in `index.css` (L1-2 and L208-210). Low impact, **deliberately not fixed** — high blast radius, zero mobile benefit.
- **`UnitScheduleGantt`'s `top-[22px]`** is hard-coupled to the month-row height. Changing any Gantt row height breaks the sticky header by a few px, silently.
