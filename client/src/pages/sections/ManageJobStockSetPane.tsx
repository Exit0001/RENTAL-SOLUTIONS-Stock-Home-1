import React, { useState, useMemo, useEffect } from "react";
import { Boxes, Search, Loader2, AlertTriangle, Layers, CheckCircle2, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { equipmentSetsApi, jobsApi, stockApi } from "@/api";
import type { EquipmentSetSummary } from "@/api";
import type { StockItem } from "@shared/schema";

interface Props {
  jobId:     string;
  onApplied: (result: {
    units:      { unitId: string; stockItemId: string }[];
    bulkItems:  { stockItemId: string; quantity: number }[];
  }) => void;
}

type Shortfall = { stockItemId: string; wanted: number; got: number };

// เลือกชุดอุปกรณ์ (เช่น ชุดกลอง) ที่บันทึกไว้มาเพิ่มเข้างานนี้ทั้งชุด — inline pane (ไม่ใช่ modal แยก)
// ฝังอยู่ในหน้าเลือกอุปกรณ์หลัก (ManageJobStockModal) เพื่อไม่ต้องสลับหน้าไปมา
export const ManageJobStockSetPane = ({ jobId, onApplied }: Props): JSX.Element => {
  const { t }  = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const { token } = useAppStore();
  const qc = useQueryClient();

  const [search,      setSearch]      = useState("");
  const [error,       setError]       = useState<string | null>(null);
  const [shortfallInfo, setShortfallInfo] = useState<{ name: string; shortfall: Shortfall[] } | null>(null);
  const [lastAdded,   setLastAdded]   = useState<string | null>(null);

  useEffect(() => {
    if (!lastAdded) return;
    const timer = setTimeout(() => setLastAdded(null), 2500);
    return () => clearTimeout(timer);
  }, [lastAdded]);

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
      onApplied({ units: res.addedUnits, bulkItems: res.addedBulkItems });
      const set = sets.find((s) => s.id === setId);
      if (res.shortfall && res.shortfall.length > 0) {
        setShortfallInfo({ name: set?.name ?? "", shortfall: res.shortfall });
      } else {
        setLastAdded(set?.name ?? "");
      }
    },
    onError: (err: any) => setError(err?.message ?? t("addSetToJob.errorApplyFailed")),
  });

  return (
    <div className="flex-1 min-w-0 flex flex-col border-r border-white/[0.06]">
      {/* Search */}
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/60" />
          <input
            autoFocus
            placeholder={t("addSetToJob.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white
              placeholder-white/20 focus:outline-none focus:border-[#FFFF00]/40 transition-all"
          />
        </div>
      </div>

      {shortfallInfo && (
        <div className="mx-4 mb-2 flex-shrink-0 rounded-lg bg-amber-400/[0.06] border border-amber-400/20 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-amber-400">{t("addSetToJob.shortfallTitle", { name: shortfallInfo.name })}</p>
              <div className="space-y-1 mt-1.5">
                {shortfallInfo.shortfall.map((s) => (
                  <div key={s.stockItemId} className="flex items-center justify-between">
                    <span className="text-[11px] text-white/70 truncate">{nameById[s.stockItemId] ?? "?"}</span>
                    <span className="text-[10px] text-amber-300/90 font-mono whitespace-nowrap ml-2">{t("addSetToJob.shortfallGot", { got: s.got, wanted: s.wanted })}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-white/50 mt-2">{t("addSetToJob.shortfallHint")}</p>
            </div>
            <button onClick={() => setShortfallInfo(null)} className="text-white/40 hover:text-white transition-colors flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {lastAdded && (
        <div className="mx-4 mb-2 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-400/10 rounded-lg px-3 py-2 flex-shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
          {t("addSetToJob.addedToast", { name: lastAdded })}
        </div>
      )}

      {error && (
        <div className="mx-4 mb-2 text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2 flex-shrink-0">{error}</div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-12 text-white/60">
            <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">{tc("loading")}</span>
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
              <p className="text-[10px] text-white/60 mt-0.5">
                {t("addSetToJob.itemsSummary", { count: s.itemCount, qty: s.totalQty })}{s.description ? ` · ${s.description}` : ""}
              </p>
            </div>
            {applyMutation.isPending && applyMutation.variables === s.id && <Loader2 className="w-4 h-4 animate-spin text-[#FFFF00]/60" />}
          </button>
        ))}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Boxes className="w-8 h-8 text-white/40" />
            <p className="text-xs text-white/60">{sets.length === 0 ? t("addSetToJob.noSetsYet") : t("addSetToJob.noSetsFound")}</p>
          </div>
        )}
      </div>
    </div>
  );
};
