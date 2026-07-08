import React from "react";
import { X, Hash, Barcode, MapPin, Layers, ShieldCheck, Wrench, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { maintenanceApi } from "@/api";
import type { StockUnitWithPlan } from "@/api";
import type { MaintenanceLog } from "@shared/schema";

const nil = (v: any) => v === null || v === undefined || v === "";

const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const unitStatusColor: Record<string, { bg: string; text: string; dot: string }> = {
  available:   { bg: "bg-emerald-950/60", text: "text-emerald-400", dot: "bg-emerald-400" },
  out:         { bg: "bg-blue-950/60",    text: "text-blue-400",    dot: "bg-blue-400" },
  maintenance: { bg: "bg-amber-950/60",   text: "text-amber-400",   dot: "bg-amber-400" },
  retired:     { bg: "bg-white/5",        text: "text-white/60",    dot: "bg-white/20" },
};

const maintenanceStatusColor: Record<string, { bg: string; text: string }> = {
  in_progress: { bg: "bg-amber-950/60",   text: "text-amber-400" },
  completed:   { bg: "bg-emerald-950/60", text: "text-emerald-400" },
};

const Row = ({ label, value, mono }: { label: string; value: any; mono?: boolean }) => {
  const { t } = useTranslation("stock");
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-white/[0.04] last:border-0">
      <span className="text-[10px] text-white/60 flex-shrink-0 min-w-[90px]">{label}</span>
      {nil(value)
        ? <span className="text-white/60 italic text-[10px]">{t("notFilled")}</span>
        : <span className={`text-white/70 text-xs ${mono ? "font-mono" : ""}`}>{String(value)}</span>
      }
    </div>
  );
};

interface Props {
  unit:     StockUnitWithPlan;
  itemName: string;
  onClose:  () => void;
}

export const UnitDetailModal = ({ unit, itemName, onClose }: Props): JSX.Element => {
  const { t }  = useTranslation("stock");
  const { t: tc } = useTranslation("common");
  const { token } = useAppStore();
  const sc = unitStatusColor[unit.status] ?? unitStatusColor.available;

  const { data: allLogs = [], isLoading: logsLoading } = useQuery<MaintenanceLog[]>({
    queryKey: ["maintenance"],
    queryFn:  maintenanceApi.getAll,
    enabled:  !!token,
  });
  const logs = allLogs
    .filter((l) => l.stockUnitId === unit.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const warrantyExp    = unit.warrantyExpiresAt ? new Date(unit.warrantyExpiresAt) : null;
  const warrantyExpired = warrantyExp ? warrantyExp.getTime() < Date.now() : false;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col bg-[#0d0d0d] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden animate-modal-up">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex-1 min-w-0 pr-2">
            <p className="text-[10px] text-white/40 truncate">{itemName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <h3 className="font-bold text-white text-sm truncate">{unit.name}</h3>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border border-current/20 flex-shrink-0 ${sc.bg} ${sc.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                {tc(`statusEnum.${unit.status}`, { defaultValue: unit.status }).toUpperCase()}
              </span>
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* General */}
          <div className="px-4 pt-3 pb-1">
            <div className="flex items-center gap-1.5 mb-2">
              <Hash className="w-3 h-3 text-[#FFFF00]/40" />
              <span className="text-[9px] font-bold text-[#FFFF00]/40 uppercase tracking-widest">{t("sectionGeneral")}</span>
            </div>
            <Row label={t("colSerial", { defaultValue: "Serial" })} value={unit.serialNumber} mono />
            <Row label={t("colBarcode", { defaultValue: "Barcode" })} value={unit.barcode} mono />
            <Row label={t("colLocation", { defaultValue: "Location" })} value={unit.location} />
            {unit.containerName && (
              <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/[0.04] last:border-0">
                <span className="text-[10px] text-white/60 flex-shrink-0 min-w-[90px]">{t("colContainer", { defaultValue: "Container" })}</span>
                <span className="flex items-center gap-1 text-xs text-white/70">
                  <Layers className="w-3 h-3 text-[#FFFF00]/50" />{unit.containerName}
                </span>
              </div>
            )}
            {unit.healthScore != null && (
              <div className="flex items-center justify-between gap-3 py-1.5">
                <span className="text-[10px] text-white/60 flex-shrink-0 min-w-[90px]">{t("healthScoreLabel", { defaultValue: "Health Score" })}</span>
                <span className={`text-xs font-semibold ${
                  unit.healthScore >= 80 ? "text-emerald-400/70" :
                  unit.healthScore >= 50 ? "text-amber-400/70" : "text-red-400/70"
                }`}>{unit.healthScore}%</span>
              </div>
            )}
          </div>

          <div className="border-t border-white/[0.04]" />

          {/* Purchase / Warranty */}
          <div className="px-4 pt-3 pb-1">
            <div className="flex items-center gap-1.5 mb-2">
              <ShieldCheck className="w-3 h-3 text-[#FFFF00]/40" />
              <span className="text-[9px] font-bold text-[#FFFF00]/40 uppercase tracking-widest">{t("purchaseWarrantyLabel", { defaultValue: "Purchase / Warranty" })}</span>
            </div>
            <Row label={t("purchasedOnLabel", { defaultValue: "Purchased" })} value={fmtDate((unit as any).purchasedAt)} />
            <div className="flex items-start justify-between gap-3 py-1.5">
              <span className="text-[10px] text-white/60 flex-shrink-0 min-w-[90px]">{t("warrantyExpLabel", { defaultValue: "Warranty Exp." })}</span>
              {fmtDate((unit as any).warrantyExpiresAt)
                ? <span className={`text-xs ${warrantyExpired ? "text-red-400 font-semibold" : "text-white/70"}`}>
                    {fmtDate((unit as any).warrantyExpiresAt)}{warrantyExpired && " ⚠"}
                  </span>
                : <span className="text-white/60 italic text-[10px]">{t("notFilled")}</span>
              }
            </div>
          </div>

          <div className="border-t border-white/[0.04]" />

          {/* Maintenance history */}
          <div className="px-4 pt-3 pb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Wrench className="w-3 h-3 text-[#FFFF00]/40" />
              <span className="text-[9px] font-bold text-[#FFFF00]/40 uppercase tracking-widest">{t("maintenanceHistoryLabel", { defaultValue: "Maintenance History" })}</span>
            </div>
            {logsLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-white/60">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : logs.length === 0 ? (
              <p className="text-[10px] text-white/40 italic py-1">{t("noMaintenanceHistory", { defaultValue: "No maintenance history yet" })}</p>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => {
                  const mc = maintenanceStatusColor[log.status] ?? maintenanceStatusColor.in_progress;
                  return (
                    <div key={log.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-[#FFFF00]/70 uppercase">{tc(`statusEnum.${log.type}`, { defaultValue: log.type })}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${mc.bg} ${mc.text}`}>
                            {tc(`statusEnum.${log.status}`, { defaultValue: log.status })}
                          </span>
                          <span className="text-[10px] text-white/50">{fmtDate(log.date)}</span>
                        </div>
                      </div>
                      <p className="text-xs text-white/70 mt-1">{log.description}</p>
                      {log.cost && (
                        <p className="text-[10px] text-white/40 mt-1">฿{Number(log.cost).toLocaleString()}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
