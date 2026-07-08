import React, { useState, useMemo, useEffect } from "react";
import { X, Package, Search, Loader2, Check, Save, ChevronDown, ChevronRight, Boxes, Layers, Minus, Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { stockApi, jobsApi, catalogApi } from "@/api";
import type { AssignedUnit, StockItemWithUnits, JobBulkEntry } from "@/api";
import type { Position } from "@shared/schema";
import type { StockUnit, ItemAccessory } from "@shared/schema";

interface Props {
  jobId:       string;
  jobName:     string;
  onClose:     () => void;
}

const statusDot: Record<string, string> = {
  available:   "bg-emerald-400",
  out:         "bg-blue-400",
  maintenance: "bg-amber-400",
  retired:     "bg-white/20",
};

export const ManageJobStockModal = ({ jobId, jobName, onClose }: Props): JSX.Element => {
  const { t } = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const { token } = useAppStore();
  const qc = useQueryClient();

  const [search,             setSearch]             = useState("");
  const [selectedIds,        setSelectedIds]        = useState<Set<string>>(new Set());
  const [bulkQuantities,     setBulkQuantities]     = useState<Record<string, number>>({});
  const [itemPositions,      setItemPositions]      = useState<Record<string, string>>({});
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

  // โหลด units ที่ assign แล้วสำหรับ job นี้
  const { data: assignedUnits = [], isLoading: assignedLoading } = useQuery<AssignedUnit[]>({
    queryKey: ["job-units", jobId],
    queryFn: () => jobsApi.getUnits(jobId),
    enabled: !!token,
  });

  // โหลด bulk quantities ที่ assign แล้วสำหรับ job นี้
  const { data: jobBulkEntries = [], isLoading: bulkLoading } = useQuery<JobBulkEntry[]>({
    queryKey: ["job-bulk-stock", jobId],
    queryFn: () => jobsApi.getJobStock(jobId),
    enabled: !!token,
  });

  // โหลด accessory links ทั้งหมดของบริษัท
  const { data: accessoryLinks = [] } = useQuery<ItemAccessory[]>({
    queryKey: ["accessory-links"],
    queryFn:  stockApi.getAllAccessoryLinks,
    enabled:  !!token,
  });

  // โหลดโซน (FOH/Mon/Power/Stage) ของบริษัท
  const { data: zones = [] } = useQuery<Position[]>({
    queryKey: ["catalog", "positions"],
    queryFn:  catalogApi.getPositions,
    enabled:  !!token,
  });

  // map: parentStockItemId → list of accessory links
  const accessoryMap = useMemo(() => {
    const map = new Map<string, ItemAccessory[]>();
    for (const link of accessoryLinks) {
      if (!map.has(link.parentStockItemId)) map.set(link.parentStockItemId, []);
      map.get(link.parentStockItemId)!.push(link);
    }
    return map;
  }, [accessoryLinks]);

  // pre-populate bulk quantities
  useEffect(() => {
    if (bulkLoading) return;
    const map: Record<string, number> = {};
    for (const entry of jobBulkEntries) {
      map[entry.stockItemId] = entry.quantity;
    }
    setBulkQuantities(map);
  }, [jobBulkEntries, bulkLoading]);

  // prefill โซนต่อ item จากข้อมูลที่บันทึกไว้ (unit + bulk)
  useEffect(() => {
    if (assignedLoading || bulkLoading) return;
    const map: Record<string, string> = {};
    for (const u of assignedUnits) {
      if (u.position && !map[u.stockItemId]) map[u.stockItemId] = u.position;
    }
    for (const b of jobBulkEntries) {
      if (b.position && !map[b.stockItemId]) map[b.stockItemId] = b.position;
    }
    setItemPositions(map);
  }, [assignedUnits, jobBulkEntries, assignedLoading, bulkLoading]);

  // pre-select ตาม assigned units + expand groups ที่มี selection
  useEffect(() => {
    if (assignedLoading || stockLoading) return;
    const ids = new Set(assignedUnits.map((u) => u.id));
    setSelectedIds(ids);

    // expand stock items + categories ที่มี unit ถูก select อยู่
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
  }, [assignedUnits, stockGroups, assignedLoading, stockLoading]);

  const toggleUnit = (unitId: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) {
        next.delete(unitId);
        return next;
      }
      next.add(unitId);

      // หา stockItemId ของ unit นี้
      let parentStockItemId: string | undefined;
      for (const g of stockGroups) {
        if (g.units.some((u) => u.id === unitId)) {
          parentStockItemId = g.id;
          break;
        }
      }

      // auto-select required accessories
      if (parentStockItemId) {
        const links = accessoryMap.get(parentStockItemId) ?? [];
        for (const link of links) {
          if (!link.required) continue;
          const accGroup = stockGroups.find((g) => g.id === link.accessoryStockItemId);
          if (!accGroup) continue;
          const availableUnits = accGroup.units.filter((u) => u.status === "available" && !next.has(u.id));
          const toAdd = availableUnits.slice(0, link.quantityPerUnit);
          toAdd.forEach((u) => next.add(u.id));
        }
      }

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

  const isLoading = stockLoading || assignedLoading || bulkLoading;

  // map: unit id → stock item id (สำหรับสร้าง payload โซนตอน save)
  const unitToItem = useMemo(() => {
    const m: Record<string, string> = {};
    for (const g of stockGroups) for (const u of g.units) m[u.id] = g.id;
    return m;
  }, [stockGroups]);

  // dropdown เลือกโซน (FOH/Mon/Power/Stage) ต่อ item — ใช้ทั้งฝั่ง unit และ bulk
  const zoneSelect = (itemId: string) => {
    if (zones.length === 0) return null;
    return (
      <select
        value={itemPositions[itemId] ?? ""}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => { e.stopPropagation(); setItemPositions((p) => ({ ...p, [itemId]: e.target.value })); }}
        title={t("manageJobStock.zoneLabel")}
        className="h-6 max-w-[110px] rounded-md bg-[#0d0d0d] border border-white/10 text-[10px] px-1.5 outline-none cursor-pointer flex-shrink-0
          hover:border-white/30 transition-colors"
        style={itemPositions[itemId] ? { color: "#FFFF00", borderColor: "rgba(255,255,0,0.35)" } : { color: "rgba(255,255,255,0.5)" }}
      >
        <option value="">{t("manageJobStock.zoneNone")}</option>
        {zones.map((z) => <option key={z.id} value={z.name}>{z.name}</option>)}
      </select>
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Save individual unit assignments
      await jobsApi.setUnits(jobId, Array.from(selectedIds));

      // Save bulk quantity assignments
      const bulkItems = Object.entries(bulkQuantities)
        .filter(([, qty]) => qty > 0)
        .map(([stockItemId, quantity]) => ({ stockItemId, quantity }));
      if (bulkItems.length > 0) {
        await jobsApi.setJobStock(jobId, bulkItems);
      }

      // Save โซน (position) ต่อ item — ต้องทำหลัง setUnits/setJobStock (เพราะ replace-all)
      const unitPos = Array.from(selectedIds).map((uid) => ({
        stockUnitId: uid,
        position:    itemPositions[unitToItem[uid]] || null,
      }));
      const bulkPos = bulkItems.map(({ stockItemId }) => ({
        stockItemId,
        position: itemPositions[stockItemId] || null,
      }));
      if (unitPos.length > 0 || bulkPos.length > 0) {
        await jobsApi.setPositions(jobId, { units: unitPos, bulk: bulkPos });
      }

      qc.invalidateQueries({ queryKey: ["job-units", jobId] });
      qc.invalidateQueries({ queryKey: ["job-bulk-stock", jobId] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["stock-with-units"] });
      onClose();
    } catch (err: any) {
      setError(err.message ?? t("manageContainerUnits.errorSaveFailed"));
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
              <Package className="w-4 h-4 text-[#FFFF00]" />
            </div>
            <div>
              <h2 className="font-bold text-white text-sm">{t("manageJobStock.title")}</h2>
              <p className="text-[10px] text-white/60 truncate max-w-[220px]">{jobName}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search + count */}
        <div className="px-5 pt-4 pb-2 flex-shrink-0 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/60" />
            <input
              autoFocus
              placeholder={t("manageContainerUnits.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white
                placeholder-white/20 focus:outline-none focus:border-[#FFFF00]/40 transition-all"
            />
          </div>
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[10px] text-white/60">
              {t("manageContainerUnits.selectedCount", { count: selectedIds.size })}
            </span>
            {selectedIds.size > 0 && (
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-[10px] text-white/60 hover:text-red-400 transition-colors"
              >
                {tc("clearAll")}
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-2">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-12 text-white/60">
              <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">{tc("loading")}</span>
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
                      : <ChevronRight className="w-3.5 h-3.5 text-white/60 flex-shrink-0" />
                  }
                  <span className="text-xs font-bold text-[#FFFF00] uppercase tracking-wider">{category}</span>
                  <span className="text-[10px] text-white/60">{t("manageContainerUnits.modelsUnitsCount", { models: groups.length, units: catUnits })}</span>
                  {catSelected > 0 && (
                    <span className="ml-auto text-[10px] font-bold text-[#FFFF00]/60 px-1.5 py-0.5 rounded bg-[#FFFF00]/10">
                      {t("manageContainerUnits.selectedBadge", { count: catSelected })}
                    </span>
                  )}
                </div>

                {/* Models in this category */}
                {catOpen && (
                  <div className="space-y-2">
                    {groups.map((group) => {
                      const isBulk       = group.trackingMode === "bulk";
                      const isExpanded   = !isBulk && expanded.has(group.id);
                      const groupUnits   = group.units;
                      const selectedInGroup = groupUnits.filter((u) => selectedIds.has(u.id)).length;
                      const allSelected  = !isBulk && groupUnits.length > 0 && groupUnits.every((u) => selectedIds.has(u.id));
                      const bulkQty      = bulkQuantities[group.id] ?? 0;
                      const bulkMax      = group.availableCount ?? (group.quantity ?? 0);

                      if (isBulk) {
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
                              {/* Zone picker (แสดงเมื่อมีจำนวน > 0) */}
                              {bulkQty > 0 && zoneSelect(group.id)}
                              {/* Stepper */}
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setBulkQuantities((p) => ({ ...p, [group.id]: Math.max(0, (p[group.id] ?? 0) - 1) }))}
                                  className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-white/30 transition-colors"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className={`w-8 text-center text-sm font-bold ${bulkQty > 0 ? "text-[#FFFF00]" : "text-white/60"}`}>
                                  {bulkQty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setBulkQuantities((p) => ({ ...p, [group.id]: Math.min(bulkMax + bulkQty, (p[group.id] ?? 0) + 1) }))}
                                  className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-white/30 transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }

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
                    <p className="text-[10px] text-white/60">{t("manageContainerUnits.unitsCount", { count: groupUnits.length })}</p>
                  </div>

                  {selectedInGroup > 0 && (
                    <span className="text-[10px] font-bold text-[#FFFF00]/60 px-1.5 py-0.5 rounded bg-[#FFFF00]/10">
                      {selectedInGroup}/{groupUnits.length}
                    </span>
                  )}

                  {selectedInGroup > 0 && zoneSelect(group.id)}

                  {isExpanded
                    ? <ChevronDown className="w-3.5 h-3.5 text-white/60 flex-shrink-0" />
                    : <ChevronRight className="w-3.5 h-3.5 text-white/60 flex-shrink-0" />
                  }
                </div>

                {/* Units */}
                {isExpanded && groupUnits.length === 0 && (
                  <div className="px-10 py-3 text-xs text-white/60 italic border-t border-white/[0.04]">
                    {t("manageContainerUnits.noUnitsHint")}
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
                        <p className="text-[10px] text-white/60 font-mono">
                          {unit.serialNumber ? `SN: ${unit.serialNumber}` : ""}
                          {unit.serialNumber && unit.barcode ? "  ·  " : ""}
                          {unit.barcode ? `BC: ${unit.barcode}` : ""}
                          {!unit.serialNumber && !unit.barcode ? t("manageContainerUnits.noSerialBarcode") : ""}
                        </p>
                      </div>

                      {/* Status dot */}
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
                )}
              </div>
            );
          })}

          {!isLoading && filteredGroups.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Package className="w-8 h-8 text-white/40" />
              <p className="text-xs text-white/60">{t("manageContainerUnits.noItemsFound")}</p>
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
            className="h-9 px-4 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors">
            {tc("cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 h-9 px-5 rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ backgroundColor: "#FFFF00" }}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? tc("saving") : selectedIds.size > 0 ? t("manageContainerUnits.saveWithCount", { count: selectedIds.size }) : tc("save")}
          </button>
        </div>
      </div>
    </div>
  );
};
