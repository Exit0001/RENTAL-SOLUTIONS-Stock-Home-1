import { useState, useMemo, type ReactNode } from "react";
import {
  Calendar, MapPin, Package, Layers, ScanLine, Plus, Loader2, Users, Wallet,
  UserPlus, ArrowRightLeft, Truck, ChevronRight, FileText, Camera, Copy, Trash2,
  LayoutTemplate, X,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useAppStore } from "@/store/appStore";
import { useToast } from "@/hooks/use-toast";
import { jobsApi, jobVehiclesApi, jobSubRentalsApi, stockApi, jobTemplatesApi } from "@/api";
import { ManageJobStockModal } from "./ManageJobStockModal";
import { JobOperationsModal } from "./JobOperationsModal";
import { RackBuildModal } from "./RackBuildModal";
import { AssignCrewModal, CREW_TYPE_LABEL } from "./AssignCrewModal";
import { AssignVehicleModal } from "./AssignVehicleModal";
import { JobExpensesModal } from "./JobExpensesModal";
import { JobSubRentalsModal } from "./JobSubRentalsModal";
import { CreatePullSheetModal } from "./CreatePullSheetModal";
import { AddIncidentModal } from "./AddIncidentModal";

interface Props {
  job: any;
  onDeleted: () => void;
}

type DetailTab = "overview" | "stock" | "crew" | "pullsheets" | "incidents" | "finance";

const statusStyles: Record<string, string> = {
  draft: "bg-white/5 text-white/60", scheduled: "bg-blue-950/60 text-blue-400",
  active: "bg-emerald-950/60 text-emerald-400", completed: "bg-white/5 text-white/60",
  cancelled: "bg-red-950/60 text-red-400",
};

export const JobDetailPanel = ({ job, onDeleted }: Props): JSX.Element => {
  const { t } = useTranslation("jobs");
  const { t: tc } = useTranslation("common");
  const { token, userRole } = useAppStore();
  const canManage = userRole === "admin" || userRole === "manager";
  const qc = useQueryClient();
  const { toast } = useToast();

  const [tab, setTab] = useState<DetailTab>("overview");
  // content modals
  const [manageStockOpen, setManageStockOpen] = useState(false);
  const [opsOpen, setOpsOpen] = useState(false);
  const [rackBuildOpen, setRackBuildOpen] = useState(false);
  const [assignCrewOpen, setAssignCrewOpen] = useState(false);
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [expensesOpen, setExpensesOpen] = useState(false);
  const [subRentalsOpen, setSubRentalsOpen] = useState(false);
  const [pullSheetOpen, setPullSheetOpen] = useState(false);
  const [incidentOpen, setIncidentOpen] = useState(false);
  // header action dialogs
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [tplName, setTplName] = useState("");

  // ── per-job data ───────────────────────────────────────
  const { data: assignedUnits = [], isLoading } = useQuery({ queryKey: ["job-units", job.id], queryFn: () => jobsApi.getUnits(job.id), enabled: !!token });
  const { data: jobContainers = [], isLoading: containersLoading } = useQuery({ queryKey: ["job-containers", job.id], queryFn: () => jobsApi.getContainers(job.id), enabled: !!token });
  const { data: jobCrew = [], isLoading: crewLoading } = useQuery({ queryKey: ["job-crew", job.id], queryFn: () => jobsApi.getJobCrew(job.id), enabled: !!token });
  const { data: jobVehicles = [], isLoading: vehiclesLoading } = useQuery({ queryKey: ["job-vehicles", job.id], queryFn: () => jobVehiclesApi.getForJob(job.id), enabled: !!token });
  const { data: jobSubRentals = [] } = useQuery({ queryKey: ["job-subrentals", job.id], queryFn: () => jobSubRentalsApi.getForJob(job.id), enabled: !!token });
  const { data: allPullSheets = [] } = useQuery({ queryKey: ["pull-sheets"], queryFn: jobsApi.getPullSheets, enabled: !!token });
  const { data: allIncidents = [] } = useQuery({ queryKey: ["incidents"], queryFn: jobsApi.getIncidents, enabled: !!token });

  const pullSheets = useMemo(() => (allPullSheets as any[]).filter((p) => p.jobId === job.id), [allPullSheets, job.id]);
  const incidents = useMemo(() => (allIncidents as any[]).filter((i) => i.jobId === job.id), [allIncidents, job.id]);

  // ── mutations ──────────────────────────────────────────
  const removeContainer = useMutation({ mutationFn: (id: string) => jobsApi.removeContainer(job.id, id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["job-containers", job.id] }); qc.invalidateQueries({ queryKey: ["containers"] }); qc.invalidateQueries({ queryKey: ["stock"] }); } });
  const removeCrew = useMutation({ mutationFn: (id: string) => jobsApi.unassignCrew(job.id, id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["job-crew", job.id] }); qc.invalidateQueries({ queryKey: ["crew-matrix"] }); } });
  const removeVehicle = useMutation({ mutationFn: (id: string) => jobVehiclesApi.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["job-vehicles", job.id] }); qc.invalidateQueries({ queryKey: ["vehicle-matrix"] }); } });
  const updatePhase = useMutation({
    mutationFn: async ({ unitIds, phase }: { unitIds: string[]; phase: "planned" | "prepared" | "dispatched" | "returned" }) => {
      await jobsApi.updatePhase(job.id, unitIds, phase);
      if (phase === "dispatched") await Promise.all(unitIds.map((id) => stockApi.updateUnit(id, { status: "out" })));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["job-units", job.id] }); qc.invalidateQueries({ queryKey: ["stock"] }); },
  });
  const updateStatus = useMutation({ mutationFn: (status: string) => jobsApi.update(job.id, { status: status as any }), onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }) });
  const duplicateJob = useMutation({ mutationFn: () => jobsApi.duplicate(job.id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["jobs"] }); qc.invalidateQueries({ queryKey: ["stock"] }); toast({ title: t("jobDuplicated") }); }, onError: (e: any) => toast({ title: t("jobDuplicateFailed"), description: e?.message, variant: "destructive" }) });
  const deleteJob = useMutation({ mutationFn: () => jobsApi.delete(job.id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["jobs"] }); qc.invalidateQueries({ queryKey: ["pull-sheets"] }); qc.invalidateQueries({ queryKey: ["stock"] }); setDeleteOpen(false); onDeleted(); } });
  const saveTemplate = useMutation({ mutationFn: (name: string) => jobTemplatesApi.saveFromJob(job.id, { name }), onSuccess: (res) => { qc.invalidateQueries({ queryKey: ["job-templates"] }); setTplOpen(false); setTplName(""); toast({ title: t("templateSaved"), description: t("templateSavedDesc", { count: res.itemCount }) }); } });
  const createPullSheet = useMutation({ mutationFn: (data: any) => jobsApi.createPullSheet(job.id, data), onSuccess: () => qc.invalidateQueries({ queryKey: ["pull-sheets"] }) });
  const createIncident = useMutation({ mutationFn: (data: any) => jobsApi.createIncident(job.id, data), onSuccess: () => qc.invalidateQueries({ queryKey: ["incidents"] }) });

  const start = new Date(job.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const end = new Date(job.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const u of assignedUnits as any[]) { const key = u.itemName ?? "Unknown"; (map[key] ??= []).push(u); }
    return Object.entries(map);
  }, [assignedUnits]);
  const checkedOutCount = (assignedUnits as any[]).filter((u) => u.status === "out").length;

  const tabs: { key: DetailTab; label: string; badge?: number }[] = [
    { key: "overview", label: "ภาพรวม" },
    { key: "stock", label: "อุปกรณ์", badge: assignedUnits.length },
    { key: "crew", label: "ทีม & รถ", badge: jobCrew.length + jobVehicles.length },
    { key: "pullsheets", label: "ใบเบิก", badge: pullSheets.length },
    { key: "incidents", label: "เหตุการณ์", badge: incidents.length },
    { key: "finance", label: "การเงิน" },
  ];

  const SectionHint = ({ children }: { children: ReactNode }) => <p className="text-sm text-white/50 italic">{children}</p>;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-5 py-3 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-white text-base truncate">{job.name}</h2>
            <div className="flex items-center gap-3 mt-1 text-xs text-white/60 flex-wrap">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{start} → {end}</span>
              {job.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>}
              <span className="text-white/50">{job.client}</span>
              {checkedOutCount > 0 && <span className="text-blue-400/70">{t("checkedOutCount", { count: checkedOutCount })}</span>}
            </div>
          </div>
          {canManage ? (
            <select value={job.status} onChange={(e) => updateStatus.mutate(e.target.value)}
              className={`px-2 py-1 rounded-full text-[11px] font-semibold border-0 cursor-pointer focus:outline-none ${statusStyles[job.status] ?? "bg-white/5 text-white/60"}`}>
              {["draft", "scheduled", "active", "completed", "cancelled"].map((s) => <option key={s} value={s} className="bg-[#111] text-white">{tc(`statusEnum.${s}`, { defaultValue: s })}</option>)}
            </select>
          ) : <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${statusStyles[job.status]}`}>{tc(`statusEnum.${job.status}`, { defaultValue: job.status })}</span>}
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <button onClick={() => setOpsOpen(true)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold text-black hover:opacity-80" style={{ backgroundColor: "#FFFF00" }}><Layers className="w-3.5 h-3.5" /> Operations</button>
          <button onClick={() => setManageStockOpen(true)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-white/70 border border-white/[0.12] hover:text-white hover:border-white/25"><Package className="w-3.5 h-3.5" /> {t("editUnits")}</button>
          {canManage && <>
            <button onClick={() => { setTplName(job.name); setTplOpen(true); }} title={t("saveAsTemplate")} className="p-1.5 rounded-lg text-white/50 hover:text-[#FFFF00] hover:bg-white/[0.06]"><LayoutTemplate className="w-4 h-4" /></button>
            <button onClick={() => duplicateJob.mutate()} disabled={duplicateJob.isPending} title={t("duplicateJob")} className="p-1.5 rounded-lg text-white/50 hover:text-[#FFFF00] hover:bg-white/[0.06] disabled:opacity-40">{duplicateJob.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}</button>
            <button onClick={() => setDeleteOpen(true)} title={t("deleteJob")} className="p-1.5 rounded-lg text-white/50 hover:text-red-400 hover:bg-white/[0.06]"><Trash2 className="w-4 h-4" /></button>
          </>}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 px-4 border-b border-white/[0.06] flex-shrink-0 overflow-x-auto">
        {tabs.map((tb) => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${tab === tb.key ? "border-[#FFFF00] text-[#FFFF00]" : "border-transparent text-white/60 hover:text-white"}`}>
            {tb.label}{tb.badge ? <span className="text-[10px] text-white/40">{tb.badge}</span> : null}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "ลูกค้า", value: job.client },
                { label: "วันงาน", value: `${start} → ${end}` },
                { label: "สถานที่", value: job.location || "—" },
                { label: "วันซ้อม", value: job.rehearsalDate ? new Date(job.rehearsalDate).toLocaleDateString("th-TH") : "—" },
              ].map((f) => (
                <div key={f.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">{f.label}</p>
                  <p className="text-sm text-white/85 truncate mt-0.5">{f.value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {[
                { label: "อุปกรณ์", n: assignedUnits.length, icon: Package },
                { label: "แร็ค", n: jobContainers.length, icon: Layers },
                { label: "ทีม", n: jobCrew.length, icon: Users },
                { label: "รถ", n: jobVehicles.length, icon: Truck },
                { label: "เช่านอก", n: jobSubRentals.length, icon: ArrowRightLeft },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-center">
                  <s.icon className="w-4 h-4 text-[#FFFF00]/50 mx-auto" />
                  <p className="text-lg font-bold text-white mt-1 tabular-nums">{s.n}</p>
                  <p className="text-[10px] text-white/40">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STOCK ── */}
        {tab === "stock" && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setManageStockOpen(true)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-[#FFFF00]/80 border border-[#FFFF00]/25 hover:bg-[#FFFF00]/10"><Package className="w-3.5 h-3.5" /> {t("editUnits")}</button>
              <button onClick={() => setOpsOpen(true)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-[#FFFF00]/80 border border-[#FFFF00]/25 hover:bg-[#FFFF00]/10"><Layers className="w-3.5 h-3.5" /> Operations</button>
              <button onClick={() => setRackBuildOpen(true)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-[#FFFF00]/80 border border-[#FFFF00]/25 hover:bg-[#FFFF00]/10"><ScanLine className="w-3.5 h-3.5" /> Build Racks</button>
            </div>
            {/* Racks */}
            <div>
              <p className="text-[10px] font-bold text-[#FFFF00]/60 uppercase tracking-wider flex items-center gap-2 mb-2"><Layers className="w-3.5 h-3.5" /> {t("racksLabel")}</p>
              {containersLoading ? <Loader2 className="w-4 h-4 animate-spin text-white/40" /> : jobContainers.length === 0 ? <SectionHint>{t("noRacksAssigned")}</SectionHint> : (
                <div className="flex flex-wrap gap-2">
                  {(jobContainers as any[]).map((c) => (
                    <div key={c.id} className="flex items-center gap-2 pl-3 pr-2 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03]">
                      <Layers className="w-4 h-4 text-[#FFFF00]/60" /><span className="text-sm text-white/80">{c.name}</span><span className="text-xs text-white/50">{t("itemsCount", { count: c.itemCount })}</span>
                      <button onClick={() => removeContainer.mutate(c.id)} disabled={removeContainer.isPending} className="p-1 rounded text-white/50 hover:text-red-400 disabled:opacity-40"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Stock phase checklist */}
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-white/40" /> : grouped.length === 0 ? <SectionHint>{t("noUnitsAssignedHint", { editUnits: t("editUnits") })}</SectionHint> : (
              <div>
                {(() => {
                  const all = assignedUnits as any[];
                  const c = (p: string) => all.filter((u) => (u.phase ?? "planned") === p).length;
                  const cells = [["phasePlanned", c("planned"), "bg-white/10 text-white/70"], ["phasePrepared", c("prepared"), "bg-amber-500/20 text-amber-400"], ["phaseDispatched", c("dispatched"), "bg-blue-500/20 text-blue-400"], ["phaseReturned", c("returned"), "bg-emerald-500/20 text-emerald-400"]] as const;
                  return (
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/[0.06] flex-wrap">
                      {cells.map(([k, n, cls], i) => (<span key={k} className="flex items-center gap-2">{i > 0 && <ChevronRight className="w-3 h-3 text-white/25" />}<span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${n > 0 ? cls : "bg-white/5 text-white/30"}`}>{t(k)} {n}</span></span>))}
                    </div>
                  );
                })()}
                <div className="space-y-4">
                  {grouped.map(([itemName, units]) => (
                    <div key={itemName}>
                      <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-white/[0.06]"><p className="text-xs font-bold text-[#FFFF00]/60 uppercase tracking-wider flex-1 truncate">{itemName}</p><span className="text-xs text-white/50">{units.length}</span></div>
                      {units.map((u: any) => {
                        const phase = u.phase ?? "planned";
                        const next = phase === "prepared" ? "dispatched" : null;
                        return (
                          <div key={u.id} className="flex items-center gap-3 py-1.5 border-b border-white/[0.03] last:border-0">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${phase === "returned" ? "bg-emerald-400" : phase === "dispatched" ? "bg-blue-400" : phase === "prepared" ? "bg-amber-400" : "bg-white/20"}`} />
                            <div className="flex-1 min-w-0"><p className="text-sm text-white/80 truncate">{u.name}</p>{u.serialNumber && <p className="text-[11px] text-white/45 font-mono truncate">{t("snLabel", { serial: u.serialNumber })}</p>}</div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${phase === "returned" ? "bg-emerald-500/15 text-emerald-400" : phase === "dispatched" ? "bg-blue-500/15 text-blue-400" : phase === "prepared" ? "bg-amber-500/15 text-amber-400" : "bg-white/5 text-white/40"}`}>{t(`phase_${phase}`)}</span>
                            {next && canManage && <button onClick={() => updatePhase.mutate({ unitIds: [u.id], phase: next as any })} disabled={updatePhase.isPending} className="p-1 rounded text-white/25 hover:text-amber-400 disabled:opacity-30"><ChevronRight className="w-3.5 h-3.5" /></button>}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CREW & VEHICLES ── */}
        {tab === "crew" && (
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-[#FFFF00]/60 uppercase tracking-wider flex items-center gap-2"><Users className="w-3.5 h-3.5" /> {t("crewLabel")}</p>
                <button onClick={() => setAssignCrewOpen(true)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-[#FFFF00]/80 border border-[#FFFF00]/25 hover:bg-[#FFFF00]/10"><UserPlus className="w-3.5 h-3.5" /> {t("assignCrew")}</button>
              </div>
              {crewLoading ? <Loader2 className="w-4 h-4 animate-spin text-white/40" /> : jobCrew.length === 0 ? <SectionHint>{t("noCrewAssigned")}</SectionHint> : (
                <div className="space-y-1">{jobCrew.map((c) => (
                  <div key={c.crewMemberId} className="group/c flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/[0.03]">
                    <div className="w-7 h-7 rounded-full bg-[#FFFF00]/10 flex items-center justify-center text-[10px] font-bold text-[#FFFF00]/80 flex-shrink-0">{c.initials}</div>
                    <span className="text-sm text-white/85 flex-1 truncate">{c.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold text-white/60 bg-white/[0.06]">{CREW_TYPE_LABEL[c.type]}</span>
                    {canManage && <button onClick={() => removeCrew.mutate(c.crewMemberId)} disabled={removeCrew.isPending} className="opacity-0 group-hover/c:opacity-100 p-1 text-white/40 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>}
                  </div>
                ))}</div>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-[#FFFF00]/60 uppercase tracking-wider flex items-center gap-2"><Truck className="w-3.5 h-3.5" /> {t("vehiclesLabel")}</p>
                <button onClick={() => setAddVehicleOpen(true)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-[#FFFF00]/80 border border-[#FFFF00]/25 hover:bg-[#FFFF00]/10"><Plus className="w-3.5 h-3.5" /> {t("addVehicle")}</button>
              </div>
              {vehiclesLoading ? <Loader2 className="w-4 h-4 animate-spin text-white/40" /> : jobVehicles.length === 0 ? <SectionHint>{t("noVehiclesAssigned")}</SectionHint> : (
                <div className="space-y-1">{jobVehicles.map((v) => (
                  <div key={v.id} className="group/v flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/[0.03]">
                    <Truck className="w-4 h-4 text-[#FFFF00]/50 flex-shrink-0" />
                    <span className="text-sm text-white/85 flex-1 truncate">{v.vehicleType}{v.plate && <span className="text-white/40"> · {v.plate}</span>}</span>
                    {v.driverName && <span className="text-xs text-white/50 truncate max-w-[120px]">🧑‍✈️ {v.driverName}</span>}
                    {canManage && <button onClick={() => removeVehicle.mutate(v.id)} disabled={removeVehicle.isPending} className="opacity-0 group-hover/v:opacity-100 p-1 text-white/40 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>}
                  </div>
                ))}</div>
              )}
              <p className="text-[11px] text-white/30 mt-2">จัดทีม/รถแบบละเอียด (ตำแหน่ง/คนขับ/เหมา) ได้ที่เมนู "ทีมงาน"</p>
            </div>
          </div>
        )}

        {/* ── PULL SHEETS ── */}
        {tab === "pullsheets" && (
          <div className="space-y-3">
            <button onClick={() => setPullSheetOpen(true)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-[#FFFF00]/80 border border-[#FFFF00]/25 hover:bg-[#FFFF00]/10"><Plus className="w-3.5 h-3.5" /> {t("createPullSheet")}</button>
            {pullSheets.length === 0 ? <SectionHint>{t("noPullSheetsYet")}</SectionHint> : (
              <div className="space-y-1.5">{pullSheets.map((ps) => (
                <div key={ps.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <FileText className="w-4 h-4 text-[#FFFF00]/50 flex-shrink-0" />
                  <span className="font-mono text-[#FFFF00]/70 text-xs flex-shrink-0">{ps.id.slice(0, 8)}</span>
                  <span className="text-sm text-white/80 flex-1 min-w-0 truncate">{ps.items} รายการ</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusStyles[ps.status] ?? "bg-white/5 text-white/60"}`}>{tc(`statusEnum.${ps.status}`, { defaultValue: ps.status })}</span>
                </div>
              ))}</div>
            )}
          </div>
        )}

        {/* ── INCIDENTS ── */}
        {tab === "incidents" && (
          <div className="space-y-3">
            <button onClick={() => setIncidentOpen(true)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-[#FFFF00]/80 border border-[#FFFF00]/25 hover:bg-[#FFFF00]/10"><Camera className="w-3.5 h-3.5" /> {t("reportIncident")}</button>
            {incidents.length === 0 ? <SectionHint>{t("noIncidentsYet", { defaultValue: "ยังไม่มีเหตุการณ์สำหรับงานนี้" })}</SectionHint> : (
              <div className="space-y-1.5">{incidents.map((inc: any) => (
                <div key={inc.id} className="px-3 py-2 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <div className="flex items-center gap-2"><span className="text-sm text-white/85 flex-1 truncate">{inc.description || inc.title || "—"}</span><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${inc.status === "resolved" ? "bg-emerald-950/60 text-emerald-400" : "bg-red-950/60 text-red-400"}`}>{tc(`statusEnum.${inc.status}`, { defaultValue: inc.status })}</span></div>
                </div>
              ))}</div>
            )}
          </div>
        )}

        {/* ── FINANCE ── */}
        {tab === "finance" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setExpensesOpen(true)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-[#FFFF00]/80 border border-[#FFFF00]/25 hover:bg-[#FFFF00]/10"><Wallet className="w-3.5 h-3.5" /> {t("outsourceExpenses")}</button>
              <button onClick={() => setSubRentalsOpen(true)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-[#FFFF00]/80 border border-[#FFFF00]/25 hover:bg-[#FFFF00]/10"><ArrowRightLeft className="w-3.5 h-3.5" /> {t("manageSubRentals")}</button>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-[#FFFF00]/50" />
              <span className="text-sm text-white/70 flex-1">{t("subRentalsLabel")}</span>
              <span className="text-sm text-white/50">{jobSubRentals.length === 0 ? t("noSubRentalsAssigned") : t("subRentalsCount", { count: jobSubRentals.length })}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── modals ── */}
      {manageStockOpen && <ManageJobStockModal jobId={job.id} jobName={job.name} onClose={() => setManageStockOpen(false)} />}
      <JobOperationsModal open={opsOpen} onClose={() => setOpsOpen(false)} job={job} />
      <RackBuildModal open={rackBuildOpen} onClose={() => setRackBuildOpen(false)} jobId={job.id} jobName={job.name} />
      {assignCrewOpen && <AssignCrewModal jobId={job.id} onClose={() => setAssignCrewOpen(false)} />}
      {addVehicleOpen && <AssignVehicleModal jobId={job.id} onClose={() => setAddVehicleOpen(false)} />}
      {expensesOpen && <JobExpensesModal jobId={job.id} jobName={job.name} onClose={() => setExpensesOpen(false)} />}
      {subRentalsOpen && <JobSubRentalsModal jobId={job.id} jobName={job.name} onClose={() => setSubRentalsOpen(false)} />}
      {pullSheetOpen && <CreatePullSheetModal onClose={() => setPullSheetOpen(false)} onSubmit={(_jobId, data) => createPullSheet.mutate(data)} />}
      {incidentOpen && <AddIncidentModal onClose={() => setIncidentOpen(false)} onSubmit={(_jobId, data) => createIncident.mutate(data)} />}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("confirmDeleteJobTitle")}</AlertDialogTitle><AlertDialogDescription>{t("confirmDeleteJobDesc")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteJob.isPending}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteJob.mutate()} disabled={deleteJob.isPending} className="bg-red-600 hover:bg-red-700 text-white">{deleteJob.isPending ? tc("deleting") : tc("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={tplOpen} onOpenChange={setTplOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("saveAsTemplate")}</AlertDialogTitle><AlertDialogDescription>{t("saveTemplateDesc", { defaultValue: "บันทึกรายการอุปกรณ์ของงานนี้เป็นเทมเพลตเพื่อใช้ซ้ำในงานถัดไป" })}</AlertDialogDescription></AlertDialogHeader>
          <input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder={t("templateNamePlaceholder")}
            className="w-full h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white focus:outline-none focus:border-[#FFFF00]/50" />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saveTemplate.isPending}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => tplName.trim() && saveTemplate.mutate(tplName.trim())} disabled={saveTemplate.isPending || !tplName.trim()} className="bg-[#FFFF00] text-black hover:opacity-80">{saveTemplate.isPending ? tc("saving") : tc("save")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
