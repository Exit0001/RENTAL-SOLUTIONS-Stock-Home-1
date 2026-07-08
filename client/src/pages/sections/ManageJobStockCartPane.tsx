import React, { useMemo, useState, useEffect } from "react";
import { Layers, Minus, Plus, PlusCircle, Trash2, PackageOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { StockItemWithUnits } from "@/api";
import type { Position } from "@shared/schema";
import type { CartUnitLine, CartBulkLine } from "./ManageJobStockModal";

interface Props {
  stockGroups:   StockItemWithUnits[];
  zones:         Position[];
  cartUnits:     Map<string, CartUnitLine>;
  cartBulkLines: Map<string, CartBulkLine>;
  onUnitPositionChange:  (unitId: string, position: string | null) => void;
  onUnitRemove:          (unitId: string) => void;
  onGroupApplyPositionToUnits: (stockItemId: string, position: string | null) => void;
  onBulkLineQtyChange:      (lineId: string, delta: number) => void;
  onBulkLinePositionChange: (lineId: string, position: string | null) => void;
  onBulkLineRemove:         (lineId: string) => void;
  onBulkLineAdd:            (stockItemId: string) => void;
}

type GroupEntry = {
  stockItemId: string;
  name: string;
  category: string;
  units: CartUnitLine[];
  bulkLines: CartBulkLine[];
};

export const ManageJobStockCartPane = ({
  stockGroups, zones, cartUnits, cartBulkLines,
  onUnitPositionChange, onUnitRemove, onGroupApplyPositionToUnits,
  onBulkLineQtyChange, onBulkLinePositionChange, onBulkLineRemove, onBulkLineAdd,
}: Props): JSX.Element => {
  const { t }  = useTranslation("modals");
  const { t: tc } = useTranslation("common");

  const [activeTab, setActiveTab] = useState<string>("ALL");

  const itemInfo = useMemo(() => {
    const m = new Map<string, { name: string; category: string }>();
    for (const g of stockGroups) m.set(g.id, { name: g.name, category: g.category || "Uncategorized" });
    return m;
  }, [stockGroups]);

  const unitInfo = useMemo(() => {
    const m = new Map<string, { name: string; serialNumber: string | null; barcode: string | null }>();
    for (const g of stockGroups) for (const u of g.units) m.set(u.id, u);
    return m;
  }, [stockGroups]);

  // tab bar — "ALL" + every zone actually in use in this cart + "UNASSIGNED" if any item has no zone yet
  const tabs = useMemo(() => {
    const zoneNames = new Set<string>();
    let hasUnassigned = false;
    for (const l of Array.from(cartUnits.values())) l.position ? zoneNames.add(l.position) : (hasUnassigned = true);
    for (const l of Array.from(cartBulkLines.values())) l.position ? zoneNames.add(l.position) : (hasUnassigned = true);
    const ordered = zones.map((z) => z.name).filter((n) => zoneNames.has(n));
    for (const n of Array.from(zoneNames)) if (!ordered.includes(n)) ordered.push(n); // zones removed from the catalog but still used here
    return ["ALL", ...ordered, ...(hasUnassigned ? ["UNASSIGNED"] : [])];
  }, [cartUnits, cartBulkLines, zones]);

  // fall back to "ALL" if the active tab's zone no longer has anything in the cart
  useEffect(() => {
    if (!tabs.includes(activeTab)) setActiveTab("ALL");
  }, [tabs, activeTab]);

  const tabCount = (tab: string) => {
    let n = 0;
    for (const l of Array.from(cartUnits.values())) {
      if (tab === "ALL" || (tab === "UNASSIGNED" ? !l.position : l.position === tab)) n += 1;
    }
    for (const l of Array.from(cartBulkLines.values())) {
      if (tab === "ALL" || (tab === "UNASSIGNED" ? !l.position : l.position === tab)) n += l.quantity;
    }
    return n;
  };

  const groups = useMemo(() => {
    const byItem = new Map<string, GroupEntry>();
    const ensure = (stockItemId: string) => {
      if (!byItem.has(stockItemId)) {
        const info = itemInfo.get(stockItemId);
        byItem.set(stockItemId, { stockItemId, name: info?.name ?? "?", category: info?.category ?? "Uncategorized", units: [], bulkLines: [] });
      }
      return byItem.get(stockItemId)!;
    };
    const matchesTab = (position: string | null) =>
      activeTab === "ALL" || (activeTab === "UNASSIGNED" ? !position : position === activeTab);

    for (const line of Array.from(cartUnits.values())) if (matchesTab(line.position)) ensure(line.stockItemId).units.push(line);
    for (const line of Array.from(cartBulkLines.values())) if (matchesTab(line.position)) ensure(line.stockItemId).bulkLines.push(line);

    return Array.from(byItem.values()).sort((a, b) =>
      a.category === b.category ? a.name.localeCompare(b.name) : a.category.localeCompare(b.category)
    );
  }, [cartUnits, cartBulkLines, itemInfo, activeTab]);

  const zoneSelect = (value: string | null, onChange: (v: string | null) => void) => (
    <select
      value={value ?? ""}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value || null)}
      title={t("manageJobStock.zoneLabel")}
      className="h-6 max-w-[100px] rounded-md bg-[#0d0d0d] border border-white/10 text-[10px] px-1.5 outline-none cursor-pointer flex-shrink-0
        hover:border-white/30 transition-colors"
      style={value ? { color: "#FFFF00", borderColor: "rgba(255,255,0,0.35)" } : { color: "rgba(255,255,255,0.5)" }}
    >
      <option value="">{t("manageJobStock.zoneNone")}</option>
      {zones.map((z) => <option key={z.id} value={z.name}>{z.name}</option>)}
    </select>
  );

  const totalCount = cartUnits.size + Array.from(cartBulkLines.values()).reduce((s, l) => s + l.quantity, 0);

  const tabLabel = (tab: string) =>
    tab === "ALL" ? t("manageJobStock.tabAll") : tab === "UNASSIGNED" ? t("manageJobStock.tabUnassigned") : tab;

  return (
    <div className="w-[38%] min-w-[260px] flex flex-col">
      <div className="px-4 pt-4 pb-2 flex-shrink-0 flex items-center justify-between">
        <span className="text-xs font-bold text-white/80">{t("manageJobStock.cartTitle")}</span>
        <span className="text-[10px] text-white/60">{t("manageContainerUnits.selectedCount", { count: totalCount })}</span>
      </div>

      {tabs.length > 1 && (
        <div className="px-4 pb-2 flex-shrink-0 flex flex-wrap gap-1.5">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`h-6 px-2.5 rounded-full text-[10px] font-semibold transition-colors border
                ${activeTab === tab ? "bg-[#FFFF00] text-black border-[#FFFF00]" : "text-white/50 border-white/10 hover:border-white/30"}`}
            >
              {tabLabel(tab)} <span className="opacity-60">{tabCount(tab)}</span>
            </button>
          ))}
        </div>
      )}

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
              {group.units.length > 0 && zoneSelect(
                group.units[0]?.position ?? null,
                (v) => onGroupApplyPositionToUnits(group.stockItemId, v)
              )}
            </div>

            {group.units.map((line) => {
              const info = unitInfo.get(line.unitId);
              return (
                <div key={line.unitId} className="flex items-center gap-2 px-3 py-1.5 border-t border-white/[0.04]">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/70 truncate">{info?.name ?? line.unitId}</p>
                    {(info?.serialNumber || info?.barcode) && (
                      <p className="text-[10px] text-white/40 font-mono truncate">
                        {info?.serialNumber ? `SN: ${info.serialNumber}` : ""}
                        {info?.serialNumber && info?.barcode ? "  ·  " : ""}
                        {info?.barcode ? `BC: ${info.barcode}` : ""}
                      </p>
                    )}
                  </div>
                  {zoneSelect(line.position, (v) => onUnitPositionChange(line.unitId, v))}
                  <button onClick={() => onUnitRemove(line.unitId)} className="text-white/30 hover:text-red-400 transition-colors flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}

            {group.bulkLines.map((line) => (
              <div key={line.lineId} className="flex items-center gap-2 px-3 py-1.5 border-t border-white/[0.04]">
                <Layers className="w-3.5 h-3.5 text-amber-400/60 flex-shrink-0" />
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => onBulkLineQtyChange(line.lineId, -1)}
                    className="w-5 h-5 rounded border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-white/30 transition-colors"
                  >
                    <Minus className="w-2.5 h-2.5" />
                  </button>
                  <span className="w-6 text-center text-xs font-bold text-[#FFFF00]">{line.quantity}</span>
                  <button
                    onClick={() => onBulkLineQtyChange(line.lineId, 1)}
                    className="w-5 h-5 rounded border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-white/30 transition-colors"
                  >
                    <Plus className="w-2.5 h-2.5" />
                  </button>
                </div>
                <div className="flex-1" />
                {zoneSelect(line.position, (v) => onBulkLinePositionChange(line.lineId, v))}
                <button onClick={() => onBulkLineRemove(line.lineId)} className="text-white/30 hover:text-red-400 transition-colors flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {group.bulkLines.length > 0 && (
              <button
                onClick={() => onBulkLineAdd(group.stockItemId)}
                className="w-full flex items-center gap-1.5 px-3 py-1.5 border-t border-white/[0.04] text-[10px] text-white/40 hover:text-[#FFFF00] transition-colors"
              >
                <PlusCircle className="w-3 h-3" />
                {t("manageJobStock.addSplit")}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
