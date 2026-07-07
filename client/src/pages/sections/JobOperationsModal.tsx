import React, { useRef, useEffect, useState, useMemo } from "react";
import {
  X, Package, Truck, ScanLine, CheckCircle2, AlertCircle,
  Loader2, ChevronDown, ChevronRight, Download, Zap, BoxSelect,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { jobsApi, stockApi, containersApi } from "@/api";
import type { AssignedUnit, ContainerWithItems } from "@/api";
import type { Job } from "@shared/schema";

type Mode = "pack" | "loadout";

interface ScanFeedback {
  type:    "success" | "error" | "already" | "notfound";
  message: string;
  detail?: string;
}

interface Props {
  open:    boolean;
  onClose: () => void;
  job:     Job;
}

// ── Phase colour helpers ──────────────────────────────────────────────
const phaseDot = (phase: string) => {
  if (phase === "dispatched") return "bg-green-400";
  if (phase === "prepared")   return "bg-amber-400";
  return "bg-white/25";
};
const phaseLabel = (phase: string) => {
  if (phase === "dispatched") return "dispatched";
  if (phase === "prepared")   return "prepared";
  return "planned";
};

export const JobOperationsModal = ({ open, onClose, job }: Props): JSX.Element | null => {
  const { token }   = useAppStore();
  const qc          = useQueryClient();
  const scanRef     = useRef<HTMLInputElement>(null);

  const [mode, setMode]           = useState<Mode>("pack");
  const [scanValue, setScanValue] = useState("");
  const [scanning, setScanning]   = useState(false);
  const [feedback, setFeedback]   = useState<ScanFeedback | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [downloading, setDownloading]       = useState(false);
  const [dispatching, setDispatching]       = useState(false);
  const [activeRackId, setActiveRackId]     = useState<string | null>(null);

  // ── Queries ───────────────────────────────────────────────────────
  const { data: jobUnits = [], isLoading: unitsLoading } = useQuery<AssignedUnit[]>({
    queryKey: ["job-units", job.id],
    queryFn:  () => jobsApi.getUnits(job.id),
    enabled:  !!token && open,
  });

  const { data: allContainers = [], isLoading: containersLoading } = useQuery<ContainerWithItems[]>({
    queryKey: ["containers"],
    queryFn:  containersApi.getAll,
    enabled:  !!token && open,
  });

  // Racks assigned to this job
  const jobRacks = useMemo(
    () => allContainers.filter((c) => c.jobId === job.id),
    [allContainers, job.id]
  );

  // Active rack object
  const activeRack = useMemo(
    () => allContainers.find((c) => c.id === activeRackId) ?? null,
    [allContainers, activeRackId]
  );

  // All racks available to assign: already in this job, or not assigned to any job
  const availableRacks = useMemo(
    () => allContainers.filter((c) => c.jobId === job.id || !c.jobId),
    [allContainers, job.id]
  );

  // Map: unit.id → containerId
  const unitContainerMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of jobRacks) {
      for (const item of c.items) {
        map[item.id] = c.id;
      }
    }
    return map;
  }, [jobRacks]);

  // ── Pack Mode: group units by itemName ────────────────────────────
  const packedGroups = useMemo(() => {
    const map: Record<string, AssignedUnit[]> = {};
    for (const u of jobUnits) {
      if (!map[u.itemName]) map[u.itemName] = [];
      map[u.itemName].push(u);
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [jobUnits]);

  const preparedCount = jobUnits.filter((u) => u.phase === "prepared" || u.phase === "dispatched").length;
  const totalUnits    = jobUnits.length;
  const packProgress  = totalUnits > 0 ? Math.round((preparedCount / totalUnits) * 100) : 0;
  const allPrepared   = totalUnits > 0 && jobUnits.every((u) => u.phase !== "planned");

  // ── Load-out Mode: per-rack stats ────────────────────────────────
  const rackStats = useMemo(() =>
    jobRacks.map((rack) => {
      const rackUnitIds  = new Set(rack.items.map((i) => i.id));
      const rackJobUnits = jobUnits.filter((u) => rackUnitIds.has(u.id));
      const dispatched   = rackJobUnits.filter((u) => u.phase === "dispatched").length;
      const total        = rackJobUnits.length;
      return {
        rack,
        total,
        dispatched,
        isLoaded:  total > 0 && dispatched === total,
        isPartial: dispatched > 0 && dispatched < total,
      };
    }),
    [jobRacks, jobUnits]
  );

  const looseJobUnits = useMemo(
    () => jobUnits.filter((u) => !unitContainerMap[u.id]),
    [jobUnits, unitContainerMap]
  );

  const allDispatched = totalUnits > 0 && jobUnits.every((u) => u.phase === "dispatched");
  const racksLoaded   = rackStats.filter((r) => r.isLoaded).length;

  // ── Feedback auto-clear ───────────────────────────────────────────
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(t);
  }, [feedback]);

  useEffect(() => {
    if (open) scanRef.current?.focus();
  }, [open, mode]);

  // ── Scan handler ──────────────────────────────────────────────────
  const handleScan = async (raw: string) => {
    const barcode = raw.trim();
    if (!barcode) return;
    setScanning(true);
    setScanValue("");

    try {
      if (mode === "loadout") {
        // ตรวจ barcode แร็คก่อน
        const matchedRack = jobRacks.find(
          (r) => r.barcode && r.barcode.toLowerCase() === barcode.toLowerCase()
        );
        if (matchedRack) {
          const result = await jobsApi.loadContainer(job.id, matchedRack.id);
          qc.invalidateQueries({ queryKey: ["job-units", job.id] });
          qc.invalidateQueries({ queryKey: ["containers"] });
          qc.invalidateQueries({ queryKey: ["stock"] });
          setFeedback({
            type:    "success",
            message: `โหลด ${matchedRack.name} แล้ว`,
            detail:  `${result.loaded} รายการ dispatched`,
          });
          return;
        }

        // ถ้าไม่ใช่แร็ค → scan unit (loose item)
        const unit = await stockApi.scanBarcode(barcode);
        const jobUnit = jobUnits.find((u) => u.id === unit.id);
        if (!jobUnit) {
          setFeedback({ type: "notfound", message: "ไม่พบของชิ้นนี้ใน job manifest" });
          return;
        }
        await Promise.all([
          jobsApi.updatePhase(job.id, [unit.id], "dispatched"),
          stockApi.updateUnit(unit.id, { status: "out" }),
        ]);
        qc.invalidateQueries({ queryKey: ["job-units", job.id] });
        qc.invalidateQueries({ queryKey: ["stock"] });
        qc.invalidateQueries({ queryKey: ["stock", unit.stockItemId] });
        setFeedback({
          type:    "success",
          message: `${unit.itemName} — dispatched`,
          detail:  unit.serialNumber || barcode,
        });

      } else {
        // ── Pack Mode ────────────────────────────────────────────────
        // 1) ตรวจว่า barcode ตรงกับแร็คไหมก่อน (จาก ALL containers)
        const matchedRack = allContainers.find(
          (c) => c.barcode && c.barcode.toLowerCase() === barcode.toLowerCase()
        );
        if (matchedRack) {
          // Auto-link rack to job if not already
          const alreadyInJob = jobRacks.some((r) => r.id === matchedRack.id);
          if (!alreadyInJob) {
            await jobsApi.addContainer(job.id, matchedRack.id);
            qc.invalidateQueries({ queryKey: ["job-units", job.id] });
            qc.invalidateQueries({ queryKey: ["containers"] });
            qc.invalidateQueries({ queryKey: ["stock"] });
          }
          setActiveRackId(matchedRack.id);
          setFeedback({
            type:    "success",
            message: `แร็คที่ใช้งาน: ${matchedRack.name}`,
            detail:  alreadyInJob
              ? "สแกนของเพื่อเพิ่มเข้าแร็คนี้"
              : `เพิ่มแร็คเข้า job แล้ว — สแกนของได้เลย`,
          });
          return;
        }

        // 2) scan unit → advance planned→prepared + assign to active rack
        const unit = await stockApi.scanBarcode(barcode);
        const jobUnit = jobUnits.find((u) => u.id === unit.id);
        if (!jobUnit) {
          setFeedback({ type: "notfound", message: "ไม่พบของชิ้นนี้ใน job" });
          return;
        }
        if (jobUnit.phase !== "planned") {
          setFeedback({
            type:    "already",
            message: `${unit.itemName} — เตรียมแล้ว (${jobUnit.phase})`,
          });
          return;
        }

        const ops: Promise<unknown>[] = [
          jobsApi.updatePhase(job.id, [unit.id], "prepared"),
        ];
        if (activeRackId) {
          ops.push(containersApi.addUnit(activeRackId, unit.id));
        }
        await Promise.all(ops);
        qc.invalidateQueries({ queryKey: ["job-units", job.id] });
        qc.invalidateQueries({ queryKey: ["stock"] });
        if (activeRackId) qc.invalidateQueries({ queryKey: ["containers"] });

        setFeedback({
          type:    "success",
          message: `${unit.itemName}`,
          detail:  activeRack
            ? `${unit.serialNumber || barcode} → ${activeRack.name}`
            : `${unit.serialNumber || barcode} — prepared`,
        });
        setExpandedGroups((prev) => new Set(Array.from(prev).concat(unit.itemName)));
      }
    } catch {
      setFeedback({ type: "error", message: "ไม่พบ barcode นี้ในระบบ" });
    } finally {
      setScanning(false);
      scanRef.current?.focus();
    }
  };

  // ── Mutations ────────────────────────────────────────────────────
  const markAllPrepared = useMutation({
    mutationFn: async () => {
      const plannedIds = jobUnits.filter((u) => u.phase === "planned").map((u) => u.id);
      if (plannedIds.length === 0) return;
      await jobsApi.updatePhase(job.id, plannedIds, "prepared");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-units", job.id] });
    },
  });

  const dispatchJob = async () => {
    setDispatching(true);
    try {
      await jobsApi.update(job.id, { status: "active" });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      onClose();
    } catch {}
    setDispatching(false);
  };

  const handleSelectRack = async (rackId: string) => {
    if (activeRackId === rackId) {
      setActiveRackId(null);
      return;
    }
    const alreadyInJob = jobRacks.some((r) => r.id === rackId);
    if (!alreadyInJob) {
      await jobsApi.addContainer(job.id, rackId);
      qc.invalidateQueries({ queryKey: ["job-units", job.id] });
      qc.invalidateQueries({ queryKey: ["containers"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
    }
    setActiveRackId(rackId);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await jobsApi.downloadContainersPackingSheet(job.id);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `packing-${job.name.replace(/\s+/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
    setDownloading(false);
  };

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  if (!open) return null;

  const isLoading = unitsLoading || containersLoading;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-black/80 backdrop-blur-sm">
      <div className="relative flex flex-col w-full h-full bg-[#0d0d0d] text-white">

        {/* ── Header ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5">
            <button
              onClick={() => setMode("pack")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-colors
                ${mode === "pack" ? "bg-[#FFFF00] text-black" : "text-white/60 hover:text-white"}`}
            >
              <Package className="w-4 h-4" /> Pack Mode
            </button>
            <button
              onClick={() => setMode("loadout")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-colors
                ${mode === "loadout" ? "bg-[#FFFF00] text-black" : "text-white/60 hover:text-white"}`}
            >
              <Truck className="w-4 h-4" /> Load-out
            </button>
          </div>

          <div className="text-center flex-1 px-4">
            <p className="text-sm font-bold text-white truncate">{job.name}</p>
            <p className="text-[11px] text-white/40">{job.client}</p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Loading ───────────────────────────────────────────── */}
        {isLoading && (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            PACK MODE
           ════════════════════════════════════════════════════════ */}
        {!isLoading && mode === "pack" && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Controls bar */}
            <div className="px-6 py-3 border-b border-white/[0.06] flex-shrink-0 bg-white/[0.015] space-y-2">

              {/* Progress row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 mr-6">
                  <div className="flex-1 bg-white/10 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${packProgress}%`, backgroundColor: "#FFFF00" }}
                    />
                  </div>
                  <span className="text-sm text-white/70 flex-shrink-0 w-28">
                    {preparedCount} / {totalUnits} prepared
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {allPrepared && (
                    <span className="text-xs px-2 py-1 rounded-full bg-[#FFFF00]/10 text-[#FFFF00] font-bold flex items-center gap-1">
                      <Zap className="w-3 h-3" /> พร้อมแล้ว → ไป Load-out
                    </span>
                  )}
                  <button
                    onClick={() => markAllPrepared.mutate()}
                    disabled={markAllPrepared.isPending || allPrepared}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold border border-white/10 text-white/60 hover:text-white hover:border-white/30 disabled:opacity-40 transition-colors"
                  >
                    {markAllPrepared.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    All Prepared
                  </button>
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold border border-white/10 text-white/60 hover:text-white hover:border-white/30 disabled:opacity-40 transition-colors"
                  >
                    {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    Packing Sheet
                  </button>
                </div>
              </div>

              {/* Rack chips — คลิกเพื่อเลือก active rack */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider flex-shrink-0">แร็ค:</span>
                {availableRacks.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleSelectRack(r.id)}
                    className={`flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-bold border transition-colors
                      ${activeRackId === r.id
                        ? "border-[#FFFF00] bg-[#FFFF00]/15 text-[#FFFF00]"
                        : "border-white/10 bg-white/[0.04] text-white/50 hover:text-white hover:border-white/30"}`}
                  >
                    <BoxSelect className="w-3 h-3" />
                    {r.name}
                    {r.jobId !== job.id && <span className="text-[9px] opacity-60 ml-0.5">+เพิ่ม</span>}
                  </button>
                ))}
                {availableRacks.length === 0 && (
                  <span className="text-xs text-white/25">ยังไม่มีแร็คในระบบ</span>
                )}
              </div>

              {/* Active rack banner */}
              {activeRack ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FFFF00]/10 border border-[#FFFF00]/20">
                  <BoxSelect className="w-4 h-4 text-[#FFFF00] flex-shrink-0" />
                  <span className="text-sm font-bold text-[#FFFF00] flex-1">
                    แร็คที่ใช้งาน: {activeRack.name}
                  </span>
                  <span className="text-xs text-[#FFFF00]/60">สแกนของเพื่อเพิ่มเข้าแร็คนี้</span>
                  <button
                    onClick={() => setActiveRackId(null)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-[#FFFF00]/50 hover:text-[#FFFF00] border border-[#FFFF00]/20 hover:border-[#FFFF00]/50 transition-colors ml-2"
                    title="ยกเลิกแร็คที่ใช้งาน"
                  >
                    <X className="w-3 h-3" /> ยกเลิก
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-dashed border-white/10">
                  <BoxSelect className="w-4 h-4 text-white/20 flex-shrink-0" />
                  <span className="text-xs text-white/30">สแกน barcode แร็คก่อน เพื่อเลือกแร็คที่ใช้งาน</span>
                </div>
              )}

              {/* Scan input */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    ref={scanRef}
                    type="text"
                    value={scanValue}
                    onChange={(e) => setScanValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleScan(scanValue); }}
                    placeholder={activeRack ? `สแกนของเข้า ${activeRack.name}...` : "สแกน barcode แร็ค หรือสแกนของ..."}
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm
                      text-white placeholder-white/30 outline-none focus:border-[#FFFF00]/50"
                  />
                </div>
                {scanning && <Loader2 className="w-4 h-4 text-white/40 animate-spin" />}
                {feedback && (
                  <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg flex-1
                    ${feedback.type === "success" ? "bg-green-500/10 text-green-400" :
                      feedback.type === "already"  ? "bg-[#FFFF00]/10 text-[#FFFF00]" :
                                                     "bg-red-500/10 text-red-400"}`}>
                    {feedback.type === "success" ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> :
                     feedback.type === "already"  ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> :
                                                    <AlertCircle  className="w-4 h-4 flex-shrink-0" />}
                    <span>{feedback.message}</span>
                    {feedback.detail && <span className="text-xs opacity-60 ml-1">{feedback.detail}</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Equipment checklist */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {packedGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2 text-white/30">
                  <Package className="w-10 h-10" />
                  <p className="text-sm">ยังไม่มีอุปกรณ์ใน job นี้</p>
                  <p className="text-xs">เพิ่มอุปกรณ์ผ่าน "Edit Units" ก่อน</p>
                </div>
              ) : (
                packedGroups.map(([itemName, units]) => {
                  const expanded = expandedGroups.has(itemName);
                  const prepared = units.filter((u) => u.phase !== "planned").length;
                  const allReady = prepared === units.length;

                  // Primary rack for this group (majority)
                  const rackIds = units.map((u) => unitContainerMap[u.id]).filter(Boolean);
                  const rackIdFreq: Record<string, number> = {};
                  for (const id of rackIds) rackIdFreq[id] = (rackIdFreq[id] ?? 0) + 1;
                  const primaryRackId = Object.entries(rackIdFreq).sort((a, b) => b[1] - a[1])[0]?.[0];
                  const primaryRack   = jobRacks.find((r) => r.id === primaryRackId);
                  const rackBadge     = primaryRack
                    ? (rackIds.length < units.length ? `${primaryRack.name} (บางส่วน)` : primaryRack.name)
                    : null;

                  return (
                    <div key={itemName} className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
                      {/* Group header */}
                      <div
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                        onClick={() => toggleGroup(itemName)}
                      >
                        {expanded
                          ? <ChevronDown  className="w-4 h-4 text-white/30 flex-shrink-0" />
                          : <ChevronRight className="w-4 h-4 text-white/30 flex-shrink-0" />}

                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {allReady
                            ? <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                            : <div className="w-4 h-4 rounded-full border-2 border-white/20 flex-shrink-0" />}
                          <span className="font-medium text-sm">{itemName}</span>
                          <span className="text-xs text-white/40">{prepared}/{units.length}</span>
                        </div>

                        {/* Rack badge (read-only) */}
                        {rackBadge && (
                          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/50 flex-shrink-0">
                            <BoxSelect className="w-3 h-3" />{rackBadge}
                          </span>
                        )}
                        {/* Assign all to active rack */}
                        {activeRack && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const plannedUnits = units.filter((u) => u.phase === "planned");
                              const ops: Promise<unknown>[] = [
                                ...units.map((u) => containersApi.addUnit(activeRack.id, u.id)),
                              ];
                              if (plannedUnits.length > 0) {
                                ops.push(jobsApi.updatePhase(job.id, plannedUnits.map((u) => u.id), "prepared"));
                              }
                              await Promise.all(ops);
                              qc.invalidateQueries({ queryKey: ["job-units", job.id] });
                              qc.invalidateQueries({ queryKey: ["containers"] });
                            }}
                            className="flex items-center gap-1 h-6 px-2 rounded text-[10px] font-bold border border-[#FFFF00]/30 text-[#FFFF00]/70 hover:text-[#FFFF00] hover:border-[#FFFF00]/60 transition-colors flex-shrink-0"
                          >
                            → {activeRack.name}
                          </button>
                        )}
                      </div>

                      {/* Unit rows */}
                      {expanded && (
                        <div className="border-t border-white/[0.04]">
                          {units.map((u) => {
                            const unitRack = jobRacks.find((r) => r.id === unitContainerMap[u.id]);
                            return (
                              <div key={u.id} className="flex items-center gap-3 px-5 py-2.5 border-b border-white/[0.03] last:border-0">
                                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${phaseDot(u.phase)}`} />
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm text-white">{u.name || u.serialNumber || "—"}</span>
                                  {u.serialNumber && <span className="text-xs text-white/40 ml-2">SN:{u.serialNumber}</span>}
                                  {u.barcode     && <span className="text-xs text-white/30 ml-2">BC:{u.barcode}</span>}
                                </div>
                                {unitRack && (
                                  <span className="text-[10px] text-white/30 flex-shrink-0">{unitRack.name}</span>
                                )}
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0
                                  ${u.phase === "dispatched" ? "bg-green-500/15 text-green-400" :
                                    u.phase === "prepared"   ? "bg-amber-500/15 text-amber-400" :
                                                               "bg-white/10 text-white/40"}`}>
                                  {phaseLabel(u.phase)}
                                </span>
                                {/* [×] ถอดออกจากแร็ค */}
                                {unitRack && (
                                  <button
                                    onClick={() => {
                                      containersApi.removeUnit(unitRack.id, u.id).then(() => {
                                        qc.invalidateQueries({ queryKey: ["containers"] });
                                      });
                                    }}
                                    className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-white/30 hover:text-red-400 hover:border-red-400/30 transition-colors flex-shrink-0"
                                    title="ถอดออกจากแร็ค"
                                  >
                                    ×
                                  </button>
                                )}
                                {/* ย้ายแร็ค inline select */}
                                {jobRacks.length > 0 && (
                                  <select
                                    className="bg-[#0d0d0d] border border-white/10 rounded px-1 py-0.5 text-[10px] text-white/40 outline-none cursor-pointer hover:border-white/30 flex-shrink-0"
                                    value={unitContainerMap[u.id] ?? ""}
                                    onChange={(e) => {
                                      if (!e.target.value) return;
                                      containersApi.addUnit(e.target.value, u.id).then(() => {
                                        qc.invalidateQueries({ queryKey: ["containers"] });
                                      });
                                    }}
                                  >
                                    <option value="">{unitRack ? "ย้ายแร็ค" : "→ เลือกแร็ค"}</option>
                                    {jobRacks.map((r) => (
                                      <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                  </select>
                                )}
                                {u.phase === "planned" && (
                                  <button
                                    onClick={() => {
                                      const ops: Promise<unknown>[] = [
                                        jobsApi.updatePhase(job.id, [u.id], "prepared"),
                                      ];
                                      if (activeRackId) ops.push(containersApi.addUnit(activeRackId, u.id));
                                      Promise.all(ops).then(() => {
                                        qc.invalidateQueries({ queryKey: ["job-units", job.id] });
                                        if (activeRackId) qc.invalidateQueries({ queryKey: ["containers"] });
                                      });
                                    }}
                                    className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-white/40 hover:text-white hover:border-white/30 transition-colors flex-shrink-0"
                                  >
                                    → Prepared
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            LOAD-OUT MODE
           ════════════════════════════════════════════════════════ */}
        {!isLoading && mode === "loadout" && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Scan input + progress bar */}
            <div className="px-6 py-4 border-b border-white/[0.06] flex-shrink-0 bg-white/[0.015] space-y-3">
              {/* Overall progress */}
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-white/10 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: rackStats.length > 0 ? `${Math.round((racksLoaded / rackStats.length) * 100)}%` : "0%",
                      backgroundColor: "#FFFF00",
                    }}
                  />
                </div>
                <span className="text-sm text-white/70 flex-shrink-0 w-32">
                  {racksLoaded} / {rackStats.length} แร็คบนรถ
                </span>
              </div>

              {/* Scan */}
              <div className="flex items-center gap-3">
                <p className="text-[11px] text-white/40 font-bold uppercase tracking-wider flex-shrink-0">สแกน barcode แร็ค:</p>
                <div className="relative flex-1 max-w-sm">
                  <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    ref={mode === "loadout" ? scanRef : undefined}
                    type="text"
                    value={scanValue}
                    onChange={(e) => setScanValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleScan(scanValue); }}
                    placeholder="สแกน barcode แร็ค หรือชิ้นส่วนที่ไม่อยู่ในแร็ค..."
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm
                      text-white placeholder-white/30 outline-none focus:border-[#FFFF00]/50"
                  />
                </div>
                {scanning && <Loader2 className="w-4 h-4 text-white/40 animate-spin" />}
                {feedback && (
                  <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg flex-1
                    ${feedback.type === "success" ? "bg-green-500/10 text-green-400" :
                      feedback.type === "notfound" ? "bg-amber-500/10 text-amber-400" :
                                                     "bg-red-500/10 text-red-400"}`}>
                    {feedback.type === "success"
                      ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      : <AlertCircle  className="w-4 h-4 flex-shrink-0" />}
                    <span>{feedback.message}</span>
                    {feedback.detail && <span className="text-xs opacity-60 ml-1">{feedback.detail}</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Rack list + loose items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {rackStats.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 gap-2 text-white/30">
                  <Truck className="w-8 h-8" />
                  <p className="text-sm">ยังไม่มีแร็คใน job นี้</p>
                </div>
              )}

              {rackStats.map(({ rack, total, dispatched, isLoaded, isPartial }) => {
                const pct = total > 0 ? Math.round((dispatched / total) * 100) : 0;
                return (
                  <div
                    key={rack.id}
                    className={`flex items-center gap-4 px-5 py-4 rounded-xl border transition-colors
                      ${isLoaded  ? "bg-green-500/5 border-green-500/20" :
                        isPartial ? "bg-amber-500/5 border-amber-500/20" :
                                    "bg-white/[0.02] border-white/[0.06]"}`}
                  >
                    {isLoaded
                      ? <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                      : <div className="w-5 h-5 rounded-full border-2 border-white/20 flex-shrink-0" />}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium ${isLoaded ? "text-green-400" : "text-white"}`}>
                          {rack.name}
                        </p>
                        {rack.type && <span className="text-xs text-white/40">{rack.type}</span>}
                        {isPartial && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium">
                            ⚠ partial
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/40 mt-0.5">{dispatched}/{total} dispatched</p>
                    </div>

                    <div className="w-32 flex-shrink-0">
                      <div className="bg-white/10 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: isLoaded ? "#4ade80" : isPartial ? "#f59e0b" : "#FFFF00",
                          }}
                        />
                      </div>
                    </div>

                    <span className={`text-xs font-medium w-16 text-right flex-shrink-0
                      ${isLoaded ? "text-green-400" : isPartial ? "text-amber-400" : "text-white/30"}`}>
                      {isLoaded ? "loaded ✓" : isPartial ? "partial" : "pending"}
                    </span>
                    {!isLoaded && (
                      <button
                        onClick={async () => {
                          await jobsApi.loadContainer(job.id, rack.id);
                          qc.invalidateQueries({ queryKey: ["job-units", job.id] });
                          qc.invalidateQueries({ queryKey: ["containers"] });
                          qc.invalidateQueries({ queryKey: ["stock"] });
                        }}
                        className="flex items-center gap-1 h-7 px-3 rounded-lg text-xs font-bold border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-colors flex-shrink-0"
                      >
                        <Truck className="w-3 h-3" /> โหลด
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Loose items */}
              {looseJobUnits.length > 0 && (
                <div className="mt-4">
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2 px-1">
                    ของที่ไม่อยู่ในแร็ค ({looseJobUnits.length})
                  </p>
                  <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
                    {looseJobUnits.map((u, idx) => (
                      <div
                        key={u.id}
                        className={`flex items-center gap-3 px-5 py-2.5 ${idx < looseJobUnits.length - 1 ? "border-b border-white/[0.04]" : ""}`}
                      >
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${phaseDot(u.phase)}`} />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-white">{u.itemName}</span>
                          {u.serialNumber && <span className="text-xs text-white/40 ml-2">SN:{u.serialNumber}</span>}
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium
                          ${u.phase === "dispatched" ? "bg-green-500/15 text-green-400" :
                            u.phase === "prepared"   ? "bg-amber-500/15 text-amber-400" :
                                                       "bg-white/10 text-white/40"}`}>
                          {phaseLabel(u.phase)}
                        </span>
                        {u.barcode && <span className="text-[10px] text-white/30 font-mono">{u.barcode}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dispatch button */}
              {allDispatched && (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={dispatchJob}
                    disabled={dispatching || job.status === "active"}
                    className="flex items-center gap-2 h-11 px-8 rounded-xl text-sm font-bold text-black
                      hover:opacity-90 disabled:opacity-40 transition-opacity"
                    style={{ backgroundColor: "#FFFF00" }}
                  >
                    {dispatching
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Truck className="w-4 h-4" />}
                    {job.status === "active" ? "Job Active แล้ว" : "Dispatch Job →"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
