import React, { useMemo, useState } from "react";
import { Search, Loader2, Check, ChevronDown, ChevronRight, Layers, Minus, Plus, Package, X as XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { StockItemWithUnits } from "@/api";
import type { StockUnit, Position } from "@shared/schema";
import type { CartUnitLine, CartBulkLine } from "./ManageJobStockModal";

const statusDot: Record<string, string> = {
  available:   "bg-emerald-400",
  out:         "bg-blue-400",
  maintenance: "bg-amber-400",
  retired:     "bg-white/20",
};

interface Props {
  stockGroups:     StockItemWithUnits[];
  isLoading:       boolean;
  search:          string;
  onSearchChange:  (v: string) => void;
  categoryFilter:  string | null;
  onCategoryFilterChange: (v: string | null) => void;
  expanded:        Set<string>;
  onToggleGroupExpand: (groupId: string) => void;
  cartUnits:       Map<string, CartUnitLine>;
  cartBulkLines:   Map<string, CartBulkLine>;
  onToggleUnit:       (unitId: string) => void;
  onToggleSelectAll:  (units: StockUnit[], stockItemId: string) => void;
  onAdjustBulkQty:    (stockItemId: string, delta: number) => void;
  zones:           Position[];
  activeZone:      string | null;
  onActiveZoneChange: (v: string | null) => void;
  onCreateZone:       (name: string) => void;
  creatingZone:       boolean;
}

export const ManageJobStockCatalogPane = ({
  stockGroups, isLoading, search, onSearchChange, categoryFilter, onCategoryFilterChange,
  expanded, onToggleGroupExpand, cartUnits, cartBulkLines, onToggleUnit, onToggleSelectAll, onAdjustBulkQty,
  zones, activeZone, onActiveZoneChange, onCreateZone, creatingZone,
}: Props): JSX.Element => {
  const { t }  = useTranslation("modals");
  const { t: tc } = useTranslation("common");

  const [brandFilter,       setBrandFilter]       = useState<string | null>(null);
  const [subCategoryFilter, setSubCategoryFilter] = useState<string | null>(null);
  const [addingZone,        setAddingZone]        = useState(false);
  const [newZoneName,       setNewZoneName]       = useState("");

  const isFiltering = !!search;

  const handleCategoryClick = (cat: string | null) => {
    setBrandFilter(null);
    setSubCategoryFilter(null);
    onCategoryFilterChange(categoryFilter === cat ? null : cat);
  };

  // chip bar — always reflects the full catalog, unaffected by the search text
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of stockGroups) {
      const cat = g.category || "Uncategorized";
      map.set(cat, (map.get(cat) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [stockGroups]);

  // brand / sub-category chips — scoped to the selected category so the list stays short
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
    if (categoryFilter) {
      groups = groups.filter((g) => (g.category || "Uncategorized") === categoryFilter);
    }
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
      .filter((g) => g.units.length > 0 || g.name.toLowerCase().includes(q));
  }, [stockGroups, categoryFilter, brandFilter, subCategoryFilter, search]);

  const groupedByCategory = useMemo(() => {
    const map = new Map<string, StockItemWithUnits[]>();
    for (const g of filteredGroups) {
      const cat = g.category || "Uncategorized";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(g);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredGroups]);

  const bulkTotalQty = (stockItemId: string) => {
    let total = 0;
    for (const l of Array.from(cartBulkLines.values())) if (l.stockItemId === stockItemId) total += l.quantity;
    return total;
  };
  const bulkLineCount = (stockItemId: string) => {
    let n = 0;
    for (const l of Array.from(cartBulkLines.values())) if (l.stockItemId === stockItemId) n++;
    return n;
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col border-r border-white/[0.06]">
      {/* Search + category chips */}
      <div className="px-4 pt-4 pb-2 flex-shrink-0 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/60" />
          <input
            autoFocus
            placeholder={t("manageContainerUnits.searchPlaceholder")}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
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
            {t("manageJobStock.allCategories")}
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

        {/* Brand / Sub-Category — scoped to the selected category */}
        {categoryFilter && brandsInCategory.length > 1 && (
          <div className="flex flex-wrap gap-1 items-center">
            <span className="text-[9px] uppercase tracking-wider text-white/30 mr-0.5">{t("manageJobStock.brandLabel")}</span>
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
            <span className="text-[9px] uppercase tracking-wider text-white/30 mr-0.5">{t("manageJobStock.subCategoryLabel")}</span>
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

        {/* Active zone — โซนที่ของชิ้นใหม่จะถูกเพิ่มเข้าไปตอนติ๊กเลือก */}
        <div className="flex flex-wrap gap-1.5 items-center pt-1 border-t border-white/[0.04]">
          <span className="text-[9px] uppercase tracking-wider text-white/30 mr-0.5">{t("manageJobStock.addingToZone")}</span>
          <button
            onClick={() => onActiveZoneChange("auto")}
            className={`h-6 px-2 rounded-full text-[10px] font-semibold transition-colors border
              ${activeZone === "auto" ? "bg-[#FFFF00] text-black border-[#FFFF00]" : "text-white/50 border-white/10 hover:border-white/30"}`}
          >
            {t("manageJobStock.zoneAuto")}
          </button>
          {zones.map((z) => (
            <button
              key={z.id}
              onClick={() => onActiveZoneChange(z.name)}
              className={`h-6 px-2 rounded-full text-[10px] font-semibold transition-colors border
                ${activeZone === z.name ? "bg-[#FFFF00] text-black border-[#FFFF00]" : "text-white/50 border-white/10 hover:border-white/30"}`}
            >
              {z.name}
            </button>
          ))}
          <button
            onClick={() => onActiveZoneChange(null)}
            className={`h-6 px-2 rounded-full text-[10px] font-semibold transition-colors border
              ${activeZone === null ? "bg-[#FFFF00] text-black border-[#FFFF00]" : "text-white/50 border-white/10 hover:border-white/30"}`}
          >
            {t("manageJobStock.zoneNone")}
          </button>

          {!addingZone ? (
            <button
              onClick={() => setAddingZone(true)}
              className="h-6 w-6 rounded-full border border-white/10 text-white/40 hover:text-[#FFFF00] hover:border-[#FFFF00]/40 flex items-center justify-center transition-colors"
              title={t("manageJobStock.addZone")}
            >
              <Plus className="w-3 h-3" />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { onCreateZone(newZoneName); setNewZoneName(""); setAddingZone(false); }
                  if (e.key === "Escape") { setNewZoneName(""); setAddingZone(false); }
                }}
                placeholder={t("manageJobStock.newZonePlaceholder")}
                disabled={creatingZone}
                className="h-6 w-24 px-2 rounded-full bg-white/[0.06] border border-white/10 text-[10px] text-white outline-none focus:border-[#FFFF00]/40"
              />
              <button
                onClick={() => { setNewZoneName(""); setAddingZone(false); }}
                className="text-white/40 hover:text-white transition-colors"
              >
                <XIcon className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-12 text-white/60">
            <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">{tc("loading")}</span>
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
                const groupUnits = group.units;
                const selectedInGroup = groupUnits.filter((u) => cartUnits.has(u.id)).length;
                const allSelected = !isBulk && groupUnits.length > 0 && groupUnits.every((u) => cartUnits.has(u.id));

                if (isBulk) {
                  const qty       = bulkTotalQty(group.id);
                  const lineCount = bulkLineCount(group.id);
                  const isSplit   = lineCount > 1;
                  return (
                    <div key={group.id} className="rounded-xl border border-white/[0.06] overflow-hidden bg-white/[0.02]">
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <Layers className="w-4 h-4 text-amber-400/70 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white/80 truncate">{group.name}</p>
                          <p className="text-[10px] text-white/60">
                            {t("manageJobStock.bulkAvailable", { available: group.availableCount ?? group.quantity ?? 0, total: group.quantity ?? 0 })}
                          </p>
                        </div>
                        {isSplit ? (
                          <span className="text-[10px] text-white/40 italic max-w-[120px] text-right">
                            {t("manageJobStock.splitNotice")}
                          </span>
                        ) : (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => onAdjustBulkQty(group.id, -1)}
                              className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-white/30 transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className={`w-8 text-center text-sm font-bold ${qty > 0 ? "text-[#FFFF00]" : "text-white/60"}`}>
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => onAdjustBulkQty(group.id, 1)}
                              className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-white/30 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={group.id} className="rounded-xl border border-white/[0.06] overflow-hidden">
                    <div
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors
                        ${isExpanded ? "bg-white/[0.04]" : "bg-white/[0.02] hover:bg-white/[0.04]"}`}
                      onClick={() => onToggleGroupExpand(group.id)}
                    >
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all
                          ${allSelected ? "border-[#FFFF00] bg-[#FFFF00]" :
                            selectedInGroup > 0 ? "border-[#FFFF00]/60 bg-[#FFFF00]/20" :
                            "border-white/20"}`}
                        onClick={(e) => { e.stopPropagation(); if (groupUnits.length) onToggleSelectAll(groupUnits, group.id); }}
                      >
                        {allSelected && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
                        {!allSelected && selectedInGroup > 0 && (
                          <div className="w-2 h-0.5 bg-[#FFFF00] rounded-full" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white/80 truncate">{group.name}</p>
                        <p className="text-[10px] text-white/60">{t("manageContainerUnits.unitsCount", { count: groupUnits.length })}</p>
                      </div>

                      {selectedInGroup > 0 && (
                        <span className="text-[10px] font-bold text-[#FFFF00]/60 px-1.5 py-0.5 rounded bg-[#FFFF00]/10">
                          {selectedInGroup}/{groupUnits.length}
                        </span>
                      )}

                      {isExpanded
                        ? <ChevronDown className="w-3.5 h-3.5 text-white/60 flex-shrink-0" />
                        : <ChevronRight className="w-3.5 h-3.5 text-white/60 flex-shrink-0" />
                      }
                    </div>

                    {isExpanded && groupUnits.length === 0 && (
                      <div className="px-10 py-3 text-xs text-white/60 italic border-t border-white/[0.04]">
                        {t("manageContainerUnits.noUnitsHint")}
                      </div>
                    )}

                    {isExpanded && groupUnits.map((unit) => {
                      const isSelected = cartUnits.has(unit.id);
                      return (
                        <div
                          key={unit.id}
                          onClick={() => onToggleUnit(unit.id)}
                          className={`flex items-center gap-3 pl-10 pr-3 py-1.5 cursor-pointer border-t border-white/[0.04] transition-colors
                            ${isSelected ? "bg-[#FFFF00]/[0.04]" : "hover:bg-white/[0.02]"}`}
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
                            ${isSelected ? "border-[#FFFF00] bg-[#FFFF00]" : "border-white/20"}`}>
                            {isSelected && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className={`text-xs truncate ${isSelected ? "text-white/90" : "text-white/50"}`}>
                              {unit.name}
                            </p>
                            <p className="text-[10px] text-white/60 font-mono">
                              {unit.serialNumber ? `SN: ${unit.serialNumber}` : ""}
                              {unit.serialNumber && unit.barcode ? "  ·  " : ""}
                              {unit.barcode ? `BC: ${unit.barcode}` : ""}
                              {!unit.serialNumber && !unit.barcode ? t("manageContainerUnits.noSerialBarcode") : ""}
                            </p>
                          </div>

                          <span className="flex items-center gap-1.5 text-[10px] text-white/60 flex-shrink-0">
                            <span className={`w-1.5 h-1.5 rounded-full ${statusDot[unit.status] ?? "bg-white/20"}`} />
                            {tc(`statusEnum.${unit.status}`, { defaultValue: unit.status })}
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
            <p className="text-xs text-white/60">{t("manageContainerUnits.noItemsFound")}</p>
          </div>
        )}
      </div>
    </div>
  );
};
