import React, { useState, useMemo } from "react";
import { X, Boxes, Search, Loader2, AlertTriangle, Layers } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { equipmentSetsApi, jobsApi, stockApi } from "@/api";
import type { EquipmentSetSummary } from "@/api";
import type { StockItem } from "@shared/schema";

interface Props {
  jobId:   string;
  onClose: () => void;
}

type Shortfall = { stockItemId: string; wanted: number; got: number };

export const AddSetToJobModal = ({ jobId, onClose }: Props): JSX.Element => {
  const { token } = useAppStore();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [error,  setError]  = useState<string | null>(null);
  const [result, setResult] = useState<{ name: string; shortfall: Shortfall[] } | null>(null);

  const { data: sets = [], isLoading } = useQuery<EquipmentSetSummary[]>({
    queryKey: ["equipment-sets"],
    queryFn: equipmentSetsApi.getAll,
    enabled: !!token,
  });

  // ชื่อ item สำหรับแสดง shortfall
  const { data: stock = [] } = useQuery<StockItem[]>({
    queryKey: ["stock"],
    queryFn: stockApi.getAll,
    enabled: !!token,
  });
  const nameById = useMemo(() => Object.fromEntries(stock.map((s) => [s.id, s.name])), [stock]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sets;
    return sets.filter((s) =>
      s.name.toLowerCase().includes(q) || (s.description ?? "").toLowerCase().includes(q));
  }, [sets, search]);

  const applyMutation = useMutation({
    mutationFn: (setId: string) => jobsApi.applySet(jobId, setId),
    onSuccess: (res, setId) => {
      qc.invalidateQueries({ queryKey: ["job-units", jobId] });
      qc.invalidateQueries({ queryKey: ["job-bulk-stock", jobId] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["stock-with-units"] });
      const set = sets.find((s) => s.id === setId);
      if (res.shortfall && res.shortfall.length > 0) {
        setResult({ name: set?.name ?? "", shortfall: res.shortfall });   // มีของไม่พอ → แสดงเตือน
      } else {
        onClose();   // ครบ → ปิดเลย
      }
    },
    onError: (err: any) => setError(err?.message ?? "เพิ่มชุดไม่สำเร็จ"),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-[#0f0f0f] border border-white/[0.08] rounded-2xl shadow-2xl animate-modal-up flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FFFF00]/10 flex items-center justify-center">
              <Boxes className="w-4 h-4 text-[#FFFF00]" />
            </div>
            <h2 className="font-bold text-white text-sm">เพิ่มชุดอุปกรณ์เข้างาน</h2>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {result ? (
          /* หน้าสรุป shortfall */
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="flex items-center gap-2 mb-3 text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              <p className="text-sm font-bold">เพิ่ม "{result.name}" แล้ว แต่ของบางรายการไม่พอ</p>
            </div>
            <div className="space-y-1.5">
              {result.shortfall.map((s) => (
                <div key={s.stockItemId} className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-400/[0.06] border border-amber-400/20">
                  <span className="text-xs text-white/80 truncate">{nameById[s.stockItemId] ?? "อุปกรณ์"}</span>
                  <span className="text-[11px] text-amber-300/90 font-mono whitespace-nowrap">ได้ {s.got}/{s.wanted}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-white/50 mt-3">
              ระบบเพิ่มเท่าที่มีของว่างให้แล้ว ส่วนที่ขาดสามารถจัดหา (เช่า/ยืม) เพิ่มภายหลังได้
            </p>
            <button onClick={onClose}
              className="mt-4 w-full h-9 rounded-lg text-sm font-bold text-black hover:opacity-80"
              style={{ backgroundColor: "#FFFF00" }}>
              เข้าใจแล้ว
            </button>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="px-5 pt-4 pb-2 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/60" />
                <input autoFocus placeholder="ค้นหาชุด…" value={search} onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#FFFF00]/40" />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-2">
              {isLoading && (
                <div className="flex items-center justify-center gap-2 py-12 text-white/60">
                  <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">กำลังโหลด…</span>
                </div>
              )}

              {!isLoading && filtered.map((s) => (
                <button key={s.id}
                  onClick={() => { setError(null); applyMutation.mutate(s.id); }}
                  disabled={applyMutation.isPending}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-[#FFFF00]/30 hover:bg-[#FFFF00]/[0.04] transition-all text-left disabled:opacity-40">
                  {s.imageUrl
                    ? <img src={s.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                    : <div className="w-9 h-9 rounded-lg bg-[#FFFF00]/10 flex items-center justify-center flex-shrink-0"><Layers className="w-4 h-4 text-[#FFFF00]/60" /></div>}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white/80 truncate">{s.name}</p>
                    <p className="text-[10px] text-white/60 mt-0.5">{s.itemCount} รายการ · {s.totalQty} ชิ้น{s.description ? ` · ${s.description}` : ""}</p>
                  </div>
                  {applyMutation.isPending && applyMutation.variables === s.id && <Loader2 className="w-4 h-4 animate-spin text-[#FFFF00]/60" />}
                </button>
              ))}

              {!isLoading && filtered.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Boxes className="w-8 h-8 text-white/40" />
                  <p className="text-xs text-white/60">{sets.length === 0 ? "ยังไม่มีชุดอุปกรณ์ — สร้างได้ที่ Stock → ชุดอุปกรณ์" : "ไม่พบชุด"}</p>
                </div>
              )}
            </div>
          </>
        )}

        {error && (
          <div className="mx-5 mb-3 text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2 flex-shrink-0">{error}</div>
        )}
      </div>
    </div>
  );
};
