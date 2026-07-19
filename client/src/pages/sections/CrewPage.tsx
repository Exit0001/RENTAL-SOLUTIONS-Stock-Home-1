import { useState, useMemo } from "react";
import { Users, Truck, CalendarRange, Plus, Pencil, Trash2, Phone, BadgeCheck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useAppStore } from "@/store/appStore";
import { crewApi, vehiclesApi, jobsApi } from "@/api";
import type { CrewMemberRow, VehicleRow, CrewType } from "@/api";
import { AddCrewMemberModal } from "./AddCrewMemberModal";
import { AddVehicleRosterModal } from "./AddVehicleRosterModal";
import { ResourceScheduleView, type ResourceRow } from "./ResourceScheduleView";
import { JobDetailModal } from "./JobDetailModal";
import { CREW_TYPE_LABEL } from "./AssignCrewModal";

type CrewTab = "roster" | "vehicles" | "schedule";

const TAB_ORDER: CrewType[] = ["own_crew", "freelancer", "outsource", "loader"];

const initialsOf = (name: string): string => {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[1][0]).toUpperCase();
};

export const CrewPage = (): JSX.Element => {
  const { token, userRole } = useAppStore();
  const canManage = userRole === "admin" || userRole === "manager";
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<CrewTab>("roster");
  const [crewModalOpen, setCrewModalOpen] = useState(false);
  const [editCrew, setEditCrew] = useState<CrewMemberRow | null>(null);
  const [deleteCrewTarget, setDeleteCrewTarget] = useState<CrewMemberRow | null>(null);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState<VehicleRow | null>(null);
  const [deleteVehicleTarget, setDeleteVehicleTarget] = useState<VehicleRow | null>(null);
  const [scheduleJob, setScheduleJob] = useState<any>(null);

  const { data: roster = [] } = useQuery<CrewMemberRow[]>({ queryKey: ["crew-members"], queryFn: () => crewApi.getRoster(), enabled: !!token });
  const { data: vehicles = [] } = useQuery<VehicleRow[]>({ queryKey: ["vehicles"], queryFn: vehiclesApi.getRoster, enabled: !!token });

  const deleteCrew = useMutation({
    mutationFn: (id: string) => crewApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crew-members"] }); setDeleteCrewTarget(null); },
  });
  const deleteVehicle = useMutation({
    mutationFn: (id: string) => vehiclesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicles"] }); setDeleteVehicleTarget(null); },
  });

  // ─── Schedule data ──────────────────────────────────────
  const { data: jobs = [] } = useQuery({ queryKey: ["jobs"], queryFn: jobsApi.getAll, enabled: !!token && activeTab === "schedule" });
  const { data: crewMatrix = [] } = useQuery({ queryKey: ["crew-matrix"], queryFn: crewApi.getMatrix, enabled: !!token && activeTab === "schedule" });
  const { data: vehicleMatrix = [] } = useQuery({ queryKey: ["vehicle-matrix"], queryFn: vehiclesApi.getMatrix, enabled: !!token && activeTab === "schedule" });

  const rosterByType = useMemo(() => {
    const m = new Map<CrewType, CrewMemberRow[]>();
    for (const ty of TAB_ORDER) m.set(ty, []);
    for (const c of roster) m.get(c.type)?.push(c);
    return m;
  }, [roster]);

  const scheduleRows: ResourceRow[] = useMemo(() => {
    const crewRows: ResourceRow[] = [];
    for (const ty of TAB_ORDER) {
      for (const c of (rosterByType.get(ty) ?? [])) {
        crewRows.push({ id: c.id, name: c.name, initials: initialsOf(c.name), sub: c.role ?? CREW_TYPE_LABEL[ty], group: CREW_TYPE_LABEL[ty] });
      }
    }
    const vehicleRows: ResourceRow[] = vehicles.map((v) => ({ id: v.id, name: v.name, initials: initialsOf(v.name), sub: v.plate ?? v.type ?? "", group: "รถ" }));
    return [...crewRows, ...vehicleRows];
  }, [rosterByType, vehicles]);

  const scheduleAssignments = useMemo(() => [
    ...crewMatrix.map((r) => ({ resourceId: r.crewMemberId, jobId: r.jobId })),
    ...vehicleMatrix.map((r) => ({ resourceId: r.vehicleId, jobId: r.jobId })),
  ], [crewMatrix, vehicleMatrix]);

  const tabs: { key: CrewTab; label: string; icon: typeof Users }[] = [
    { key: "roster",   label: "ทีมงาน",   icon: Users },
    { key: "vehicles", label: "รถ",       icon: Truck },
    { key: "schedule", label: "ตารางงาน", icon: CalendarRange },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-4 pb-0">
        <h1 className="text-xl font-bold text-white">ทีมงานและรถ</h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 pt-3 border-b border-white/[0.06] bg-[#0f0f0f]">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-[#FFFF00] text-[#FFFF00]" : "border-transparent text-white/60 hover:text-white"}`}>
            <tab.icon className="w-3.5 h-3.5" />{tab.label}
          </button>
        ))}
      </div>

      {/* ── Roster ─────────────────────────────────────────── */}
      {activeTab === "roster" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex flex-row items-center gap-3 w-full px-4 py-3 border-b border-white/10 bg-[#0f0f0f] flex-shrink-0">
            <Users className="w-4 h-4 text-[#FFFF00]/60" />
            <span className="text-sm font-semibold text-white/50">ทีมงาน</span>
            <span className="text-xs text-white/60">{roster.length} คน</span>
            {canManage && (
              <button onClick={() => { setEditCrew(null); setCrewModalOpen(true); }}
                className="ml-auto flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-bold text-black hover:opacity-90" style={{ backgroundColor: "#FFFF00" }}>
                <Plus className="w-4 h-4" /> เพิ่มคน
              </button>
            )}
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-5">
            {roster.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center text-white/40">
                <Users className="w-10 h-10" /><p className="text-sm">ยังไม่มีทีมงาน — คลิก "เพิ่มคน"</p>
              </div>
            ) : TAB_ORDER.map((ty) => {
              const members = rosterByType.get(ty) ?? [];
              if (members.length === 0) return null;
              return (
                <div key={ty}>
                  <h3 className="text-[11px] font-bold text-[#FFFF00]/60 uppercase tracking-wider mb-2">{CREW_TYPE_LABEL[ty]} · {members.length}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {members.map((m) => (
                      <div key={m.id} className="rounded-xl border border-white/[0.08] bg-[#111] p-3 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#FFFF00]/10 flex items-center justify-center text-xs font-bold text-[#FFFF00]/70 flex-shrink-0">{initialsOf(m.name)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold text-white truncate">{m.name}</p>
                            {m.userId && <BadgeCheck className="w-3.5 h-3.5 text-emerald-400/70 flex-shrink-0" />}
                          </div>
                          {m.role && <p className="text-[11px] text-white/50 truncate">{m.role}</p>}
                          {m.phone && <p className="text-[10px] text-white/40 flex items-center gap-1 mt-0.5"><Phone className="w-2.5 h-2.5" />{m.phone}</p>}
                          {canManage && (
                            <div className="flex items-center gap-2 mt-2">
                              <button onClick={() => { setEditCrew(m); setCrewModalOpen(true); }} className="flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-semibold bg-white/[0.06] text-white/70 hover:bg-white/10"><Pencil className="w-3 h-3" />แก้ไข</button>
                              <button onClick={() => setDeleteCrewTarget(m)} className="flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20"><Trash2 className="w-3 h-3" />ลบ</button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Vehicles ───────────────────────────────────────── */}
      {activeTab === "vehicles" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex flex-row items-center gap-3 w-full px-4 py-3 border-b border-white/10 bg-[#0f0f0f] flex-shrink-0">
            <Truck className="w-4 h-4 text-[#FFFF00]/60" />
            <span className="text-sm font-semibold text-white/50">คลังรถ</span>
            <span className="text-xs text-white/60">{vehicles.length} คัน</span>
            {canManage && (
              <button onClick={() => { setEditVehicle(null); setVehicleModalOpen(true); }}
                className="ml-auto flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-bold text-black hover:opacity-90" style={{ backgroundColor: "#FFFF00" }}>
                <Plus className="w-4 h-4" /> เพิ่มรถ
              </button>
            )}
          </div>

          <div className="flex-1 overflow-auto p-4">
            {vehicles.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center text-white/40">
                <Truck className="w-10 h-10" /><p className="text-sm">ยังไม่มีรถ — คลิก "เพิ่มรถ"</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {vehicles.map((v) => (
                  <div key={v.id} className="rounded-xl border border-white/[0.08] bg-[#111] p-3 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#FFFF00]/10 flex items-center justify-center flex-shrink-0"><Truck className="w-4 h-4 text-[#FFFF00]/60" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{v.name}</p>
                      <p className="text-[11px] text-white/50">{[v.type, v.plate, v.capacity].filter(Boolean).join(" · ") || "—"}</p>
                      {canManage && (
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={() => { setEditVehicle(v); setVehicleModalOpen(true); }} className="flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-semibold bg-white/[0.06] text-white/70 hover:bg-white/10"><Pencil className="w-3 h-3" />แก้ไข</button>
                          <button onClick={() => setDeleteVehicleTarget(v)} className="flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20"><Trash2 className="w-3 h-3" />ลบ</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Schedule ───────────────────────────────────────── */}
      {activeTab === "schedule" && (
        <div className="flex-1 overflow-hidden">
          <ResourceScheduleView
            rows={scheduleRows}
            jobs={jobs}
            assignments={scheduleAssignments}
            onBarClick={(job) => setScheduleJob(job)}
            emptyText="ยังไม่มีทีมงาน/รถ — เพิ่มที่แท็บด้านบน"
          />
        </div>
      )}

      {/* Modals */}
      {crewModalOpen && <AddCrewMemberModal member={editCrew} onClose={() => { setCrewModalOpen(false); setEditCrew(null); }} />}
      {vehicleModalOpen && <AddVehicleRosterModal vehicle={editVehicle} onClose={() => { setVehicleModalOpen(false); setEditVehicle(null); }} />}
      {scheduleJob && <JobDetailModal job={scheduleJob} onClose={() => setScheduleJob(null)} />}

      <AlertDialog open={!!deleteCrewTarget} onOpenChange={(o) => !o && setDeleteCrewTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบทีมงาน?</AlertDialogTitle>
            <AlertDialogDescription>ลบ "{deleteCrewTarget?.name}" — จะถูกนำออกจากงานที่ถูก assign ไว้ด้วย</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCrew.isPending}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteCrewTarget && deleteCrew.mutate(deleteCrewTarget.id)} disabled={deleteCrew.isPending} className="bg-red-600 hover:bg-red-700 text-white">ลบ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteVehicleTarget} onOpenChange={(o) => !o && setDeleteVehicleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบรถ?</AlertDialogTitle>
            <AlertDialogDescription>ลบ "{deleteVehicleTarget?.name}" — จะถูกนำออกจากงานที่ถูก assign ไว้ด้วย</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteVehicle.isPending}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteVehicleTarget && deleteVehicle.mutate(deleteVehicleTarget.id)} disabled={deleteVehicle.isPending} className="bg-red-600 hover:bg-red-700 text-white">ลบ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
