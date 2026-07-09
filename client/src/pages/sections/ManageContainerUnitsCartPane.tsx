import React, { useMemo } from "react";
import { Trash2, PackageOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { StockItemWithUnits } from "@/api";

interface Props {
  stockGroups: StockItemWithUnits[];
  selectedIds: Set<string>;
  onUnitRemove: (unitId: string) => void;
}

type GroupEntry = {
  stockItemId: string;
  name: string;
  category: string;
  unitIds: string[];
};

export const ManageContainerUnitsCartPane = ({ stockGroups, selectedIds, onUnitRemove }: Props): JSX.Element => {
  const { t } = useTranslation("modals");

  const unitInfo = useMemo(() => {
    const m = new Map<string, { name: string; serialNumber: string | null; barcode: string | null }>();
    for (const g of stockGroups) for (const u of g.units) m.set(u.id, u);
    return m;
  }, [stockGroups]);

  const groups = useMemo(() => {
    const byItem = new Map<string, GroupEntry>();
    for (const g of stockGroups) {
      const unitIds = g.units.filter((u) => selectedIds.has(u.id)).map((u) => u.id);
      if (unitIds.length === 0) continue;
      byItem.set(g.id, { stockItemId: g.id, name: g.name, category: g.category || "Uncategorized", unitIds });
    }
    return Array.from(byItem.values()).sort((a, b) =>
      a.category === b.category ? a.name.localeCompare(b.name) : a.category.localeCompare(b.category)
    );
  }, [stockGroups, selectedIds]);

  return (
    <div className="w-[38%] min-w-[260px] flex flex-col">
      <div className="px-4 pt-4 pb-2 flex-shrink-0 flex items-center justify-between">
        <span className="text-xs font-bold text-white/80">{t("manageJobStock.cartTitle")}</span>
        <span className="text-[10px] text-white/60">{t("manageContainerUnits.selectedCount", { count: selectedIds.size })}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {groups.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <PackageOpen className="w-8 h-8 text-white/30" />
            <p className="text-xs text-white/50">{t("manageJobStock.cartEmpty")}</p>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.stockItemId} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.04]">
              <p className="text-xs font-semibold text-white/80 truncate flex-1 min-w-0">{group.name}</p>
              <span className="text-[10px] text-white/40 flex-shrink-0">{group.unitIds.length}</span>
            </div>

            {group.unitIds.map((unitId) => {
              const info = unitInfo.get(unitId);
              return (
                <div key={unitId} className="flex items-center gap-2 px-3 py-1.5 border-t border-white/[0.04]">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/70 truncate">{info?.name ?? unitId}</p>
                    {(info?.serialNumber || info?.barcode) && (
                      <p className="text-[10px] text-white/40 font-mono truncate">
                        {info?.serialNumber ? `SN: ${info.serialNumber}` : ""}
                        {info?.serialNumber && info?.barcode ? "  ·  " : ""}
                        {info?.barcode ? `BC: ${info.barcode}` : ""}
                      </p>
                    )}
                  </div>
                  <button onClick={() => onUnitRemove(unitId)} className="text-white/30 hover:text-red-400 transition-colors flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
