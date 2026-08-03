import { useState, useMemo, useEffect } from "react";
import {
  Users, Truck, Plus, Pencil, Trash2, Check, Minus, BadgeCheck, CalendarClock, ClipboardList, X,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useAppStore } from "@/store/appStore";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { ScrollTabs } from "@/components/ScrollTabs";
import { jobColor } from "@/lib/jobColors";
import { crewApi, vehiclesApi, jobsApi, jobVehiclesApi } from "@/api";
import type { CrewMemberRow, VehicleRow, JobCrewMember, JobVehicleRow, CrewType } from "@/api";
import { AddCrewMemberModal } from "./AddCrewMemberModal";
import { AddVehicleRosterModal } from "./AddVehicleRosterModal";
import { AddResourcesModal } from "./AddResourcesModal";
import { ResourceScheduleView, type ResourceRow } from "./ResourceScheduleView";
import { CREW_TYPE_LABEL } from "./AssignCrewModal";
import { JobDailyScheduleSection } from "./JobDailyScheduleSection";

const NAMED_TYPES: CrewType[] = ["own_crew", "freelancer"];
const COUNT_TYPES: CrewType[] = ["outsource", "loader"];
const ROLE_PRESETS = ["FOH", "Monitor", "เวที", "ช่างไฟ", "คนขับ", "Loader", "ทั่วไป"];
const NO_ROLE = "ไม่ระบุตำแหน่ง";

const initialsOf = (name: string): string => {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[1][0]).toUpperCase();
};
const fmt = (d?: string | Date | null) => d ? new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short" }) : "";

type MobilePane = "roster" | "schedule" | "callsheet";

export const CrewPage = (): JSX.Element => {
  const { token, userRole } = useAppStore();
  const canManage = userRole === "admin" || userRole === "manager";
  const qc = useQueryClient();

  const { isMobile } = useBreakpoint();
  const [mobilePane, setMobilePane] = useState<MobilePane>("schedule");
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [groupMode, setGroupMode] = useState<"role" | "type">("role");
  const [error, setError] = useState<string | null>(null);
  // roster popups
  const [crewModalOpen, setCrewModalOpen] = useState(false);
  const [editCrew, setEditCrew] = useState<CrewMemberRow | null>(null);
  const [deleteCrewTarget, setDeleteCrewTarget] = useState<CrewMemberRow | null>(null);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState<VehicleRow | null>(null);
  const [deleteVehicleTarget, setDeleteVehicleTarget] = useState<VehicleRow | null>(null);
  // เพิ่มหลายรายการทีเดียว (workspace เต็มจอ) — null=ปิด
  const [addResourceTab, setAddResourceTab] = useState<"crew" | "vehicle" | null>(null);

  // ── shared data ────────────────────────────────────────
  const { data: roster = [] } = useQuery<CrewMemberRow[]>({ queryKey: ["crew-members"], queryFn: () => crewApi.getRoster(), enabled: !!token });
  const { data: vehicles = [] } = useQuery<VehicleRow[]>({ queryKey: ["vehicles"], queryFn: vehiclesApi.getRoster, enabled: !!token });
  const { data: jobs = [] } = useQuery({ queryKey: ["jobs"], queryFn: jobsApi.getAll, enabled: !!token });
  const { data: crewMatrix = [] } = useQuery({ queryKey: ["crew-matrix"], queryFn: crewApi.getMatrix, enabled: !!token });
  const { data: vehicleMatrix = [] } = useQuery({ queryKey: ["vehicle-matrix"], queryFn: vehiclesApi.getMatrix, enabled: !!token });

  const sid = selectedJob?.id as string | undefined;
  const { data: jobCrew = [] } = useQuery<JobCrewMember[]>({ queryKey: ["job-crew", sid], queryFn: () => jobsApi.getJobCrew(sid!), enabled: !!token && !!sid });
  const { data: jobVehicles = [] } = useQuery<JobVehicleRow[]>({ queryKey: ["job-vehicles", sid], queryFn: () => jobVehiclesApi.getForJob(sid!), enabled: !!token && !!sid });
  const { data: jobCounts = [] } = useQuery({ queryKey: ["job-crew-counts", sid], queryFn: () => jobsApi.getCrewCounts(sid!), enabled: !!token && !!sid });

  const assignedCrew = useMemo(() => new Set(jobCrew.map((c) => c.crewMemberId)), [jobCrew]);
  const assignedVehicle = useMemo(() => new Map(jobVehicles.filter((v) => v.vehicleId).map((v) => [v.vehicleId as string, v.id])), [jobVehicles]);
  const countByType = useMemo(() => { const m = new Map<CrewType, number>(); for (const r of jobCounts) m.set(r.type, r.count); return m; }, [jobCounts]);
  const totalCount = COUNT_TYPES.reduce((s, ty) => s + (countByType.get(ty) ?? 0), 0);

  // Picking a job on mobile jumps to its call sheet. Keyed on the id (not the object) so
  // it fires once per selection and doesn't fight a user who tabs back to the roster.
  useEffect(() => {
    if (isMobile && sid) setMobilePane("callsheet");
  }, [sid, isMobile]);

  const onErr = (e: any) => setError(e?.message ?? "ผิดพลาด");
  const invCrew = () => { qc.invalidateQueries({ queryKey: ["job-crew", sid] }); qc.invalidateQueries({ queryKey: ["crew-matrix"] }); };
  const invVeh = () => { qc.invalidateQueries({ queryKey: ["job-vehicles", sid] }); qc.invalidateQueries({ queryKey: ["vehicle-matrix"] }); };

  const addCrew = useMutation({ mutationFn: (id: string) => jobsApi.assignCrew(sid!, id), onSuccess: invCrew, onError: onErr });
  const removeCrew = useMutation({ mutationFn: (id: string) => jobsApi.unassignCrew(sid!, id), onSuccess: invCrew, onError: onErr });
  const setRole = useMutation({ mutationFn: (v: { id: string; role: string | null }) => jobsApi.updateCrewRole(sid!, v.id, v.role), onSuccess: invCrew, onError: onErr });
  const addVeh = useMutation({ mutationFn: (vehicleId: string) => jobVehiclesApi.create(sid!, { vehicleId }), onSuccess: invVeh, onError: onErr });
  const removeVeh = useMutation({ mutationFn: (rowId: string) => jobVehiclesApi.delete(rowId), onSuccess: invVeh, onError: onErr });
  const setDriver = useMutation({ mutationFn: (v: { id: string; driverCrewMemberId: string | null }) => jobVehiclesApi.update(v.id, { driverCrewMemberId: v.driverCrewMemberId }), onSuccess: invVeh, onError: onErr });
  const setCount = useMutation({ mutationFn: (v: { type: CrewType; count: number }) => jobsApi.setCrewCount(sid!, v.type, v.count), onSuccess: () => qc.invalidateQueries({ queryKey: ["job-crew-counts", sid] }), onError: onErr });

  const deleteCrew = useMutation({ mutationFn: (id: string) => crewApi.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["crew-members"] }); setDeleteCrewTarget(null); } });
  const deleteVehicle = useMutation({ mutationFn: (id: string) => vehiclesApi.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicles"] }); setDeleteVehicleTarget(null); } });

  const toggleCrew = (id: string) => { if (!sid) return; setError(null); assignedCrew.has(id) ? removeCrew.mutate(id) : addCrew.mutate(id); };
  const toggleVeh = (v: VehicleRow) => { if (!sid) return; setError(null); const rowId = assignedVehicle.get(v.id); rowId ? removeVeh.mutate(rowId) : addVeh.mutate(v.id); };
  const bumpCount = (ty: CrewType, delta: number) => { if (!sid) return; setError(null); setCount.mutate({ type: ty, count: Math.max(0, (countByType.get(ty) ?? 0) + delta) }); };

  // ── roster (left) grouping ─────────────────────────────
  const rosterByType = useMemo(() => {
    const m = new Map<CrewType, CrewMemberRow[]>();
    for (const ty of NAMED_TYPES) m.set(ty, []);
    for (const c of roster) if (c.active && NAMED_TYPES.includes(c.type)) m.get(c.type)?.push(c);
    return m;
  }, [roster]);

  // ── schedule (center) ──────────────────────────────────
  const scheduleRows: ResourceRow[] = useMemo(() => {
    const crewRows: ResourceRow[] = [];
    for (const ty of NAMED_TYPES) for (const c of (rosterByType.get(ty) ?? [])) crewRows.push({ id: c.id, name: c.name, initials: initialsOf(c.name), sub: c.role ?? CREW_TYPE_LABEL[ty], group: CREW_TYPE_LABEL[ty] });
    const vehicleRows: ResourceRow[] = vehicles.map((v) => ({ id: v.id, name: v.name, initials: initialsOf(v.name), sub: v.plate ?? v.type ?? "", group: "รถ" }));
    return [...crewRows, ...vehicleRows];
  }, [rosterByType, vehicles]);
  const scheduleAssignments = useMemo(() => [
    ...crewMatrix.map((r) => ({ resourceId: r.crewMemberId, jobId: r.jobId })),
    ...vehicleMatrix.map((r) => ({ resourceId: r.vehicleId, jobId: r.jobId })),
  ], [crewMatrix, vehicleMatrix]);
  const perJobCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of crewMatrix) m.set(r.jobId, (m.get(r.jobId) ?? 0) + 1);
    for (const r of vehicleMatrix) m.set(r.jobId, (m.get(r.jobId) ?? 0) + 1);
    return m;
  }, [crewMatrix, vehicleMatrix]);
  const staffableJobs = useMemo(() =>
    (jobs as any[]).filter((j) => j.status !== "cancelled" && j.status !== "completed")
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
    [jobs]);

  // ── call sheet (right) grouping ────────────────────────
  const crewGroups = useMemo(() => {
    const m = new Map<string, JobCrewMember[]>();
    for (const c of jobCrew) {
      const key = groupMode === "role" ? (c.role || NO_ROLE) : CREW_TYPE_LABEL[c.type];
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(c);
    }
    return Array.from(m.entries()).sort((a, b) => (a[0] === NO_ROLE ? 1 : b[0] === NO_ROLE ? -1 : a[0].localeCompare(b[0])));
  }, [jobCrew, groupMode]);
  const drivers = roster.filter((c) => c.active);

  // reusable roster row (crew)
  const CrewRosterRow = ({ m }: { m: CrewMemberRow }) => {
    const on = assignedCrew.has(m.id);
    return (
      <div className={`group/row flex items-center gap-2 px-2 py-2 min-h-[48px] rounded-lg transition-colors ${on ? "bg-brand/[0.08]" : "hover:bg-fg/[0.03]"}`}>
        <button onClick={() => toggleCrew(m.id)} disabled={!sid} className="flex items-center gap-2 flex-1 min-w-0 text-left disabled:cursor-default">
          {m.imageUrl
            ? <img src={m.imageUrl} alt={m.name} className="w-8 h-8 rounded-full object-cover border border-fg/10 flex-shrink-0" />
            : <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center text-[11px] font-bold text-brand/70 flex-shrink-0">{initialsOf(m.name)}</div>}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-fg/90 truncate flex items-center gap-1">{m.name}{m.userId && <BadgeCheck className="w-3 h-3 text-emerald-400/70 flex-shrink-0" />}</p>
            {m.role && <p className="text-[11px] text-fg/50 truncate">{m.role}</p>}
          </div>
          {sid && <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${on ? "bg-brand" : "border-2 border-fg/25"}`}>{on && <Check className="w-3.5 h-3.5 text-black" strokeWidth={3} />}</div>}
        </button>
        {canManage && (
          <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover/row:opacity-100 transition-opacity flex-shrink-0">
            <button onClick={() => { setEditCrew(m); setCrewModalOpen(true); }} className="tap-target p-1.5 rounded text-fg/50 hover:text-fg"><Pencil className="w-4 h-4" /></button>
            <button onClick={() => setDeleteCrewTarget(m)} className="tap-target p-1.5 rounded text-fg/50 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
          </div>
        )}
      </div>
    );
  };

  // The job picker strip lives inside the centre pane on desktop, but on mobile it is
  // hoisted above the pane tabs: the roster's tap-to-assign is gated on a selected job,
  // so without this the roster tab would be unusable without tab-hopping.
  const jobPickerStrip = (
    <div className="h-scroll flex items-center gap-2 px-3 md:px-4 py-2 border-b border-fg/10 bg-surface-1 flex-shrink-0">
      <span className="text-xs font-semibold text-fg/50 flex-shrink-0">เลือกงาน:</span>
      {staffableJobs.length === 0 ? <span className="text-xs text-fg/30">ยังไม่มีงาน</span> : staffableJobs.map((j) => {
        const cnt = perJobCount.get(j.id) ?? 0;
        const active = sid === j.id;
        return (
          // กดชิปงานที่เลือกอยู่ซ้ำ = ยกเลิกการเลือก (เดิมเลือกแล้วเลิกไม่ได้เลย)
          <button key={j.id} onClick={() => setSelectedJob(active ? null : j)}
            title={active ? "กดอีกครั้งเพื่อยกเลิกการเลือก" : j.name}
            className={`flex items-center gap-2 h-10 px-3.5 rounded-lg border transition-colors flex-shrink-0 ${active ? "border-brand bg-brand/10" : "border-fg/10 bg-fg/[0.02] hover:border-brand/40"}`}>
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: jobColor(j.id, j.color).bg }}
            />
            <span className={`text-sm font-semibold whitespace-nowrap ${active ? "text-brand" : "text-fg/85"}`}>{j.name}</span>
            <span className="text-xs text-fg/45 whitespace-nowrap">{new Date(j.startDate).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</span>
            {cnt > 0 && <span className="text-xs font-bold text-brand bg-brand/10 px-1.5 rounded-full">{cnt}</span>}
            {active && <X className="w-3.5 h-3.5 text-brand/70 flex-shrink-0" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page header */}
      <div className="flex items-center gap-3 px-3 md:px-6 py-3 border-b border-fg/[0.06] flex-shrink-0">
        <Users className="w-5 h-5 text-brand flex-shrink-0" aria-hidden="true" />
        <h1 className="text-base md:text-lg font-bold text-fg truncate">ทีมงานและรถ</h1>
        {error && <span className="ml-auto text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-1 flex-shrink-0">{error}</span>}
      </div>

      {isMobile && jobPickerStrip}
      {isMobile && (
        <ScrollTabs
          tabs={[
            { key: "roster", label: "คลังคน/รถ", Icon: Users },
            { key: "schedule", label: "ตาราง", Icon: CalendarClock },
            { key: "callsheet", label: "ใบเรียกทีม", Icon: ClipboardList, count: selectedJob ? jobCrew.length + totalCount : undefined },
          ]}
          active={mobilePane}
          onChange={(k) => setMobilePane(k as MobilePane)}
          variant="underline"
          className="border-b border-fg/[0.06] flex-shrink-0 px-2"
          testIdPrefix="tab-crew"
        />
      )}

      <div className="flex-1 flex min-h-0">

        {/* ── LEFT: roster ──────────────────────────────── */}
        <aside className={`${isMobile ? (mobilePane === "roster" ? "flex w-full" : "hidden") : "flex w-[250px] lg:w-[280px] flex-shrink-0 border-r"} flex-col border-fg/[0.06] bg-surface-1`}>
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-fg/[0.06] flex-shrink-0">
            <span className="text-xs font-bold text-fg/50">คลังคน/รถ</span>
            {canManage && (
              <div className="ml-auto flex items-center gap-1">
                <button onClick={() => setAddResourceTab("crew")} className="flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-bold text-black hover:opacity-90" style={{ backgroundColor: "var(--brand)" }}><Plus className="w-3 h-3" />คน</button>
                <button onClick={() => setAddResourceTab("vehicle")} className="flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-bold text-brand border border-brand/30 hover:bg-brand/10"><Plus className="w-3 h-3" />รถ</button>
              </div>
            )}
          </div>
          {sid ? (
            <p className="px-3 py-1.5 text-[11px] text-fg/50 border-b border-fg/[0.04] flex-shrink-0">คลิกชื่อ/รถเพื่อจัดเข้า <span className="text-brand/70 font-semibold">{selectedJob.name}</span></p>
          ) : (
            <p className="px-3 py-1.5 text-[11px] text-fg/40 border-b border-fg/[0.04] flex-shrink-0">เลือกงานจากตารางกลางเพื่อจัดทีม</p>
          )}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
            {NAMED_TYPES.map((ty) => {
              const members = rosterByType.get(ty) ?? [];
              return (
                <div key={ty}>
                  <div className="px-2 py-1 text-[11px] font-bold text-brand/60 uppercase tracking-wider">{CREW_TYPE_LABEL[ty]} · {members.length}</div>
                  {members.length === 0 ? <p className="px-2 text-[10px] text-fg/25">—</p> : members.map((m) => <CrewRosterRow key={m.id} m={m} />)}
                </div>
              );
            })}
            <div>
              <div className="px-2 py-1 text-[11px] font-bold text-brand/60 uppercase tracking-wider">รถ · {vehicles.length}</div>
              {vehicles.length === 0 ? <p className="px-2 text-[10px] text-fg/25">—</p> : vehicles.filter((v) => v.active).map((v) => {
                const on = assignedVehicle.has(v.id);
                return (
                  <div key={v.id} className={`group/row flex items-center gap-2 px-2 py-2 min-h-[48px] rounded-lg transition-colors ${on ? "bg-brand/[0.08]" : "hover:bg-fg/[0.03]"}`}>
                    <button onClick={() => toggleVeh(v)} disabled={!sid} className="flex items-center gap-2 flex-1 min-w-0 text-left disabled:cursor-default">
                      {v.imageUrl
                        ? <img src={v.imageUrl} alt={v.name} className="w-8 h-8 rounded-lg object-cover border border-fg/10 flex-shrink-0" />
                        : <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0"><Truck className="w-4 h-4 text-brand/60" /></div>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-fg/90 truncate">{v.name}</p>
                        {(v.plate || v.type) && <p className="text-[11px] text-fg/50 truncate">{[v.type, v.plate].filter(Boolean).join(" · ")}</p>}
                      </div>
                      {sid && <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${on ? "bg-brand" : "border-2 border-fg/25"}`}>{on && <Check className="w-3.5 h-3.5 text-black" strokeWidth={3} />}</div>}
                    </button>
                    {canManage && (
                      <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover/row:opacity-100 transition-opacity flex-shrink-0">
                        <button onClick={() => { setEditVehicle(v); setVehicleModalOpen(true); }} className="tap-target p-1.5 rounded text-fg/50 hover:text-fg"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteVehicleTarget(v)} className="tap-target p-1.5 rounded text-fg/50 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* ── CENTER: schedule ──────────────────────────── */}
        <div className={`${isMobile ? (mobilePane === "schedule" ? "flex w-full" : "hidden") : "flex flex-1"} flex-col min-w-0`}>
          {!isMobile && jobPickerStrip}
          <div className="flex-1 overflow-hidden">
            <ResourceScheduleView rows={scheduleRows} jobs={jobs} assignments={scheduleAssignments}
              onBarClick={(job) => setSelectedJob(job)} emptyText="ยังไม่มีทีมงาน/รถ — เพิ่มทางซ้าย" />
          </div>
        </div>

        {/* ── RIGHT: call sheet ─────────────────────────── */}
        <aside className={`${isMobile ? (mobilePane === "callsheet" ? "flex w-full" : "hidden") : "flex w-[320px] lg:w-[380px] flex-shrink-0 border-l"} flex-col border-fg/[0.06] bg-surface-1`}>
          {!selectedJob ? (
            <div className="flex flex-col items-center justify-center h-full text-fg/25 gap-2 px-6 text-center">
              <CalendarClock className="w-10 h-10" />
              <p className="text-sm">เลือกงานจากตารางกลาง<br />เพื่อจัดทีม/รถ</p>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-fg/[0.06] flex-shrink-0">
                <p className="text-sm font-bold text-fg truncate">{selectedJob.name}</p>
                <p className="text-[11px] text-fg/50 flex items-center justify-between mt-0.5">
                  <span>{fmt(selectedJob.startDate)}{selectedJob.endDate ? `–${fmt(selectedJob.endDate)}` : ""}</span>
                  <span className="text-brand/70 font-semibold">{jobCrew.length + totalCount} คน · {jobVehicles.length} รถ</span>
                </p>
                <div className="flex items-center gap-1 mt-2 bg-fg/[0.04] rounded-lg p-0.5 w-fit">
                  <button onClick={() => setGroupMode("role")} className={`px-3 py-1.5 rounded-md text-xs font-bold ${groupMode === "role" ? "bg-brand text-black" : "text-fg/60 hover:text-fg"}`}>ตามตำแหน่ง</button>
                  <button onClick={() => setGroupMode("type")} className={`px-3 py-1.5 rounded-md text-xs font-bold ${groupMode === "type" ? "bg-brand text-black" : "text-fg/60 hover:text-fg"}`}>ตามประเภท</button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                {/* named crew */}
                {crewGroups.map(([gname, members]) => (
                  <div key={gname}>
                    <div className="text-xs font-bold text-brand/70 uppercase tracking-wider mb-2">{gname} · {members.length}</div>
                    <div className="space-y-1.5">
                      {members.map((c) => (
                        <div key={c.crewMemberId} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-fg/[0.07] bg-fg/[0.02]">
                          <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center text-[11px] font-bold text-brand/70 flex-shrink-0">{c.initials}</div>
                          <div className="flex-1 min-w-0"><p className="text-sm text-fg/90 truncate">{c.name}</p><span className="text-[11px] text-fg/50">{CREW_TYPE_LABEL[c.type]}</span></div>
                          <select value={ROLE_PRESETS.includes(c.role ?? "") ? (c.role ?? "") : (c.role ? "__custom" : "")}
                            onChange={(e) => { const v = e.target.value; if (v !== "__custom") setRole.mutate({ id: c.crewMemberId, role: v || null }); }}
                            className="h-8 min-w-[110px] max-w-[150px] px-2 rounded-md bg-fg/[0.04] border border-fg/10 text-xs text-fg/85 focus:outline-none focus:border-brand/40 cursor-pointer">
                            <option value="">ตำแหน่ง</option>
                            {ROLE_PRESETS.map((r) => <option key={r} value={r}>{r}</option>)}
                            {c.role && !ROLE_PRESETS.includes(c.role) && <option value="__custom">{c.role}</option>}
                          </select>
                          <button onClick={() => { setError(null); removeCrew.mutate(c.crewMemberId); }} className="text-fg/30 hover:text-red-400 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* outsource / loader headcount */}
                <div>
                  <div className="text-xs font-bold text-brand/70 uppercase tracking-wider mb-2">แรงงานเหมา (จำนวนคน)</div>
                  <div className="space-y-1.5">
                    {COUNT_TYPES.map((ty) => {
                      const n = countByType.get(ty) ?? 0;
                      return (
                        <div key={ty} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${n > 0 ? "border-brand/25 bg-brand/[0.04]" : "border-fg/[0.07] bg-fg/[0.02]"}`}>
                          <span className="flex-1 text-sm text-fg/85">{CREW_TYPE_LABEL[ty]}</span>
                          <button onClick={() => bumpCount(ty, -1)} disabled={n === 0} className="w-8 h-8 rounded-lg border border-fg/10 flex items-center justify-center text-fg/60 hover:text-fg hover:border-fg/30 active:bg-fg/[0.08] disabled:opacity-30 flex-shrink-0"><Minus className="w-3 h-3" /></button>
                          <span className={`w-6 text-center text-sm font-bold tabular-nums ${n > 0 ? "text-brand" : "text-fg/50"}`}>{n}</span>
                          <button onClick={() => bumpCount(ty, 1)} className="w-8 h-8 rounded-lg border border-fg/10 flex items-center justify-center text-fg/60 hover:text-fg hover:border-fg/30 active:bg-fg/[0.08] flex-shrink-0"><Plus className="w-3 h-3" /></button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* vehicles */}
                {jobVehicles.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-brand/70 uppercase tracking-wider mb-2">รถ · {jobVehicles.length}</div>
                    <div className="space-y-1.5">
                      {jobVehicles.map((v) => (
                        <div key={v.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-fg/[0.07] bg-fg/[0.02]">
                          <div className="w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0"><Truck className="w-3.5 h-3.5 text-brand/60" /></div>
                          <div className="flex-1 min-w-0"><p className="text-sm text-fg/90 truncate">{v.vehicleType}</p>{v.plate && <span className="text-[11px] text-fg/50">{v.plate}</span>}</div>
                          <select value={v.driverCrewMemberId ?? ""} onChange={(e) => setDriver.mutate({ id: v.id, driverCrewMemberId: e.target.value || null })}
                            className="h-8 min-w-[110px] max-w-[150px] px-2 rounded-md bg-fg/[0.04] border border-fg/10 text-xs text-fg/85 focus:outline-none focus:border-brand/40 cursor-pointer">
                            <option value="">คนขับ</option>
                            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                          <button onClick={() => { setError(null); removeVeh.mutate(v.id); }} className="text-fg/30 hover:text-red-400 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* daily schedule */}
                <div>
                  <div className="text-xs font-bold text-brand/70 uppercase tracking-wider mb-2">ตารางรายวัน</div>
                  <JobDailyScheduleSection jobId={sid!} startDate={selectedJob.startDate} endDate={selectedJob.endDate} jobCrew={jobCrew} canManage={canManage} />
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Popups */}
      {crewModalOpen && <AddCrewMemberModal member={editCrew} onClose={() => { setCrewModalOpen(false); setEditCrew(null); }} />}
      {vehicleModalOpen && <AddVehicleRosterModal vehicle={editVehicle} onClose={() => { setVehicleModalOpen(false); setEditVehicle(null); }} />}
      {addResourceTab && <AddResourcesModal initialTab={addResourceTab} onClose={() => setAddResourceTab(null)} />}

      <AlertDialog open={!!deleteCrewTarget} onOpenChange={(o) => !o && setDeleteCrewTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>ลบทีมงาน?</AlertDialogTitle>
            <AlertDialogDescription>ลบ "{deleteCrewTarget?.name}" — จะถูกนำออกจากงานที่ถูก assign ไว้ด้วย</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCrew.isPending}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteCrewTarget && deleteCrew.mutate(deleteCrewTarget.id)} disabled={deleteCrew.isPending} className="bg-red-600 hover:bg-red-700 text-fg">ลบ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteVehicleTarget} onOpenChange={(o) => !o && setDeleteVehicleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>ลบรถ?</AlertDialogTitle>
            <AlertDialogDescription>ลบ "{deleteVehicleTarget?.name}" — จะถูกนำออกจากงานที่ถูก assign ไว้ด้วย</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteVehicle.isPending}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteVehicleTarget && deleteVehicle.mutate(deleteVehicleTarget.id)} disabled={deleteVehicle.isPending} className="bg-red-600 hover:bg-red-700 text-fg">ลบ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
