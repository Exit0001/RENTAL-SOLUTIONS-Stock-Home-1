import React, { useState, useMemo } from "react";
import { X, Layers, Search, Loader2, Box as BoxIcon, Briefcase, ShoppingBag, Package, MapPin } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { containersApi, jobsApi } from "@/api";
import type { ContainerWithItems } from "@/api";

interface Props {
  jobId:   string;
  onClose: () => void;
}

const typeIcons: Record<string, typeof Layers> = {
  rack:  Layers,
  case:  Briefcase,
  bag:   ShoppingBag,
  box:   BoxIcon,
  other: Package,
};

export const AssignContainerModal = ({ jobId, onClose }: Props): JSX.Element => {
  const { t } = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const { token } = useAppStore();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [error,  setError]  = useState<string | null>(null);

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
    mutationFn: (containerId: string) => jobsApi.addContainer(jobId, containerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-containers", jobId] });
      qc.invalidateQueries({ queryKey: ["containers"] });
      qc.invalidateQueries({ queryKey: ["job-units", jobId] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      onClose();
    },
    onError: (err: any) => setError(err.message ?? t("assignContainer.errorAddFailed")),
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
              <Layers className="w-4 h-4 text-[#FFFF00]" />
            </div>
            <h2 className="font-bold text-white text-sm">{t("assignContainer.title")}</h2>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-4 pb-2 flex-shrink-0">
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

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-2">
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
                onClick={() => { setError(null); assignMutation.mutate(c.id); }}
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

        {error && (
          <div className="mx-5 mb-3 text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2 flex-shrink-0">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};
