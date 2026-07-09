import React, { useState, useMemo, useEffect } from "react";
import { X, Layers, Loader2, Save } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { stockApi, containersApi } from "@/api";
import type { StockItemWithUnits, ContainerWithItems } from "@/api";
import type { StockUnit } from "@shared/schema";
import { ManageContainerUnitsCatalogPane } from "./ManageContainerUnitsCatalogPane";
import { ManageContainerUnitsCartPane } from "./ManageContainerUnitsCartPane";

interface Props {
  container: ContainerWithItems;
  onClose:   () => void;
}

export const ManageContainerUnitsModal = ({ container, onClose }: Props): JSX.Element => {
  const { t } = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const { token } = useAppStore();
  const qc = useQueryClient();

  const [search,         setSearch]         = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [expanded,       setExpanded]       = useState<Set<string>>(new Set());
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set(container.items.map((u) => u.id)));
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState<string | null>(null);

  // โหลด stock items พร้อม units
  const { data: stockGroups = [], isLoading: stockLoading } = useQuery<StockItemWithUnits[]>({
    queryKey: ["stock-with-units"],
    queryFn: stockApi.getAllWithUnits,
    enabled: !!token,
  });

  // pre-expand model groups that already have a unit selected (ของที่อยู่ใน container นี้แล้ว)
  useEffect(() => {
    if (stockLoading) return;
    const ids = new Set(container.items.map((u) => u.id));
    if (ids.size > 0) {
      const toExpand = new Set<string>();
      for (const g of stockGroups) if (g.units.some((u) => ids.has(u.id))) toExpand.add(g.id);
      setExpanded(toExpand);
    }
  }, [stockGroups, stockLoading, container.items]);

  const toggleUnit = (unitId: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(unitId) ? next.delete(unitId) : next.add(unitId);
      return next;
    });

  const toggleGroupExpand = (groupId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
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

  const isLoading = stockLoading;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await containersApi.setUnits(container.id, Array.from(selectedIds));
      qc.invalidateQueries({ queryKey: ["containers"] });
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
      <div className="w-full max-w-6xl bg-[#0f0f0f] border border-white/[0.08] rounded-2xl shadow-2xl animate-modal-up flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FFFF00]/10 flex items-center justify-center">
              <Layers className="w-4 h-4 text-[#FFFF00]" />
            </div>
            <div>
              <h2 className="font-bold text-white text-sm">{t("manageContainerUnits.title")}</h2>
              <p className="text-[10px] text-white/60 truncate max-w-[220px]">{container.name}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Two-pane body: catalog (left) + persistent cart (right) */}
        <div className="flex-1 min-h-0 flex flex-row">
          <ManageContainerUnitsCatalogPane
            stockGroups={stockGroups}
            isLoading={isLoading}
            search={search}
            onSearchChange={setSearch}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            expanded={expanded}
            onToggleGroupExpand={toggleGroupExpand}
            selectedIds={selectedIds}
            onToggleUnit={toggleUnit}
            onToggleSelectAll={toggleSelectAll}
          />
          <ManageContainerUnitsCartPane
            stockGroups={stockGroups}
            selectedIds={selectedIds}
            onUnitRemove={toggleUnit}
          />
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
