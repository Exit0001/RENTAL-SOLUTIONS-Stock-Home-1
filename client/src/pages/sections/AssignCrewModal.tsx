import { useState, useMemo } from "react";
import { X, Users, Search, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { crewApi, jobsApi } from "@/api";
import type { CrewMemberRow, CrewType } from "@/api";

interface Props {
  jobId:   string;
  onClose: () => void;
}

export const CREW_TYPE_LABEL: Record<CrewType, string> = {
  own_crew:   "ทีมงานประจำ",
  freelancer: "ฟรีแลนซ์",
  outsource:  "Outsource",
  loader:     "เด็กโหลด",
};

const initialsOf = (name: string): string => {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[1][0]).toUpperCase();
};

export const AssignCrewModal = ({ jobId, onClose }: Props): JSX.Element => {
  const { token } = useAppStore();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<CrewType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: roster = [], isLoading: rosterLoading } = useQuery<CrewMemberRow[]>({
    queryKey: ["crew-members"],
    queryFn: () => crewApi.getRoster(),
    enabled: !!token,
  });

  const { data: jobCrew = [], isLoading: jobCrewLoading } = useQuery({
    queryKey: ["job-crew", jobId],
    queryFn: () => jobsApi.getJobCrew(jobId),
    enabled: !!token,
  });

  const isLoading = rosterLoading || jobCrewLoading;

  const available = useMemo(() => {
    const assigned = new Set(jobCrew.map((c) => c.crewMemberId));
    return roster.filter((m) => m.active && !assigned.has(m.id));
  }, [roster, jobCrew]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return available.filter((m) =>
      (!typeFilter || m.type === typeFilter) &&
      (!q || m.name.toLowerCase().includes(q) || (m.role ?? "").toLowerCase().includes(q)));
  }, [available, search, typeFilter]);

  const assignMutation = useMutation({
    mutationFn: (crewMemberId: string) => jobsApi.assignCrew(jobId, crewMemberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-crew", jobId] });
      qc.invalidateQueries({ queryKey: ["crew-matrix"] });
      onClose();
    },
    onError: (err: any) => setError(err?.message ?? "เพิ่มทีมงานไม่สำเร็จ"),
  });

  const types: CrewType[] = ["own_crew", "freelancer", "outsource", "loader"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md bg-[#0f0f0f] border border-white/[0.08] rounded-2xl shadow-2xl animate-modal-up flex flex-col max-h-[85vh]">

        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FFFF00]/10 flex items-center justify-center"><Users className="w-4 h-4 text-[#FFFF00]" /></div>
            <h2 className="font-bold text-white text-sm">เพิ่มทีมงานเข้างาน</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {/* Search + type filter */}
        <div className="px-5 pt-4 pb-2 flex-shrink-0 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/60" />
            <input autoFocus placeholder="ค้นหาชื่อ / ตำแหน่ง…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#FFFF00]/40" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setTypeFilter(null)}
              className={`h-6 px-2.5 rounded-full text-[11px] font-semibold border transition-colors ${!typeFilter ? "bg-[#FFFF00] text-black border-[#FFFF00]" : "text-white/60 border-white/10 hover:border-white/30"}`}>ทั้งหมด</button>
            {types.map((ty) => (
              <button key={ty} onClick={() => setTypeFilter(typeFilter === ty ? null : ty)}
                className={`h-6 px-2.5 rounded-full text-[11px] font-semibold border transition-colors ${typeFilter === ty ? "bg-[#FFFF00] text-black border-[#FFFF00]" : "text-white/60 border-white/10 hover:border-white/30"}`}>{CREW_TYPE_LABEL[ty]}</button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-2">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-12 text-white/60"><Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">กำลังโหลด…</span></div>
          )}
          {!isLoading && filtered.map((m) => (
            <button key={m.id} onClick={() => { setError(null); assignMutation.mutate(m.id); }} disabled={assignMutation.isPending}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-[#FFFF00]/30 hover:bg-[#FFFF00]/[0.04] transition-all text-left disabled:opacity-40">
              <div className="w-8 h-8 rounded-full bg-[#FFFF00]/10 flex items-center justify-center text-xs font-bold text-[#FFFF00]/70 flex-shrink-0">{initialsOf(m.name)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white/80 truncate">{m.name}</p>
                <p className="text-[10px] text-white/60">{CREW_TYPE_LABEL[m.type]}{m.role ? ` · ${m.role}` : ""}</p>
              </div>
              {m.userId && <span className="text-[9px] text-emerald-400/70 bg-emerald-400/10 px-1.5 py-0.5 rounded-full">มี account</span>}
            </button>
          ))}
          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Users className="w-8 h-8 text-white/40" />
              <p className="text-xs text-white/60">{available.length === 0 ? "ทีมงานทั้งหมดถูก assign แล้ว — เพิ่มคนใหม่ได้ที่หน้าทีมงาน" : "ไม่พบทีมงาน"}</p>
            </div>
          )}
        </div>

        {error && <div className="mx-5 mb-3 text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2 flex-shrink-0">{error}</div>}
      </div>
    </div>
  );
};
