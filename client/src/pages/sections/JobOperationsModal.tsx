import React, { useRef, useEffect, useState, useMemo } from "react";
import {
  X, Package, Truck, ScanLine, CheckCircle2, AlertCircle,
  Loader2, ChevronDown, ChevronRight, Download, Zap, BoxSelect,
  RotateCcw, ArrowRightLeft, Hash, Link2, AlertTriangle, Plus, Trash2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { jobsApi, stockApi, containersApi } from "@/api";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { ManageJobStockModal } from "./ManageJobStockModal";
import type { AssignedUnit, ContainerWithItems } from "@/api";
import type { Job, ItemAccessory, StockItem } from "@shared/schema";

type OpsTab = "pack" | "dispatch" | "return";

interface ScanFeedback {
  type:    "success" | "error" | "already" | "notfound";
  message: string;
  detail?: string;
}

type LogEntryType = "rack_switch" | "item_ok" | "item_already" | "error";
interface LogEntry {
  id:      number;
  type:    LogEntryType;
  text:    string;
  sub?:    string;
  rack?:   string;
  rackId?: string;
}

interface Props {
  open:    boolean;
  onClose: () => void;
  job:     Job;
}

const phaseDot = (phase: string) => {
  if (phase === "returned")   return "bg-emerald-400";
  if (phase === "dispatched") return "bg-blue-400";
  if (phase === "prepared")   return "bg-amber-400";
  return "bg-fg/25";
};
const phaseLabel = (phase: string) => {
  if (phase === "returned")   return "returned";
  if (phase === "dispatched") return "dispatched";
  if (phase === "prepared")   return "prepared";
  return "planned";
};

// Shared scan-log feed — same look across Pack / Dispatch / Return tabs
const LogFeed = ({ entries, emptyHint }: { entries: LogEntry[]; emptyHint: string }): JSX.Element => (
  <div className="flex-1 overflow-y-auto px-3 md:px-5 py-3 space-y-1.5">
    {entries.length === 0 ? (
      <div className="flex flex-col items-center justify-center h-full text-fg/20 gap-2">
        <Hash className="w-8 h-8" />
        <p className="text-xs text-center whitespace-pre-line">{emptyHint}</p>
      </div>
    ) : (
      entries.map((entry, idx) => (
        <div key={entry.id}
          className={`flex items-start gap-3 px-3 py-2 rounded-lg transition-opacity
            ${idx === 0 ? "opacity-100" : idx < 3 ? "opacity-70" : "opacity-40"}
            ${entry.type === "rack_switch" ? "bg-brand/[0.06] border border-brand/15"
              : entry.type === "item_ok"    ? "bg-fg/[0.03]"
              : entry.type === "item_already" ? "bg-amber-500/[0.06]"
              : "bg-red-500/[0.06]"}`}>
          <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5
            ${entry.type === "rack_switch" ? "bg-brand/15 text-brand"
              : entry.type === "item_ok"    ? "bg-green-500/15 text-green-400"
              : entry.type === "item_already" ? "bg-amber-500/15 text-amber-400"
              : "bg-red-500/15 text-red-400"}`}>
            {entry.type === "rack_switch"   ? <ArrowRightLeft className="w-2.5 h-2.5" />
              : entry.type === "item_ok"    ? <CheckCircle2 className="w-2.5 h-2.5" />
              : entry.type === "item_already" ? <CheckCircle2 className="w-2.5 h-2.5" />
              : <AlertCircle className="w-2.5 h-2.5" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-semibold truncate
              ${entry.type === "rack_switch" ? "text-brand"
                : entry.type === "item_ok"   ? "text-fg"
                : entry.type === "item_already" ? "text-amber-300"
                : "text-red-400"}`}>
              {entry.type === "rack_switch" ? `↕ ${entry.text}` : entry.text}
            </p>
            {entry.sub && <p className="text-[10px] text-fg/35 truncate">{entry.sub}</p>}
            {entry.rack && <p className="text-[10px] text-brand/40 truncate">→ {entry.rack}</p>}
          </div>
          {idx === 0 && <div className="w-1.5 h-1.5 rounded-full bg-brand flex-shrink-0 mt-1.5 animate-pulse" />}
        </div>
      ))
    )}
  </div>
);

export const JobOperationsModal = ({ open, onClose, job }: Props): JSX.Element | null => {
  const { token } = useAppStore();
  const qc        = useQueryClient();
  const scanRef       = useRef<HTMLInputElement>(null);
  const returnScanRef = useRef<HTMLInputElement>(null);
  const logIdRef      = useRef(0);

  const [tab, setTab]                 = useState<OpsTab>("pack");
  const [tabInitialized, setTabInitialized] = useState(false);
  const [scanValue, setScanValue]     = useState("");
  const [scanning, setScanning]       = useState(false);
  const [feedback, setFeedback]       = useState<ScanFeedback | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [manageStockSearch, setManageStockSearch] = useState<string | null>(null);
  const [activeRackId, setActiveRackId] = useState<string | null>(null);
  const [scanLog, setScanLog]         = useState<LogEntry[]>([]);

  const [returnScanValue, setReturnScanValue]   = useState("");
  const [returnScanning, setReturnScanning]     = useState(false);
  const [returnFeedback, setReturnFeedback]     = useState<ScanFeedback | null>(null);
  const [returnScannedIds, setReturnScannedIds] = useState<Set<string>>(new Set());
  const [dispatchLog, setDispatchLog]           = useState<LogEntry[]>([]);
  const [returnLog, setReturnLog]               = useState<LogEntry[]>([]);

  const pushLog = (entry: Omit<LogEntry, "id">) => {
    logIdRef.current += 1;
    setScanLog((prev) => [{ ...entry, id: logIdRef.current }, ...prev].slice(0, 12));
  };
  const pushDispatchLog = (entry: Omit<LogEntry, "id">) => {
    logIdRef.current += 1;
    setDispatchLog((prev) => [{ ...entry, id: logIdRef.current }, ...prev].slice(0, 12));
  };
  const pushReturnLog = (entry: Omit<LogEntry, "id">) => {
    logIdRef.current += 1;
    setReturnLog((prev) => [{ ...entry, id: logIdRef.current }, ...prev].slice(0, 12));
  };

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

  // อุปกรณ์เสริมที่ "จำเป็น" ต้องไปด้วยกัน — ใช้จับคู่การ์ดในแท็บ Pack + เตือนถ้ายังขาดในแผนงาน
  const { data: accessoryLinks = [] } = useQuery<ItemAccessory[]>({
    queryKey: ["accessory-links"],
    queryFn:  stockApi.getAllAccessoryLinks,
    enabled:  !!token && open,
  });
  const { data: allStock = [] } = useQuery<StockItem[]>({
    queryKey: ["stock"],
    queryFn:  stockApi.getAll,
    enabled:  !!token && open,
  });
  const stockNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of allStock) m.set(s.id, s.name);
    return m;
  }, [allStock]);
  const requiredAccessoryLinks = useMemo(() => accessoryLinks.filter((l) => l.required), [accessoryLinks]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTab("pack");
      setTabInitialized(false);
      setReturnScanValue("");
      setReturnScannedIds(new Set());
      setReturnFeedback(null);
      setScanValue("");
      setFeedback(null);
      setScanLog([]);
      setDispatchLog([]);
      setReturnLog([]);
    }
  }, [open]);

  // Auto-select correct tab
  useEffect(() => {
    if (tabInitialized || !open || jobUnits.length === 0) return;
    const total      = jobUnits.length;
    const dispatched = jobUnits.filter(u => u.phase === "dispatched" || u.phase === "returned").length;
    const prepared   = jobUnits.filter(u => u.phase !== "planned").length;
    if (dispatched === total) setTab("return");
    else if (prepared === total) setTab("dispatch");
    else setTab("pack");
    setTabInitialized(true);
  }, [jobUnits, tabInitialized, open]);

  const jobRacks = useMemo(
    () => allContainers.filter((c) => c.jobId === job.id),
    [allContainers, job.id]
  );
  const activeRack = useMemo(
    () => allContainers.find((c) => c.id === activeRackId) ?? null,
    [allContainers, activeRackId]
  );
  const availableRacks = useMemo(
    () => allContainers.filter((c) => c.jobId === job.id || !c.jobId),
    [allContainers, job.id]
  );
  const unitContainerMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of jobRacks) for (const item of c.items) map[item.id] = c.id;
    return map;
  }, [jobRacks]);

  const totalUnits                 = jobUnits.length;
  const notPlannedCount            = jobUnits.filter(u => u.phase !== "planned").length;
  const dispatchedAndReturnedCount = jobUnits.filter(u => u.phase === "dispatched" || u.phase === "returned").length;
  const returnedCount              = jobUnits.filter(u => u.phase === "returned").length;
  const packProgress               = totalUnits > 0 ? Math.round((notPlannedCount / totalUnits) * 100) : 0;
  const allPrepared                = totalUnits > 0 && notPlannedCount === totalUnits;
  const allDispatched              = totalUnits > 0 && dispatchedAndReturnedCount === totalUnits;

  // จับกลุ่มตามรุ่น (stock item) แล้วจัดให้ accessory ที่ "จำเป็น" อยู่ติดกับของหลักเสมอ
  // (เฉพาะกรณีทั้งของหลักและ accessory มีอยู่ในงานนี้จริง) แทนการเรียงตามตัวอักษรล้วนๆ
  const packedGroups = useMemo(() => {
    const map = new Map<string, { itemName: string; stockItemId: string; units: AssignedUnit[]; accessoryOfName?: string }>();
    for (const u of jobUnits) {
      if (!map.has(u.itemName)) map.set(u.itemName, { itemName: u.itemName, stockItemId: u.stockItemId, units: [] });
      map.get(u.itemName)!.units.push(u);
    }
    const groups = Array.from(map.values()).sort((a, b) => a.itemName.localeCompare(b.itemName));

    const presentIds = new Set(groups.map((g) => g.stockItemId));
    const parentOf = new Map<string, string>(); // accessoryStockItemId -> parentStockItemId
    for (const link of requiredAccessoryLinks) {
      if (presentIds.has(link.parentStockItemId) && presentIds.has(link.accessoryStockItemId)) {
        parentOf.set(link.accessoryStockItemId, link.parentStockItemId);
      }
    }
    const byStockItemId = new Map(groups.map((g) => [g.stockItemId, g]));
    const consumed = new Set<string>();
    const ordered: typeof groups = [];
    for (const g of groups) {
      if (consumed.has(g.stockItemId) || parentOf.has(g.stockItemId)) continue;
      ordered.push(g);
      consumed.add(g.stockItemId);
      for (const [accId, parentId] of Array.from(parentOf.entries())) {
        if (parentId !== g.stockItemId || consumed.has(accId)) continue;
        const accGroup = byStockItemId.get(accId);
        if (accGroup) {
          ordered.push({ ...accGroup, accessoryOfName: g.itemName });
          consumed.add(accId);
        }
      }
    }
    for (const g of groups) {
      if (!consumed.has(g.stockItemId)) { ordered.push(g); consumed.add(g.stockItemId); }
    }
    return ordered;
  }, [jobUnits, requiredAccessoryLinks]);

  const accessoryShortfalls = useMemo(() => {
    const parentCounts = new Map<string, number>();
    for (const u of jobUnits) parentCounts.set(u.stockItemId, (parentCounts.get(u.stockItemId) ?? 0) + 1);

    const wanted = new Map<string, number>();
    for (const link of requiredAccessoryLinks) {
      const parentQty = parentCounts.get(link.parentStockItemId) ?? 0;
      if (parentQty === 0) continue;
      wanted.set(link.accessoryStockItemId, (wanted.get(link.accessoryStockItemId) ?? 0) + link.quantityPerUnit * parentQty);
    }

    const results: { stockItemId: string; name: string; wanted: number; got: number }[] = [];
    for (const [accId, wantedQty] of Array.from(wanted.entries())) {
      const got = parentCounts.get(accId) ?? 0;
      if (got < wantedQty) results.push({ stockItemId: accId, name: stockNameById.get(accId) ?? "?", wanted: wantedQty, got });
    }
    return results;
  }, [jobUnits, requiredAccessoryLinks, stockNameById]);

  const rackStats = useMemo(() =>
    jobRacks.map((rack) => {
      const rackUnitIds  = new Set(rack.items.map((i) => i.id));
      const rackJobUnits = jobUnits.filter((u) => rackUnitIds.has(u.id));
      const dispatched   = rackJobUnits.filter((u) => u.phase === "dispatched").length;
      const prepared     = rackJobUnits.filter((u) => u.phase !== "planned").length;
      const total        = rackJobUnits.length;
      return { rack, total, prepared, dispatched, isLoaded: total > 0 && dispatched === total, isPartial: dispatched > 0 && dispatched < total };
    }),
    [jobRacks, jobUnits]
  );

  const looseJobUnits = useMemo(
    () => jobUnits.filter((u) => !unitContainerMap[u.id]),
    [jobUnits, unitContainerMap]
  );
  const racksLoaded = rackStats.filter((r) => r.isLoaded).length;

  const manifestReturnUnits = useMemo(
    () => jobUnits.filter(u => u.phase === "dispatched" || u.phase === "returned"),
    [jobUnits]
  );

  // Per-rack item counts for Pack tab display
  const rackPackStats = useMemo(() =>
    jobRacks.map((rack) => {
      const rackUnitIds  = new Set(rack.items.map((i) => i.id));
      const rackJobUnits = jobUnits.filter((u) => rackUnitIds.has(u.id));
      const prepared     = rackJobUnits.filter((u) => u.phase !== "planned").length;
      const total        = rackJobUnits.length;
      return { rack, total, prepared, done: total > 0 && prepared === total };
    }),
    [jobRacks, jobUnits]
  );

  // Feedback auto-clear
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(t);
  }, [feedback]);

  useEffect(() => {
    if (!returnFeedback) return;
    const t = setTimeout(() => setReturnFeedback(null), 3000);
    return () => clearTimeout(t);
  }, [returnFeedback]);

  // Auto-focus scan input
  useEffect(() => {
    if (!open) return;
    if (tab === "return") returnScanRef.current?.focus();
    else scanRef.current?.focus();
  }, [open, tab]);

  // ── Pack + Dispatch scan handler ──────────────────────────
  const handleScan = async (raw: string) => {
    const barcode = raw.trim();
    if (!barcode) return;
    setScanning(true);
    setScanValue("");
    try {
      if (tab === "dispatch") {
        const matchedRack = jobRacks.find(
          (r) => r.barcode && r.barcode.toLowerCase() === barcode.toLowerCase()
        );
        if (matchedRack) {
          const result = await jobsApi.loadContainer(job.id, matchedRack.id);
          qc.invalidateQueries({ queryKey: ["job-units", job.id] });
          qc.invalidateQueries({ queryKey: ["containers"] });
          qc.invalidateQueries({ queryKey: ["stock"] });
          pushDispatchLog({ type: "item_ok", text: `โหลด ${matchedRack.name}`, sub: `${result.loaded} ชิ้นขึ้นรถ` });
          return;
        }
        const unit    = await stockApi.scanBarcode(barcode);
        const jobUnit = jobUnits.find((u) => u.id === unit.id);
        if (!jobUnit) { pushDispatchLog({ type: "error", text: "ไม่พบของชิ้นนี้ใน job", sub: barcode }); return; }
        await Promise.all([
          jobsApi.updatePhase(job.id, [unit.id], "dispatched"),
          stockApi.updateUnit(unit.id, { status: "out" }),
        ]);
        qc.invalidateQueries({ queryKey: ["job-units", job.id] });
        qc.invalidateQueries({ queryKey: ["stock"] });
        qc.invalidateQueries({ queryKey: ["stock", unit.stockItemId] });
        qc.invalidateQueries({ queryKey: ["containers"] });
        pushDispatchLog({ type: "item_ok", text: unit.itemName, sub: `${unit.serialNumber || barcode} — dispatched` });

      } else {
        // Pack mode — check rack barcode first
        const matchedRack = allContainers.find(
          (c) => c.barcode && c.barcode.toLowerCase() === barcode.toLowerCase()
        );
        if (matchedRack) {
          const alreadyInJob = jobRacks.some((r) => r.id === matchedRack.id);
          if (!alreadyInJob) {
            await jobsApi.addContainer(job.id, matchedRack.id);
            qc.invalidateQueries({ queryKey: ["job-units", job.id] });
            qc.invalidateQueries({ queryKey: ["containers"] });
            qc.invalidateQueries({ queryKey: ["stock"] });
          }
          const prevRack = activeRack?.name;
          setActiveRackId(matchedRack.id);
          pushLog({
            type: "rack_switch",
            text: matchedRack.name,
            sub:  prevRack ? `เปลี่ยนจาก ${prevRack}` : "เลือกแร็คแล้ว",
            rackId: matchedRack.id,
          });
          return;
        }
        // Item barcode
        const unit    = await stockApi.scanBarcode(barcode);
        const jobUnit = jobUnits.find((u) => u.id === unit.id);
        if (!jobUnit) {
          pushLog({ type: "error", text: "ไม่พบของนี้ใน job", sub: barcode });
          return;
        }
        if (jobUnit.phase !== "planned") {
          pushLog({ type: "item_already", text: unit.itemName, sub: `${unit.serialNumber ?? barcode} — ${jobUnit.phase}` });
          return;
        }
        const ops: Promise<unknown>[] = [jobsApi.updatePhase(job.id, [unit.id], "prepared")];
        if (activeRackId) ops.push(containersApi.addUnit(activeRackId, unit.id));
        await Promise.all(ops);
        qc.invalidateQueries({ queryKey: ["job-units", job.id] });
        qc.invalidateQueries({ queryKey: ["stock"] });
        if (activeRackId) qc.invalidateQueries({ queryKey: ["containers"] });
        pushLog({
          type: "item_ok",
          text: unit.itemName,
          sub:  unit.serialNumber ?? unit.barcode ?? barcode,
          rack: activeRack?.name,
        });
        setExpandedGroups((prev) => new Set(Array.from(prev).concat(unit.itemName)));
      }
    } catch {
      const errEntry = { type: "error" as const, text: "ไม่พบ barcode นี้ในระบบ", sub: barcode };
      if (tab === "dispatch") pushDispatchLog(errEntry);
      else pushLog(errEntry);
    } finally {
      setScanning(false);
      scanRef.current?.focus();
    }
  };

  // ── Return scan handler ──────────────────────────────────
  const handleReturnScan = async (raw: string) => {
    const barcode = raw.trim();
    if (!barcode) return;
    setReturnScanning(true);
    setReturnScanValue("");
    try {
      const unit    = await stockApi.scanBarcode(barcode);
      const jobUnit = jobUnits.find((u) => u.id === unit.id);
      if (!jobUnit) { pushReturnLog({ type: "error", text: "ไม่พบของชิ้นนี้ใน job", sub: barcode }); return; }
      if (jobUnit.phase === "returned") { pushReturnLog({ type: "item_already", text: unit.itemName, sub: `${unit.serialNumber || barcode} — คืนแล้ว` }); return; }
      await Promise.all([
        stockApi.updateUnit(unit.id, { status: "available" }),
        jobsApi.updatePhase(job.id, [unit.id], "returned"),
      ]);
      qc.invalidateQueries({ queryKey: ["job-units", job.id] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["stock", unit.stockItemId] });
      qc.invalidateQueries({ queryKey: ["containers"] });
      setReturnScannedIds((prev) => { const next = new Set(prev); next.add(unit.id); return next; });
      pushReturnLog({ type: "item_ok", text: unit.itemName, sub: `${unit.serialNumber || barcode} — คืนแล้ว` });
    } catch {
      pushReturnLog({ type: "error", text: "ไม่พบ barcode นี้ในระบบ", sub: barcode });
    } finally {
      setReturnScanning(false);
      returnScanRef.current?.focus();
    }
  };

  const markAllPrepared = useMutation({
    mutationFn: async () => {
      const plannedIds = jobUnits.filter((u) => u.phase === "planned").map((u) => u.id);
      if (plannedIds.length === 0) return;
      await jobsApi.updatePhase(job.id, plannedIds, "prepared");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job-units", job.id] }),
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
    if (activeRackId === rackId) { setActiveRackId(null); return; }
    const alreadyInJob = jobRacks.some((r) => r.id === rackId);
    if (!alreadyInJob) {
      await jobsApi.addContainer(job.id, rackId);
      qc.invalidateQueries({ queryKey: ["job-units", job.id] });
      qc.invalidateQueries({ queryKey: ["containers"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
    }
    const prevRack = activeRack?.name;
    const newRack  = allContainers.find((c) => c.id === rackId);
    setActiveRackId(rackId);
    if (newRack) pushLog({ type: "rack_switch", text: newRack.name, sub: prevRack ? `เปลี่ยนจาก ${prevRack}` : "เลือกแร็คแล้ว", rackId });
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

  const toggleGroup = (name: string) =>
    setExpandedGroups((prev) => { const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next; });

  if (!open) return null;

  const isLoading = unitsLoading || containersLoading;

  const packFraction     = totalUnits > 0 ? `${notPlannedCount}/${totalUnits}` : "—";
  const dispatchFraction = totalUnits > 0 ? `${dispatchedAndReturnedCount}/${totalUnits}` : "—";
  const returnTotal      = manifestReturnUnits.length;
  const returnFraction   = returnTotal > 0 ? `${returnedCount}/${returnTotal}` : "—";
  const packDone     = totalUnits > 0 && notPlannedCount === totalUnits;
  const dispatchDone = totalUnits > 0 && dispatchedAndReturnedCount === totalUnits;
  const returnDone   = returnTotal > 0 && returnedCount === returnTotal;

  const opsIcons  = { pack: Package, dispatch: Truck, return: RotateCcw };
  const opsLabels = { pack: "Pack", dispatch: "Dispatch", return: "Return" };
  const opsFractions = { pack: packFraction, dispatch: dispatchFraction, return: returnFraction };
  const opsDones     = { pack: packDone, dispatch: dispatchDone, return: returnDone };

  return (
    <>
    <WorkspaceShell
      icon={<Truck className="w-4 h-4 text-black" />}
      title={job.name}
      subtitle={job.client ?? undefined}
      onClose={onClose}
      tabs={(["pack", "dispatch", "return"] as OpsTab[]).map((tk) => ({
        key: tk,
        label: opsLabels[tk],
        Icon: opsIcons[tk],
        badge: opsDones[tk]
          ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
          : <span className="text-[10px] ml-0.5 opacity-50">{opsFractions[tk]}</span>,
      }))}
      activeTab={tab}
      onTabChange={(k) => setTab(k as OpsTab)}
    >

        {isLoading && (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="w-8 h-8 text-fg/30 animate-spin" />
          </div>
        )}

        {/* ════════════════════════════════════════
            PACK TAB — 2-column scanner-first layout
            Left: scanner station  Right: inventory
        ════════════════════════════════════════ */}
        {!isLoading && tab === "pack" && (
          <div className="flex flex-col md:flex-row flex-1 min-h-0">

            {/* ── Left: Scanner Station — full width & capped height on mobile
                (stacked above the list, thumb reach), fixed side column on md+ ── */}
            <div
              className="w-full md:w-[400px] flex-shrink-0 flex flex-col max-h-[36dvh] md:max-h-none md:border-r border-b md:border-b-0 border-fg/[0.06] bg-surface-0"
              onClick={() => scanRef.current?.focus()}
            >
              {/* Active rack display — big, scanner-visible */}
              {activeRack ? (
                <div className="px-3 md:px-5 pt-3 pb-3 md:pt-5 md:pb-4 border-b border-brand/15 bg-brand/[0.04] flex-shrink-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <BoxSelect className="w-4 h-4 text-brand/60 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold text-brand/50 uppercase tracking-widest">กำลังสแกนเข้า</p>
                        <p className="text-xl font-bold text-brand leading-tight">{activeRack.name}</p>
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setActiveRackId(null); }}
                      className="mt-0.5 text-[10px] px-2 py-1 rounded border border-brand/20 text-brand/40 hover:text-brand hover:border-brand/50 transition-colors flex-shrink-0">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  {/* Per-rack progress */}
                  {(() => {
                    const stat = rackPackStats.find((s) => s.rack.id === activeRack.id);
                    if (!stat) return null;
                    return (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-black/30 rounded-full h-1.5 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-300"
                            style={{ width: stat.total > 0 ? `${Math.round(stat.prepared / stat.total * 100)}%` : "0%", backgroundColor: stat.done ? "#4ade80" : "var(--brand)" }} />
                        </div>
                        <span className={`text-[11px] font-bold tabular-nums flex-shrink-0 ${stat.done ? "text-green-400" : "text-brand/70"}`}>
                          {stat.prepared}/{stat.total}
                          {stat.done && " ✓"}
                        </span>
                      </div>
                    );
                  })()}
                  {/* Next rack hint when current is full */}
                  {rackPackStats.find((s) => s.rack.id === activeRack.id)?.done && (
                    <p className="text-[11px] text-green-400/80 mt-2 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> ครบแล้ว — สแกน barcode แร็คถัดไปเพื่อสลับ
                    </p>
                  )}
                </div>
              ) : (
                <div className="px-3 md:px-5 pt-3 pb-3 md:pt-5 md:pb-4 border-b border-fg/[0.06] flex-shrink-0">
                  <p className="text-[10px] font-bold text-fg/30 uppercase tracking-widest mb-1">ยังไม่ได้เลือกแร็ค</p>
                  <p className="text-base font-bold text-fg/50">สแกน barcode แร็ค</p>
                  <p className="text-[11px] text-fg/30 mt-1">
                    หรือเลือกแร็คจากรายการ<span className="md:hidden">ด้านล่าง</span><span className="hidden md:inline">ทางขวา</span>
                  </p>
                </div>
              )}

              {/* Scan input */}
              <div className="px-3 md:px-5 py-4 border-b border-fg/[0.06] flex-shrink-0">
                <div className="relative">
                  <ScanLine className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fg/30 pointer-events-none" />
                  {scanning && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fg/40 animate-spin" />}
                  <input
                    ref={scanRef}
                    type="text"
                    value={scanValue}
                    onChange={(e) => setScanValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleScan(scanValue); }}
                    placeholder={activeRack ? `สแกนของ → ${activeRack.name}` : "สแกน barcode แร็ค หรือสแกนของ..."}
                    autoFocus
                    className="w-full bg-fg/[0.06] border border-fg/10 rounded-xl pl-10 pr-10 py-3 text-sm text-fg placeholder-fg/25 outline-none focus:border-brand/50 focus:bg-fg/[0.08] transition-all"
                  />
                </div>
                <p className="text-[10px] text-fg/20 mt-2 text-center">
                  {activeRack
                    ? "สแกน barcode แร็คอื่น = สลับแร็คทันที ไม่ต้องกลับมากดที่หน้าจอ"
                    : "สแกน barcode แร็คก่อน เพื่อเลือกแร็คที่ใช้งาน"}
                </p>
              </div>

              {/* Scan log feed */}
              <div className="flex-1 overflow-y-auto px-3 md:px-5 py-3 space-y-1.5">
                {scanLog.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-fg/20 gap-2">
                    <Hash className="w-8 h-8" />
                    <p className="text-xs text-center">รายการสแกนจะแสดงที่นี่<br/>ล่าสุดอยู่ด้านบน</p>
                  </div>
                ) : (
                  scanLog.map((entry, idx) => {
                    const isRackEntry = entry.type === "rack_switch" && !!entry.rackId;
                    const isActiveRack = isRackEntry && entry.rackId === activeRackId;
                    return (
                    <div key={entry.id}
                      onClick={() => isRackEntry && handleSelectRack(entry.rackId!)}
                      title={isRackEntry ? "คลิกเพื่อเลือกแร็คนี้อีกครั้ง" : undefined}
                      className={`flex items-start gap-3 px-3 py-2 rounded-lg transition-opacity
                        ${isRackEntry ? "cursor-pointer hover:bg-brand/[0.1]" : ""}
                        ${idx === 0 ? "opacity-100" : idx < 3 ? "opacity-70" : "opacity-40"}
                        ${entry.type === "rack_switch" ? "bg-brand/[0.06] border border-brand/15"
                          : entry.type === "item_ok"    ? "bg-fg/[0.03]"
                          : entry.type === "item_already" ? "bg-amber-500/[0.06]"
                          : "bg-red-500/[0.06]"}`}>
                      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5
                        ${entry.type === "rack_switch" ? "bg-brand/15 text-brand"
                          : entry.type === "item_ok"    ? "bg-green-500/15 text-green-400"
                          : entry.type === "item_already" ? "bg-amber-500/15 text-amber-400"
                          : "bg-red-500/15 text-red-400"}`}>
                        {entry.type === "rack_switch"   ? <ArrowRightLeft className="w-2.5 h-2.5" />
                          : entry.type === "item_ok"    ? <CheckCircle2 className="w-2.5 h-2.5" />
                          : entry.type === "item_already" ? <CheckCircle2 className="w-2.5 h-2.5" />
                          : <AlertCircle className="w-2.5 h-2.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold truncate
                          ${entry.type === "rack_switch" ? "text-brand"
                            : entry.type === "item_ok"   ? "text-fg"
                            : entry.type === "item_already" ? "text-amber-300"
                            : "text-red-400"}`}>
                          {entry.type === "rack_switch" ? `↕ ${entry.text}` : entry.text}
                        </p>
                        {entry.sub && <p className="text-[10px] text-fg/35 truncate">{entry.sub}</p>}
                        {entry.rack && <p className="text-[10px] text-brand/40 truncate">→ {entry.rack}</p>}
                      </div>
                      {isActiveRack && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-brand text-black font-bold flex-shrink-0">กำลังใช้</span>}
                      {idx === 0 && !isActiveRack && <div className="w-1.5 h-1.5 rounded-full bg-brand flex-shrink-0 mt-1.5 animate-pulse" />}
                    </div>
                    );
                  })
                )}
              </div>

              {/* Download packing sheet — secondary/utility action, kept low-key so it
                  doesn't visually compete with the live scan log above it */}
              <div className="border-t border-fg/10 p-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="tap-target w-full flex items-center justify-center gap-2 h-11 md:h-9 px-4 text-sm font-medium rounded-lg border border-fg/10 text-fg/60 hover:text-fg hover:border-fg/20 disabled:opacity-40 transition-colors"
                >
                  {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  ดาวน์โหลด Packing Sheet
                </button>
              </div>
            </div>

            {/* ── Right: Inventory + Rack List ───────────────── */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              {/* Top bar: progress + rack chips + buttons */}
              <div className="px-3 md:px-5 py-3 border-b border-fg/[0.06] flex-shrink-0 bg-fg/[0.015] space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-fg/10 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${packProgress}%`, backgroundColor: "var(--brand)" }} />
                  </div>
                  <span className="text-xs text-fg/60 flex-shrink-0 tabular-nums">{notPlannedCount}/{totalUnits}</span>
                  {allPrepared && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand/10 text-brand font-bold flex items-center gap-1 flex-shrink-0">
                      <Zap className="w-3 h-3" /> พร้อม → Dispatch
                    </span>
                  )}
                  <button onClick={() => markAllPrepared.mutate()} disabled={markAllPrepared.isPending || allPrepared}
                    className="flex items-center gap-1 h-9 md:h-7 px-3 md:px-2.5 rounded-lg text-xs md:text-[10px] font-bold border border-fg/10 text-fg/60 md:text-fg/50 hover:text-fg hover:border-fg/30 disabled:opacity-40 transition-colors flex-shrink-0">
                    {markAllPrepared.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                    All Prepared
                  </button>
                </div>

                {/* Rack chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] text-fg/25 font-bold uppercase tracking-wider flex-shrink-0">แร็ค:</span>
                  {availableRacks.map((r) => {
                    const stat = rackPackStats.find((s) => s.rack.id === r.id);
                    const isActive = activeRackId === r.id;
                    return (
                      <button key={r.id} onClick={() => handleSelectRack(r.id)}
                        className={`flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[10px] font-bold border transition-colors
                          ${isActive ? "border-brand bg-brand/15 text-brand"
                            : stat?.done ? "border-green-500/30 bg-green-500/10 text-green-400"
                            : "border-fg/10 bg-fg/[0.04] text-fg/50 hover:text-fg hover:border-fg/30"}`}>
                        <BoxSelect className="w-2.5 h-2.5" />
                        {r.name}
                        {stat && <span className="opacity-60">{stat.prepared}/{stat.total}</span>}
                        {stat?.done && <CheckCircle2 className="w-2.5 h-2.5 text-green-400" />}
                        {r.jobId !== job.id && <span className="opacity-50">+</span>}
                      </button>
                    );
                  })}
                  {availableRacks.length === 0 && <span className="text-xs text-fg/20">ยังไม่มีแร็คในระบบ</span>}
                </div>
              </div>

              {/* Missing required accessory warning — informational only, ไม่บล็อกงาน */}
              {accessoryShortfalls.length > 0 && (
                <div className="mx-3 mt-3 flex-shrink-0 rounded-lg bg-amber-400/[0.06] border border-amber-400/20 px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-amber-400">ขาดอุปกรณ์เสริมที่จำเป็น</p>
                      <div className="space-y-1 mt-1.5">
                        {accessoryShortfalls.map((s) => (
                          <div key={s.stockItemId} className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-fg/70 truncate">{s.name}</span>
                            <span className="text-[10px] text-amber-300/90 font-mono whitespace-nowrap">มี {s.got} / ต้องการ {s.wanted}</span>
                            <button
                              onClick={() => setManageStockSearch(s.name)}
                              className="flex items-center gap-1 h-8 md:h-6 px-2.5 md:px-2 rounded-lg md:rounded text-xs md:text-[10px] font-bold text-black flex-shrink-0 hover:opacity-80 transition-opacity"
                              style={{ backgroundColor: "var(--brand)" }}
                            >
                              <Plus className="w-2.5 h-2.5" />เพิ่ม
                            </button>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-fg/50 mt-2">คำเตือนนี้ไม่บล็อกการแพ็ค/ดิสแพตช์</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Unit list */}
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                {packedGroups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-2 text-fg/30">
                    <Package className="w-10 h-10" />
                    <p className="text-sm">ยังไม่มีอุปกรณ์ใน job นี้</p>
                    <p className="text-xs">เพิ่มอุปกรณ์ผ่าน "Edit Units" ก่อน</p>
                  </div>
                ) : (
                  packedGroups.map(({ itemName, units, accessoryOfName }) => {
                    const expanded  = expandedGroups.has(itemName);
                    const prepared  = units.filter((u) => u.phase !== "planned").length;
                    const allReady  = prepared === units.length;
                    const rackIds   = units.map((u) => unitContainerMap[u.id]).filter(Boolean);
                    const rackIdFreq: Record<string, number> = {};
                    for (const id of rackIds) rackIdFreq[id] = (rackIdFreq[id] ?? 0) + 1;
                    const primaryRackId = Object.entries(rackIdFreq).sort((a, b) => b[1] - a[1])[0]?.[0];
                    const primaryRack   = jobRacks.find((r) => r.id === primaryRackId);
                    const rackBadge     = primaryRack ? (rackIds.length < units.length ? `${primaryRack.name}…` : primaryRack.name) : null;
                    const zone          = units.find((u) => u.position)?.position ?? null;

                    return (
                      <div key={itemName} className="bg-fg/[0.025] border border-fg/[0.05] rounded-xl overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-fg/[0.02] transition-colors" onClick={() => toggleGroup(itemName)}>
                          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-fg/25 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-fg/25 flex-shrink-0" />}
                          {allReady ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" /> : <div className="w-3.5 h-3.5 rounded-full border border-fg/20 flex-shrink-0" />}
                          <span className="font-medium text-sm text-fg flex-1 min-w-0 truncate">{itemName}</span>
                          {accessoryOfName && (
                            <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-fg/[0.06] text-fg/40 flex-shrink-0" title={`อุปกรณ์เสริมของ ${accessoryOfName}`}>
                              <Link2 className="w-2.5 h-2.5" />{accessoryOfName}
                            </span>
                          )}
                          {zone && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-brand/10 text-brand/70 flex-shrink-0 font-semibold">{zone}</span>
                          )}
                          <span className="text-[10px] text-fg/40 tabular-nums flex-shrink-0">{prepared}/{units.length}</span>
                          {rackBadge && (
                            <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-fg/[0.06] text-fg/40 flex-shrink-0 ml-1" title={`ตอนนี้อยู่ในแร็ค: ${rackBadge}`}>
                              <BoxSelect className="w-2.5 h-2.5" />{rackBadge}
                            </span>
                          )}
                          {activeRack && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const plannedUnits = units.filter((u) => u.phase === "planned");
                                const ops: Promise<unknown>[] = [...units.map((u) => containersApi.addUnit(activeRack.id, u.id))];
                                if (plannedUnits.length > 0) ops.push(jobsApi.updatePhase(job.id, plannedUnits.map((u) => u.id), "prepared"));
                                await Promise.all(ops);
                                qc.invalidateQueries({ queryKey: ["job-units", job.id] });
                                qc.invalidateQueries({ queryKey: ["containers"] });
                              }}
                              title={`ย้ายอุปกรณ์กลุ่มนี้ทั้งหมดไปที่แร็ค "${activeRack.name}" (แร็คที่กำลังใช้อยู่)`}
                              className="flex items-center gap-1 h-5 px-1.5 rounded text-[9px] font-bold border border-brand/25 text-brand/60 hover:text-brand hover:border-brand/50 transition-colors flex-shrink-0 ml-1"
                            >
                              ย้ายทั้งหมด → {activeRack.name}
                            </button>
                          )}
                        </div>

                        {expanded && (
                          <div className="border-t border-fg/[0.04]">
                            {units.map((u) => {
                              const unitRack = jobRacks.find((r) => r.id === unitContainerMap[u.id]);
                              return (
                                <div key={u.id} className="flex items-center gap-2 px-4 py-2 border-b border-fg/[0.025] last:border-0">
                                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${phaseDot(u.phase)}`} />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-xs text-fg/80">{u.name || "—"}</span>
                                    {u.serialNumber && <span className="text-[10px] text-fg/35 ml-1.5 font-mono">SN:{u.serialNumber}</span>}
                                    {u.barcode && <span className="text-[10px] text-fg/25 ml-1.5 font-mono">BC:{u.barcode}</span>}
                                  </div>
                                  {unitRack && <span className="text-[9px] text-fg/25 flex-shrink-0">{unitRack.name}</span>}
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0
                                    ${u.phase === "returned" ? "bg-emerald-500/15 text-emerald-400" : u.phase === "dispatched" ? "bg-blue-500/15 text-blue-400" : u.phase === "prepared" ? "bg-amber-500/15 text-amber-400" : "bg-fg/8 text-fg/35"}`}>
                                    {phaseLabel(u.phase)}
                                  </span>
                                  {jobRacks.length > 0 && (
                                    <select
                                      className="bg-surface-1 border border-fg/10 rounded px-1 py-0.5 text-[9px] text-fg/35 outline-none cursor-pointer hover:border-fg/25 flex-shrink-0"
                                      value={unitContainerMap[u.id] ?? ""}
                                      onChange={(e) => { if (!e.target.value) return; containersApi.addUnit(e.target.value, u.id).then(() => qc.invalidateQueries({ queryKey: ["containers"] })); }}
                                    >
                                      <option value="">{unitRack ? "ย้าย" : "→ แร็ค"}</option>
                                      {jobRacks.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                  )}
                                  {unitRack && (
                                    <button
                                      onClick={() => containersApi.removeUnit(unitRack.id, u.id).then(() => qc.invalidateQueries({ queryKey: ["containers"] }))}
                                      title="นำออกจากแร็ค (สแกน/เลือกผิด)"
                                      className="p-1 rounded text-fg/50 hover:text-red-400 hover:bg-red-400/10 transition-colors flex-shrink-0"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {u.phase === "planned" && (
                                    <button
                                      onClick={() => {
                                        if (!confirm(`นำ "${u.name || u.itemName}" ออกจากรายการอุปกรณ์ของงานนี้?`)) return;
                                        const remainingIds = jobUnits.filter((x) => x.id !== u.id).map((x) => x.id);
                                        const ops: Promise<unknown>[] = [jobsApi.setUnits(job.id, remainingIds)];
                                        if (unitRack) ops.push(containersApi.removeUnit(unitRack.id, u.id));
                                        Promise.all(ops).then(() => {
                                          qc.invalidateQueries({ queryKey: ["job-units", job.id] });
                                          qc.invalidateQueries({ queryKey: ["containers"] });
                                        });
                                      }}
                                      title="เอาออกจากงานนี้ (เลือกผิด/ไม่ใช้แล้ว)"
                                      className="p-1 rounded text-fg/50 hover:text-red-400 hover:bg-red-400/10 transition-colors flex-shrink-0"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {u.phase === "planned" && (
                                    <button
                                      onClick={() => {
                                        const ops: Promise<unknown>[] = [jobsApi.updatePhase(job.id, [u.id], "prepared")];
                                        if (activeRackId) ops.push(containersApi.addUnit(activeRackId, u.id));
                                        Promise.all(ops).then(() => {
                                          qc.invalidateQueries({ queryKey: ["job-units", job.id] });
                                          if (activeRackId) qc.invalidateQueries({ queryKey: ["containers"] });
                                        });
                                      }}
                                      className="text-[9px] px-1.5 py-0.5 rounded border border-fg/10 text-fg/35 hover:text-fg hover:border-fg/25 transition-colors flex-shrink-0"
                                    >→ OK</button>
                                  )}
                                  {u.phase === "prepared" && (
                                    <button
                                      onClick={() => {
                                        const ops: Promise<unknown>[] = [jobsApi.updatePhase(job.id, [u.id], "planned")];
                                        if (unitRack) ops.push(containersApi.removeUnit(unitRack.id, u.id));
                                        Promise.all(ops).then(() => {
                                          qc.invalidateQueries({ queryKey: ["job-units", job.id] });
                                          qc.invalidateQueries({ queryKey: ["containers"] });
                                        });
                                      }}
                                      title="ยกเลิก — เลือกผิด กลับเป็นวางแผน"
                                      className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border border-fg/10 text-fg/35 hover:text-red-400 hover:border-red-400/30 transition-colors flex-shrink-0"
                                    >
                                      <RotateCcw className="w-2.5 h-2.5" />ยกเลิก
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
          </div>
        )}

        {/* ════════════════════════════════════════
            DISPATCH TAB — same scanner-first layout as Pack (blue accent)
            Left: scanner station  Right: rack list
        ════════════════════════════════════════ */}
        {!isLoading && tab === "dispatch" && (
          <div className="flex flex-col md:flex-row flex-1 min-h-0">

            {/* ── Left: Scanner Station — full width & capped height on mobile
                (stacked above the list, thumb reach), fixed side column on md+ ── */}
            <div
              className="w-full md:w-[400px] flex-shrink-0 flex flex-col max-h-[36dvh] md:max-h-none md:border-r border-b md:border-b-0 border-fg/[0.06] bg-surface-0"
              onClick={() => scanRef.current?.focus()}
            >
              {/* Mode context header */}
              <div className="px-3 md:px-5 pt-3 pb-3 md:pt-5 md:pb-4 border-b border-blue-500/15 bg-blue-500/[0.04] flex-shrink-0">
                <div className="flex items-center gap-2 mb-2.5">
                  <Truck className="w-4 h-4 text-blue-400/60 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-blue-400/50 uppercase tracking-widest">กำลังโหลดขึ้นรถ</p>
                    <p className="text-xl font-bold text-blue-400 leading-tight">Dispatch</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-black/30 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300"
                      style={{ width: totalUnits > 0 ? `${Math.round(dispatchedAndReturnedCount / totalUnits * 100)}%` : "0%", backgroundColor: allDispatched ? "#4ade80" : "#3b82f6" }} />
                  </div>
                  <span className={`text-[11px] font-bold tabular-nums flex-shrink-0 ${allDispatched ? "text-green-400" : "text-blue-400/70"}`}>
                    {dispatchedAndReturnedCount}/{totalUnits}{allDispatched && " ✓"}
                  </span>
                </div>
              </div>

              {/* Scan input */}
              <div className="px-3 md:px-5 py-4 border-b border-fg/[0.06] flex-shrink-0">
                <div className="relative">
                  <ScanLine className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fg/30 pointer-events-none" />
                  {scanning && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fg/40 animate-spin" />}
                  <input
                    ref={scanRef}
                    type="text"
                    value={scanValue}
                    onChange={(e) => setScanValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleScan(scanValue); }}
                    placeholder="สแกน barcode แร็ค หรือชิ้นส่วน..."
                    autoFocus
                    className="w-full bg-fg/[0.06] border border-fg/10 rounded-xl pl-10 pr-10 py-3 text-sm text-fg placeholder-fg/25 outline-none focus:border-blue-500/50 focus:bg-fg/[0.08] transition-all"
                  />
                </div>
                <p className="text-[10px] text-fg/20 mt-2 text-center">สแกนแร็ค = โหลดทั้งแร็คขึ้นรถ · สแกนของ = dispatch ทีละชิ้น</p>
              </div>

              {/* Scan log feed */}
              <LogFeed entries={dispatchLog} emptyHint={"รายการสแกนจะแสดงที่นี่\nล่าสุดอยู่ด้านบน"} />
            </div>

            {/* ── Right: Rack list ───────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              {/* Top bar: progress + dispatch button */}
              <div className="px-3 md:px-5 py-3 border-b border-fg/[0.06] flex-shrink-0 bg-fg/[0.015]">
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-fg/10 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: rackStats.length > 0 ? `${Math.round((racksLoaded / rackStats.length) * 100)}%` : "0%", backgroundColor: "#3b82f6" }} />
                  </div>
                  <span className="text-xs text-fg/60 flex-shrink-0 tabular-nums">{racksLoaded}/{rackStats.length} แร็คบนรถ</span>
                  {allDispatched && (
                    <button onClick={dispatchJob} disabled={dispatching || job.status === "active"}
                      className="flex items-center gap-1 h-9 md:h-7 px-3 rounded-lg text-xs md:text-[10px] font-bold text-black hover:opacity-90 disabled:opacity-40 transition-opacity flex-shrink-0"
                      style={{ backgroundColor: "var(--brand)" }}>
                      {dispatching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Truck className="w-3 h-3" />}
                      {job.status === "active" ? "Active แล้ว" : "Dispatch Job →"}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {rackStats.length === 0 && looseJobUnits.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 gap-2 text-fg/30">
                  <Truck className="w-10 h-10" /><p className="text-sm">ยังไม่มีแร็คใน job นี้</p>
                </div>
              )}
              {rackStats.map(({ rack, total, dispatched, isLoaded, isPartial }) => {
                const pct = total > 0 ? Math.round((dispatched / total) * 100) : 0;
                return (
                  <div key={rack.id} className={`flex flex-wrap items-center gap-2 md:gap-4 px-3 md:px-5 py-3 md:py-4 rounded-xl border transition-colors
                    ${isLoaded ? "bg-green-500/5 border-green-500/20" : isPartial ? "bg-amber-500/5 border-amber-500/20" : "bg-fg/[0.02] border-fg/[0.06]"}`}>
                    {isLoaded ? <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" /> : <div className="w-5 h-5 rounded-full border-2 border-fg/20 flex-shrink-0" />}
                    <div className="flex-1 min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium ${isLoaded ? "text-green-400" : "text-fg"}`}>{rack.name}</p>
                        {rack.type && <span className="text-xs text-fg/40">{rack.type}</span>}
                        {isPartial && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium">⚠ partial</span>}
                      </div>
                      <p className="text-xs text-fg/40 mt-0.5">{dispatched}/{total} dispatched</p>
                    </div>
                    <div className="w-20 md:w-32 flex-shrink-0">
                      <div className="bg-fg/10 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: isLoaded ? "#4ade80" : isPartial ? "#f59e0b" : "var(--brand)" }} />
                      </div>
                    </div>
                    <span className={`text-xs font-medium w-16 text-right flex-shrink-0 ${isLoaded ? "text-green-400" : isPartial ? "text-amber-400" : "text-fg/30"}`}>
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
                        className="tap-target flex items-center gap-1 h-9 md:h-7 px-3 rounded-lg text-xs font-bold border border-fg/10 text-fg/60 md:text-fg/50 hover:text-fg hover:border-fg/30 transition-colors flex-shrink-0"
                      >
                        <Truck className="w-3 h-3" /> โหลด
                      </button>
                    )}
                  </div>
                );
              })}

              {looseJobUnits.length > 0 && (
                <div className="mt-4">
                  <p className="text-[10px] font-bold text-fg/30 uppercase tracking-wider mb-2 px-1">ของที่ไม่อยู่ในแร็ค ({looseJobUnits.length})</p>
                  <div className="bg-fg/[0.02] border border-fg/[0.06] rounded-xl overflow-hidden">
                    {looseJobUnits.map((u, idx) => (
                      <div key={u.id} className={`flex items-center gap-3 px-3 md:px-5 py-2.5 ${idx < looseJobUnits.length - 1 ? "border-b border-fg/[0.04]" : ""}`}>
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${phaseDot(u.phase)}`} />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-fg">{u.itemName}</span>
                          {u.serialNumber && <span className="text-xs text-fg/40 ml-2">SN:{u.serialNumber}</span>}
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium
                          ${u.phase === "returned" ? "bg-emerald-500/15 text-emerald-400" : u.phase === "dispatched" ? "bg-blue-500/15 text-blue-400" : u.phase === "prepared" ? "bg-amber-500/15 text-amber-400" : "bg-fg/10 text-fg/40"}`}>
                          {phaseLabel(u.phase)}
                        </span>
                        {u.barcode && <span className="text-[10px] text-fg/30 font-mono">{u.barcode}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════
            RETURN TAB — same scanner-first layout as Pack (emerald accent)
            Left: scanner station  Right: manifest list
        ════════════════════════════════════════ */}
        {!isLoading && tab === "return" && (
          <div className="flex flex-col md:flex-row flex-1 min-h-0">

            {/* ── Left: Scanner Station — full width & capped height on mobile
                (stacked above the list, thumb reach), fixed side column on md+ ── */}
            <div
              className="w-full md:w-[400px] flex-shrink-0 flex flex-col max-h-[36dvh] md:max-h-none md:border-r border-b md:border-b-0 border-fg/[0.06] bg-surface-0"
              onClick={() => returnScanRef.current?.focus()}
            >
              {/* Mode context header */}
              <div className="px-3 md:px-5 pt-3 pb-3 md:pt-5 md:pb-4 border-b border-emerald-500/15 bg-emerald-500/[0.04] flex-shrink-0">
                <div className="flex items-center gap-2 mb-2.5">
                  <RotateCcw className="w-4 h-4 text-emerald-400/60 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-emerald-400/50 uppercase tracking-widest">กำลังคืนอุปกรณ์</p>
                    <p className="text-xl font-bold text-emerald-400 leading-tight">Return</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-black/30 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300"
                      style={{ width: returnTotal > 0 ? `${Math.round(returnedCount / returnTotal * 100)}%` : "0%", backgroundColor: returnDone ? "#4ade80" : "#34d399" }} />
                  </div>
                  <span className={`text-[11px] font-bold tabular-nums flex-shrink-0 ${returnDone ? "text-green-400" : "text-emerald-400/70"}`}>
                    {returnedCount}/{returnTotal}{returnDone && " ✓"}
                  </span>
                </div>
              </div>

              {/* Scan input */}
              <div className="px-3 md:px-5 py-4 border-b border-fg/[0.06] flex-shrink-0">
                <div className="relative">
                  <ScanLine className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fg/30 pointer-events-none" />
                  {returnScanning && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fg/40 animate-spin" />}
                  <input
                    ref={returnScanRef}
                    type="text"
                    value={returnScanValue}
                    onChange={(e) => setReturnScanValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleReturnScan(returnScanValue); }}
                    placeholder="สแกน barcode เพื่อคืน..."
                    autoFocus
                    className="w-full bg-fg/[0.06] border border-fg/10 rounded-xl pl-10 pr-10 py-3 text-sm text-fg placeholder-fg/25 outline-none focus:border-emerald-500/50 focus:bg-fg/[0.08] transition-all"
                  />
                </div>
                <p className="text-[10px] text-fg/20 mt-2 text-center">สแกน barcode อุปกรณ์ที่คืนเข้าคลัง</p>
              </div>

              {/* Scan log feed */}
              <LogFeed entries={returnLog} emptyHint={"รายการสแกนจะแสดงที่นี่\nล่าสุดอยู่ด้านบน"} />
            </div>

            {/* ── Right: Manifest list ───────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              {/* Top bar: progress */}
              <div className="px-3 md:px-5 py-3 border-b border-fg/[0.06] flex-shrink-0 bg-fg/[0.015]">
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-fg/10 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500 bg-emerald-400"
                      style={{ width: returnTotal > 0 ? `${Math.round(returnedCount / returnTotal * 100)}%` : "0%" }} />
                  </div>
                  <span className="text-xs text-fg/60 flex-shrink-0 tabular-nums">{returnedCount}/{returnTotal} คืนแล้ว</span>
                </div>
              </div>

              {/* Manifest grouped list */}
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                {manifestReturnUnits.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-2 text-fg/30">
                    <RotateCcw className="w-10 h-10" /><p className="text-sm">ยังไม่มีอุปกรณ์ที่ออกงาน</p>
                  </div>
                ) : (
                  Object.entries(
                    manifestReturnUnits.reduce((acc, u) => {
                      if (!acc[u.itemName]) acc[u.itemName] = [];
                      acc[u.itemName].push(u);
                      return acc;
                    }, {} as Record<string, AssignedUnit[]>)
                  ).sort(([a], [b]) => a.localeCompare(b)).map(([itemName, units]) => {
                    const returned = units.filter((u) => u.phase === "returned" || returnScannedIds.has(u.id)).length;
                    const allBack  = returned === units.length;
                    return (
                      <div key={itemName} className="bg-fg/[0.025] border border-fg/[0.05] rounded-xl overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          {allBack ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /> : <div className="w-3.5 h-3.5 rounded-full border border-fg/20 flex-shrink-0" />}
                          <span className="font-medium text-sm text-fg flex-1 min-w-0 truncate">{itemName}</span>
                          <span className="text-[10px] text-fg/40 tabular-nums flex-shrink-0">{returned}/{units.length}</span>
                        </div>
                        <div className="border-t border-fg/[0.04]">
                          {units.map((u) => {
                            const isReturned = u.phase === "returned";
                            const isTicked   = isReturned || returnScannedIds.has(u.id);
                            return (
                              <div key={u.id} className={`flex items-center gap-2 px-4 py-2 border-b border-fg/[0.025] last:border-0 ${isReturned && !returnScannedIds.has(u.id) ? "opacity-60" : ""}`}>
                                {isTicked
                                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                                  : <div className="w-3.5 h-3.5 rounded-full border border-fg/20 flex-shrink-0" />}
                                <div className="flex-1 min-w-0">
                                  <span className="text-xs text-fg/80">{u.name || "—"}</span>
                                  {u.serialNumber && <span className="text-[10px] text-fg/35 ml-1.5 font-mono">SN:{u.serialNumber}</span>}
                                  {u.barcode && <span className="text-[10px] text-fg/25 ml-1.5 font-mono">BC:{u.barcode}</span>}
                                </div>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${isTicked ? "bg-emerald-500/15 text-emerald-400" : "bg-blue-500/15 text-blue-400"}`}>
                                  {isTicked ? "คืนแล้ว" : "dispatched"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

    </WorkspaceShell>
    {manageStockSearch !== null && (
      <ManageJobStockModal
        jobId={job.id}
        jobName={job.name}
        initialSearch={manageStockSearch}
        onClose={() => setManageStockSearch(null)}
      />
    )}
    </>
  );
};
