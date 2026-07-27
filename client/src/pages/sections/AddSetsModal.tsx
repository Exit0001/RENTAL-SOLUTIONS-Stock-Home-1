import { useState } from "react";
import { Boxes, Save, Plus, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
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

// สร้างชุดอุปกรณ์หลายชุดพร้อมกัน — แต่ละชุดเป็นแท็บ มีตัวเลือกอุปกรณ์ของตัวเอง บันทึกทีเดียว
// การแก้ไขชุดเดิมยังใช้ SetBuilderModal (ทีละชุด)

interface Draft {
  id: number;
  name: string;
  description: string;
  imageUrl: string | null;
  metaOpen: boolean;
  autoQty: PickerAutoMap;
  pinned: PickerPinMap;
}

const mkDraft = (id: number): Draft => ({
  id, name: "", description: "", imageUrl: null, metaOpen: false,
  autoQty: new Map(), pinned: new Map(),
});

const piecesOf = (d: Draft) => Array.from(d.autoQty.values()).reduce((s, q) => s + q, 0) + d.pinned.size;

interface Props {
  onClose: () => void;
}

export const AddSetsModal = ({ onClose }: Props): JSX.Element => {
  const { token, companyId } = useAppStore();
  const qc = useQueryClient();

  const [drafts, setDrafts] = useState<Draft[]>([mkDraft(1)]);
  const [activeId, setActiveId] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: stockGroups = [], isLoading } = useQuery<StockItemWithUnits[]>({
    queryKey: ["stock-with-units"],
    queryFn: stockApi.getAllWithUnits,
    enabled: !!token,
  });

  const active = drafts.find((d) => d.id === activeId) ?? drafts[0];
  const patchActive = (fn: (d: Draft) => Draft) => setDrafts((ds) => ds.map((d) => (d.id === active.id ? fn(d) : d)));

  const addDraft = () => {
    const id = Date.now();
    setDrafts((ds) => [...ds, mkDraft(id)]);
    setActiveId(id);
  };
  const removeDraft = (id: number) => {
    setDrafts((ds) => {
      if (ds.length <= 1) return ds;
      const next = ds.filter((d) => d.id !== id);
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  };

  // ── selection handlers (ทำงานกับแท็บที่เปิดอยู่) ────────
  const adjustAuto = (stockItemId: string, delta: number, max: number) =>
    patchActive((d) => {
      const pinnedN = Array.from(d.pinned.values()).filter((sid) => sid === stockItemId).length;
      const cur = d.autoQty.get(stockItemId) ?? 0;
      const next = Math.max(0, Math.min(max - pinnedN, cur + delta));
      const m = new Map(d.autoQty);
      if (next === 0) m.delete(stockItemId); else m.set(stockItemId, next);
      return { ...d, autoQty: m };
    });

  const togglePin = (unitId: string, stockItemId: string) =>
    patchActive((d) => {
      const m = new Map(d.pinned);
      m.has(unitId) ? m.delete(unitId) : m.set(unitId, stockItemId);
      return { ...d, pinned: m };
    });

  const toggleSelectAllUnits = (units: StockUnit[], stockItemId: string) =>
    patchActive((d) => {
      const allSelected = units.length > 0 && units.every((u) => d.pinned.get(u.id) === stockItemId);
      const pin = new Map(d.pinned);
      if (allSelected) units.forEach((u) => pin.delete(u.id));
      else units.forEach((u) => pin.set(u.id, stockItemId));
      const auto = new Map(d.autoQty);
      auto.delete(stockItemId);
      return { ...d, pinned: pin, autoQty: auto };
    });

  const clearItem = (stockItemId: string) =>
    patchActive((d) => {
      const auto = new Map(d.autoQty); auto.delete(stockItemId);
      const pin = new Map(d.pinned);
      for (const [uid, sid] of Array.from(d.pinned)) if (sid === stockItemId) pin.delete(uid);
      return { ...d, autoQty: auto, pinned: pin };
    });

  const validDrafts = drafts.filter((d) => d.name.trim());
  const totalPieces = validDrafts.reduce((s, d) => s + piecesOf(d), 0);
  const canSave = validDrafts.length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) {
      if (validDrafts.length === 0) setError("กรุณาตั้งชื่อชุดอย่างน้อย 1 ชุด");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const results = await Promise.allSettled(
        validDrafts.map((d) => {
          const items = [
            ...Array.from(d.autoQty.entries()).map(([stockItemId, quantity]) => ({ stockItemId, quantity })),
            ...Array.from(d.pinned.entries()).map(([unitId, stockItemId]) => ({ stockItemId, quantity: 1, unitId })),
          ];
          return equipmentSetsApi.create({ name: d.name.trim(), description: d.description.trim() || null, imageUrl: d.imageUrl, items });
        }),
      );
      qc.invalidateQueries({ queryKey: ["equipment-sets"] });
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        setError(`บันทึกไม่สำเร็จ ${failed} ชุด — ที่เหลือบันทึกแล้ว`);
        setSaving(false);
        return;
      }
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "บันทึกไม่สำเร็จ");
      setSaving(false);
    }
  };

  const tabs = drafts.map((d, i) => {
    const p = piecesOf(d);
    return {
      key: String(d.id),
      label: d.name.trim() || `ชุด ${i + 1}`,
      badge: p > 0 ? <span className={`text-[10px] ${d.id === active.id ? "text-black/60" : "text-fg/40"}`}>{p}</span> : undefined,
    };
  });

  return (
    <WorkspaceShell
      icon={<Boxes className="w-4 h-4 text-black" />}
      title="สร้างชุดอุปกรณ์"
      subtitle="สร้างหลายชุดพร้อมกัน — แต่ละแท็บคือ 1 ชุด"
      tabs={tabs}
      activeTab={String(active.id)}
      onTabChange={(k) => setActiveId(Number(k))}
      headerActions={
        <button
          onClick={addDraft}
          className="h-9 px-3 rounded-lg text-xs font-bold text-brand border border-brand/30 hover:bg-brand/10 flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />เพิ่มชุด
        </button>
      }
      onClose={onClose}
      footer={
        <>
          <div className="flex items-center gap-3">
            <div className="text-sm text-fg/70 font-medium">รวม {validDrafts.length} ชุด · {totalPieces} ชิ้น</div>
            {error && <span className="text-xs text-red-400">{error}</span>}
          </div>
          <div className="flex items-center gap-2">
            <WSButton variant="ghost" onClick={onClose}>ยกเลิก</WSButton>
            <WSButton variant="primary" onClick={handleSave} disabled={!canSave} pending={saving} icon={<Save className="w-4 h-4" />}>
              บันทึกทั้งหมด
            </WSButton>
          </div>
        </>
      }
    >
      {/* Meta ของแท็บที่เปิดอยู่ */}
      <div className="px-6 py-2.5 border-b border-fg/[0.06] flex-shrink-0 flex items-center gap-2.5">
        <input
          value={active.name}
          onChange={(e) => patchActive((d) => ({ ...d, name: e.target.value }))}
          placeholder="ชื่อชุด * เช่น ชุดกลอง Yamaha BG2"
          className="flex-1 h-9 px-3 rounded-lg bg-fg/[0.04] border border-fg/10 text-sm text-fg placeholder:text-fg/30 focus:outline-none focus:border-brand/50"
        />
        <button
          type="button"
          onClick={() => patchActive((d) => ({ ...d, metaOpen: !d.metaOpen }))}
          className={`h-9 px-3 rounded-lg text-xs font-medium border flex items-center gap-1.5 flex-shrink-0 transition-colors
            ${active.metaOpen ? "bg-fg/[0.06] border-fg/20 text-fg" : "border-fg/10 text-fg/50 hover:border-fg/30 hover:text-fg/80"}`}
        >
          {(active.description || active.imageUrl) && <span className="w-1.5 h-1.5 rounded-full bg-brand" />}
          หมายเหตุ / รูปชุด
          {active.metaOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {drafts.length > 1 && (
          <button
            type="button"
            onClick={() => removeDraft(active.id)}
            className="h-9 px-3 rounded-lg text-xs font-medium border border-fg/10 text-fg/50 hover:border-red-500/40 hover:text-red-400 flex items-center gap-1.5 flex-shrink-0 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />ลบชุดนี้
          </button>
        )}
      </div>

      {active.metaOpen && (
        <div className="px-6 py-3 border-b border-fg/[0.06] flex-shrink-0 flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-[11px] font-bold text-fg/70 mb-1">หมายเหตุ</label>
            <input
              value={active.description}
              onChange={(e) => patchActive((d) => ({ ...d, description: e.target.value }))}
              placeholder="เช่น Chery Wood Lacquer (CWL)"
              className="w-full h-9 px-3 rounded-lg bg-fg/[0.04] border border-fg/10 text-sm text-fg placeholder:text-fg/30 focus:outline-none focus:border-brand/50"
            />
          </div>
          <div className="w-full md:w-56 flex-shrink-0">
            <FileUploadField label="รูปชุด" folder="sets" companyId={companyId ?? ""}
              value={active.imageUrl} onChange={(v) => patchActive((d) => ({ ...d, imageUrl: v }))} />
          </div>
        </div>
      )}

      {/* Two-pane: catalog (ซ้าย) + cart (ขวา) ของแท็บที่เปิดอยู่ */}
      <div className="flex-1 min-h-0 flex flex-row">
        <EquipmentCatalogPane
          stockGroups={stockGroups}
          isLoading={isLoading}
          autoQty={active.autoQty}
          pinned={active.pinned}
          onAdjustAuto={adjustAuto}
          onTogglePin={togglePin}
          onToggleSelectAll={toggleSelectAllUnits}
        />
        <EquipmentCartPane
          stockGroups={stockGroups}
          autoQty={active.autoQty}
          pinned={active.pinned}
          onAdjustAuto={adjustAuto}
          onTogglePin={togglePin}
          onClearItem={clearItem}
        />
      </div>
    </WorkspaceShell>
  );
};
