import React, { useState } from "react";
import {
  X, Package, Pencil, MapPin, Hash, Barcode, Archive,
  Boxes, Info, DollarSign, Wrench, FileText, Loader2,
  ExternalLink, ShieldCheck, Calendar, Link2, Plus, Trash2, Search,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { stockApi } from "@/api";
import type { ItemAccessoryWithInfo } from "@/api";
import type { StockItem, StockUnit } from "@shared/schema";

// ────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────

const nil = (v: any) => v === null || v === undefined || v === "";

const Val = ({ value, mono = false }: { value: any; mono?: boolean }) => {
  const { t } = useTranslation("stock");
  return nil(value) ? (
    <span className="text-white/60 italic text-[10px]">{t("notFilled")}</span>
  ) : (
    <span className={`text-white/70 text-xs ${mono ? "font-mono" : ""}`}>{String(value)}</span>
  );
};

const Row = ({ label, value, mono }: { label: string; value: any; mono?: boolean }) => (
  <div className="flex items-start justify-between gap-3 py-1.5 border-b border-white/[0.04] last:border-0">
    <span className="text-[10px] text-white/60 flex-shrink-0 min-w-[90px]">{label}</span>
    <Val value={value} mono={mono} />
  </div>
);

const Section = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
  <div className="px-4 pt-3 pb-1">
    <div className="flex items-center gap-1.5 mb-2">
      <Icon className="w-3 h-3 text-[#FFFF00]/40" />
      <span className="text-[9px] font-bold text-[#FFFF00]/40 uppercase tracking-widest">{title}</span>
    </div>
    {children}
  </div>
);

const unitStatusColor: Record<string, { bg: string; text: string; dot: string }> = {
  available:   { bg: "bg-emerald-950/60", text: "text-emerald-400", dot: "bg-emerald-400" },
  out:         { bg: "bg-blue-950/60",    text: "text-blue-400",    dot: "bg-blue-400" },
  maintenance: { bg: "bg-amber-950/60",   text: "text-amber-400",   dot: "bg-amber-400" },
  retired:     { bg: "bg-white/5",        text: "text-white/60",    dot: "bg-white/20" },
};


// ────────────────────────────────────────────────
// main component
// ────────────────────────────────────────────────

interface Props {
  item:    StockItem & { unitCount?: number };
  onClose: () => void;
  onEdit:  () => void;
}

export const ItemDetailPanel = ({ item, onClose, onEdit }: Props): JSX.Element => {
  const { t } = useTranslation("stock");
  const { t: tc } = useTranslation("common");
  const { token, userRole } = useAppStore();
  const qc = useQueryClient();
  const canManage = userRole === "admin" || userRole === "manager";
  const [activeTab, setActiveTab] = useState<"units" | "accessories" | "details">("units");
  const [accSearch, setAccSearch] = useState("");

  // Fetch full item with units
  const { data, isLoading } = useQuery({
    queryKey: ["stock", item.id],
    queryFn:  () => stockApi.getById(item.id),
    enabled: !!token,
  });

  const units: StockUnit[] = (data as any)?.units ?? [];


  const { data: accessories = [], isLoading: accLoading } = useQuery<ItemAccessoryWithInfo[]>({
    queryKey: ["accessories", item.id],
    queryFn:  () => stockApi.getAccessories(item.id),
    enabled:  !!token && activeTab === "accessories",
  });

  const { data: allItems = [] } = useQuery<StockItem[]>({
    queryKey: ["stock"],
    queryFn:  stockApi.getAll,
    enabled:  !!token && activeTab === "accessories" && canManage,
  });

  const accSearchResults = React.useMemo(() => {
    if (!accSearch.trim()) return [];
    const q = accSearch.toLowerCase();
    const linkedIds = new Set(accessories.map((a) => a.accessoryStockItemId));
    return allItems
      .filter((si) => si.id !== item.id && !linkedIds.has(si.id) && si.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [accSearch, allItems, accessories, item.id]);

  const addAcc = useMutation({
    mutationFn: (d: { accessoryStockItemId: string; quantityPerUnit: number; required: boolean }) =>
      stockApi.addAccessory(item.id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accessories", item.id] });
      setAccSearch("");
    },
  });

  const removeAcc = useMutation({
    mutationFn: (linkId: string) => stockApi.removeAccessory(linkId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accessories", item.id] }),
  });

  const availableCount   = units.filter((u) => u.status === "available").length;
  const outCount         = units.filter((u) => u.status === "out").length;
  const maintenanceCount = units.filter((u) => u.status === "maintenance").length;

  const fmtCost = (v: any) => {
    if (nil(v)) return null;
    return `฿${Number(v).toLocaleString()}`;
  };

  return (
    <div className="flex flex-col h-full w-80 flex-shrink-0 bg-[#0d0d0d] border-l border-white/[0.06] overflow-hidden animate-slide-in-right">

      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FFFF00" }}>
              <Package className="w-3.5 h-3.5 text-black" />
            </div>
            <h3 className="font-bold text-white text-sm truncate">{item.name}</h3>
          </div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 text-white/60">{item.brand}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 text-white/60">{item.category}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 text-white/60">{item.subCategory}</span>
          </div>
        </div>
        <button onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 flex-shrink-0">
        <div className="px-2 py-2.5 flex flex-col items-center">
          <span className="text-base font-bold text-white">{units.length}</span>
          <span className="text-[8px] text-white/60 uppercase tracking-wider">{t("statTotal")}</span>
        </div>
        <div className="px-2 py-2.5 flex flex-col items-center">
          <span className="text-base font-bold text-emerald-400">{availableCount}</span>
          <span className="text-[8px] text-white/60 uppercase tracking-wider">{t("statReady")}</span>
        </div>
        <div className="px-2 py-2.5 flex flex-col items-center">
          <span className="text-base font-bold text-blue-400">{outCount}</span>
          <span className="text-[8px] text-white/60 uppercase tracking-wider">{t("statOut")}</span>
        </div>
        <div className="px-2 py-2.5 flex flex-col items-center">
          <span className="text-base font-bold text-amber-400">{maintenanceCount}</span>
          <span className="text-[8px] text-white/60 uppercase tracking-wider">{t("statRepair")}</span>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-white/[0.06] flex-shrink-0">
        {[
          { key: "units",       label: t("tabUnits"),       icon: Boxes },
          { key: "accessories", label: t("tabAccessories"), icon: Link2 },
          { key: "details",     label: t("tabDetails"),     icon: Info },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-[10px] font-medium border-b-2 transition-colors ${
              activeTab === tab.key ? "border-[#FFFF00] text-[#FFFF00]" : "border-transparent text-white/60 hover:text-white"
            }`}>
            <tab.icon className="w-3 h-3" />{tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Units tab ── */}
        {activeTab === "units" && (
          <div>
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-white/60">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">{t("loadingUnits")}</span>
              </div>
            ) : units.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-white/40 gap-2">
                <Package className="w-8 h-8" />
                <p className="text-sm">{t("noUnitsYetPanel")}</p>
                <p className="text-[10px] text-center px-6">{t("useAddIndividualUnitHint")}</p>
              </div>
            ) : (
              units.map((u, i) => {
                const sc = unitStatusColor[u.status] ?? unitStatusColor.available;
                return (
                  <div key={u.id}
                    className="flex flex-col gap-1.5 px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                    style={{ animationDelay: `${i * 30}ms` }}>

                    {/* Name + status */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-white/85 font-medium truncate">{u.name}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border border-current/20 flex-shrink-0 ${sc.bg} ${sc.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {tc(`statusEnum.${u.status}`, { defaultValue: u.status }).toUpperCase()}
                      </span>
                    </div>

                    {/* Serial + Barcode */}
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-[10px] text-white/60">
                        <Hash className="w-2.5 h-2.5 flex-shrink-0" />
                        {nil(u.serialNumber)
                          ? <span className="italic text-white/60">{t("notFilled")}</span>
                          : <span className="font-mono text-white/60">{u.serialNumber}</span>
                        }
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-white/60">
                        <Barcode className="w-2.5 h-2.5 flex-shrink-0" />
                        {nil(u.barcode)
                          ? <span className="italic text-white/60">{t("notFilled")}</span>
                          : <span className="font-mono text-white/60">{u.barcode}</span>
                        }
                      </span>
                    </div>

                    {/* Location + Health */}
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-[10px] text-white/60">
                        <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                        {nil(u.location)
                          ? <span className="italic text-white/60">{t("notFilled")}</span>
                          : <span className="text-white/55">{u.location}</span>
                        }
                      </span>
                      {u.healthScore != null && (
                        <span className={`text-[10px] font-semibold ${
                          u.healthScore >= 80 ? "text-emerald-400/70" :
                          u.healthScore >= 50 ? "text-amber-400/70" : "text-red-400/70"
                        }`}>
                          {u.healthScore}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {!isLoading && units.length > 0 && (
              <p className="text-[9px] text-white/40 text-center py-2">{t("clickStatusBadgeHint")}</p>
            )}
          </div>
        )}

        {/* ── Accessories tab ── */}
        {activeTab === "accessories" && (
          <div className="flex flex-col gap-3 p-4">

            {/* Search box — top */}
            {canManage && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/40" />
                  <input
                    value={accSearch}
                    onChange={(e) => setAccSearch(e.target.value)}
                    placeholder={t("searchAccessoryPlaceholder")}
                    className="w-full h-8 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FFFF00]/40"
                  />
                </div>
                {accSearchResults.map((si) => (
                  <div key={si.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-xs text-white/70 flex-1 truncate">{si.name}</p>
                    <button
                      onClick={() => addAcc.mutate({ accessoryStockItemId: si.id, quantityPerUnit: 1, required: true })}
                      disabled={addAcc.isPending}
                      className="flex items-center gap-1 h-6 px-2 rounded text-[10px] font-bold text-black disabled:opacity-40 transition-opacity hover:opacity-80 flex-shrink-0"
                      style={{ backgroundColor: "#FFFF00" }}
                    >
                      <Plus className="w-3 h-3" />{t("addAccessory")}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[10px] text-white/50 leading-relaxed">{t("accessoriesHint")}</p>

            {accLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-white/60">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : accessories.length === 0 ? (
              <div className="flex flex-col items-center py-6 gap-2 text-white/40">
                <Link2 className="w-6 h-6" />
                <p className="text-xs">{t("noAccessoriesYet")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {accessories.map((acc) => (
                  <div key={acc.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white/80 truncate">{acc.accessoryName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-white/50">×{acc.quantityPerUnit}</span>
                        <span className={`text-[9px] px-1 rounded font-bold ${acc.required ? "bg-amber-500/20 text-amber-400" : "bg-white/10 text-white/50"}`}>
                          {acc.required ? t("requiredLabel") : t("optionalLabel")}
                        </span>
                        <span className="text-[10px] text-emerald-400/70">{acc.availableCount} {t("availableCountLabel")}</span>
                      </div>
                    </div>
                    {canManage && (
                      <button onClick={() => removeAcc.mutate(acc.id)}
                        disabled={removeAcc.isPending}
                        className="p-1.5 rounded text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-colors flex-shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Details tab ── */}
        {activeTab === "details" && (
          <div className="pb-4">

            <Section title={t("sectionGeneral")} icon={Info}>
              <Row label={t("manufacturer")} value={item.manufacturer} />
              <Row label={t("country")}      value={item.manufacturerCountry} />
              <Row label={tc("description")} value={item.description} />
            </Section>

            <div className="border-t border-white/[0.04]" />

            <Section title={t("sectionPricing")} icon={DollarSign}>
              <Row label={t("purchaseCost")}      value={fmtCost(item.purchaseCost)} />
              <Row label={t("dailyRate")}         value={item.dailyRate ? `฿${Number(item.dailyRate).toLocaleString()}` : null} />
              <Row label={t("weeklyRate")}        value={item.weeklyRate ? `฿${Number(item.weeklyRate).toLocaleString()}` : null} />
              <Row label={t("replacementValue")}  value={fmtCost(item.replacementValue)} />
              <Row label={t("securityDeposit")}   value={fmtCost(item.securityDeposit)} />
            </Section>

            <div className="border-t border-white/[0.04]" />

            <Section title={t("sectionSpecs")} icon={Wrench}>
              <Row label={t("weightKg")}  value={item.weight ? `${item.weight} kg` : null} />
              <Row label={t("dimensions")} value={item.dimensions} />
              {item.specs?.fields && Object.entries(item.specs.fields).map(([k, v]) => (
                <Row key={k} label={k} value={v} />
              ))}
              {item.specs?.customFields?.map((f) => (
                <Row key={f.key} label={f.label} value={f.value} />
              ))}
            </Section>

            <div className="border-t border-white/[0.04]" />

            <Section title={t("sectionDocuments")} icon={FileText}>
              <Row label={t("supplierNameLabel")} value={item.supplierName} />
              <Row label={t("supportContact")}    value={item.supportContact} />

              {/* Document links */}
              {[
                { label: t("manualDoc"),  url: item.manualUrl },
                { label: t("certDoc"),    url: item.certUrl },
                { label: t("invoiceDoc"), url: item.invoiceUrl },
              ].map(({ label, url }) => (
                <div key={label} className="flex items-center justify-between gap-3 py-1.5 border-b border-white/[0.04] last:border-0">
                  <span className="text-[10px] text-white/60 min-w-[90px]">{label}</span>
                  {nil(url)
                    ? <span className="text-white/40 italic text-[10px]">{t("notFilled")}</span>
                    : <a href={url!} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] text-[#FFFF00]/60 hover:text-[#FFFF00] transition-colors">
                        {t("openFile")} <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                  }
                </div>
              ))}
            </Section>

          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex gap-2 px-4 py-3 border-t border-white/[0.06] flex-shrink-0">
        <button onClick={onEdit}
          className="flex-1 h-8 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 text-black transition-opacity hover:opacity-80"
          style={{ backgroundColor: "#FFFF00" }}>
          <Pencil className="w-3.5 h-3.5" /> {t("editItem")}
        </button>
        <button
          className="h-8 px-3 rounded-lg text-xs font-medium text-white/60 border border-white/10 hover:text-white hover:border-white/20 flex items-center gap-1.5 transition-colors">
          <Archive className="w-3.5 h-3.5" /> {t("archive")}
        </button>
      </div>
    </div>
  );
};
