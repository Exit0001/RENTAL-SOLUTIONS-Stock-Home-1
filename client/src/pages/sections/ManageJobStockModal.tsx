import React, { useState, useMemo, useEffect } from "react";
import { X, Package, Loader2, Save } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { stockApi, jobsApi, catalogApi } from "@/api";
import type { AssignedUnit, StockItemWithUnits, JobBulkEntry } from "@/api";
import type { Position } from "@shared/schema";
import type { StockUnit, ItemAccessory } from "@shared/schema";
import { ManageJobStockCatalogPane } from "./ManageJobStockCatalogPane";
import { ManageJobStockCartPane } from "./ManageJobStockCartPane";

export type CartUnitLine = { unitId: string; stockItemId: string; position: string | null };
export type CartBulkLine = { lineId: string; stockItemId: string; quantity: number; position: string | null };

interface Props {
  jobId:       string;
  jobName:     string;
  onClose:     () => void;
}

export const ManageJobStockModal = ({ jobId, jobName, onClose }: Props): JSX.Element => {
  const { t } = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const { token } = useAppStore();
  const qc = useQueryClient();

  const [search,         setSearch]         = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [expanded,       setExpanded]       = useState<Set<string>>(new Set());
  const [cartUnits,      setCartUnits]      = useState<Map<string, CartUnitLine>>(new Map());
  const [cartBulkLines,  setCartBulkLines]  = useState<Map<string, CartBulkLine>>(new Map());
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState<string | null>(null);

  // โซนที่กำลัง "เพิ่มของเข้า" ตอนนี้ — "auto" = ใช้ lastPosition ต่อ item (smart default เดิม),
  // string = บังคับโซนนี้กับของที่เพิ่มใหม่ทุกชิ้น, null = บังคับไม่ระบุโซน
  const [activeZone, setActiveZone] = useState<string | null>("auto");

  // โหลด stock items พร้อม units (+ lastPosition ต่อ item สำหรับ smart default)
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

  // map: stockItemId → most-recently-used zone (smart default for newly added lines)
  const lastPositionByItem = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const g of stockGroups) m.set(g.id, g.lastPosition ?? null);
    return m;
  }, [stockGroups]);

  // map: stockItemId → remaining available qty for bulk items (excluding this job's own assignment)
  const bulkMaxByItem = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of stockGroups) if (g.trackingMode === "bulk") m.set(g.id, g.availableCount ?? g.quantity ?? 0);
    return m;
  }, [stockGroups]);

  // สร้างโซนใหม่จากใน modal ได้ทันที (แต่ละงานจะมีกี่จุดก็ได้ โดยใช้ list กลางร่วมกันทุกงาน)
  const createZoneMutation = useMutation({
    mutationFn: (name: string) => catalogApi.createPosition({ name }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["catalog", "positions"] });
      setActiveZone(created.name);
    },
  });

  const onCreateZone = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = zones.find((z) => z.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) { setActiveZone(existing.name); return; }
    createZoneMutation.mutate(trimmed);
  };

  // โซนที่จะใช้ตอนเพิ่มของชิ้นใหม่ — "auto" ใช้ smart default ต่อ item, ไม่งั้นบังคับตามที่เลือกไว้
  const resolvePosition = (stockItemId: string): string | null =>
    activeZone === "auto" ? (lastPositionByItem.get(stockItemId) ?? null) : activeZone;

  // pre-populate cart from saved job data — always trusts the row's own saved position, never overrides it
  useEffect(() => {
    if (assignedLoading) return;
    const map = new Map<string, CartUnitLine>();
    for (const u of assignedUnits) {
      map.set(u.id, { unitId: u.id, stockItemId: u.stockItemId, position: u.position ?? null });
    }
    setCartUnits(map);
  }, [assignedUnits, assignedLoading]);

  useEffect(() => {
    if (bulkLoading) return;
    const map = new Map<string, CartBulkLine>();
    for (const entry of jobBulkEntries) {
      map.set(entry.id, { lineId: entry.id, stockItemId: entry.stockItemId, quantity: entry.quantity, position: entry.position ?? null });
    }
    setCartBulkLines(map);
  }, [jobBulkEntries, bulkLoading]);

  // pre-expand model groups that already have a selected unit
  useEffect(() => {
    if (assignedLoading || stockLoading || assignedUnits.length === 0) return;
    const ids = new Set(assignedUnits.map((u) => u.id));
    const toExpand = new Set<string>();
    for (const g of stockGroups) {
      if (g.units.some((u) => ids.has(u.id))) toExpand.add(g.id);
    }
    setExpanded(toExpand);
  }, [assignedUnits, stockGroups, assignedLoading, stockLoading]);

  const toggleUnit = (unitId: string) => {
    setCartUnits((prev) => {
      const next = new Map(prev);
      if (next.has(unitId)) {
        next.delete(unitId);
        return next;
      }

      let parentStockItemId: string | undefined;
      for (const g of stockGroups) {
        if (g.units.some((u) => u.id === unitId)) { parentStockItemId = g.id; break; }
      }
      if (!parentStockItemId) return next;

      next.set(unitId, { unitId, stockItemId: parentStockItemId, position: resolvePosition(parentStockItemId) });

      // auto-select required accessories
      const links = accessoryMap.get(parentStockItemId) ?? [];
      for (const link of links) {
        if (!link.required) continue;
        const accGroup = stockGroups.find((g) => g.id === link.accessoryStockItemId);
        if (!accGroup) continue;
        const availableUnits = accGroup.units.filter((u) => u.status === "available" && !next.has(u.id));
        const toAdd = availableUnits.slice(0, link.quantityPerUnit);
        for (const u of toAdd) {
          next.set(u.id, { unitId: u.id, stockItemId: accGroup.id, position: resolvePosition(accGroup.id) });
        }
      }

      return next;
    });
  };

  const toggleGroupExpand = (groupId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });

  const toggleSelectAll = (units: StockUnit[], stockItemId: string) => {
    const allSelected = units.every((u) => cartUnits.has(u.id));
    setCartUnits((prev) => {
      const next = new Map(prev);
      if (allSelected) {
        units.forEach((u) => next.delete(u.id));
      } else {
        units.forEach((u) => {
          if (!next.has(u.id)) next.set(u.id, { unitId: u.id, stockItemId, position: resolvePosition(stockItemId) });
        });
      }
      return next;
    });
  };

  // catalog stepper — operates on the single line for this item; if already split into
  // multiple positioned lines, the catalog defers to the cart pane instead (see splitNotice)
  const adjustBulkQty = (stockItemId: string, delta: number) => {
    const bulkMax = bulkMaxByItem.get(stockItemId) ?? 0;
    setCartBulkLines((prev) => {
      const matches = Array.from(prev.entries()).filter(([, l]) => l.stockItemId === stockItemId);
      if (matches.length > 1) return prev;
      const next = new Map(prev);
      if (matches.length === 1) {
        const [lineId, line] = matches[0];
        const max = bulkMax + line.quantity;
        const newQty = Math.max(0, Math.min(max, line.quantity + delta));
        if (newQty === 0) next.delete(lineId);
        else next.set(lineId, { ...line, quantity: newQty });
      } else if (delta > 0) {
        const lineId = crypto.randomUUID();
        next.set(lineId, { lineId, stockItemId, quantity: 1, position: resolvePosition(stockItemId) });
      }
      return next;
    });
  };

  const onBulkLineQtyChange = (lineId: string, delta: number) => {
    setCartBulkLines((prev) => {
      const line = prev.get(lineId);
      if (!line) return prev;
      const bulkMax = bulkMaxByItem.get(line.stockItemId) ?? 0;
      const max = bulkMax + line.quantity;
      const newQty = Math.max(0, Math.min(max, line.quantity + delta));
      const next = new Map(prev);
      if (newQty === 0) next.delete(lineId);
      else next.set(lineId, { ...line, quantity: newQty });
      return next;
    });
  };

  const onBulkLineAdd = (stockItemId: string) => {
    setCartBulkLines((prev) => {
      const next = new Map(prev);
      const lineId = crypto.randomUUID();
      next.set(lineId, { lineId, stockItemId, quantity: 1, position: null });
      return next;
    });
  };

  const onBulkLineRemove = (lineId: string) =>
    setCartBulkLines((prev) => { const next = new Map(prev); next.delete(lineId); return next; });

  const onBulkLinePositionChange = (lineId: string, position: string | null) =>
    setCartBulkLines((prev) => {
      const line = prev.get(lineId);
      if (!line) return prev;
      const next = new Map(prev);
      next.set(lineId, { ...line, position });
      return next;
    });

  const onUnitPositionChange = (unitId: string, position: string | null) =>
    setCartUnits((prev) => {
      const line = prev.get(unitId);
      if (!line) return prev;
      const next = new Map(prev);
      next.set(unitId, { ...line, position });
      return next;
    });

  const onUnitRemove = (unitId: string) =>
    setCartUnits((prev) => { const next = new Map(prev); next.delete(unitId); return next; });

  const onGroupApplyPositionToUnits = (stockItemId: string, position: string | null) =>
    setCartUnits((prev) => {
      const next = new Map(prev);
      for (const [id, line] of Array.from(prev)) {
        if (line.stockItemId === stockItemId) next.set(id, { ...line, position });
      }
      return next;
    });

  const isLoading = stockLoading || assignedLoading || bulkLoading;

  const cartCount = cartUnits.size + Array.from(cartBulkLines.values()).reduce((s, l) => s + l.quantity, 0);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Save individual unit assignments
      await jobsApi.setUnits(jobId, Array.from(cartUnits.keys()));

      // Save bulk quantity assignments (always called — including when the cart has zero
      // bulk lines, so a fully-cleared bulk assignment actually clears job_stock server-side)
      const bulkItems = Array.from(cartBulkLines.values())
        .filter((l) => l.quantity > 0)
        .map((l) => ({ stockItemId: l.stockItemId, quantity: l.quantity, position: l.position }));
      await jobsApi.setJobStock(jobId, bulkItems);

      // Save per-unit zone (position) — must run after setUnits (replace-all)
      const unitPos = Array.from(cartUnits.values()).map((l) => ({ stockUnitId: l.unitId, position: l.position }));
      if (unitPos.length > 0) {
        await jobsApi.setPositions(jobId, { units: unitPos });
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
      <div className="w-full max-w-6xl bg-[#0f0f0f] border border-white/[0.08] rounded-2xl shadow-2xl animate-modal-up flex flex-col max-h-[90vh]">

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

        {/* Two-pane body: catalog (left) + persistent cart (right) */}
        <div className="flex-1 min-h-0 flex flex-row">
          <ManageJobStockCatalogPane
            stockGroups={stockGroups}
            isLoading={isLoading}
            search={search}
            onSearchChange={setSearch}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            expanded={expanded}
            onToggleGroupExpand={toggleGroupExpand}
            cartUnits={cartUnits}
            cartBulkLines={cartBulkLines}
            onToggleUnit={toggleUnit}
            onToggleSelectAll={toggleSelectAll}
            onAdjustBulkQty={adjustBulkQty}
            zones={zones}
            activeZone={activeZone}
            onActiveZoneChange={setActiveZone}
            onCreateZone={onCreateZone}
            creatingZone={createZoneMutation.isPending}
          />
          <ManageJobStockCartPane
            stockGroups={stockGroups}
            zones={zones}
            cartUnits={cartUnits}
            cartBulkLines={cartBulkLines}
            onUnitPositionChange={onUnitPositionChange}
            onUnitRemove={onUnitRemove}
            onGroupApplyPositionToUnits={onGroupApplyPositionToUnits}
            onBulkLineQtyChange={onBulkLineQtyChange}
            onBulkLinePositionChange={onBulkLinePositionChange}
            onBulkLineRemove={onBulkLineRemove}
            onBulkLineAdd={onBulkLineAdd}
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
            {saving ? tc("saving") : cartCount > 0 ? t("manageContainerUnits.saveWithCount", { count: cartCount }) : tc("save")}
          </button>
        </div>
      </div>
    </div>
  );
};
