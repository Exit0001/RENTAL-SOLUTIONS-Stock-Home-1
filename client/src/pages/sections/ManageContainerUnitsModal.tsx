import { useState, useEffect } from "react";
import { Layers, Save, Package } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { stockApi, containersApi } from "@/api";
import type { StockItemWithUnits, ContainerWithItems } from "@/api";
import type { StockUnit } from "@shared/schema";
import { WorkspaceShell, WSButton } from "@/components/WorkspaceShell";
import { ManageContainerUnitsCatalogPane } from "./ManageContainerUnitsCatalogPane";
import { ManageContainerUnitsCartPane } from "./ManageContainerUnitsCartPane";

interface Props {
  containers: ContainerWithItems[];
  initialContainerId?: string;
  onClose: () => void;
}

const setsEqual = (a: Set<string>, b: Set<string>) => {
  if (a.size !== b.size) return false;
  for (const x of Array.from(a)) if (!b.has(x)) return false;
  return true;
};

export const ManageContainerUnitsModal = ({ containers, initialContainerId, onClose }: Props): JSX.Element => {
  const { t } = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const { token } = useAppStore();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // เลือกแร็คที่กำลังจัด
  const [activeId, setActiveId] = useState<string>(initialContainerId ?? containers[0]?.id ?? "");

  // สถานะเริ่มต้น (แช่แข็ง) + สถานะที่แก้ไข — เก็บ selection ต่อแร็คในหน่วยความจำ สลับแร็คได้โดยไม่เสียของ
  const [initialByRack] = useState<Map<string, Set<string>>>(
    () => new Map(containers.map((c) => [c.id, new Set(c.items.map((u) => u.id))])),
  );
  const [selectionByRack, setSelectionByRack] = useState<Map<string, Set<string>>>(
    () => new Map(containers.map((c) => [c.id, new Set(c.items.map((u) => u.id))])),
  );

  const activeSet = selectionByRack.get(activeId) ?? new Set<string>();

  const { data: stockGroups = [], isLoading } = useQuery<StockItemWithUnits[]>({
    queryKey: ["stock-with-units"],
    queryFn: stockApi.getAllWithUnits,
    enabled: !!token,
  });

  // กางกลุ่มรุ่นที่มีของอยู่ในแร็คที่เลือกอยู่แล้ว (คำนวณใหม่ทุกครั้งที่สลับแร็ค)
  useEffect(() => {
    if (isLoading) return;
    const ids = selectionByRack.get(activeId) ?? new Set<string>();
    const toExpand = new Set<string>();
    if (ids.size > 0) for (const g of stockGroups) if (g.units.some((u) => ids.has(u.id))) toExpand.add(g.id);
    setExpanded(toExpand);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, stockGroups, isLoading]);

  const toggleUnit = (unitId: string) =>
    setSelectionByRack((prev) => {
      const next = new Map(prev);
      const cur = new Set(next.get(activeId) ?? []);
      if (cur.has(unitId)) {
        cur.delete(unitId);
      } else {
        cur.add(unitId);
        // 1 unit อยู่ได้แร็คเดียว — เอาออกจากแร็คอื่นในหน่วยความจำ (backend ก็ทำแบบนี้ตอน save)
        for (const [rid, set] of Array.from(next.entries())) {
          if (rid !== activeId && set.has(unitId)) {
            const s2 = new Set(set); s2.delete(unitId); next.set(rid, s2);
          }
        }
      }
      next.set(activeId, cur);
      return next;
    });

  const toggleGroupExpand = (groupId: string) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(groupId) ? n.delete(groupId) : n.add(groupId); return n; });

  const toggleSelectAll = (units: StockUnit[]) => {
    const allSelected = units.every((u) => activeSet.has(u.id));
    setSelectionByRack((prev) => {
      const next = new Map(prev);
      const cur = new Set(next.get(activeId) ?? []);
      if (allSelected) {
        units.forEach((u) => cur.delete(u.id));
      } else {
        units.forEach((u) => {
          cur.add(u.id);
          for (const [rid, set] of Array.from(next.entries())) {
            if (rid !== activeId && set.has(u.id)) { const s2 = new Set(set); s2.delete(u.id); next.set(rid, s2); }
          }
        });
      }
      next.set(activeId, cur);
      return next;
    });
  };

  // แร็คที่เปลี่ยนแปลง (เทียบกับสถานะเริ่มต้น)
  const changedRackIds = containers
    .map((c) => c.id)
    .filter((id) => !setsEqual(selectionByRack.get(id) ?? new Set(), initialByRack.get(id) ?? new Set()));

  const handleSave = async () => {
    if (changedRackIds.length === 0) { onClose(); return; }
    setSaving(true);
    setError(null);
    try {
      for (const id of changedRackIds) {
        await containersApi.setUnits(id, Array.from(selectionByRack.get(id) ?? []));
      }
      qc.invalidateQueries({ queryKey: ["containers"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      onClose();
    } catch (err: any) {
      setError(err.message ?? t("manageContainerUnits.errorSaveFailed"));
      setSaving(false);
    }
  };

  const activeContainer = containers.find((c) => c.id === activeId);

  return (
    <WorkspaceShell
      icon={<Layers className="w-4 h-4 text-black" />}
      title={t("manageContainerUnits.title", { defaultValue: "จัดของลงแร็ค" })}
      subtitle={activeContainer?.name}
      onClose={onClose}
      sidebarTitle={t("manageContainerUnits.rackListTitle", { defaultValue: "เลือกแร็ค / คอนเทนเนอร์" })}
      sidebar={
        <div className="p-3 flex flex-col gap-1.5">
          {containers.map((c) => {
            const count = (selectionByRack.get(c.id) ?? new Set()).size;
            const changed = changedRackIds.includes(c.id);
            const isActive = c.id === activeId;
            return (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors flex items-center gap-2.5
                  ${isActive ? "bg-[#FFFF00]/10 border-[#FFFF00]/40" : "bg-white/[0.02] border-white/[0.06] hover:border-white/20"}`}
              >
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? "bg-[#FFFF00]/20" : "bg-white/5"}`}>
                  <Layers className={`w-3.5 h-3.5 ${isActive ? "text-[#FFFF00]" : "text-white/50"}`} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${isActive ? "text-[#FFFF00]" : "text-white/85"}`}>{c.name}</p>
                  <p className="text-[10px] text-white/50 truncate">
                    {c.type ? `${c.type} · ` : ""}{t("manageContainerUnits.unitsCount", { count, defaultValue: `${count} ชิ้น` })}
                  </p>
                </div>
                {changed && <span className="w-1.5 h-1.5 rounded-full bg-[#FFFF00] flex-shrink-0" title="มีการแก้ไข" />}
              </button>
            );
          })}
          {containers.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-white/50">
              <Package className="w-7 h-7" />
              <p className="text-xs">ยังไม่มีแร็ค</p>
            </div>
          )}
        </div>
      }
      footer={
        <>
          <div className="flex items-center gap-3">
            <div className="text-sm text-white/70 font-medium">
              {activeContainer?.name} · {activeSet.size} ชิ้น
            </div>
            {changedRackIds.length > 0 && (
              <span className="text-[11px] text-[#FFFF00]/80">แก้ไข {changedRackIds.length} แร็ค</span>
            )}
            {error && <span className="text-xs text-red-400">{error}</span>}
          </div>
          <div className="flex items-center gap-2">
            <WSButton variant="ghost" onClick={onClose}>{tc("cancel")}</WSButton>
            <WSButton variant="primary" onClick={handleSave} disabled={saving} pending={saving} icon={<Save className="w-4 h-4" />}>
              {changedRackIds.length > 1 ? `บันทึกทั้งหมด (${changedRackIds.length})` : tc("save")}
            </WSButton>
          </div>
        </>
      }
    >
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
          selectedIds={activeSet}
          onToggleUnit={toggleUnit}
          onToggleSelectAll={toggleSelectAll}
        />
        <ManageContainerUnitsCartPane
          stockGroups={stockGroups}
          selectedIds={activeSet}
          onUnitRemove={toggleUnit}
        />
      </div>
    </WorkspaceShell>
  );
};
