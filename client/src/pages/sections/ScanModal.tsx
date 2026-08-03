import React, { useRef, useEffect, useState, useMemo } from "react";
import {
  ScanLine, CheckCircle2, AlertCircle, Package,
  LogIn, LogOut, Loader2, Check,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { stockApi, jobsApi } from "@/api";
import { WorkspaceShell } from "@/components/WorkspaceShell";
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

  // In return mode: show only dispatched+returned units (already left warehouse)
  // In checkout mode: show all units
  const manifestUnits = useMemo(() =>
    mode === "return"
      ? assignedUnits.filter((u) => u.phase === "dispatched" || u.phase === "returned")
      : assignedUnits,
  [assignedUnits, mode]);

  const grouped = useMemo(() => {
    const map: Record<string, AssignedUnit[]> = {};
    for (const u of manifestUnits) {
      const key = (u as any).itemName ?? t("scan.unknownItem");
      if (!map[key]) map[key] = [];
      map[key].push(u);
    }
    return Object.entries(map);
  }, [manifestUnits, t]);

  const barcodeToUnit = useMemo(() => {
    const m: Record<string, AssignedUnit> = {};
    for (const u of assignedUnits) {
      if (u.barcode) m[u.barcode] = u;
    }
    return m;
  }, [assignedUnits]);

  // Pre-populate scanned set: in return mode, already-returned units count as ticked
  const alreadyReturnedIds = useMemo(() =>
    new Set(assignedUnits.filter((u) => u.phase === "returned").map((u) => u.id)),
  [assignedUnits]);

  // Merge session scans + already returned (for display ticking)
  const allTickedIds = useMemo(() => {
    const s = new Set(scannedIds);
    if (mode === "return") alreadyReturnedIds.forEach((id) => s.add(id));
    return s;
  }, [scannedIds, alreadyReturnedIds, mode]);

  const scannedCount = mode === "return" ? allTickedIds.size : scannedIds.size;
  const totalCount   = mode === "return" ? manifestUnits.length : assignedUnits.length;

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

      // sync phase in job_units: checkout → dispatched, return → returned
      const newPhase = mode === "checkout" ? "dispatched" : "returned";
      await jobsApi.updatePhase(jobId, [unit.id], newPhase);
      qc.invalidateQueries({ queryKey: ["job-units", jobId] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["stock", unit.stockItemId] });
      qc.invalidateQueries({ queryKey: ["containers"] });

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
    <WorkspaceShell
      icon={<ScanLine className="w-4 h-4 text-black" />}
      title={t("scan.title")}
      subtitle={jobName}
      onClose={onClose}
      headerActions={
        // มือถือ: ย่อเหลือ "12/40" อย่างเดียว ไม่งั้นเบียด app bar ที่มีปุ่มย้อนกลับ+ชื่อแล้ว
        <div className="flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3 py-1.5 rounded-xl bg-fg/[0.04] border border-fg/[0.06] flex-shrink-0">
          <span className="text-base md:text-lg font-bold text-brand tabular-nums">{scannedCount}</span>
          <span className="text-xs md:text-sm text-fg/60 tabular-nums">/ {totalCount}</span>
          <span className="hidden md:inline text-[10px] text-fg/60 ml-0.5">{t("scan.scannedSuffix")}</span>
        </div>
      }
    >
        {/* Body — two columns on tablet/desktop; stacked (scan panel first) on mobile
            so the live scan input stays visible without a tab switch mid-scan */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

          {/* Manifest — second on mobile, left column on md+ */}
          <div className="flex-1 min-h-0 order-2 md:order-1 md:border-r border-fg/[0.06] flex flex-col overflow-hidden">
            <div className="px-3 md:px-5 py-2.5 border-b border-fg/[0.04] flex items-center gap-2 flex-shrink-0">
              <Package className="w-3.5 h-3.5 text-brand/40" />
              <span className="text-[10px] font-bold text-brand/40 uppercase tracking-widest">{t("scan.manifest")}</span>
              <div className="ml-auto flex items-center gap-2">
                <div className="h-1.5 w-28 rounded-full bg-fg/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                    style={{ width: totalCount > 0 ? `${Math.round((scannedCount / totalCount) * 100)}%` : "0%" }}
                  />
                </div>
                <span className="text-[10px] text-fg/60">
                  {totalCount > 0 ? Math.round((scannedCount / totalCount) * 100) : 0}%
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 md:px-5 py-4 space-y-5">
              {isLoading && (
                <div className="flex items-center gap-2 text-fg/60 text-xs py-6">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("scan.loadingManifest")}
                </div>
              )}
              {!isLoading && assignedUnits.length === 0 && (
                <p className="text-xs text-fg/60 italic py-6 text-center">{t("scan.noEquipmentAssigned")}</p>
              )}
              {!isLoading && grouped.length === 0 && mode === "return" && (
                <p className="text-xs text-fg/40 italic py-6 text-center">{t("scan.noDispatchedUnits")}</p>
              )}
              {!isLoading && grouped.map(([itemName, units]) => (
                <div key={itemName}>
                  <div className="flex items-center gap-2 mb-2 pb-1 border-b border-fg/[0.05]">
                    <p className="text-[10px] font-bold text-fg/60 uppercase tracking-wider flex-1">{itemName}</p>
                    <span className="text-[9px] text-emerald-400/60">
                      {units.filter((u) => allTickedIds.has(u.id)).length}/{units.length}
                    </span>
                  </div>
                  {units.map((u) => {
                    const ticked       = allTickedIds.has(u.id);
                    const preReturned  = !scannedIds.has(u.id) && alreadyReturnedIds.has(u.id);
                    return (
                      <div
                        key={u.id}
                        className={`flex items-center gap-2.5 py-1.5 px-2 rounded-lg mb-0.5 transition-all duration-300 ${
                          ticked
                            ? "bg-emerald-500/[0.07] border border-emerald-500/[0.12]"
                            : "border border-transparent hover:bg-fg/[0.02]"
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                          ticked ? "bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.35)]" : "border border-fg/15"
                        }`}>
                          {ticked && <Check className="w-3 h-3 text-fg" strokeWidth={3} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs truncate transition-colors ${ticked ? "text-emerald-300/90" : "text-fg/50"}`}>
                            {u.name}
                          </p>
                          {u.serialNumber && (
                            <p className="text-[10px] text-fg/60 font-mono">{t("scan.serialPrefix")} {u.serialNumber}</p>
                          )}
                        </div>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                          ticked
                            ? modeCheckout
                              ? "bg-blue-400/15 text-blue-300"
                              : preReturned
                                ? "bg-emerald-400/10 text-emerald-400/60"
                                : "bg-emerald-400/15 text-emerald-300"
                            : "bg-fg/5 text-fg/60"
                        }`}>
                          {ticked
                            ? modeCheckout
                              ? t("scan.outBadge")
                              : preReturned
                                ? t("scan.alreadyReturned")
                                : t("scan.inBadge")
                            : tc(`statusEnum.${u.status}`, { defaultValue: u.status })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Scan panel — first on mobile (thumb reach, stays visible while scanning), right column on md+ */}
          <div className="w-full md:w-[280px] flex-shrink-0 order-1 md:order-2 flex flex-col px-3 md:px-5 py-3 md:py-4 gap-3 md:gap-4 border-b md:border-b-0 border-fg/[0.06]">

            {/* Mode Toggle */}
            <div className="flex rounded-xl overflow-hidden border border-fg/[0.08] p-0.5 gap-0.5 bg-fg/[0.02]">
              <button
                onClick={() => setMode("checkout")}
                className={`tap-target flex-1 flex items-center justify-center gap-1.5 py-2.5 md:py-2 rounded-lg text-xs font-bold transition-all ${
                  modeCheckout ? "bg-blue-500/20 text-blue-400" : "text-fg/60 hover:text-fg"
                }`}
              >
                <LogOut className="w-3.5 h-3.5" /> {t("scan.outButton")}
              </button>
              <button
                onClick={() => setMode("return")}
                className={`tap-target flex-1 flex items-center justify-center gap-1.5 py-2.5 md:py-2 rounded-lg text-xs font-bold transition-all ${
                  !modeCheckout ? "bg-emerald-500/20 text-emerald-400" : "text-fg/60 hover:text-fg"
                }`}
              >
                <LogIn className="w-3.5 h-3.5" /> {t("scan.returnButton")}
              </button>
            </div>

            {/* Scan Input */}
            <div>
              <div className={`relative rounded-xl border-2 transition-colors ${
                scanning ? "border-fg/20" :
                modeCheckout ? "border-blue-500/40 bg-blue-500/[0.04]" :
                "border-emerald-500/40 bg-emerald-500/[0.04]"
              }`}>
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  {scanning
                    ? <Loader2 className="w-5 h-5 text-fg/60 animate-spin" />
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
                  className="w-full h-12 pl-12 pr-4 bg-transparent text-sm text-fg placeholder-fg/20
                    focus:outline-none font-mono tracking-wider"
                />
              </div>
              <p className="text-[9px] text-fg/40 mt-1.5 text-center">{t("scan.hidModeHint")}</p>
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
                    <p className="text-xs text-fg/60 truncate">{lastEntry.itemName}</p>
                    <p className="text-[10px] text-fg/60 font-mono">{lastEntry.unitName}</p>
                  </>
                ) : (
                  <p className="text-xs text-red-300/70 truncate">{lastEntry.error}</p>
                )}
                <p className="text-[10px] text-fg/60 font-mono mt-0.5">{lastEntry.barcode}</p>
                {lastEntry.success && !lastEntry.inManifest && (
                  <p className="text-[9px] text-amber-400/60 mt-1">{t("scan.notInManifest")}</p>
                )}
              </div>
            )}

            {/* Stats + close */}
            <div className="mt-auto space-y-3">
              <div className="flex items-center justify-between text-[10px] text-fg/60 border-t border-fg/[0.04] pt-3">
                <span className="text-emerald-400/50">{t("scan.scannedCountLabel", { count: entries.filter((r) => r.success).length })}</span>
                <span className="text-red-400/50">{t("scan.errorsCountLabel", { count: entries.filter((r) => !r.success).length })}</span>
              </div>
              <button
                onClick={onClose}
                className="tap-target w-full h-11 md:h-9 rounded-xl text-sm font-medium text-fg/60 hover:text-fg hover:bg-fg/[0.06] border border-fg/[0.06] transition-colors"
              >
                {tc("done")}
              </button>
            </div>
          </div>
        </div>
    </WorkspaceShell>
  );
};
