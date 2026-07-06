import React, { useRef, useEffect, useState, useMemo } from "react";
import {
  X, ScanLine, CheckCircle2, AlertCircle, Package,
  LogIn, LogOut, Loader2, Check,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { stockApi, jobsApi } from "@/api";
import type { AssignedUnit } from "@/api";

interface ScanEntry {
  barcode:    string;
  unitId:     string | null;
  itemName:   string;
  unitName:   string;
  mode:       "checkout" | "return";
  success:    boolean;
  inManifest: boolean;
  error?:     string;
}

interface Props {
  jobName: string;
  jobId:   string;
  onClose: () => void;
}

export const ScanModal = ({ jobName, jobId, onClose }: Props): JSX.Element => {
  const { t }        = useTranslation("modals");
  const { t: tc }    = useTranslation("common");
  const { token }    = useAppStore();
  const qc           = useQueryClient();
  const inputRef     = useRef<HTMLInputElement>(null);
  const [mode, setMode]             = useState<"checkout" | "return">("checkout");
  const [value, setValue]           = useState("");
  const [scanning, setScanning]     = useState(false);
  const [entries, setEntries]       = useState<ScanEntry[]>([]);
  const [lastEntry, setLastEntry]   = useState<ScanEntry | null>(null);
  const [scannedIds, setScannedIds] = useState<Set<string>>(new Set());

  const { data: assignedUnits = [], isLoading } = useQuery<AssignedUnit[]>({
    queryKey: ["job-units", jobId],
    queryFn:  () => jobsApi.getUnits(jobId),
    enabled: !!token,
  });

  const grouped = useMemo(() => {
    const map: Record<string, AssignedUnit[]> = {};
    for (const u of assignedUnits) {
      const key = (u as any).itemName ?? t("scan.unknownItem");
      if (!map[key]) map[key] = [];
      map[key].push(u);
    }
    return Object.entries(map);
  }, [assignedUnits]);

  const barcodeToUnit = useMemo(() => {
    const m: Record<string, AssignedUnit> = {};
    for (const u of assignedUnits) {
      if (u.barcode) m[u.barcode] = u;
    }
    return m;
  }, [assignedUnits]);

  const scannedCount = scannedIds.size;
  const totalCount   = assignedUnits.length;

  useEffect(() => { inputRef.current?.focus(); }, [mode]);

  const handleScan = async (raw: string) => {
    const barcode = raw.trim();
    if (!barcode) return;
    setValue("");
    setScanning(true);
    try {
      const unit      = await stockApi.scanBarcode(barcode);
      const newStatus = mode === "checkout" ? "out" : "available";
      await stockApi.updateUnit(unit.id, { status: newStatus });

      // sync phase in job_units: checkout → dispatched, return → planned
      const newPhase = mode === "checkout" ? "dispatched" : "planned";
      await jobsApi.updatePhase(jobId, [unit.id], newPhase);
      qc.invalidateQueries({ queryKey: ["job-units", jobId] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["stock", unit.stockItemId] });

      const inManifest = !!barcodeToUnit[barcode];
      if (inManifest) {
        setScannedIds((prev) => {
          const next = new Set(prev);
          next.add(unit.id);
          return next;
        });
      }

      const entry: ScanEntry = { barcode, unitId: unit.id, itemName: unit.itemName, unitName: unit.name, mode, success: true, inManifest };
      setLastEntry(entry);
      setEntries((prev) => [entry, ...prev]);
    } catch (err: any) {
      const entry: ScanEntry = { barcode, unitId: null, itemName: "", unitName: "", mode, success: false, inManifest: false, error: err.message ?? t("scan.defaultScanError") };
      setLastEntry(entry);
      setEntries((prev) => [entry, ...prev]);
    } finally {
      setScanning(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleScan(value);
  };

  const modeCheckout = mode === "checkout";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.88)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-4xl bg-[#0f0f0f] border border-white/[0.08] rounded-2xl shadow-2xl animate-modal-up flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${modeCheckout ? "bg-blue-500/10" : "bg-emerald-500/10"}`}>
              <ScanLine className={`w-5 h-5 ${modeCheckout ? "text-blue-400" : "text-emerald-400"}`} />
            </div>
            <div>
              <h2 className="font-bold text-white text-sm">{t("scan.title")}</h2>
              <p className="text-[10px] text-white/60 truncate max-w-[220px]">{jobName}</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <span className="text-lg font-bold text-[#FFFF00]">{scannedCount}</span>
              <span className="text-sm text-white/60">/ {totalCount}</span>
              <span className="text-[10px] text-white/60 ml-0.5">{t("scan.scannedSuffix")}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — two columns */}
        <div className="flex flex-1 overflow-hidden">

          {/* LEFT: Manifest */}
          <div className="flex-1 border-r border-white/[0.06] flex flex-col overflow-hidden">
            <div className="px-5 py-2.5 border-b border-white/[0.04] flex items-center gap-2 flex-shrink-0">
              <Package className="w-3.5 h-3.5 text-[#FFFF00]/40" />
              <span className="text-[10px] font-bold text-[#FFFF00]/40 uppercase tracking-widest">{t("scan.manifest")}</span>
              <div className="ml-auto flex items-center gap-2">
                <div className="h-1.5 w-28 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                    style={{ width: totalCount > 0 ? `${Math.round((scannedCount / totalCount) * 100)}%` : "0%" }}
                  />
                </div>
                <span className="text-[10px] text-white/60">
                  {totalCount > 0 ? Math.round((scannedCount / totalCount) * 100) : 0}%
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {isLoading && (
                <div className="flex items-center gap-2 text-white/60 text-xs py-6">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("scan.loadingManifest")}
                </div>
              )}
              {!isLoading && assignedUnits.length === 0 && (
                <p className="text-xs text-white/60 italic py-6 text-center">{t("scan.noEquipmentAssigned")}</p>
              )}
              {!isLoading && grouped.map(([itemName, units]) => (
                <div key={itemName}>
                  <div className="flex items-center gap-2 mb-2 pb-1 border-b border-white/[0.05]">
                    <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider flex-1">{itemName}</p>
                    <span className="text-[9px] text-emerald-400/60">
                      {units.filter((u) => scannedIds.has(u.id)).length}/{units.length}
                    </span>
                  </div>
                  {units.map((u) => {
                    const ticked = scannedIds.has(u.id);
                    return (
                      <div
                        key={u.id}
                        className={`flex items-center gap-2.5 py-1.5 px-2 rounded-lg mb-0.5 transition-all duration-300 ${
                          ticked
                            ? "bg-emerald-500/[0.07] border border-emerald-500/[0.12]"
                            : "border border-transparent hover:bg-white/[0.02]"
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                          ticked ? "bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.35)]" : "border border-white/15"
                        }`}>
                          {ticked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs truncate transition-colors ${ticked ? "text-emerald-300/90" : "text-white/50"}`}>
                            {u.name}
                          </p>
                          {u.serialNumber && (
                            <p className="text-[10px] text-white/60 font-mono">{t("scan.serialPrefix")} {u.serialNumber}</p>
                          )}
                        </div>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                          ticked
                            ? modeCheckout
                              ? "bg-blue-400/15 text-blue-300"
                              : "bg-emerald-400/15 text-emerald-300"
                            : "bg-white/5 text-white/60"
                        }`}>
                          {ticked ? (modeCheckout ? t("scan.outBadge") : t("scan.inBadge")) : tc(`statusEnum.${u.status}`, { defaultValue: u.status })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: Scan panel */}
          <div className="w-[280px] flex-shrink-0 flex flex-col px-5 py-4 gap-4">

            {/* Mode Toggle */}
            <div className="flex rounded-xl overflow-hidden border border-white/[0.08] p-0.5 gap-0.5 bg-white/[0.02]">
              <button
                onClick={() => setMode("checkout")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  modeCheckout ? "bg-blue-500/20 text-blue-400" : "text-white/60 hover:text-white"
                }`}
              >
                <LogOut className="w-3.5 h-3.5" /> {t("scan.outButton")}
              </button>
              <button
                onClick={() => setMode("return")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  !modeCheckout ? "bg-emerald-500/20 text-emerald-400" : "text-white/60 hover:text-white"
                }`}
              >
                <LogIn className="w-3.5 h-3.5" /> {t("scan.returnButton")}
              </button>
            </div>

            {/* Scan Input */}
            <div>
              <div className={`relative rounded-xl border-2 transition-colors ${
                scanning ? "border-white/20" :
                modeCheckout ? "border-blue-500/40 bg-blue-500/[0.04]" :
                "border-emerald-500/40 bg-emerald-500/[0.04]"
              }`}>
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  {scanning
                    ? <Loader2 className="w-5 h-5 text-white/60 animate-spin" />
                    : <ScanLine className={`w-5 h-5 ${modeCheckout ? "text-blue-400/60" : "text-emerald-400/60"}`} />
                  }
                </div>
                <input
                  ref={inputRef}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={scanning}
                  placeholder={t("scan.scanPlaceholder")}
                  className="w-full h-12 pl-12 pr-4 bg-transparent text-sm text-white placeholder-white/20
                    focus:outline-none font-mono tracking-wider"
                />
              </div>
              <p className="text-[9px] text-white/40 mt-1.5 text-center">{t("scan.hidModeHint")}</p>
            </div>

            {/* Last result */}
            {lastEntry && (
              <div className={`rounded-xl p-3 border ${
                lastEntry.success
                  ? lastEntry.mode === "checkout"
                    ? "bg-blue-500/[0.07] border-blue-500/20"
                    : "bg-emerald-500/[0.07] border-emerald-500/20"
                  : "bg-red-500/[0.07] border-red-500/20"
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  {lastEntry.success
                    ? <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${lastEntry.mode === "checkout" ? "text-blue-400" : "text-emerald-400"}`} />
                    : <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                  }
                  <span className={`text-xs font-bold ${
                    !lastEntry.success ? "text-red-300" :
                    lastEntry.mode === "checkout" ? "text-blue-300" : "text-emerald-300"
                  }`}>
                    {!lastEntry.success ? t("scan.notFound") : lastEntry.mode === "checkout" ? t("scan.checkedOut") : t("scan.returned")}
                  </span>
                </div>
                {lastEntry.success ? (
                  <>
                    <p className="text-xs text-white/60 truncate">{lastEntry.itemName}</p>
                    <p className="text-[10px] text-white/60 font-mono">{lastEntry.unitName}</p>
                  </>
                ) : (
                  <p className="text-xs text-red-300/70 truncate">{lastEntry.error}</p>
                )}
                <p className="text-[10px] text-white/60 font-mono mt-0.5">{lastEntry.barcode}</p>
                {lastEntry.success && !lastEntry.inManifest && (
                  <p className="text-[9px] text-amber-400/60 mt-1">{t("scan.notInManifest")}</p>
                )}
              </div>
            )}

            {/* Stats + close */}
            <div className="mt-auto space-y-3">
              <div className="flex items-center justify-between text-[10px] text-white/60 border-t border-white/[0.04] pt-3">
                <span className="text-emerald-400/50">{t("scan.scannedCountLabel", { count: entries.filter((r) => r.success).length })}</span>
                <span className="text-red-400/50">{t("scan.errorsCountLabel", { count: entries.filter((r) => !r.success).length })}</span>
              </div>
              <button
                onClick={onClose}
                className="w-full h-9 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/[0.06] border border-white/[0.06] transition-colors"
              >
                {tc("done")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
