import { useState, useMemo } from "react";
import { X, Users, Search, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { jobsApi } from "@/api";
import type { CrewMember } from "@/api";

interface Props {
  jobId:   string;
  onClose: () => void;
}

export const AssignCrewModal = ({ jobId, onClose }: Props): JSX.Element => {
  const { t } = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const { token } = useAppStore();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [error,  setError]  = useState<string | null>(null);

  const { data: crewData, isLoading: companyLoading } = useQuery({
    queryKey: ["crew"],
    queryFn: jobsApi.getCrew,
    enabled: !!token,
  });

  const { data: jobCrew = [], isLoading: jobCrewLoading } = useQuery({
    queryKey: ["job-crew", jobId],
    queryFn: () => jobsApi.getJobCrew(jobId),
    enabled: !!token,
  });

  const companyUsers = crewData?.crew ?? [];
  const isLoading = companyLoading || jobCrewLoading;

  // เฉพาะคนที่ยังไม่ได้ถูก assign ให้ job นี้
  const available = useMemo(() => {
    const assignedIds = new Set(jobCrew.map((c) => c.userId));
    return companyUsers.filter((u) => !assignedIds.has(u.id));
  }, [companyUsers, jobCrew]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return available;
    return available.filter((u: CrewMember) => u.name.toLowerCase().includes(q));
  }, [available, search]);

  const assignMutation = useMutation({
    mutationFn: (userId: string) => jobsApi.assignCrew(jobId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-crew", jobId] });
      qc.invalidateQueries({ queryKey: ["crew"] });
      onClose();
    },
    onError: (err: any) => setError(err.message ?? t("assignCrew.errorAssignFailed")),
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
              <Users className="w-4 h-4 text-[#FFFF00]" />
            </div>
            <h2 className="font-bold text-white text-sm">{t("assignCrew.title")}</h2>
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
              placeholder={t("assignCrew.searchPlaceholder")}
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

          {!isLoading && filtered.map((u: CrewMember) => (
            <button
              key={u.id}
              onClick={() => { setError(null); assignMutation.mutate(u.id); }}
              disabled={assignMutation.isPending}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-[#FFFF00]/30 hover:bg-[#FFFF00]/[0.04] transition-all text-left disabled:opacity-40"
            >
              <div className="w-8 h-8 rounded-full bg-[#FFFF00]/10 flex items-center justify-center text-xs font-bold text-[#FFFF00]/70 flex-shrink-0">
                {u.initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white/80 truncate">{u.name}</p>
                <p className="text-[10px] text-white/60 capitalize">{u.role}</p>
              </div>
            </button>
          ))}

          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Users className="w-8 h-8 text-white/40" />
              <p className="text-xs text-white/60">
                {available.length === 0 ? t("assignCrew.noUsersAvailable") : t("assignCrew.noUsersFound")}
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
