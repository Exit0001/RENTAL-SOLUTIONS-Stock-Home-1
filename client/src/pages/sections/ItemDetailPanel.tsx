import React, { useState, useRef } from "react";
import {
  X, Package, MapPin, Hash, Barcode,
  Boxes, Info, DollarSign, Wrench, FileText, Loader2,
  ExternalLink, Calendar, Trash2, ImagePlus,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { stockApi } from "@/api";
import { uploadAttachment } from "@/components/FileUploadField";
import type { StockItemWithUnits, StockUnitWithPlan } from "@/api";
import type { StockItem } from "@shared/schema";
import { getSpecTemplates } from "./AddNewItemModal";
import { UnitDetailModal } from "./UnitDetailModal";
import { UnitScheduleGantt } from "./UnitScheduleGantt";

const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

// ────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────

const nil = (v: any) => v === null || v === undefined || v === "";

const Val = ({ value, mono = false }: { value: any; mono?: boolean }) => {
  const { t } = useTranslation("stock");
  return nil(value) ? (
    <span className="text-fg/60 italic text-[10px]">{t("notFilled")}</span>
  ) : (
    <span className={`text-fg/70 text-xs ${mono ? "font-mono" : ""}`}>{String(value)}</span>
  );
};

const Row = ({ label, value, mono }: { label: string; value: any; mono?: boolean }) => (
  <div className="flex items-start justify-between gap-3 py-1.5 border-b border-fg/[0.04] last:border-0">
    <span className="text-[10px] text-fg/60 flex-shrink-0 min-w-[90px]">{label}</span>
    <Val value={value} mono={mono} />
  </div>
);

const Section = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
  <div className="px-4 pt-3 pb-1">
    <div className="flex items-center gap-1.5 mb-2">
      <Icon className="w-3 h-3 text-brand/40" />
      <span className="text-[9px] font-bold text-brand/40 uppercase tracking-widest">{title}</span>
    </div>
    {children}
  </div>
);

const unitStatusColor: Record<string, { bg: string; text: string; dot: string }> = {
  available:   { bg: "bg-emerald-950/60", text: "text-emerald-400", dot: "bg-emerald-400" },
  out:         { bg: "bg-blue-950/60",    text: "text-blue-400",    dot: "bg-blue-400" },
  maintenance: { bg: "bg-amber-950/60",   text: "text-amber-400",   dot: "bg-amber-400" },
  retired:     { bg: "bg-fg/5",        text: "text-fg/60",    dot: "bg-fg/20" },
};

// ────────────────────────────────────────────────
// main component
// ────────────────────────────────────────────────

interface Props {
  item:    StockItem & { unitCount?: number };
  onClose: () => void;
}

export const ItemDetailPanel = ({ item, onClose }: Props): JSX.Element => {
  const { t } = useTranslation("stock");
  const { t: tc } = useTranslation("common");
  const { t: tm } = useTranslation("modals");
  const { token, userRole, companyId } = useAppStore();
  const qc = useQueryClient();
  const canManage = userRole === "admin" || userRole === "manager";
  const [activeTab, setActiveTab] = useState<"units" | "schedule" | "details">("units");
  const [selectedUnit, setSelectedUnit] = useState<StockUnitWithPlan | null>(null);

  // รูปสินค้า (ระดับรุ่น) — โชว์ในหน้านี้ + อัปโหลด/เปลี่ยน/ลบได้ (ผู้จัดการ)
  const [imageUrl, setImageUrl] = useState<string | null>(item.imageUrl ?? null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const saveImg = useMutation({
    mutationFn: (url: string | null) => stockApi.update(item.id, { imageUrl: url }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["stock"] }); qc.invalidateQueries({ queryKey: ["stock", item.id] }); },
  });
  const handleImgFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadingImg(true);
    try {
      const url = await uploadAttachment(file, "stock-items", companyId ?? "");
      setImageUrl(url);
      saveImg.mutate(url);
    } finally {
      setUploadingImg(false);
      if (imgInputRef.current) imgInputRef.current.value = "";
    }
  };
  const removeImg = () => { setImageUrl(null); saveImg.mutate(null); };

  // Fetch full item with units
  const { data, isLoading } = useQuery({
    queryKey: ["stock", item.id],
    queryFn:  () => stockApi.getById(item.id),
    enabled: !!token,
  });

  const units: StockUnitWithPlan[] = (data as StockItemWithUnits | undefined)?.units ?? [];

  const specTemplates = React.useMemo(() => getSpecTemplates(tm), [tm]);


  const availableCount   = units.filter((u) => u.status === "available").length;
  const outCount         = units.filter((u) => u.status === "out").length;
  const maintenanceCount = units.filter((u) => u.status === "maintenance").length;

  const fmtCost = (v: any) => {
    if (nil(v)) return null;
    return `฿${Number(v).toLocaleString()}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
    <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-surface-1 border border-fg/[0.08] rounded-2xl shadow-2xl overflow-hidden animate-modal-up">

      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-fg/[0.06] flex-shrink-0">
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2 mb-1">
            {item.imageUrl ? (
              <img src={item.imageUrl} alt="" className="w-8 h-8 rounded-md object-cover flex-shrink-0 border border-fg/10" />
            ) : (
              <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "var(--brand)" }}>
                <Package className="w-4 h-4 text-black" />
              </div>
            )}
            <h3 className="font-bold text-fg text-sm truncate">{item.name}</h3>
          </div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-fg/5 text-fg/60">{item.brand}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-fg/5 text-fg/60">{item.category}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-fg/5 text-fg/60">{item.subCategory}</span>
          </div>
        </div>
        <button onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-fg/60 hover:text-fg hover:bg-fg/[0.06] transition-colors flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* รูปสินค้า */}
      {(imageUrl || canManage) && (
        <div className="px-4 py-3 border-b border-fg/[0.06] flex-shrink-0">
          <input ref={imgInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => handleImgFile(e.target.files?.[0])} />
          {imageUrl ? (
            <div className="relative rounded-xl overflow-hidden border border-fg/10 bg-black/40">
              <img src={imageUrl} alt={item.name} className="w-full max-h-52 object-contain mx-auto" />
              {uploadingImg && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Loader2 className="w-5 h-5 animate-spin text-brand" />
                </div>
              )}
              {canManage && (
                <div className="absolute top-2 right-2 flex gap-1.5">
                  <button onClick={() => imgInputRef.current?.click()}
                    className="h-7 px-2.5 rounded-lg text-[11px] font-semibold bg-black/60 text-fg/80 hover:text-fg backdrop-blur-sm transition-colors">
                    {t("changePhoto", { defaultValue: "เปลี่ยนรูป" })}
                  </button>
                  <button onClick={removeImg}
                    className="w-7 h-7 rounded-lg flex items-center justify-center bg-black/60 text-fg/70 hover:text-red-400 backdrop-blur-sm transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ) : canManage ? (
            <button onClick={() => imgInputRef.current?.click()} disabled={uploadingImg}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border border-dashed border-fg/15 hover:border-brand/40 bg-fg/[0.02] hover:bg-fg/[0.04] text-fg/50 hover:text-brand text-xs font-medium transition-all disabled:cursor-wait">
              {uploadingImg ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
              {t("addProductPhoto", { defaultValue: "เพิ่มรูปสินค้า" })}
            </button>
          ) : null}
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-4 flex-shrink-0">
        <div className="px-2 py-2.5 flex flex-col items-center">
          <span className="text-base font-bold text-fg">{units.length}</span>
          <span className="text-[8px] text-fg/60 uppercase tracking-wider">{t("statTotal")}</span>
        </div>
        <div className="px-2 py-2.5 flex flex-col items-center">
          <span className="text-base font-bold text-emerald-400">{availableCount}</span>
          <span className="text-[8px] text-fg/60 uppercase tracking-wider">{t("statReady")}</span>
        </div>
        <div className="px-2 py-2.5 flex flex-col items-center">
          <span className="text-base font-bold text-blue-400">{outCount}</span>
          <span className="text-[8px] text-fg/60 uppercase tracking-wider">{t("statOut")}</span>
        </div>
        <div className="px-2 py-2.5 flex flex-col items-center">
          <span className="text-base font-bold text-amber-400">{maintenanceCount}</span>
          <span className="text-[8px] text-fg/60 uppercase tracking-wider">{t("statRepair")}</span>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-fg/[0.06] flex-shrink-0">
        {[
          { key: "units",       label: t("tabUnits"),       icon: Boxes },
          { key: "schedule",    label: t("tabSchedule"),    icon: Calendar },
          { key: "details",     label: t("tabDetails"),     icon: Info },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-[10px] font-medium border-b-2 transition-colors ${
              activeTab === tab.key ? "border-brand text-brand" : "border-transparent text-fg/60 hover:text-fg"
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
              <div className="flex items-center justify-center gap-2 py-10 text-fg/60">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">{t("loadingUnits")}</span>
              </div>
            ) : units.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-fg/40 gap-2">
                <Package className="w-8 h-8" />
                <p className="text-sm">{t("noUnitsYetPanel")}</p>
                <p className="text-[10px] text-center px-6">{t("useAddIndividualUnitHint")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3">
              {units.map((u, i) => {
                const sc = unitStatusColor[u.status] ?? unitStatusColor.available;
                return (
                  <div key={u.id}
                    onClick={() => setSelectedUnit(u)}
                    className="flex flex-col gap-1.5 px-4 py-3 rounded-xl border border-fg/[0.06] hover:bg-fg/[0.04] hover:border-brand/20 cursor-pointer transition-colors"
                    style={{ animationDelay: `${i * 30}ms` }}>

                    {/* Name + status */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-fg/85 font-medium truncate">{u.name}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border border-current/20 flex-shrink-0 ${sc.bg} ${sc.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {tc(`statusEnum.${u.status}`, { defaultValue: u.status }).toUpperCase()}
                      </span>
                    </div>

                    {/* Serial + Barcode */}
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-[10px] text-fg/60">
                        <Hash className="w-2.5 h-2.5 flex-shrink-0" />
                        {nil(u.serialNumber)
                          ? <span className="italic text-fg/60">{t("notFilled")}</span>
                          : <span className="font-mono text-fg/60">{u.serialNumber}</span>
                        }
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-fg/60">
                        <Barcode className="w-2.5 h-2.5 flex-shrink-0" />
                        {nil(u.barcode)
                          ? <span className="italic text-fg/60">{t("notFilled")}</span>
                          : <span className="font-mono text-fg/60">{u.barcode}</span>
                        }
                      </span>
                    </div>

                    {/* Location + Health */}
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-[10px] text-fg/60">
                        <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                        {nil(u.location)
                          ? <span className="italic text-fg/60">{t("notFilled")}</span>
                          : <span className="text-fg/55">{u.location}</span>
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

                    {/* Planned job (ถ้ามี) */}
                    {u.plannedJob && (
                      <div className="flex items-center gap-1 text-[10px] text-blue-400/70 flex-wrap">
                        <span>→ {t("plannedForJob")}:</span>
                        <span className="font-medium text-blue-300/80">{u.plannedJob.name}</span>
                        {u.plannedJob.startDate && (
                          <span className="text-blue-400/50">({fmtDate(u.plannedJob.startDate)})</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            )}
            {!isLoading && units.length > 0 && (
              <p className="text-[9px] text-fg/40 text-center py-2">{t("clickStatusBadgeHint")}</p>
            )}
          </div>
        )}

        {/* ── Schedule tab (ตารางการออกงาน) — Gantt แสดงต่อยูนิต ── */}
        {activeTab === "schedule" && (
          isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-fg/60">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">{t("loadingUnits")}</span>
            </div>
          ) : (
            <UnitScheduleGantt units={units} />
          )
        )}

        {/* ── Details tab ── */}
        {activeTab === "details" && (
          <div className="pb-4">

            <Section title={t("sectionGeneral")} icon={Info}>
              <Row label={t("manufacturer")} value={item.manufacturer} />
              <Row label={t("country")}      value={item.manufacturerCountry} />
              <Row label={tc("description")} value={item.description} />
            </Section>

            <div className="border-t border-fg/[0.04]" />

            <Section title={t("sectionPricing")} icon={DollarSign}>
              <Row label={t("purchaseCost")}      value={fmtCost(item.purchaseCost)} />
              <Row label={t("dailyRate")}         value={item.dailyRate ? `฿${Number(item.dailyRate).toLocaleString()}` : null} />
              <Row label={t("weeklyRate")}        value={item.weeklyRate ? `฿${Number(item.weeklyRate).toLocaleString()}` : null} />
              <Row label={t("replacementValue")}  value={fmtCost(item.replacementValue)} />
              <Row label={t("securityDeposit")}   value={fmtCost(item.securityDeposit)} />
            </Section>

            <div className="border-t border-fg/[0.04]" />

            <Section title={t("sectionSpecs")} icon={Wrench}>
              <Row label={t("weightKg")}  value={item.weight ? `${item.weight} kg` : null} />
              <Row label={t("dimensions")} value={item.dimensions} />
              {(specTemplates[item.specs?.template ?? ""]?.fields ?? []).map((f) => (
                <Row key={f.key} label={f.label} value={item.specs?.fields?.[f.key]} />
              ))}
              {item.specs?.customFields?.map((f) => (
                <Row key={f.key} label={f.label} value={f.value} />
              ))}
              {(item.specs?.protocolTags?.length ?? 0) > 0 && (
                <div className="flex items-start justify-between gap-3 py-1.5">
                  <span className="text-[10px] text-fg/60 flex-shrink-0 min-w-[90px] pt-0.5">{tm("addNewItem.protocolTags")}</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {item.specs!.protocolTags!.map((tag) => (
                      <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-brand/10 text-brand/70">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </Section>

            <div className="border-t border-fg/[0.04]" />

            <Section title={t("sectionDocuments")} icon={FileText}>
              <Row label={t("supplierNameLabel")} value={item.supplierName} />
              <Row label={t("supportContact")}    value={item.supportContact} />

              {/* Document links */}
              {[
                { label: t("manualDoc"),  url: item.manualUrl },
                { label: t("certDoc"),    url: item.certUrl },
                { label: t("invoiceDoc"), url: item.invoiceUrl },
              ].map(({ label, url }) => (
                <div key={label} className="flex items-center justify-between gap-3 py-1.5 border-b border-fg/[0.04] last:border-0">
                  <span className="text-[10px] text-fg/60 min-w-[90px]">{label}</span>
                  {nil(url)
                    ? <span className="text-fg/40 italic text-[10px]">{t("notFilled")}</span>
                    : <a href={url!} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] text-brand/60 hover:text-brand transition-colors">
                        {t("openFile")} <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                  }
                </div>
              ))}
            </Section>

          </div>
        )}
      </div>
    </div>

    {selectedUnit && (
      <UnitDetailModal unit={selectedUnit} itemName={item.name} onClose={() => setSelectedUnit(null)} />
    )}
    </div>
  );
};
