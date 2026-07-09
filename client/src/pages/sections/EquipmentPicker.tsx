import React, { useMemo, useState } from "react";
import { Search, Loader2, ChevronDown, ChevronRight, Layers, Minus, Plus, Package, Pin, X, Boxes } from "lucide-react";
import type { StockItemWithUnits } from "@/api";

// ─────────────────────────────────────────────────────────────
// Reusable two-pane equipment picker — โมเดล "จำนวนต่อรุ่น (auto-pick) + ปักหมุด unit เฉพาะ"
// ใช้ร่วมกันได้ทุกฟีเจอร์ที่ต้อง "เลือกของ" (ชุดอุปกรณ์ / เทมเพลต / ฟีเจอร์อนาคต)
//   autoQty : Map<stockItemId, number>  — เลือกจำนวน (ระบบ auto-pick unit ว่างภายหลัง / bulk = จำนวน)
//   pinned  : Map<unitId, stockItemId>  — ปักหมุด unit เฉพาะ (serial ตายตัว)
// ─────────────────────────────────────────────────────────────

export type PickerAutoMap = Map<string, number>;
export type PickerPinMap  = Map<string, string>;

const statusDot: Record<string, string> = {
  available:   "bg-emerald-400",
  out:         "bg-blue-400",
  maintenance: "bg-amber-400",
  retired:     "bg-white/20",
};

export const maxAvailFor = (item: StockItemWithUnits): number =>
  item.trackingMode === "bulk"
    ? (item.availableCount ?? item.quantity ?? 0)
    : item.units.filter((u) => u.status === "available").length;

interface CatalogProps {
  stockGroups: StockItemWithUnits[];
  isLoading:   boolean;
  autoQty:     PickerAutoMap;
  pinned:      PickerPinMap;
  onAdjustAuto: (stockItemId: string, delta: number, max: number) => void;
  onTogglePin:  (unitId: string, stockItemId: string) => void;
}

// ── ซ้าย: แคตตาล็อก + ค้นหา + filter หมวดหมู่/แบรนด์/หมวดย่อย ──────────
export const EquipmentCatalogPane = ({
  stockGroups, isLoading, autoQty, pinned, onAdjustAuto, onTogglePin,
}: CatalogProps): JSX.Element => {
  const [search, setSearch]                     = useState("");
  const [categoryFilter, setCategoryFilter]     = useState<string | null>(null);
  const [brandFilter, setBrandFilter]           = useState<string | null>(null);
  const [subCategoryFilter, setSubCategoryFilter] = useState<string | null>(null);
  const [expanded, setExpanded]                 = useState<Set<string>>(new Set());

  const isFiltering = !!search;

  const handleCategoryClick = (cat: string | null) => {
    setBrandFilter(null);
    setSubCategoryFilter(null);
    setCategoryFilter((cur) => (cur === cat ? null : cat));
  };

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of stockGroups) {
      const cat = g.category || "Uncategorized";
      map.set(cat, (map.get(cat) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [stockGroups]);

  const itemsInCategory = useMemo(() => {
    if (!categoryFilter) return [];
    return stockGroups.filter((g) => (g.category || "Uncategorized") === categoryFilter);
  }, [stockGroups, categoryFilter]);

  const brandsInCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of itemsInCategory) map.set(g.brand, (map.get(g.brand) ?? 0) + 1);
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [itemsInCategory]);

  const subCategoriesInCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of itemsInCategory) map.set(g.subCategory, (map.get(g.subCategory) ?? 0) + 1);
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [itemsInCategory]);

  const filteredGroups = useMemo(() => {
    const q = search.toLowerCase();
    let groups = stockGroups;
    if (categoryFilter)    groups = groups.filter((g) => (g.category || "Uncategorized") === categoryFilter);
    if (brandFilter)       groups = groups.filter((g) => g.brand === brandFilter);
    if (subCategoryFilter) groups = groups.filter((g) => g.subCategory === subCategoryFilter);
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        units: g.units.filter(
          (u) => u.name.toLowerCase().includes(q) ||
                 (u.serialNumber ?? "").toLowerCase().includes(q) ||
                 (u.barcode ?? "").toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.units.length > 0 || g.name.toLowerCase().includes(q) || g.brand.toLowerCase().includes(q));
  }, [stockGroups, categoryFilter, brandFilter, subCategoryFilter, search]);

  const groupedByCategory = useMemo(() => {
    const map = new Map<string, StockItemWithUnits[]>();
    for (const g of filteredGroups) {
      const cat = g.category || "Uncategorized";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(g);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cat, items]) => [cat, items.sort((a, b) => a.name.localeCompare(b.name))] as const);
  }, [filteredGroups]);

  const toggleModel = (id: string) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const pinnedForItem = (itemId: string) =>
    Array.from(pinned.values()).filter((sid) => sid === itemId).length;

  return (
    <div className="flex-1 min-w-0 flex flex-col border-r border-white/[0.06]">
      {/* Search + filter chips */}
      <div className="px-4 pt-4 pb-2 flex-shrink-0 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/60" />
          <input
            autoFocus
            placeholder="ค้นหารุ่น / serial / บาร์โค้ด…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white
              placeholder-white/20 focus:outline-none focus:border-[#FFFF00]/40 transition-all"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => handleCategoryClick(null)}
            className={`h-7 px-2.5 rounded-full text-[11px] font-semibold transition-colors border
              ${!categoryFilter ? "bg-[#FFFF00] text-black border-[#FFFF00]" : "text-white/60 border-white/10 hover:border-white/30"}`}
          >
            ทั้งหมด
          </button>
          {categories.map(([cat, count]) => (
            <button
              key={cat}
              onClick={() => handleCategoryClick(cat)}
              className={`h-7 px-2.5 rounded-full text-[11px] font-semibold transition-colors border
                ${categoryFilter === cat ? "bg-[#FFFF00] text-black border-[#FFFF00]" : "text-white/60 border-white/10 hover:border-white/30"}`}
            >
              {cat} <span className="opacity-60">{count}</span>
            </button>
          ))}
        </div>

        {categoryFilter && brandsInCategory.length > 1 && (
          <div className="flex flex-wrap gap-1 items-center">
            <span className="text-[9px] uppercase tracking-wider text-white/30 mr-0.5">แบรนด์</span>
            {brandsInCategory.map(([brand, count]) => (
              <button
                key={brand}
                onClick={() => setBrandFilter(brandFilter === brand ? null : brand)}
                className={`h-6 px-2 rounded-full text-[10px] font-medium transition-colors border
                  ${brandFilter === brand ? "bg-white text-black border-white" : "text-white/50 border-white/10 hover:border-white/30"}`}
              >
                {brand} <span className="opacity-60">{count}</span>
              </button>
            ))}
          </div>
        )}
        {categoryFilter && subCategoriesInCategory.length > 1 && (
          <div className="flex flex-wrap gap-1 items-center">
            <span className="text-[9px] uppercase tracking-wider text-white/30 mr-0.5">หมวดย่อย</span>
            {subCategoriesInCategory.map(([sub, count]) => (
              <button
                key={sub}
                onClick={() => setSubCategoryFilter(subCategoryFilter === sub ? null : sub)}
                className={`h-6 px-2 rounded-full text-[10px] font-medium transition-colors border
                  ${subCategoryFilter === sub ? "bg-white text-black border-white" : "text-white/50 border-white/10 hover:border-white/30"}`}
              >
                {sub} <span className="opacity-60">{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-12 text-white/60">
            <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">กำลังโหลด…</span>
          </div>
        )}

        {!isLoading && groupedByCategory.map(([category, groups]) => (
          <div key={category}>
            <div className="px-1 py-1.5 sticky top-0 bg-[#0f0f0f]/95 backdrop-blur-sm z-10">
              <span className="text-xs font-bold text-[#FFFF00] uppercase tracking-wider">{category}</span>
            </div>

            <div className="space-y-2">
              {groups.map((group) => {
                const isBulk     = group.trackingMode === "bulk";
                const isExpanded = !isBulk && (isFiltering || expanded.has(group.id));
                const maxAvail   = maxAvailFor(group);
                const qty        = autoQty.get(group.id) ?? 0;
                const pinnedN    = pinnedForItem(group.id);
                const selected   = qty + pinnedN;

                return (
                  <div key={group.id} className={`rounded-xl border overflow-hidden ${selected > 0 ? "border-[#FFFF00]/25 bg-[#FFFF00]/[0.03]" : "border-white/[0.06] bg-white/[0.02]"}`}>
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      {/* expand units (unit-tracked เท่านั้น) */}
                      {!isBulk ? (
                        <button onClick={() => toggleModel(group.id)} className="p-0.5 -ml-1 text-white/50 hover:text-white">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      ) : <Layers className="w-4 h-4 text-amber-400/70 flex-shrink-0" />}

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white/80 truncate">{group.name}</p>
                        <p className="text-[10px] text-white/60">
                          {group.brand} · ว่าง {maxAvail}{isBulk ? " (นับจำนวน)" : ""}
                        </p>
                      </div>

                      {selected > 0 && (
                        <span className="text-[10px] font-bold text-[#FFFF00] bg-[#FFFF00]/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                          เลือก {selected}
                        </span>
                      )}

                      {/* stepper auto-qty */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => onAdjustAuto(group.id, -1, maxAvail)}
                          disabled={qty === 0}
                          className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-white/30 transition-colors disabled:opacity-30"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className={`w-6 text-center text-sm font-bold tabular-nums ${qty > 0 ? "text-[#FFFF00]" : "text-white/60"}`}>{qty}</span>
                        <button
                          type="button"
                          onClick={() => onAdjustAuto(group.id, 1, maxAvail)}
                          disabled={qty + pinnedN >= maxAvail}
                          className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-white/30 transition-colors disabled:opacity-30"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* unit rows — ปักหมุด serial เฉพาะ */}
                    {isExpanded && group.units.length === 0 && (
                      <div className="px-10 py-3 text-xs text-white/60 italic border-t border-white/[0.04]">ยังไม่มี unit</div>
                    )}
                    {isExpanded && group.units.map((unit) => {
                      const isPinned = pinned.has(unit.id);
                      const avail = unit.status === "available";
                      return (
                        <div
                          key={unit.id}
                          onClick={() => avail && onTogglePin(unit.id, group.id)}
                          className={`flex items-center gap-3 pl-10 pr-3 py-1.5 border-t border-white/[0.04] transition-colors
                            ${isPinned ? "bg-[#FFFF00]/[0.06]" : "hover:bg-white/[0.02]"} ${avail ? "cursor-pointer" : "opacity-40 cursor-not-allowed"}`}
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
                            ${isPinned ? "border-[#FFFF00] bg-[#FFFF00]" : "border-white/20"}`}>
                            {isPinned && <Pin className="w-2.5 h-2.5 text-black" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs truncate ${isPinned ? "text-white/90" : "text-white/50"}`}>{unit.name}</p>
                            <p className="text-[10px] text-white/60 font-mono">{unit.serialNumber ? `SN: ${unit.serialNumber}` : "—"}</p>
                          </div>
                          <span className="flex items-center gap-1.5 text-[10px] text-white/60 flex-shrink-0">
                            <span className={`w-1.5 h-1.5 rounded-full ${statusDot[unit.status] ?? "bg-white/20"}`} />
                            {unit.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {!isLoading && filteredGroups.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Package className="w-8 h-8 text-white/40" />
            <p className="text-xs text-white/60">ไม่พบอุปกรณ์</p>
          </div>
        )}
      </div>
    </div>
  );
};

interface CartProps {
  stockGroups: StockItemWithUnits[];
  autoQty:     PickerAutoMap;
  pinned:      PickerPinMap;
  onAdjustAuto: (stockItemId: string, delta: number, max: number) => void;
  onTogglePin:  (unitId: string, stockItemId: string) => void;
  onClearItem:  (stockItemId: string) => void;
}

// ── ขวา: ตะกร้าของที่เลือก (แก้จำนวน/ถอดออกได้) ──────────────────────
export const EquipmentCartPane = ({
  stockGroups, autoQty, pinned, onAdjustAuto, onTogglePin, onClearItem,
}: CartProps): JSX.Element => {
  const itemById = useMemo(() => Object.fromEntries(stockGroups.map((g) => [g.id, g])), [stockGroups]);

  // รวมรายการที่เลือก (auto หรือ pinned) ต่อ stockItem
  const lines = useMemo(() => {
    const ids = new Set<string>();
    for (const id of Array.from(autoQty.keys())) ids.add(id);
    for (const sid of Array.from(pinned.values())) ids.add(sid);
    return Array.from(ids)
      .map((id) => ({
        item: itemById[id] as StockItemWithUnits | undefined,
        qty: autoQty.get(id) ?? 0,
        pinnedUnits: Array.from(pinned.entries()).filter(([, sid]) => sid === id).map(([uid]) => uid),
      }))
      .filter((l) => l.item)
      .sort((a, b) => a.item!.name.localeCompare(b.item!.name));
  }, [autoQty, pinned, itemById]);

  const totalPieces = Array.from(autoQty.values()).reduce((s, q) => s + q, 0) + pinned.size;

  return (
    <div className="w-72 lg:w-80 flex-shrink-0 flex flex-col bg-[#0c0c0c]">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2 flex-shrink-0">
        <Boxes className="w-4 h-4 text-[#FFFF00]/70" />
        <span className="text-sm font-bold text-white">ของในชุด</span>
        {totalPieces > 0 && <span className="ml-auto text-[11px] font-bold text-[#FFFF00] bg-[#FFFF00]/10 px-2 py-0.5 rounded-full">{totalPieces} ชิ้น</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {lines.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-white/30">
            <Boxes className="w-8 h-8" />
            <p className="text-xs">เลือกของจากด้านซ้าย<br />เพื่อเพิ่มเข้าชุด</p>
          </div>
        ) : lines.map(({ item, qty, pinnedUnits }) => {
          const max = maxAvailFor(item!);
          const units = item!.units;
          return (
            <div key={item!.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white/90 truncate">{item!.name}</p>
                  <p className="text-[10px] text-white/40">{item!.brand}</p>
                </div>
                <button onClick={() => onClearItem(item!.id)} className="p-0.5 text-white/30 hover:text-red-400 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* auto qty line */}
              {qty > 0 && (
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-white/50 flex-1">จำนวน (auto-pick)</span>
                  <button onClick={() => onAdjustAuto(item!.id, -1, max)}
                    className="w-6 h-6 rounded-md border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-white/30">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center text-sm font-bold text-[#FFFF00] tabular-nums">{qty}</span>
                  <button onClick={() => onAdjustAuto(item!.id, 1, max)} disabled={qty + pinnedUnits.length >= max}
                    className="w-6 h-6 rounded-md border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-white/30 disabled:opacity-30">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* pinned unit chips */}
              {pinnedUnits.length > 0 && (
                <div className="mt-2 space-y-1">
                  {pinnedUnits.map((uid) => {
                    const u = units.find((x) => x.id === uid);
                    return (
                      <div key={uid} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#FFFF00]/[0.06] border border-[#FFFF00]/20">
                        <Pin className="w-2.5 h-2.5 text-[#FFFF00]/70 flex-shrink-0" />
                        <span className="text-[10px] text-white/70 truncate flex-1">{u?.serialNumber || u?.name || uid}</span>
                        <button onClick={() => onTogglePin(uid, item!.id)} className="text-white/30 hover:text-red-400">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
