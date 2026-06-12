import React, { useState, useMemo, useEffect } from "react";
import { X, Layers, Search, Loader2, Check, Save, ChevronDown, ChevronRight, Boxes, Package } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { stockApi, containersApi } from "@/api";
import type { StockItemWithUnits, ContainerWithItems } from "@/api";
import type { StockUnit } from "@shared/schema";

interface Props {
  container: ContainerWithItems;
  onClose:   () => void;
}

const statusDot: Record<string, string> = {
  available:   "bg-emerald-400",
  out:         "bg-blue-400",
  maintenance: "bg-amber-400",
  retired:     "bg-white/20",
};

export const ManageContainerUnitsModal = ({ container, onClose }: Props): JSX.Element => {
  const { token } = useAppStore();
  const qc = useQueryClient();

  const [search,             setSearch]             = useState("");
  const [selectedIds,        setSelectedIds]        = useState<Set<string>>(new Set(container.items.map((u) => u.id)));
  const [expanded,           setExpanded]           = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [saving,             setSaving]             = useState(false);
  const [error,              setError]              = useState<string | null>(null);

  // โหลด stock items พร้อม units
  const { data: stockGroups = [], isLoading: stockLoading } = useQuery<StockItemWithUnits[]>({
    queryKey: ["stock-with-units"],
    queryFn: stockApi.getAllWithUnits,
    enabled: !!token,
  });

  // expand stock items + categories ที่มี unit ถูก select อยู่ (ของที่อยู่ใน container นี้แล้ว)
  useEffect(() => {
    if (stockLoading) return;
    const ids = new Set(container.items.map((u) => u.id));
    if (ids.size > 0) {
      const toExpand = new Set<string>();
      const toExpandCat = new Set<string>();
      for (const g of stockGroups) {
        if (g.units.some((u) => ids.has(u.id))) {
          toExpand.add(g.id);
          toExpandCat.add(g.category || "Uncategorized");
        }
      }
      setExpanded(toExpand);
      setExpandedCategories(toExpandCat);
    }
  }, [stockGroups, stockLoading, container.items]);

  const toggleUnit = (unitId: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(unitId) ? next.delete(unitId) : next.add(unitId);
      return next;
    });

  const toggleGroup = (groupId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });

  const toggleCategory = (category: string) =>
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(category) ? next.delete(category) : next.add(category);
      return next;
    });

  const toggleSelectAll = (units: StockUnit[]) => {
    const allSelected = units.every((u) => selectedIds.has(u.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) units.forEach((u) => next.delete(u.id));
      else             units.forEach((u) => next.add(u.id));
      return next;
    });
  };

  const filteredGroups = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return stockGroups;
    return stockGroups
      .map((g) => ({
        ...g,
        units: g.units.filter(
          (u) => u.name.toLowerCase().includes(q) ||
                 (u.serialNumber ?? "").toLowerCase().includes(q) ||
                 (u.barcode ?? "").toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.units.length > 0 || g.name.toLowerCase().includes(q));
  }, [stockGroups, search]);

  const isFiltering = !!search;

  // จัดกลุ่มตาม category (เรียง A→Z)
  const groupedByCategory = useMemo(() => {
    const map = new Map<string, StockItemWithUnits[]>();
    for (const g of filteredGroups) {
      const cat = g.category || "Uncategorized";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(g);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredGroups]);

  const isLoading = stockLoading;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await containersApi.setUnits(container.id, Array.from(selectedIds));
      qc.invalidateQueries({ queryKey: ["containers"] });
      onClose();
    } catch (err: any) {
      setError(err.message ?? "บันทึกไม่สำเร็จ");
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-3xl bg-[#0f0f0f] border border-white/[0.08] rounded-2xl shadow-2xl animate-modal-up flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FFFF00]/10 flex items-center justify-center">
              <Layers className="w-4 h-4 text-[#FFFF00]" />
            </div>
            <div>
              <h2 className="font-bold text-white text-sm">จัดของใน Container</h2>
              <p className="text-[10px] text-white/30 truncate max-w-[220px]">{container.name}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search + count */}
        <div className="px-5 pt-4 pb-2 flex-shrink-0 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
            <input
              autoFocus
              placeholder="ค้นหา unit, serial, barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white
                placeholder-white/20 focus:outline-none focus:border-[#FFFF00]/40 transition-all"
            />
          </div>
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[10px] text-white/25">
              เลือกแล้ว <span className="text-[#FFFF00]/60 font-medium">{selectedIds.size}</span> units
            </span>
            {selectedIds.size > 0 && (
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-[10px] text-white/25 hover:text-red-400 transition-colors"
              >
                ล้างทั้งหมด
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-2">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-12 text-white/30">
              <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Loading...</span>
            </div>
          )}

          {!isLoading && groupedByCategory.map(([category, groups]) => {
            const catOpen     = isFiltering ? true : expandedCategories.has(category);
            const catUnits    = groups.reduce((s, g) => s + g.units.length, 0);
            const catSelected = groups.reduce((s, g) => s + g.units.filter((u) => selectedIds.has(u.id)).length, 0);

            return (
              <div key={category}>
                {/* Category header */}
                <div
                  className="flex items-center gap-2 px-1 py-2 cursor-pointer select-none"
                  onClick={() => toggleCategory(category)}
                >
                  {isFiltering
                    ? <Boxes className="w-3.5 h-3.5 text-[#FFFF00]/40 flex-shrink-0" />
                    : catOpen
                      ? <ChevronDown className="w-3.5 h-3.5 text-[#FFFF00]/60 flex-shrink-0" />
                      : <ChevronRight className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                  }
                  <span className="text-xs font-bold text-[#FFFF00] uppercase tracking-wider">{category}</span>
                  <span className="text-[10px] text-white/25">{groups.length} models · {catUnits} units</span>
                  {catSelected > 0 && (
                    <span className="ml-auto text-[10px] font-bold text-[#FFFF00]/60 px-1.5 py-0.5 rounded bg-[#FFFF00]/10">
                      {catSelected} selected
                    </span>
                  )}
                </div>

                {/* Models in this category */}
                {catOpen && (
                  <div className="space-y-2">
                    {groups.map((group) => {
                      const isExpanded   = expanded.has(group.id);
                      const groupUnits   = group.units;
                      const selectedInGroup = groupUnits.filter((u) => selectedIds.has(u.id)).length;
                      const allSelected  = groupUnits.length > 0 && groupUnits.every((u) => selectedIds.has(u.id));

                      return (
              <div key={group.id} className="rounded-xl border border-white/[0.06] overflow-hidden">
                {/* Group header */}
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors
                    ${isExpanded ? "bg-white/[0.04]" : "bg-white/[0.02] hover:bg-white/[0.04]"}`}
                  onClick={() => toggleGroup(group.id)}
                >
                  {/* Select-all checkbox */}
                  <div
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all
                      ${allSelected ? "border-[#FFFF00] bg-[#FFFF00]" :
                        selectedInGroup > 0 ? "border-[#FFFF00]/60 bg-[#FFFF00]/20" :
                        "border-white/20"}`}
                    onClick={(e) => { e.stopPropagation(); if (groupUnits.length) toggleSelectAll(groupUnits); }}
                  >
                    {allSelected && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
                    {!allSelected && selectedInGroup > 0 && (
                      <div className="w-2 h-0.5 bg-[#FFFF00] rounded-full" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white/80 truncate">{group.name}</p>
                    <p className="text-[10px] text-white/30">{groupUnits.length} units</p>
                  </div>

                  {selectedInGroup > 0 && (
                    <span className="text-[10px] font-bold text-[#FFFF00]/60 px-1.5 py-0.5 rounded bg-[#FFFF00]/10">
                      {selectedInGroup}/{groupUnits.length}
                    </span>
                  )}

                  {isExpanded
                    ? <ChevronDown className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                    : <ChevronRight className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                  }
                </div>

                {/* Units */}
                {isExpanded && groupUnits.length === 0 && (
                  <div className="px-10 py-3 text-xs text-white/20 italic border-t border-white/[0.04]">
                    ไม่มี units — เพิ่มก่อนผ่านหน้า Stock
                  </div>
                )}

                {isExpanded && groupUnits.map((unit) => {
                  const isSelected = selectedIds.has(unit.id);
                  return (
                    <div
                      key={unit.id}
                      onClick={() => toggleUnit(unit.id)}
                      className={`flex items-center gap-3 pl-10 pr-3 py-1.5 cursor-pointer border-t border-white/[0.04] transition-colors
                        ${isSelected ? "bg-[#FFFF00]/[0.04]" : "hover:bg-white/[0.02]"}`}
                    >
                      {/* Unit checkbox */}
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
                        ${isSelected ? "border-[#FFFF00] bg-[#FFFF00]" : "border-white/20"}`}>
                        {isSelected && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`text-xs truncate ${isSelected ? "text-white/90" : "text-white/50"}`}>
                          {unit.name}
                        </p>
                        <p className="text-[10px] text-white/25 font-mono">
                          {unit.serialNumber ? `SN: ${unit.serialNumber}` : ""}
                          {unit.serialNumber && unit.barcode ? "  ·  " : ""}
                          {unit.barcode ? `BC: ${unit.barcode}` : ""}
                          {!unit.serialNumber && !unit.barcode ? "ไม่มี serial / barcode" : ""}
                        </p>
                      </div>

                      {/* Status dot */}
                      <span className="flex items-center gap-1.5 text-[10px] text-white/25 flex-shrink-0">
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
                )}
              </div>
            );
          })}

          {!isLoading && filteredGroups.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Package className="w-8 h-8 text-white/10" />
              <p className="text-xs text-white/25">ไม่พบสินค้า</p>
            </div>
          )}
        </div>

        {error && (
          <div className="mx-5 mb-2 text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2 flex-shrink-0">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06] flex-shrink-0 gap-3">
          <button onClick={onClose}
            className="h-9 px-4 rounded-lg text-sm text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 h-9 px-5 rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ backgroundColor: "#FFFF00" }}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Saving..." : `Save${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
};
