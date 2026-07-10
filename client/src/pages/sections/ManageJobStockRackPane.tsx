import React, { useState, useMemo, useEffect } from "react";
import { Layers, Search, Loader2, Box as BoxIcon, Briefcase, ShoppingBag, Package, MapPin, CheckCircle2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { containersApi, jobsApi } from "@/api";
import type { ContainerWithItems } from "@/api";

interface Props {
  jobId:        string;
  onUnitsAdded: (units: { unitId: string; stockItemId: string }[]) => void;
}

const typeIcons: Record<string, typeof Layers> = {
  rack:  Layers,
  case:  Briefcase,
  bag:   ShoppingBag,
  box:   BoxIcon,
  other: Package,
};

// เลือกแร็ค/คอนเทนเนอร์ที่มีอยู่แล้วมาเพิ่มเข้างานนี้ทั้งชุด — inline pane (ไม่ใช่ modal แยก)
// ฝังอยู่ในหน้าเลือกอุปกรณ์หลัก (ManageJobStockModal) เพื่อไม่ต้องสลับหน้าไปมา
export const ManageJobStockRackPane = ({ jobId, onUnitsAdded }: Props): JSX.Element => {
  const { t } = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const { token } = useAppStore();
  const qc = useQueryClient();

  const [search,    setSearch]    = useState("");
  const [error,     setError]     = useState<string | null>(null);
  const [lastAdded, setLastAdded] = useState<{ name: string; count: number } | null>(null);

  useEffect(() => {
    if (!lastAdded) return;
    const timer = setTimeout(() => setLastAdded(null), 2500);
    return () => clearTimeout(timer);
  }, [lastAdded]);

  const { data: containers = [], isLoading } = useQuery<ContainerWithItems[]>({
    queryKey: ["containers"],
    queryFn: containersApi.getAll,
    enabled: !!token,
  });

  // เฉพาะแร็คที่ยังไม่ถูกเอาออกไปงานอื่น
  const available = useMemo(() => containers.filter((c) => !c.isOut), [containers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return available;
    return available.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.location ?? "").toLowerCase().includes(q) ||
      (c.barcode ?? "").toLowerCase().includes(q)
    );
  }, [available, search]);

  const assignMutation = useMutation({
    mutationFn: (container: ContainerWithItems) => jobsApi.addContainer(jobId, container.id).then(() => container),
    onSuccess: (container) => {
      qc.invalidateQueries({ queryKey: ["job-containers", jobId] });
      qc.invalidateQueries({ queryKey: ["containers"] });
      qc.invalidateQueries({ queryKey: ["job-units", jobId] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      onUnitsAdded(container.items.map((i) => ({ unitId: i.id, stockItemId: i.stockItemId })));
      setLastAdded({ name: container.name, count: container.items.length });
    },
    onError: (err: any) => setError(err.message ?? t("assignContainer.errorAddFailed")),
  });

  return (
    <div className="flex-1 min-w-0 flex flex-col border-r border-white/[0.06]">
      {/* Search */}
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/60" />
          <input
            autoFocus
            placeholder={t("assignContainer.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white
              placeholder-white/20 focus:outline-none focus:border-[#FFFF00]/40 transition-all"
          />
        </div>
      </div>

      {lastAdded && (
        <div className="mx-4 mb-2 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-400/10 rounded-lg px-3 py-2 flex-shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
          {t("assignContainer.addedToast", { name: lastAdded.name, count: lastAdded.count })}
        </div>
      )}

      {error && (
        <div className="mx-4 mb-2 text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2 flex-shrink-0">
          {error}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-12 text-white/60">
            <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">{tc("loading")}</span>
          </div>
        )}

        {!isLoading && filtered.map((c) => {
          const Icon = typeIcons[c.type.toLowerCase()] ?? Package;
          return (
            <button
              key={c.id}
              onClick={() => { setError(null); assignMutation.mutate(c); }}
              disabled={assignMutation.isPending}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-[#FFFF00]/30 hover:bg-[#FFFF00]/[0.04] transition-all text-left disabled:opacity-40"
            >
              <Icon className="w-4 h-4 text-[#FFFF00]/60 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white/80 truncate">{c.name}</p>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#FFFF00]/10 text-[#FFFF00]/70 capitalize flex-shrink-0">{c.type}</span>
                </div>
                <p className="text-[10px] text-white/60 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-2.5 h-2.5 flex-shrink-0" /> {c.location || "—"} · {t("assignContainer.itemsCount", { count: c.items.length })}
                </p>
              </div>
              {assignMutation.isPending && assignMutation.variables?.id === c.id && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white/40 flex-shrink-0" />
              )}
            </button>
          );
        })}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Layers className="w-8 h-8 text-white/40" />
            <p className="text-xs text-white/60">
              {available.length === 0 ? t("assignContainer.noRacksAvailable") : t("assignContainer.noRacksFound")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
