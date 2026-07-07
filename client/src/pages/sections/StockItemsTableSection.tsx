import React, { useState, useMemo } from "react";
import { ChevronRightIcon, Pencil, Trash2, Eye, Package, Loader2, Boxes, Check, X as XIcon, Layers } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAppStore } from "@/store/appStore";
import { stockApi } from "@/api";
import type { StockUnitWithPlan } from "@/api";
import type { StockItem, StockUnit } from "@shared/schema";

type StockItemWithCount = StockItem & { unitCount: number; availableCount: number; plannedCount?: number };

const AvailabilityBadge = ({ available, total, planned }: { available: number; total: number; planned?: number }) => {
  const { t } = useTranslation("stock");
  const free          = available - (planned ?? 0);
  const allFree       = free === total && total > 0;
  const noneFree      = free === 0 && available === 0;
  const hasPlanned    = (planned ?? 0) > 0;

  const color = allFree && !hasPlanned
    ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/40"
    : noneFree
    ? "bg-red-950/60 text-red-400 border-red-800/40"
    : "bg-amber-950/60 text-amber-400 border-amber-800/40";

  const dot = allFree && !hasPlanned ? "bg-emerald-400" : noneFree ? "bg-red-400" : "bg-amber-400";

  const label = allFree && !hasPlanned
    ? t("allAvailable")
    : noneFree
    ? t("unavailable")
    : t("availableOfTotal", { available: free, total });

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap ${color}`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
        {label}
      </span>
      {hasPlanned && (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold border bg-blue-950/50 text-blue-300 border-blue-800/40 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
          {planned} จัดเตรียม
        </span>
      )}
    </div>
  );
};

const ActionIcons = ({ onView, onEdit, onDelete }: { onView?: () => void; onEdit?: () => void; onDelete?: () => void }) => {
  const { t } = useTranslation("stock");
  const { t: tc } = useTranslation("common");
  return (
    <div className="flex items-center gap-1">
      <button onClick={(e) => { e.stopPropagation(); onView?.(); }}
        className="p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors" title={t("viewDetails")}>
        <Eye className="w-4 h-4" />
      </button>
      <button onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
        className="p-1.5 rounded-md text-white hover:text-[#FFFF00] hover:bg-white/10 transition-colors" title={tc("edit")}
      >
        <Pencil className="w-4 h-4" />
      </button>
      {onDelete && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 rounded-md text-white/60 hover:text-red-400 hover:bg-red-400/10 transition-colors" title={tc("delete")}>
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

const toInputDate = (d: string | Date | null | undefined) => {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  return dt.toISOString().split("T")[0];
};

const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const UnitRows = ({ itemId }: { itemId: string }) => {
  const { t } = useTranslation("stock");
  const { t: tc } = useTranslation("common");
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["stock", itemId],
    queryFn: () => stockApi.getById(itemId),
  });

  const updateUnit = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, any> }) =>
      stockApi.updateUnit(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock", itemId] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      setSaveError(null);
      setEditingId(null);
    },
    onError: (err: any) => {
      const msg = err?.message ?? "เกิดข้อผิดพลาด";
      setSaveError(msg);
      toast({ title: "ไม่สามารถบันทึกได้", description: msg, variant: "destructive" });
    },
  });

  const startEdit = (unit: StockUnit) => {
    setEditingId(unit.id);
    setForm({
      name:              unit.name,
      serialNumber:      unit.serialNumber ?? "",
      barcode:           unit.barcode ?? "",
      location:          unit.location ?? "",
      status:            unit.status,
      purchasedAt:       toInputDate((unit as any).purchasedAt),
      warrantyExpiresAt: toInputDate((unit as any).warrantyExpiresAt),
    });
  };

  const saveEdit = (unitId: string) => {
    const toDate = (v: string) => (v ? new Date(v).toISOString() : null);
    updateUnit.mutate({
      id: unitId,
      payload: {
        name:              form.name,
        serialNumber:      form.serialNumber || null,
        barcode:           form.barcode || null,
        location:          form.location || null,
        status:            form.status,
        purchasedAt:       toDate(form.purchasedAt),
        warrantyExpiresAt: toDate(form.warrantyExpiresAt),
      },
    });
  };

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  if (isLoading) {
    return (
      <TableRow className="bg-[#0e0e0e] hover:bg-[#0e0e0e]">
        <TableCell colSpan={6} className="py-3 pl-16">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-white/60" />
        </TableCell>
      </TableRow>
    );
  }

  const units: StockUnitWithPlan[] = (data?.units ?? []) as StockUnitWithPlan[];

  if (units.length === 0) {
    return (
      <TableRow className="bg-[#0e0e0e] hover:bg-[#0e0e0e]">
        <TableCell colSpan={6} className="py-2.5 pl-16 text-xs text-white/60 italic">
          {t("noUnitsRow")}
        </TableCell>
      </TableRow>
    );
  }

  const inputCls = "h-7 w-full bg-black/50 border border-white/10 rounded px-2 text-xs text-white focus:outline-none focus:border-[#FFFF00]/40 transition-colors";

  return (
    <>
      {/* Sub-header */}
      <TableRow className="bg-[#0b0b0b] hover:bg-[#0b0b0b] border-b-0">
        <TableCell colSpan={6} className="py-1.5 pl-16 pr-4">
          <div className="grid gap-x-3 text-[10px] font-bold text-white/60 uppercase tracking-wider pr-[34px]"
            style={{ gridTemplateColumns: "2fr 1.1fr 1.1fr 1fr 1.1fr 1.1fr 1fr" }}>
            <span>{t("colUnitName")}</span>
            <span>{t("colSerialNo")}</span>
            <span>{tc("barcode")}</span>
            <span>{tc("location")}</span>
            <span>{t("colPurchased")}</span>
            <span>{t("colWarrantyExp")}</span>
            <span>{tc("status")}</span>
          </div>
        </TableCell>
      </TableRow>

      {units.map((unit, i) => {
        const isEditing = editingId === unit.id;
        const wExp      = (unit as any).warrantyExpiresAt as string | null | undefined;
        const wDate     = wExp ? new Date(wExp) : null;
        const expired   = wDate ? wDate.getTime() < Date.now() : false;
        const soon      = wDate ? (!expired && wDate.getTime() - Date.now() < 90 * 864e5) : false;

        return (
          <TableRow
            key={unit.id}
            className={`border-b border-white/[0.03] transition-colors ${
              isEditing ? "bg-[#161616]" : "bg-[#0f0f0f] hover:bg-[#141414]"
            }`}
            style={{ animationDelay: `${i * 20}ms` }}
          >
            <TableCell colSpan={6} className="py-2 pl-16 pr-4">
              {isEditing ? (
                /* ── Edit mode ── */
                <div className="flex flex-col gap-2">
                  <div className="grid gap-x-3 items-center"
                    style={{ gridTemplateColumns: "2fr 1.1fr 1.1fr 1fr 1.1fr 1.1fr 1fr" }}>
                    <input className={inputCls} value={form.name}              onChange={f("name")}              placeholder={t("unitNamePlaceholder")} />
                    <input className={`${inputCls} font-mono`} value={form.serialNumber}   onChange={f("serialNumber")}   placeholder={t("serialNoPlaceholder")} />
                    <input className={`${inputCls} font-mono`} value={form.barcode}        onChange={f("barcode")}        placeholder={tc("barcode")} />
                    <input className={inputCls} value={form.location}          onChange={f("location")}          placeholder={tc("location")} />
                    <input type="date" className={`${inputCls} [color-scheme:dark]`} value={form.purchasedAt}  onChange={f("purchasedAt")} />
                    <input type="date" className={`${inputCls} [color-scheme:dark]`} value={form.warrantyExpiresAt} onChange={f("warrantyExpiresAt")} />
                    <select className={`${inputCls} appearance-none cursor-pointer`} value={form.status} onChange={f("status")}>
                      <option value="available"   className="bg-[#111]">{tc("statusEnum.available")}</option>
                      <option value="out"         className="bg-[#111]">{tc("statusEnum.out")}</option>
                      <option value="maintenance" className="bg-[#111]">{tc("statusEnum.maintenance")}</option>
                      <option value="retired"     className="bg-[#111]">{tc("statusEnum.retired")}</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 justify-end flex-wrap">
                    {saveError && (
                      <span className="text-[11px] text-red-400 flex-1 min-w-0 truncate">{saveError}</span>
                    )}
                    <button onClick={() => { setEditingId(null); setSaveError(null); }}
                      className="h-7 px-3 rounded text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition-colors">
                      {tc("cancel")}
                    </button>
                    <button
                      onClick={() => { setSaveError(null); saveEdit(unit.id); }}
                      disabled={updateUnit.isPending}
                      className="h-7 px-3 rounded text-xs font-bold text-black flex items-center gap-1.5 disabled:opacity-50 transition-opacity hover:opacity-80"
                      style={{ backgroundColor: "#FFFF00" }}
                    >
                      {updateUnit.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      {tc("save")}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── View mode ── */
                <div className="flex items-center gap-2">
                  <div className="grid gap-x-3 items-center flex-1"
                    style={{ gridTemplateColumns: "2fr 1.1fr 1.1fr 1fr 1.1fr 1.1fr 1fr" }}>
                    <span className="text-white/85 text-sm font-medium truncate">{unit.name}</span>
                    <span className="text-white/50 font-mono text-xs truncate">{unit.serialNumber ?? "—"}</span>
                    <span className="text-white/50 font-mono text-xs truncate">{unit.barcode ?? "—"}</span>
                    <span className="text-white/50 text-xs truncate">{unit.location ?? "—"}</span>
                    <span className="text-white/60 text-xs">{fmtDate(wExp ? wExp : null) ? fmtDate((unit as any).purchasedAt) : <span className="text-white/60">—</span>}</span>
                    <span className={`text-xs ${expired ? "text-red-400 font-semibold" : soon ? "text-amber-400 font-semibold" : "text-white/60"}`}>
                      {wDate ? (
                        <>{fmtDate(wExp)}{expired && " ⚠"}{soon && " !"}</>
                      ) : <span className="text-white/60">—</span>}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold w-fit
                        ${unit.status === "available"  ? "bg-emerald-950/60 text-emerald-400" :
                          unit.status === "maintenance" ? "bg-amber-950/60 text-amber-400" :
                          unit.status === "out"         ? "bg-blue-950/60 text-blue-400" :
                          "bg-white/[0.06] text-white/60"}`}>
                        <span className={`w-1 h-1 rounded-full ${
                          unit.status === "available"  ? "bg-emerald-400" :
                          unit.status === "maintenance" ? "bg-amber-400" :
                          unit.status === "out"         ? "bg-blue-400" : "bg-white/30"}`} />
                        {tc(`statusEnum.${unit.status}`, { defaultValue: unit.status }).toUpperCase()}
                      </span>
                      {(unit as StockUnitWithPlan).plannedJob && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold w-fit bg-blue-950/50 text-blue-300 border border-blue-800/30 max-w-[140px]"
                          title={`จัดเตรียมสำหรับ: ${(unit as StockUnitWithPlan).plannedJob!.name}`}>
                          <span className="w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" />
                          <span className="truncate">{(unit as StockUnitWithPlan).plannedJob!.name}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Edit button */}
                  <button
                    onClick={() => startEdit(unit)}
                    className="flex-shrink-0 p-1.5 rounded text-white/60 hover:text-[#FFFF00] hover:bg-[#FFFF00]/10 transition-colors"
                    title={t("editUnit")}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {!isEditing && (
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-white/40 pl-0 flex-wrap">
                  <span>{t("addedOn", { date: fmtDate(unit.createdAt) ?? "—" })}</span>
                  {unit.containerName && (
                    <span className="inline-flex items-center gap-1 text-[#FFFF00]/40">
                      <Layers className="w-2.5 h-2.5" /> {t("inContainer", { name: unit.containerName })}
                    </span>
                  )}
                  {(unit as StockUnitWithPlan).plannedJob && (
                    <span className="inline-flex items-center gap-1 text-blue-400/60">
                      <span>→ งาน:</span>
                      <span className="font-medium text-blue-300/70">{(unit as StockUnitWithPlan).plannedJob!.name}</span>
                      {(unit as StockUnitWithPlan).plannedJob!.startDate && (
                        <span className="text-blue-400/40">({fmtDate((unit as StockUnitWithPlan).plannedJob!.startDate)})</span>
                      )}
                    </span>
                  )}
                </div>
              )}
            </TableCell>
          </TableRow>
        );
      })}
    </>
  );
};

interface StockItemsTableProps {
  selectedBrands?: string[];
  selectedCategories?: string[];
  selectedSubCategories?: string[];
  searchQuery?: string;
  onViewItem?: (item: StockItem) => void;
  onEditItem?: (item: StockItem) => void;
  selectedItemId?: string | null;
}

export const StockItemsTableSection = ({
  selectedBrands = [],
  selectedCategories = [],
  selectedSubCategories = [],
  searchQuery = "",
  onViewItem,
  onEditItem,
  selectedItemId,
}: StockItemsTableProps): JSX.Element => {
  const { t } = useTranslation("stock");
  const { t: tc } = useTranslation("common");
  const { token, userRole } = useAppStore();
  const qc = useQueryClient();
  const [expandedRows, setExpandedRows]           = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [deleteItemId, setDeleteItemId]           = useState<string | null>(null);
  const [deleteError, setDeleteError]             = useState<string | null>(null);

  const canManage = userRole === "admin" || userRole === "manager";

  const deleteMutation = useMutation({
    mutationFn: (id: string) => stockApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock"] });
      setDeleteItemId(null);
    },
    onError: (err: any) => {
      setDeleteError(err.message ?? "ไม่สามารถลบได้");
    },
  });

  const { data: stockItems = [], isLoading } = useQuery<StockItemWithCount[]>({
    queryKey: ["stock"],
    queryFn: stockApi.getAll as () => Promise<StockItemWithCount[]>,
    enabled: !!token,
  });

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const isFiltering = searchQuery || selectedBrands.length > 0 || selectedCategories.length > 0 || selectedSubCategories.length > 0;

  const filteredItems = useMemo(() =>
    stockItems
      .filter((item) => {
        const brandMatch       = selectedBrands.length === 0       || selectedBrands.includes(item.brand);
        const categoryMatch    = selectedCategories.length === 0    || selectedCategories.includes(item.category);
        const subCategoryMatch = selectedSubCategories.length === 0 || selectedSubCategories.includes(item.subCategory);
        const q = searchQuery.toLowerCase();
        const searchMatch =
          !q ||
          item.name.toLowerCase().includes(q) ||
          item.brand.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.subCategory.toLowerCase().includes(q);
        return brandMatch && categoryMatch && subCategoryMatch && searchMatch;
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
    [stockItems, selectedBrands, selectedCategories, selectedSubCategories, searchQuery]
  );

  // Group by category, sorted A→Z
  const grouped = useMemo(() => {
    const map = new Map<string, StockItemWithCount[]>();
    for (const item of filteredItems) {
      const cat = item.category || "Uncategorized";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredItems]);

  const totalItems = filteredItems.length;
  const totalUnits = filteredItems.reduce((s, i) => s + i.unitCount, 0);

  // When filtering/searching, treat all categories as expanded
  const isCategoryOpen = (cat: string) => isFiltering ? true : expandedCategories.has(cat);

  return (
    <section className="w-full bg-[#0f0f0f] rounded-xl border border-white/10 overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
        <Package className="w-5 h-5 text-[#FFFF00]" />
        <h2 className="font-bold text-[#FFFF00] text-base tracking-widest uppercase">{t("stockItems")}</h2>
        <div className="ml-auto flex items-center gap-3 text-xs text-white/60 font-medium">
          {isFiltering && <span className="text-[#FFFF00]/50">{t("filteredLabel")} ·</span>}
          <span>{t("categoryCount", { count: grouped.length })}</span>
          <span className="text-white/40">·</span>
          <span>{t("modelsCount", { count: totalItems })}</span>
          <span className="text-white/40">·</span>
          <span>{t("unitsCount", { count: totalUnits })}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table className="w-full table-fixed">
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[16%]" />
            <col className="w-[14%]" />
            <col className="w-[8%]" />
            <col className="w-[18%]" />
            <col className="w-[16%]" />
          </colgroup>

          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="py-3 pl-6 font-bold text-[#FFFF00] text-xs uppercase tracking-wider">{tc("name")}</TableHead>
              <TableHead className="py-3 font-bold text-[#FFFF00] text-xs uppercase tracking-wider">{tc("brand")}</TableHead>
              <TableHead className="py-3 font-bold text-[#FFFF00] text-xs uppercase tracking-wider">{t("colSubCategory")}</TableHead>
              <TableHead className="py-3 font-bold text-[#FFFF00] text-xs uppercase tracking-wider">{t("colQty")}</TableHead>
              <TableHead className="py-3 font-bold text-[#FFFF00] text-xs uppercase tracking-wider">{tc("status")}</TableHead>
              <TableHead className="py-3 pr-6 text-right font-bold text-[#FFFF00] text-xs uppercase tracking-wider">{tc("actions")}</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {/* ─── Skeleton ─── */}
            {isLoading && Array.from({ length: 4 }).map((_, ci) => (
              <React.Fragment key={`skg-${ci}`}>
                {/* category header skeleton */}
                <TableRow className="animate-pulse bg-[#141414] border-b border-white/[0.08]">
                  <TableCell colSpan={6} className="py-3 pl-4">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded bg-white/[0.08]" />
                      <div className="h-3.5 rounded bg-white/[0.08] w-32" />
                      <div className="h-5 rounded-full bg-white/[0.05] w-20 ml-2" />
                    </div>
                  </TableCell>
                </TableRow>
                {/* item skeletons inside */}
                {Array.from({ length: 3 }).map((_, ii) => (
                  <TableRow key={`ski-${ci}-${ii}`} className="animate-pulse bg-[#1a1a1a] border-b border-white/[0.05]">
                    <TableCell className="py-3 pl-10">
                      <div className="h-3 rounded bg-white/[0.06]" style={{ width: `${50 + (ii * 19) % 40}%` }} />
                    </TableCell>
                    <TableCell><div className="h-3 rounded bg-white/[0.04] w-20" /></TableCell>
                    <TableCell><div className="h-3 rounded bg-white/[0.04] w-16" /></TableCell>
                    <TableCell><div className="h-3 rounded bg-white/[0.04] w-6" /></TableCell>
                    <TableCell><div className="h-5 rounded-full bg-white/[0.04] w-24" /></TableCell>
                    <TableCell />
                  </TableRow>
                ))}
              </React.Fragment>
            ))}

            {/* ─── Empty state ─── */}
            {!isLoading && grouped.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Package className="w-8 h-8 text-white/40" />
                    <p className="text-white/60 text-sm">{t("noItemsMatchFilters")}</p>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* ─── Grouped rows ─── */}
            {!isLoading && grouped.map(([category, items]) => {
              const catOpen       = isCategoryOpen(category);
              const catTotalUnits = items.reduce((s: number, i: StockItemWithCount) => s + i.unitCount, 0);
              const catAvail      = items.reduce((s: number, i: StockItemWithCount) => s + i.availableCount, 0);
              const allAvail      = catAvail === catTotalUnits && catTotalUnits > 0;
              const noneAvail     = catAvail === 0;

              return (
                <React.Fragment key={category}>
                  {/* Category header */}
                  <TableRow
                    className="cursor-pointer bg-[#141414] hover:bg-[#1a1a1a] border-b border-white/[0.08] transition-colors select-none"
                    onClick={() => !isFiltering && toggleCategory(category)}
                  >
                    <TableCell colSpan={6} className="py-2.5 pl-4 pr-6">
                      <div className="flex items-center gap-2.5">
                        {!isFiltering && (
                          <ChevronRightIcon
                            className={`w-4 h-4 flex-shrink-0 text-[#FFFF00]/60 transition-transform duration-200 ${catOpen ? "rotate-90" : ""}`}
                          />
                        )}
                        <Boxes className="w-3.5 h-3.5 text-[#FFFF00]/40 flex-shrink-0" />
                        <span className="font-bold text-sm text-[#FFFF00]">{category}</span>
                        <span className="text-xs text-white/60 ml-1">
                          {t("modelsCount", { count: items.length })} · {t("unitsCount", { count: catTotalUnits })}
                        </span>
                        <span className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold
                          ${allAvail  ? "bg-emerald-950/40 text-emerald-500" :
                            noneAvail ? "bg-red-950/40 text-red-500" :
                            "bg-amber-950/40 text-amber-500"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${allAvail ? "bg-emerald-500" : noneAvail ? "bg-red-500" : "bg-amber-500"}`} />
                          {allAvail ? t("allAvailable") : noneAvail ? t("noneAvailable") : t("countAvailable", { count: catAvail })}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Item rows (shown when category is open) */}
                  {catOpen && items.map((item: StockItemWithCount) => {
                    const isBulk     = item.trackingMode === "bulk";
                    const isExpanded = !isBulk && expandedRows.has(item.id);
                    const isSelected = selectedItemId === item.id;
                    const totalForBadge = isBulk ? (item.quantity ?? 0) : item.unitCount;
                    return (
                      <React.Fragment key={item.id}>
                        <TableRow
                          className={`transition-colors border-b ${
                            isBulk ? "" : "cursor-pointer"
                          } ${
                            isSelected
                              ? "bg-[#FFFF00]/[0.05] border-l-2 border-l-[#FFFF00]/50 border-b-white/10"
                              : "bg-[#1a1a1a] hover:bg-[#242424] border-b-white/[0.05]"
                          }`}
                          onClick={isBulk ? undefined : () => toggleRow(item.id)}
                        >
                          <TableCell className="py-2.5 pl-10">
                            <div className="flex items-center gap-2">
                              {isBulk ? (
                                <Layers className="w-3.5 h-3.5 flex-shrink-0 text-amber-400/70" />
                              ) : (
                                <ChevronRightIcon
                                  className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${
                                    isExpanded ? "rotate-90 text-[#FFFF00]" : "text-white/60"
                                  }`}
                                />
                              )}
                              <span className={`font-medium text-sm truncate ${isSelected ? "text-[#FFFF00]" : "text-white/90"}`}>
                                {item.name}
                              </span>
                              {isBulk && (
                                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400 font-medium flex-shrink-0">
                                  BULK
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 text-white/60 text-sm truncate align-middle">
                            {item.brand}
                          </TableCell>
                          <TableCell className="py-2.5 text-white/60 text-sm truncate align-middle">
                            {item.subCategory || "—"}
                          </TableCell>
                          <TableCell className="py-2.5 text-sm align-middle">
                            <span className="font-bold text-white/80">{totalForBadge}</span>
                          </TableCell>
                          <TableCell className="py-2.5 align-middle">
                            <AvailabilityBadge available={item.availableCount} total={totalForBadge} planned={item.plannedCount} />
                          </TableCell>
                          <TableCell className="py-2.5 pr-6 text-right align-middle">
                            <ActionIcons
                              onView={() => onViewItem?.(item)}
                              onEdit={() => onEditItem?.(item)}
                              onDelete={canManage ? () => { setDeleteError(null); setDeleteItemId(item.id); } : undefined}
                            />
                          </TableCell>
                        </TableRow>
                        {isExpanded && <UnitRows key={`units-${item.id}`} itemId={item.id} />}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteItemId} onOpenChange={(open) => { if (!open) { setDeleteItemId(null); setDeleteError(null); } }}>
        <AlertDialogContent className="bg-[#0f0f0f] border border-white/[0.08]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">{tc("areYouSure")}</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              {t("deleteItemConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{deleteError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-white/60 hover:text-white bg-transparent">
              {tc("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (deleteItemId) deleteMutation.mutate(deleteItemId); }}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white border-0"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};
