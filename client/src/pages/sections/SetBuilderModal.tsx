import React, { useState, useEffect } from "react";
import { Boxes, Save, ChevronDown, ChevronUp } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { stockApi, equipmentSetsApi } from "@/api";
import type { StockItemWithUnits } from "@/api";
import type { StockUnit } from "@shared/schema";
import { FileUploadField } from "@/components/FileUploadField";
import { WorkspaceShell, WSButton } from "@/components/WorkspaceShell";
import {
  EquipmentCatalogPane, EquipmentCartPane,
  type PickerAutoMap, type PickerPinMap,
} from "./EquipmentPicker";

interface Props {
  setId?: string | null;   // มี → แก้ไข, ไม่มี → สร้างใหม่
  onClose: () => void;
}

export const SetBuilderModal = ({ setId, onClose }: Props): JSX.Element => {
  const { token, companyId } = useAppStore();
  const qc = useQueryClient();

  const [name, setName]               = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl]       = useState<string | null>(null);
  const [metaOpen, setMetaOpen]       = useState(false);
  const [autoQty, setAutoQty]         = useState<PickerAutoMap>(new Map());
  const [pinned, setPinned]           = useState<PickerPinMap>(new Map());
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const { data: stockGroups = [], isLoading: stockLoading } = useQuery<StockItemWithUnits[]>({
    queryKey: ["stock-with-units"],
    queryFn: stockApi.getAllWithUnits,
    enabled: !!token,
  });

  const { data: existing, isLoading: existingLoading } = useQuery({
    queryKey: ["equipment-sets", setId],
    queryFn: () => equipmentSetsApi.getById(setId!),
    enabled: !!token && !!setId,
  });

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setDescription(existing.description ?? "");
    setImageUrl(existing.imageUrl ?? null);
    if (existing.description || existing.imageUrl) setMetaOpen(true);
    const auto: PickerAutoMap = new Map();
    const pin: PickerPinMap = new Map();
    for (const it of existing.items) {
      if (it.unitId) pin.set(it.unitId, it.stockItemId);
      else auto.set(it.stockItemId, (auto.get(it.stockItemId) ?? 0) + it.quantity);
    }
    setAutoQty(auto);
    setPinned(pin);
  }, [existing]);

  const adjustAuto = (stockItemId: string, delta: number, max: number) =>
    setAutoQty((prev) => {
      const pinnedN = Array.from(pinned.values()).filter((sid) => sid === stockItemId).length;
      const cur = prev.get(stockItemId) ?? 0;
      const next = Math.max(0, Math.min(max - pinnedN, cur + delta));
      const m = new Map(prev);
      if (next === 0) m.delete(stockItemId); else m.set(stockItemId, next);
      return m;
    });

  const togglePin = (unitId: string, stockItemId: string) =>
    setPinned((prev) => { const m = new Map(prev); m.has(unitId) ? m.delete(unitId) : m.set(unitId, stockItemId); return m; });

  const toggleSelectAllUnits = (units: StockUnit[], stockItemId: string) => {
    const allSelected = units.length > 0 && units.every((u) => pinned.get(u.id) === stockItemId);
    setPinned((prev) => {
      const m = new Map(prev);
      if (allSelected) units.forEach((u) => m.delete(u.id));
      else             units.forEach((u) => m.set(u.id, stockItemId));
      return m;
    });
    // explicit per-unit selection replaces any legacy auto-pick quantity for this item
    setAutoQty((prev) => { if (!prev.has(stockItemId)) return prev; const m = new Map(prev); m.delete(stockItemId); return m; });
  };

  const clearItem = (stockItemId: string) => {
    setAutoQty((prev) => { const m = new Map(prev); m.delete(stockItemId); return m; });
    setPinned((prev) => {
      const m = new Map(prev);
      for (const [uid, sid] of Array.from(prev)) if (sid === stockItemId) m.delete(uid);
      return m;
    });
  };

  const totalPieces = Array.from(autoQty.values()).reduce((s, q) => s + q, 0) + pinned.size;

  const handleSave = async () => {
    if (!name.trim()) { setError("กรุณาระบุชื่อชุดอุปกรณ์"); return; }
    setSaving(true);
    setError(null);
    try {
      const items = [
        ...Array.from(autoQty.entries()).map(([stockItemId, quantity]) => ({ stockItemId, quantity })),
        ...Array.from(pinned.entries()).map(([unitId, stockItemId]) => ({ stockItemId, quantity: 1, unitId })),
      ];
      const payload = { name: name.trim(), description: description.trim() || null, imageUrl, items };
      if (setId) await equipmentSetsApi.update(setId, payload);
      else await equipmentSetsApi.create(payload);
      qc.invalidateQueries({ queryKey: ["equipment-sets"] });
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "บันทึกไม่สำเร็จ");
      setSaving(false);
    }
  };

  const isLoading = stockLoading || (!!setId && existingLoading);

  return (
    <WorkspaceShell
      icon={<Boxes className="w-4 h-4 text-black" />}
      title={setId ? "แก้ไขชุดอุปกรณ์" : "สร้างชุดอุปกรณ์"}
      onClose={onClose}
      footer={
        <>
          <div className="text-xs text-red-400">{error}</div>
          <div className="flex items-center gap-2">
            <WSButton variant="ghost" onClick={onClose}>ยกเลิก</WSButton>
            <WSButton variant="primary" onClick={handleSave} disabled={saving} pending={saving} icon={<Save className="w-4 h-4" />}>
              {saving ? "กำลังบันทึก…" : totalPieces > 0 ? `บันทึกชุด (${totalPieces})` : "บันทึกชุด"}
            </WSButton>
          </div>
        </>
      }
    >
        {/* Meta: name always visible (compact); note/image tucked behind a toggle */}
        <div className="px-6 py-2.5 border-b border-fg/[0.06] flex-shrink-0 flex items-center gap-2.5">
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="ชื่อชุด * เช่น ชุดกลอง Yamaha BG2"
            className="flex-1 h-9 px-3 rounded-lg bg-fg/[0.04] border border-fg/10 text-sm text-fg placeholder:text-fg/30 focus:outline-none focus:border-brand/50" />
          <button
            type="button"
            onClick={() => setMetaOpen((v) => !v)}
            className={`h-9 px-3 rounded-lg text-xs font-medium border flex items-center gap-1.5 flex-shrink-0 transition-colors
              ${metaOpen ? "bg-fg/[0.06] border-fg/20 text-fg" : "border-fg/10 text-fg/50 hover:border-fg/30 hover:text-fg/80"}`}
          >
            {(description || imageUrl) && <span className="w-1.5 h-1.5 rounded-full bg-brand" />}
            หมายเหตุ / รูปชุด
            {metaOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {metaOpen && (
          <div className="px-6 py-3 border-b border-fg/[0.06] flex-shrink-0 flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-fg/70 mb-1">หมายเหตุ</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="เช่น Chery Wood Lacquer (CWL)"
                className="w-full h-9 px-3 rounded-lg bg-fg/[0.04] border border-fg/10 text-sm text-fg placeholder:text-fg/30 focus:outline-none focus:border-brand/50" />
            </div>
            <div className="w-full md:w-56 flex-shrink-0">
              <FileUploadField label="รูปชุด" folder="sets" companyId={companyId ?? ""}
                value={imageUrl} onChange={setImageUrl} />
            </div>
          </div>
        )}

        {/* Two-pane: catalog (left) + selected cart (right) */}
        <div className="flex-1 min-h-0 flex flex-row">
          <EquipmentCatalogPane
            stockGroups={stockGroups}
            isLoading={isLoading}
            autoQty={autoQty}
            pinned={pinned}
            onAdjustAuto={adjustAuto}
            onTogglePin={togglePin}
            onToggleSelectAll={toggleSelectAllUnits}
          />
          <EquipmentCartPane
            stockGroups={stockGroups}
            autoQty={autoQty}
            pinned={pinned}
            onAdjustAuto={adjustAuto}
            onTogglePin={togglePin}
            onClearItem={clearItem}
          />
        </div>
    </WorkspaceShell>
  );
};
