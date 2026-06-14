import { useState, useMemo } from "react";
import { X, Wrench, Search, Check, ChevronDown, ChevronRight, Boxes, Package, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { stockApi, jobsApi, type CrewMember, type StockItemWithUnits } from "@/api";
import { FileUploadField } from "@/components/FileUploadField";
import type { StockUnit, InsertMaintenanceLogBatch } from "@shared/schema";

const TYPES = ["repair", "preventive", "inspection"];
const STATUSES = ["in_progress", "completed"];

const statusDot: Record<string, string> = {
  available:   "bg-emerald-400",
  out:         "bg-blue-400",
  maintenance: "bg-amber-400",
  retired:     "bg-white/20",
};

const InputField = ({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[10px] text-white/60 uppercase tracking-wider font-medium">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-9 bg-black/40 border border-white/10 rounded-lg text-sm text-white px-3 placeholder:text-white/60 focus:outline-none focus:border-[#FFFF00]/40 transition-colors"
    />
  </div>
);

const SelectField = ({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) => {
  const { t: tc } = useTranslation("common");
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] text-white/60 uppercase tracking-wider font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 bg-black/40 border border-white/10 rounded-lg text-sm text-white px-3 focus:outline-none focus:border-[#FFFF00]/40 transition-colors appearance-none cursor-pointer"
      >
        <option value="" className="bg-[#111]">{tc("selectPlaceholder")}</option>
        {options.map((o) => <option key={o.value} value={o.value} className="bg-[#111]">{o.label}</option>)}
      </select>
    </div>
  );
};

interface AddMaintenanceLogModalProps {
  onClose: () => void;
  onSubmit: (data: InsertMaintenanceLogBatch) => void;
}

export const AddMaintenanceLogModal = ({ onClose, onSubmit }: AddMaintenanceLogModalProps): JSX.Element => {
  const { t } = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const { token, companyId } = useAppStore();

  const [search, setSearch] = useState("");
  const [selectedUnitIds, setSelectedUnitIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const [type, setType] = useState("repair");
  const [description, setDescription] = useState("");
  const [techId, setTechId] = useState("");
  const [cost, setCost] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("in_progress");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  const { data: stockGroups = [], isLoading: stockLoading } = useQuery<StockItemWithUnits[]>({
    queryKey: ["stock-with-units"],
    queryFn: stockApi.getAllWithUnits,
    enabled: !!token,
  });

  const { data: crewData } = useQuery({
    queryKey: ["crew"],
    queryFn: jobsApi.getCrew,
    enabled: !!token,
  });
  const crew: CrewMember[] = crewData?.crew ?? [];

  const toggleUnit = (unitId: string) =>
    setSelectedUnitIds((prev) => {
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
    const allSelected = units.every((u) => selectedUnitIds.has(u.id));
    setSelectedUnitIds((prev) => {
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

  const groupedByCategory = useMemo(() => {
    const map = new Map<string, StockItemWithUnits[]>();
    for (const g of filteredGroups) {
      const cat = g.category || "Uncategorized";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(g);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredGroups]);

  const handleSave = () => {
    if (!description.trim() || !date) return;
    onSubmit({
      stockUnitIds: Array.from(selectedUnitIds),
      type: type as InsertMaintenanceLogBatch["type"],
      description: description.trim(),
      techId: techId || null,
      status: status as InsertMaintenanceLogBatch["status"],
      cost: cost ? cost : null,
      receiptUrl,
      date: new Date(date),
    } as InsertMaintenanceLogBatch);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-2xl bg-[#0f0f0f] border border-white/[0.08] rounded-2xl shadow-2xl animate-modal-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#FFFF00" }}>
              <Wrench className="w-3.5 h-3.5 text-black" />
            </div>
            <h2 className="text-sm font-bold text-white">{t("addMaintenanceLog.title")}</h2>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Items to Repair — multi-select picker */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] text-white/60 uppercase tracking-wider font-medium">
              {t("addMaintenanceLog.itemsToRepair")}
            </label>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/60" />
              <input
                placeholder={t("manageContainerUnits.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-black/40 border border-white/10 text-sm text-white
                  placeholder-white/60 focus:outline-none focus:border-[#FFFF00]/40 transition-colors"
              />
            </div>

            <div className="flex items-center justify-between px-0.5">
              <span className="text-[10px] text-white/60">
                {selectedUnitIds.size > 0
                  ? t("manageContainerUnits.selectedCount", { count: selectedUnitIds.size })
                  : t("addMaintenanceLog.noItemsSelected")}
              </span>
              {selectedUnitIds.size > 0 && (
                <button
                  onClick={() => setSelectedUnitIds(new Set())}
                  className="text-[10px] text-white/60 hover:text-red-400 transition-colors"
                >
                  {tc("clearAll")}
                </button>
              )}
            </div>

            <div className="max-h-[260px] overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-2 space-y-1.5">
              {stockLoading && (
                <div className="flex items-center justify-center gap-2 py-8 text-white/60">
                  <Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">{tc("loading")}</span>
                </div>
              )}

              {!stockLoading && groupedByCategory.map(([category, groups]) => {
                const catOpen     = isFiltering ? true : expandedCategories.has(category);
                const catUnits    = groups.reduce((s, g) => s + g.units.length, 0);
                const catSelected = groups.reduce((s, g) => s + g.units.filter((u) => selectedUnitIds.has(u.id)).length, 0);

                return (
                  <div key={category}>
                    <div
                      className="flex items-center gap-2 px-1 py-1.5 cursor-pointer select-none"
                      onClick={() => toggleCategory(category)}
                    >
                      {isFiltering
                        ? <Boxes className="w-3.5 h-3.5 text-[#FFFF00]/40 flex-shrink-0" />
                        : catOpen
                          ? <ChevronDown className="w-3.5 h-3.5 text-[#FFFF00]/60 flex-shrink-0" />
                          : <ChevronRight className="w-3.5 h-3.5 text-white/60 flex-shrink-0" />
                      }
                      <span className="text-[11px] font-bold text-[#FFFF00] uppercase tracking-wider">{category}</span>
                      <span className="text-[10px] text-white/60">{t("manageContainerUnits.modelsUnitsCount", { models: groups.length, units: catUnits })}</span>
                      {catSelected > 0 && (
                        <span className="ml-auto text-[10px] font-bold text-[#FFFF00]/60 px-1.5 py-0.5 rounded bg-[#FFFF00]/10">
                          {t("manageContainerUnits.selectedBadge", { count: catSelected })}
                        </span>
                      )}
                    </div>

                    {catOpen && (
                      <div className="space-y-1.5">
                        {groups.map((group) => {
                          const isExpanded      = expanded.has(group.id);
                          const groupUnits      = group.units;
                          const selectedInGroup = groupUnits.filter((u) => selectedUnitIds.has(u.id)).length;
                          const allSelected     = groupUnits.length > 0 && groupUnits.every((u) => selectedUnitIds.has(u.id));

                          return (
                            <div key={group.id} className="rounded-lg border border-white/[0.06] overflow-hidden">
                              <div
                                className={`flex items-center gap-2.5 px-2.5 py-2 cursor-pointer transition-colors
                                  ${isExpanded ? "bg-white/[0.04]" : "bg-white/[0.02] hover:bg-white/[0.04]"}`}
                                onClick={() => toggleGroup(group.id)}
                              >
                                <div
                                  className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
                                    ${allSelected ? "border-[#FFFF00] bg-[#FFFF00]" :
                                      selectedInGroup > 0 ? "border-[#FFFF00]/60 bg-[#FFFF00]/20" :
                                      "border-white/20"}`}
                                  onClick={(e) => { e.stopPropagation(); if (groupUnits.length) toggleSelectAll(groupUnits); }}
                                >
                                  {allSelected && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
                                  {!allSelected && selectedInGroup > 0 && (
                                    <div className="w-1.5 h-0.5 bg-[#FFFF00] rounded-full" />
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-white/80 truncate">{group.name}</p>
                                  <p className="text-[10px] text-white/60">{t("manageContainerUnits.unitsCount", { count: groupUnits.length })}</p>
                                </div>

                                {selectedInGroup > 0 && (
                                  <span className="text-[10px] font-bold text-[#FFFF00]/60 px-1.5 py-0.5 rounded bg-[#FFFF00]/10">
                                    {selectedInGroup}/{groupUnits.length}
                                  </span>
                                )}

                                {isExpanded
                                  ? <ChevronDown className="w-3.5 h-3.5 text-white/60 flex-shrink-0" />
                                  : <ChevronRight className="w-3.5 h-3.5 text-white/60 flex-shrink-0" />
                                }
                              </div>

                              {isExpanded && groupUnits.map((unit) => {
                                const isSelected = selectedUnitIds.has(unit.id);
                                return (
                                  <div
                                    key={unit.id}
                                    onClick={() => toggleUnit(unit.id)}
                                    className={`flex items-center gap-2.5 pl-8 pr-2.5 py-1.5 cursor-pointer border-t border-white/[0.04] transition-colors
                                      ${isSelected ? "bg-[#FFFF00]/[0.04]" : "hover:bg-white/[0.02]"}`}
                                  >
                                    <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
                                      ${isSelected ? "border-[#FFFF00] bg-[#FFFF00]" : "border-white/20"}`}>
                                      {isSelected && <Check className="w-2 h-2 text-black" strokeWidth={3} />}
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

              {!stockLoading && filteredGroups.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <Package className="w-6 h-6 text-white/40" />
                  <p className="text-xs text-white/60">{t("manageContainerUnits.noItemsFound")}</p>
                </div>
              )}
            </div>

            <p className="text-[10px] text-white/40">{t("addMaintenanceLog.itemsToRepairHint")}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectField label={t("addMaintenanceLog.typeLabel")} value={type} onChange={setType}
              options={TYPES.map((ty) => ({ value: ty, label: tc(`statusEnum.${ty}`, { defaultValue: ty }) }))} />
            <SelectField label={tc("status")} value={status} onChange={setStatus}
              options={STATUSES.map((s) => ({ value: s, label: tc(`statusEnum.${s}`, { defaultValue: s }) }))} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-white/60 uppercase tracking-wider font-medium">{tc("description")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={t("addMaintenanceLog.descriptionPlaceholder")}
              className="w-full bg-black/40 border border-white/10 rounded-lg text-sm text-white px-3 py-2 placeholder:text-white/60 focus:outline-none focus:border-[#FFFF00]/40 transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectField label={t("addMaintenanceLog.technician")} value={techId} onChange={setTechId}
              options={crew.map((c) => ({ value: c.id, label: c.name }))} />
            <InputField label={t("addMaintenanceLog.costLabel")} type="number" value={cost} onChange={setCost} placeholder={t("addMaintenanceLog.costPlaceholder")} />
          </div>

          <InputField label={tc("date")} type="date" value={date} onChange={setDate} />

          {companyId && (
            <FileUploadField label={t("shared.receiptBill")} folder="maintenance" companyId={companyId}
              value={receiptUrl} onChange={setReceiptUrl} />
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 h-9 rounded-lg border border-white/10 text-sm text-white/60 hover:text-white hover:border-white/20 transition-colors">
            {tc("cancel")}
          </button>
          <button onClick={handleSave} disabled={!description.trim() || !date}
            className="flex-1 h-9 rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#FFFF00" }}>
            {t("addMaintenanceLog.saveLog")}
          </button>
        </div>
      </div>
    </div>
  );
};
