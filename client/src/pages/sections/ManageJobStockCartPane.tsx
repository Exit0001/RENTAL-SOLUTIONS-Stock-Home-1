import React, { useMemo, useState, useEffect } from "react";
import { Layers, Minus, Plus, PlusCircle, Trash2, PackageOpen, Check, X } from "lucide-react";
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

  // multi-select for bulk zone changes — composite keys ("u:<unitId>" / "b:<lineId>") since
  // units and bulk lines live in separate maps but share one selection set
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // drop selections that no longer exist in the cart (item removed / unit unpicked)
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set<string>();
      for (const key of Array.from(prev)) {
        if (key.startsWith("u:") && cartUnits.has(key.slice(2))) next.add(key);
        else if (key.startsWith("b:") && cartBulkLines.has(key.slice(2))) next.add(key);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [cartUnits, cartBulkLines]);

  const toggleSelect = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // last row clicked (without shift) — anchor for shift-click range selection
  const [lastClickedKey, setLastClickedKey] = useState<string | null>(null);

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

  // groups items (by stock item) into a single list, filtered to whichever zone `tab` represents
  const buildGroupsForTab = (tab: string): GroupEntry[] => {
    const byItem = new Map<string, GroupEntry>();
    const ensure = (stockItemId: string) => {
      if (!byItem.has(stockItemId)) {
        const info = itemInfo.get(stockItemId);
        byItem.set(stockItemId, { stockItemId, name: info?.name ?? "?", category: info?.category ?? "Uncategorized", units: [], bulkLines: [] });
      }
      return byItem.get(stockItemId)!;
    };
    const matchesTab = (position: string | null) =>
      tab === "ALL" || (tab === "UNASSIGNED" ? !position : position === tab);

    for (const line of Array.from(cartUnits.values())) if (matchesTab(line.position)) ensure(line.stockItemId).units.push(line);
    for (const line of Array.from(cartBulkLines.values())) if (matchesTab(line.position)) ensure(line.stockItemId).bulkLines.push(line);

    return Array.from(byItem.values()).sort((a, b) =>
      a.category === b.category ? a.name.localeCompare(b.name) : a.category.localeCompare(b.category)
    );
  };

  const groups = useMemo(() => buildGroupsForTab(activeTab), [cartUnits, cartBulkLines, itemInfo, activeTab]);

  // "ALL" view — instead of one flat list, section it by zone (same order as the tab bar) so
  // scrolling down reads FOH's items, then Stage's, then unassigned, etc. — easier to scan than
  // a flat list where the zone is only visible in each row's small dropdown.
  const zoneSections = useMemo(() => {
    if (activeTab !== "ALL") return [];
    return tabs
      .filter((tab) => tab !== "ALL")
      .map((zoneKey) => ({ zoneKey, groups: buildGroupsForTab(zoneKey) }))
      .filter((section) => section.groups.length > 0);
  }, [activeTab, tabs, cartUnits, cartBulkLines, itemInfo]);

  // every row visible in the current tab, in the exact order they're rendered (zone-sectioned
  // when on "ALL", flat otherwise) — backs both "select all" and shift-click range selection
  const orderedVisibleKeys = useMemo(() => {
    const keys: string[] = [];
    const pushFrom = (gs: GroupEntry[]) => {
      for (const g of gs) {
        for (const u of g.units) keys.push(`u:${u.unitId}`);
        for (const b of g.bulkLines) keys.push(`b:${b.lineId}`);
      }
    };
    if (activeTab === "ALL") for (const section of zoneSections) pushFrom(section.groups);
    else pushFrom(groups);
    return keys;
  }, [activeTab, zoneSections, groups]);

  const allVisibleSelected = orderedVisibleKeys.length > 0 && orderedVisibleKeys.every((k) => selected.has(k));

  const toggleSelectAllVisible = () =>
    setSelected((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        for (const k of orderedVisibleKeys) next.delete(k);
        return next;
      }
      return new Set([...Array.from(prev), ...orderedVisibleKeys]);
    });

  // click = toggle one row; shift-click = select every row between the last-clicked row and
  // this one (same "hold shift to select a range" convention as file managers/Gmail) — makes
  // selecting a long run of rows one click instead of one-by-one
  const handleRowSelect = (key: string, shiftKey: boolean) => {
    if (shiftKey && lastClickedKey) {
      const i1 = orderedVisibleKeys.indexOf(lastClickedKey);
      const i2 = orderedVisibleKeys.indexOf(key);
      if (i1 !== -1 && i2 !== -1) {
        const [start, end] = i1 < i2 ? [i1, i2] : [i2, i1];
        const range = orderedVisibleKeys.slice(start, end + 1);
        setSelected((prev) => new Set([...Array.from(prev), ...range]));
        setLastClickedKey(key);
        return;
      }
    }
    toggleSelect(key);
    setLastClickedKey(key);
  };

  // apply one zone to every selected row at once, then clear the selection
  const applyBulkZone = (raw: string) => {
    if (!raw) return;
    const newZone = raw === "__NONE__" ? null : raw;
    for (const key of Array.from(selected)) {
      if (key.startsWith("u:")) onUnitPositionChange(key.slice(2), newZone);
      else if (key.startsWith("b:")) onBulkLinePositionChange(key.slice(2), newZone);
    }
    setSelected(new Set());
  };

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

  const rowCheckbox = (key: string) => (
    <button
      onMouseDown={(e) => { if (e.shiftKey) e.preventDefault(); }}
      onClick={(e) => { e.stopPropagation(); handleRowSelect(key, e.shiftKey); }}
      className={`select-none w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
        ${selected.has(key) ? "border-[#FFFF00] bg-[#FFFF00]" : "border-white/20 hover:border-white/40"}`}
    >
      {selected.has(key) && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
    </button>
  );

  const renderGroupCard = (group: GroupEntry) => {
    const groupKeys = [...group.units.map((u) => `u:${u.unitId}`), ...group.bulkLines.map((b) => `b:${b.lineId}`)];
    const groupAllSelected  = groupKeys.length > 0 && groupKeys.every((k) => selected.has(k));
    const groupSomeSelected = !groupAllSelected && groupKeys.some((k) => selected.has(k));
    const toggleGroupSelect = () =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (groupAllSelected) groupKeys.forEach((k) => next.delete(k));
        else groupKeys.forEach((k) => next.add(k));
        return next;
      });

    return (
      <div key={group.stockItemId} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.04]">
          {groupKeys.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleGroupSelect(); }}
              title={t("manageJobStock.selectGroupHint")}
              className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
                ${groupAllSelected ? "border-[#FFFF00] bg-[#FFFF00]" : groupSomeSelected ? "border-[#FFFF00]/60 bg-[#FFFF00]/20" : "border-white/20 hover:border-white/40"}`}
            >
              {groupAllSelected && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
              {groupSomeSelected && <div className="w-2 h-0.5 bg-[#FFFF00] rounded-full" />}
            </button>
          )}
          <p className="text-xs font-semibold text-white/80 truncate flex-1 min-w-0">{group.name}</p>
          {group.units.length > 0 && zoneSelect(
            group.units[0]?.position ?? null,
            (v) => onGroupApplyPositionToUnits(group.stockItemId, v)
          )}
        </div>

        {group.units.map((line) => {
          const info = unitInfo.get(line.unitId);
          const key = `u:${line.unitId}`;
          return (
            <div
              key={line.unitId}
              onMouseDown={(e) => { if (e.shiftKey) e.preventDefault(); }}
              onClick={(e) => handleRowSelect(key, e.shiftKey)}
              className={`select-none flex items-center gap-2 px-3 py-1.5 border-t border-white/[0.04] cursor-pointer transition-colors ${selected.has(key) ? "bg-[#FFFF00]/[0.05]" : "hover:bg-white/[0.02]"}`}
            >
              {rowCheckbox(key)}
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
              <button onClick={(e) => { e.stopPropagation(); onUnitRemove(line.unitId); }} className="text-white/30 hover:text-red-400 transition-colors flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}

        {group.bulkLines.map((line) => {
          const key = `b:${line.lineId}`;
          return (
          <div
            key={line.lineId}
            onMouseDown={(e) => { if (e.shiftKey) e.preventDefault(); }}
            onClick={(e) => handleRowSelect(key, e.shiftKey)}
            className={`select-none flex items-center gap-2 px-3 py-1.5 border-t border-white/[0.04] cursor-pointer transition-colors ${selected.has(key) ? "bg-[#FFFF00]/[0.05]" : "hover:bg-white/[0.02]"}`}
          >
            {rowCheckbox(key)}
            <Layers className="w-3.5 h-3.5 text-amber-400/60 flex-shrink-0" />
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); onBulkLineQtyChange(line.lineId, -1); }}
                className="w-5 h-5 rounded border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-white/30 transition-colors"
              >
                <Minus className="w-2.5 h-2.5" />
              </button>
              <span className="w-6 text-center text-xs font-bold text-[#FFFF00]">{line.quantity}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onBulkLineQtyChange(line.lineId, 1); }}
                className="w-5 h-5 rounded border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-white/30 transition-colors"
              >
                <Plus className="w-2.5 h-2.5" />
              </button>
            </div>
            <div className="flex-1" />
            {zoneSelect(line.position, (v) => onBulkLinePositionChange(line.lineId, v))}
            <button onClick={(e) => { e.stopPropagation(); onBulkLineRemove(line.lineId); }} className="text-white/30 hover:text-red-400 transition-colors flex-shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          );
        })}

        {group.bulkLines.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); onBulkLineAdd(group.stockItemId); }}
            className="w-full flex items-center gap-1.5 px-3 py-1.5 border-t border-white/[0.04] text-[10px] text-white/40 hover:text-[#FFFF00] transition-colors"
          >
            <PlusCircle className="w-3 h-3" />
            {t("manageJobStock.addSplit")}
          </button>
        )}
      </div>
    );
  };

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

      {groups.length > 0 && (
        <div className="px-4 pb-2 flex-shrink-0 flex items-center gap-2">
          <button
            onClick={toggleSelectAllVisible}
            className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
              ${allVisibleSelected ? "border-[#FFFF00] bg-[#FFFF00]" : "border-white/20 hover:border-white/40"}`}
          >
            {allVisibleSelected && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
          </button>
          <span className="text-[10px] text-white/50 whitespace-nowrap">
            {selected.size > 0 ? t("manageJobStock.selectedForBulk", { count: selected.size }) : t("manageJobStock.selectAllHint")}
          </span>
          {selected.size > 0 && (
            <>
              <div className="flex-1" />
              <select
                value=""
                onChange={(e) => applyBulkZone(e.target.value)}
                className="h-7 rounded-md bg-[#0d0d0d] border border-[#FFFF00]/30 text-[10px] px-2 outline-none cursor-pointer text-[#FFFF00] hover:border-[#FFFF00]/50 transition-colors flex-shrink-0"
              >
                <option value="" disabled>{t("manageJobStock.bulkZonePlaceholder")}</option>
                <option value="__NONE__">{t("manageJobStock.zoneNone")}</option>
                {zones.map((z) => <option key={z.id} value={z.name}>{z.name}</option>)}
              </select>
              <button onClick={() => setSelected(new Set())} className="text-white/40 hover:text-red-400 transition-colors flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4 select-none">
        {groups.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <PackageOpen className="w-8 h-8 text-white/30" />
            <p className="text-xs text-white/50">{t("manageJobStock.cartEmpty")}</p>
          </div>
        )}

        {activeTab === "ALL" ? (
          zoneSections.map(({ zoneKey, groups: zoneGroups }) => (
            <div key={zoneKey}>
              <div className="flex items-center gap-2 mb-2 px-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#FFFF00]/60 whitespace-nowrap">
                  {tabLabel(zoneKey)}
                </span>
                <span className="text-[10px] text-white/40 flex-shrink-0">{tabCount(zoneKey)}</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>
              <div className="space-y-3">
                {zoneGroups.map(renderGroupCard)}
              </div>
            </div>
          ))
        ) : (
          <div className="space-y-3">
            {groups.map(renderGroupCard)}
          </div>
        )}
      </div>
    </div>
  );
};
