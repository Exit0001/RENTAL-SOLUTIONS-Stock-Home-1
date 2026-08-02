import React, { useRef, useEffect, useState, useMemo } from "react";
import {
  ScanLine, CheckCircle2, AlertCircle, Loader2, Download,
  Boxes, Search, Package, Trash2,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { stockApi, containersApi, jobsApi } from "@/api";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { MasterDetail } from "@/components/MasterDetail";
import { ResponsiveTable } from "@/components/ResponsiveTable";
import { DataCard } from "@/components/DataCard";
import type { ContainerWithItems } from "@/api";

interface ScanFeedback {
  type:       "success" | "error" | "switch";
  message:    string;
  detail?:    string;
}

interface Props {
  open:    boolean;
  onClose: () => void;
  jobId?:  string;
  jobName?: string;
}

export const RackBuildModal = ({ open, onClose, jobId, jobName }: Props): JSX.Element | null => {
  const { token }      = useAppStore();
  const qc             = useQueryClient();
  const inputRef       = useRef<HTMLInputElement>(null);
  const rackScanRef    = useRef<HTMLInputElement>(null);

  const [activeRackId, setActiveRackId]   = useState<string | null>(null);
  const [value, setValue]                 = useState("");
  const [rackScanValue, setRackScanValue] = useState("");
  const [scanning, setScanning]           = useState(false);
  const [feedback, setFeedback]           = useState<ScanFeedback | null>(null);
  const [search, setSearch]               = useState("");
  const [downloading, setDownloading]     = useState(false);

  const { data: allContainers = [], isLoading } = useQuery<ContainerWithItems[]>({
    queryKey: ["containers"],
    queryFn:  containersApi.getAll,
    enabled:  !!token && open,
  });

  // ถ้า jobId → แสดงเฉพาะ containers ที่อยู่ใน job นั้น
  const racks: ContainerWithItems[] = useMemo(() => {
    if (!jobId) return allContainers;
    return allContainers.filter((c) => c.jobId === jobId);
  }, [allContainers, jobId]);

  const filteredRacks = useMemo(() => {
    if (!search.trim()) return racks;
    const q = search.toLowerCase();
    return racks.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.type ?? "").toLowerCase().includes(q) ||
        (r.location ?? "").toLowerCase().includes(q)
    );
  }, [racks, search]);

  const activeRack: ContainerWithItems | undefined = racks.find((r) => r.id === activeRackId);

  // auto-focus scan input เมื่อ active rack เปลี่ยน
  useEffect(() => {
    if (activeRackId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeRackId]);

  // clear feedback หลัง 3 วินาที
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(t);
  }, [feedback]);

  // ใช้ได้ทั้งจากช่องสแกนแร็คในรายการ (master, ยังไม่ได้เลือกแร็ค) และช่องสแกนของในแร็คที่เลือกอยู่
  // (detail) — clearInput ให้แต่ละฝั่งเคลียร์ค่า/โฟกัสอินพุตของตัวเอง ไม่ผูกกับ ref/state ตัวใดตัวหนึ่ง
  const handleScan = async (rawBarcode: string, clearInput: () => void) => {
    const barcode = rawBarcode.trim();
    if (!barcode) return;

    // 1. ตรวจก่อนว่า barcode ตรงกับ container ใด → เปลี่ยน active rack
    const matchedRack = racks.find(
      (r) => r.barcode && r.barcode.toLowerCase() === barcode.toLowerCase()
    );
    if (matchedRack) {
      setActiveRackId(matchedRack.id);
      setFeedback({ type: "switch", message: `เปลี่ยนไปแร็ค: ${matchedRack.name}` });
      clearInput();
      return;
    }

    // 2. ต้องเลือก rack ก่อนจึงจะเพิ่ม unit ได้
    if (!activeRackId) {
      setFeedback({ type: "error", message: "เลือกแร็คก่อน แล้วค่อยสแกนของ" });
      clearInput();
      return;
    }

    setScanning(true);
    try {
      // scan barcode → ได้ unit
      const unit = await stockApi.scanBarcode(barcode);

      // ตรวจว่า unit อยู่ใน rack อื่นอยู่ก่อนไหม
      const prevRack = allContainers.find((c) =>
        c.id !== activeRackId && c.items.some((item) => item.id === unit.id)
      );

      // เพิ่มเข้า rack นี้ (server auto-move)
      await containersApi.addUnit(activeRackId, unit.id);
      qc.invalidateQueries({ queryKey: ["containers"] });

      setFeedback({
        type:    "success",
        message: `${unit.itemName} — ${unit.name || unit.serialNumber || barcode}`,
        detail:  prevRack ? `ย้ายจาก ${prevRack.name}` : undefined,
      });
    } catch (err: any) {
      setFeedback({
        type:    "error",
        message: err?.message ?? "ไม่พบ barcode นี้ในระบบ",
      });
    } finally {
      setScanning(false);
      clearInput();
    }
  };

  const clearDetailScan = () => { setValue(""); inputRef.current?.focus(); };
  const clearRackScan = () => { setRackScanValue(""); rackScanRef.current?.focus(); };

  const handleRemoveUnit = async (unitId: string) => {
    if (!activeRackId) return;
    try {
      await containersApi.removeUnit(activeRackId, unitId);
      qc.invalidateQueries({ queryKey: ["containers"] });
    } catch {}
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = jobId
        ? await jobsApi.downloadContainersPackingSheet(jobId)
        : await containersApi.downloadPackingSheet();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = jobId ? `packing-sheet-job.pdf` : "packing-sheet-all.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
    setDownloading(false);
  };

  if (!open) return null;

  // Sort active rack items by category → name
  const sortedItems = activeRack
    ? [...activeRack.items].sort((a, b) => {
        const cat = (a.category ?? "").localeCompare(b.category ?? "");
        return cat !== 0 ? cat : (a.itemName ?? "").localeCompare(b.itemName ?? "");
      })
    : [];

  return (
    <WorkspaceShell
      icon={<Boxes className="w-4 h-4 text-black" />}
      title="Rack Build Mode"
      subtitle={jobName || undefined}
      onClose={onClose}
    >
        {/* ── Body — rack list ⇄ active rack detail, push/pop on mobile ── */}
        <MasterDetail
          masterClassName="w-full md:w-64"
          detailOpen={!!activeRackId}
          onBack={() => setActiveRackId(null)}
          detailTitle={activeRack?.name}
          master={
          <div className="h-full flex flex-col md:border-r border-fg/10">
            {/* Scan barcode แร็ค — เข้าโหมดจัดของโดยไม่ต้องแตะรายการ (สำคัญบนมือถือ:
                เป็นทางเดียวที่จะเข้าไปสแกนของได้ก่อนเลือกแร็คจากรายการ) */}
            <div className="px-3 pt-3 pb-2 flex-shrink-0">
              <div className="relative">
                <ScanLine className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fg/30 pointer-events-none" />
                <input
                  ref={rackScanRef}
                  type="text"
                  value={rackScanValue}
                  onChange={(e) => setRackScanValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleScan(rackScanValue, clearRackScan); }}
                  placeholder="สแกน barcode แร็ค…"
                  className="w-full h-11 bg-fg/[0.06] border border-fg/10 rounded-lg pl-10 pr-3 text-sm
                    text-fg placeholder-fg/30 outline-none focus:border-brand/50"
                />
              </div>
              {feedback && !activeRackId && (
                <div
                  className={`mt-2 flex items-start gap-2 text-xs rounded-lg px-3 py-2
                    ${feedback.type === "success" ? "bg-green-500/10 text-green-400" :
                      feedback.type === "switch"  ? "bg-brand/10 text-brand" :
                                                    "bg-red-500/10 text-red-400"}`}
                >
                  {feedback.type === "success" ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> :
                   feedback.type === "switch"   ? <Boxes className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> :
                                                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                  <span>{feedback.message}</span>
                </div>
              )}
            </div>

            {/* Search */}
            <div className="px-3 py-2 border-b border-fg/[0.06]">
              <div className="flex items-center gap-2 bg-fg/[0.04] rounded-lg px-3 py-1.5">
                <Search className="w-3.5 h-3.5 text-fg/40 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="ค้นหาแร็ค..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-transparent text-sm text-fg placeholder-fg/30 outline-none w-full"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto py-1">
              {isLoading ? (
                <div className="flex items-center justify-center h-20">
                  <Loader2 className="w-5 h-5 text-fg/30 animate-spin" />
                </div>
              ) : filteredRacks.length === 0 ? (
                <div className="px-4 py-8 text-center text-fg/30 text-sm">
                  {jobId ? "ยังไม่มีแร็คใน job นี้" : "ไม่มีแร็ค"}
                </div>
              ) : (
                filteredRacks.map((rack) => {
                  const isActive = rack.id === activeRackId;
                  return (
                    <button
                      key={rack.id}
                      onClick={() => setActiveRackId(rack.id)}
                      className={`w-full text-left px-3 py-2.5 flex items-center gap-2 transition-colors
                        ${isActive
                          ? "bg-brand/10 border-l-2 border-brand"
                          : "border-l-2 border-transparent hover:bg-fg/[0.04]"
                        }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isActive ? "text-brand" : "text-fg"}`}>
                          {rack.name}
                        </p>
                        <p className="text-[11px] text-fg/40 truncate">{rack.type}</p>
                      </div>
                      <span className={`text-xs font-mono flex-shrink-0 ${isActive ? "text-brand/70" : "text-fg/40"}`}>
                        {rack.items.length}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Download PDF — เฉพาะโหมด global (ไม่มี jobId) เท่านั้น
                ถ้าเปิดจากในงาน ให้โหลด packing sheet จากปุ่ม "PDF" ในแท็บ Pack (Job Operations) แทน
                เพราะเป็นไฟล์เดียวกัน — Rack Build Mode มีหน้าที่จัดแร็คทิ้งไว้อย่างเดียว */}
            {!jobId && (
              <div className="border-t border-fg/10 p-3">
                <button
                  onClick={handleDownload}
                  disabled={downloading || racks.length === 0}
                  className="tap-target w-full flex items-center justify-center gap-2 h-11 md:h-9 px-4 text-sm font-bold rounded-lg
                    disabled:opacity-40 hover:opacity-90"
                  style={{ backgroundColor: "var(--brand)", color: "#000" }}
                >
                  {downloading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Download className="w-4 h-4" />
                  }
                  ดาวน์โหลด Packing Sheet
                </button>
              </div>
            )}
          </div>
          }
          detail={
          <div className="h-full flex flex-col min-w-0">
            {!activeRack ? (
              /* ยังไม่เลือก rack — สแกน barcode แร็คได้จากช่องด้านซ้าย (รายการแร็ค) */
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-fg/30 px-6 text-center">
                <ScanLine className="w-16 h-16" />
                <div>
                  <p className="text-base font-medium text-fg/40">เลือกแร็คก่อน</p>
                  <p className="text-sm mt-1">คลิกที่รายการ หรือสแกน barcode แร็คทางซ้าย</p>
                </div>
              </div>
            ) : (
              <>
                {/* Rack Info Header */}
                <div className="px-3 md:px-5 py-3 border-b border-fg/10 flex-shrink-0 bg-fg/[0.02]">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-bold text-brand">{activeRack.name}</p>
                      <p className="text-xs text-fg/40">
                        {activeRack.type}
                        {activeRack.location ? ` — ${activeRack.location}` : ""}
                        <span className="ml-2 text-fg/30">{activeRack.items.length} รายการ</span>
                      </p>
                    </div>
                    {activeRack.isOut && (
                      <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">
                        Check Out
                      </span>
                    )}
                  </div>
                </div>

                {/* Scan Input */}
                <div className="px-3 md:px-5 py-4 border-b border-fg/[0.06] flex-shrink-0">
                  <label className="text-[11px] text-fg/40 font-bold uppercase tracking-wider mb-2 block">
                    สแกน barcode อุปกรณ์
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg/30" />
                      <input
                        ref={inputRef}
                        type="text"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleScan(value, clearDetailScan);
                        }}
                        placeholder="สแกนหรือพิมพ์ barcode แล้วกด Enter..."
                        className="w-full h-11 md:h-auto bg-fg/[0.06] border border-fg/10 rounded-lg pl-10 pr-4 py-2.5 text-sm
                          text-fg placeholder-fg/30 outline-none focus:border-brand/50"
                      />
                    </div>
                    {scanning && <Loader2 className="w-5 h-5 text-fg/40 animate-spin flex-shrink-0" />}
                  </div>

                  {/* Feedback */}
                  {feedback && (
                    <div
                      className={`mt-2 flex items-start gap-2 text-sm rounded-lg px-3 py-2
                        ${feedback.type === "success" ? "bg-green-500/10 text-green-400" :
                          feedback.type === "switch"  ? "bg-brand/10 text-brand" :
                                                        "bg-red-500/10 text-red-400"}`}
                    >
                      {feedback.type === "success" ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /> :
                       feedback.type === "switch"   ? <Boxes className="w-4 h-4 flex-shrink-0 mt-0.5" /> :
                                                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                      <div>
                        <p className="font-medium">{feedback.message}</p>
                        {feedback.detail && <p className="text-xs opacity-70 mt-0.5">{feedback.detail}</p>}
                      </div>
                    </div>
                  )}
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto">
                  {sortedItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-2 text-fg/30">
                      <Package className="w-10 h-10" />
                      <p className="text-sm">ยังไม่มีของในแร็คนี้</p>
                    </div>
                  ) : (
                    <ResponsiveTable
                      table={
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-fg/[0.06]">
                              <th className="text-left px-5 py-2.5 text-[10px] font-bold text-fg/30 uppercase tracking-wider">Category</th>
                              <th className="text-left px-3 py-2.5 text-[10px] font-bold text-fg/30 uppercase tracking-wider">อุปกรณ์</th>
                              <th className="text-left px-3 py-2.5 text-[10px] font-bold text-fg/30 uppercase tracking-wider">S/N</th>
                              <th className="text-left px-3 py-2.5 text-[10px] font-bold text-fg/30 uppercase tracking-wider">Barcode</th>
                              <th className="text-left px-3 py-2.5 text-[10px] font-bold text-fg/30 uppercase tracking-wider">Status</th>
                              <th className="px-3 py-2.5 w-10" />
                            </tr>
                          </thead>
                          <tbody>
                            {sortedItems.map((item, idx) => (
                              <tr
                                key={item.id}
                                className={`border-b border-fg/[0.04] ${idx % 2 === 0 ? "" : "bg-fg/[0.015]"}`}
                              >
                                <td className="px-5 py-2.5 text-xs text-fg/50">{item.category || "—"}</td>
                                <td className="px-3 py-2.5 font-medium text-fg">{item.itemName || item.name || "—"}</td>
                                <td className="px-3 py-2.5 text-xs text-fg/50 font-mono">{item.serialNumber || "—"}</td>
                                <td className="px-3 py-2.5 text-xs text-fg/50 font-mono">{item.barcode || "—"}</td>
                                <td className="px-3 py-2.5">
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium
                                    ${item.status === "available" ? "bg-green-500/15 text-green-400" :
                                      item.status === "out"       ? "bg-amber-500/15 text-amber-400" :
                                      item.status === "maintenance" ? "bg-red-500/15 text-red-400" :
                                                                     "bg-fg/10 text-fg/50"}`}>
                                    {item.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5">
                                  <button
                                    onClick={() => handleRemoveUnit(item.id)}
                                    className="tap-target p-1 rounded text-fg/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                    title="ลบออกจากแร็ค"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      }
                      className="px-3 pt-3"
                      cards={sortedItems.map((item) => (
                        <DataCard
                          key={item.id}
                          title={item.itemName || item.name || "—"}
                          badge={
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap
                              ${item.status === "available" ? "bg-green-500/15 text-green-400" :
                                item.status === "out"       ? "bg-amber-500/15 text-amber-400" :
                                item.status === "maintenance" ? "bg-red-500/15 text-red-400" :
                                                               "bg-fg/10 text-fg/50"}`}>
                              {item.status}
                            </span>
                          }
                          fields={[
                            { label: "Category", value: item.category || "—" },
                            { label: "S/N", value: item.serialNumber || "—" },
                            { label: "Barcode", value: item.barcode || "—" },
                          ]}
                          actions={
                            <button
                              onClick={() => handleRemoveUnit(item.id)}
                              className="tap-target flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[11px] font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />ลบออกจากแร็ค
                            </button>
                          }
                        />
                      ))}
                    />
                  )}
                </div>
              </>
            )}
          </div>
          }
        />
    </WorkspaceShell>
  );
};
