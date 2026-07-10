import { useState, useMemo } from "react";
import {
  X, Calendar, MapPin, Package, Layers, ScanLine, Plus,
  Loader2, Users, Wallet, UserPlus, ArrowRightLeft, Truck, ChevronRight, Briefcase,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { jobsApi, jobVehiclesApi, jobSubRentalsApi, stockApi } from "@/api";
import { RackBuildModal } from "./RackBuildModal";
import { AssignCrewModal } from "./AssignCrewModal";
import { AddVehicleModal } from "./AddVehicleModal";
import { JobExpensesModal } from "./JobExpensesModal";
import { JobSubRentalsModal } from "./JobSubRentalsModal";

interface Props {
  job: any;
  onClose: () => void;
}

// Full-screen job detail — was previously an inline accordion row (JobDetailRow) that had to
// cram everything into table-row height, forcing 10px text and 24px buttons throughout.
// Pulled out into its own modal (same "click job row → open" cost as the old expand) so every
// section gets normal-sized, readable text and touch targets.
export const JobDetailModal = ({ job, onClose }: Props): JSX.Element => {
  const { t } = useTranslation("jobs");
  const { t: tc } = useTranslation("common");
  const { token, userRole } = useAppStore();
  const canManage = userRole === "admin" || userRole === "manager";
  const qc = useQueryClient();
  const [rackBuildOpen, setRackBuildOpen] = useState(false);
  const [assignCrewOpen, setAssignCrewOpen] = useState(false);
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [expensesOpen, setExpensesOpen] = useState(false);
  const [subRentalsOpen, setSubRentalsOpen] = useState(false);

  const { data: assignedUnits = [], isLoading } = useQuery({
    queryKey: ["job-units", job.id],
    queryFn:  () => jobsApi.getUnits(job.id),
    enabled: !!token,
  });

  const { data: jobContainers = [], isLoading: containersLoading } = useQuery({
    queryKey: ["job-containers", job.id],
    queryFn:  () => jobsApi.getContainers(job.id),
    enabled: !!token,
  });

  const { data: jobCrew = [], isLoading: crewLoading } = useQuery({
    queryKey: ["job-crew", job.id],
    queryFn:  () => jobsApi.getJobCrew(job.id),
    enabled: !!token,
  });

  const { data: jobVehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ["job-vehicles", job.id],
    queryFn:  () => jobVehiclesApi.getForJob(job.id),
    enabled: !!token,
  });

  const { data: jobSubRentals = [] } = useQuery({
    queryKey: ["job-subrentals", job.id],
    queryFn:  () => jobSubRentalsApi.getForJob(job.id),
    enabled: !!token,
  });

  const removeContainer = useMutation({
    mutationFn: (containerId: string) => jobsApi.removeContainer(job.id, containerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-containers", job.id] });
      qc.invalidateQueries({ queryKey: ["containers"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
    },
  });

  const removeCrew = useMutation({
    mutationFn: (userId: string) => jobsApi.unassignCrew(job.id, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-crew", job.id] });
      qc.invalidateQueries({ queryKey: ["crew"] });
    },
  });

  const removeVehicle = useMutation({
    mutationFn: (vehicleId: string) => jobVehiclesApi.delete(vehicleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job-vehicles", job.id] }),
  });

  const updatePhase = useMutation({
    mutationFn: async ({ unitIds, phase }: { unitIds: string[]; phase: "planned" | "prepared" | "dispatched" | "returned" }) => {
      await jobsApi.updatePhase(job.id, unitIds, phase);
      if (phase === "dispatched") {
        await Promise.all(unitIds.map((id) => stockApi.updateUnit(id, { status: "out" })));
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-units", job.id] });
      qc.invalidateQueries({ queryKey: ["stock"] });
    },
  });

  const start = new Date(job.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const end   = new Date(job.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  const grouped = useMemo(() => {
    const map: Record<string, typeof assignedUnits> = {};
    for (const u of assignedUnits) {
      const key = (u as any).itemName ?? "Unknown";
      if (!map[key]) map[key] = [];
      map[key].push(u);
    }
    return Object.entries(map);
  }, [assignedUnits]);

  const checkedOutCount = (assignedUnits as any[]).filter((u) => u.status === "out").length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-3xl bg-[#0f0f0f] border border-white/[0.08] rounded-2xl shadow-2xl animate-modal-up flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#FFFF00]/10 flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-5 h-5 text-[#FFFF00]" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-white text-base truncate">{job.name}</h2>
              <div className="flex items-center gap-4 mt-1 text-xs text-white/60 flex-wrap">
                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{start} → {end}</span>
                {job.location && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{job.location}</span>}
                <span className="flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-[#FFFF00]/50" />
                  <span className="text-[#FFFF00]/70 font-semibold">{assignedUnits.length}</span> {t("unitsAssigned")}
                </span>
                {checkedOutCount > 0 && (
                  <span className="text-blue-400/70 font-medium">{t("checkedOutCount", { count: checkedOutCount })}</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Racks / Containers */}
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-[#FFFF00]/60 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4" /> {t("racksLabel")}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRackBuildOpen(true)}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-[#FFFF00]/80 border border-[#FFFF00]/25 hover:bg-[#FFFF00]/10 transition-colors"
                >
                  <ScanLine className="w-3.5 h-3.5" /> Build Racks
                </button>
              </div>
            </div>
            {containersLoading ? (
              <div className="flex items-center gap-2 text-white/60 text-sm py-1">
                <Loader2 className="w-4 h-4 animate-spin" /> {tc("loading")}
              </div>
            ) : jobContainers.length === 0 ? (
              <p className="text-sm text-white/60 italic">{t("noRacksAssigned")}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(jobContainers as any[]).map((c) => (
                  <div key={c.id} className="flex items-center gap-2 pl-3 pr-2 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03]">
                    <Layers className="w-4 h-4 text-[#FFFF00]/60 flex-shrink-0" />
                    <span className="text-sm text-white/80">{c.name}</span>
                    <span className="text-xs text-white/50">{t("itemsCount", { count: c.itemCount })}</span>
                    <button
                      onClick={() => removeContainer.mutate(c.id)}
                      disabled={removeContainer.isPending}
                      title={t("checkIn")}
                      className="p-1 rounded text-white/60 hover:text-red-400 hover:bg-white/[0.06] transition-colors disabled:opacity-40"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Crew */}
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-[#FFFF00]/60 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4" /> {t("crewLabel")}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setExpensesOpen(true)}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-[#FFFF00]/80 border border-[#FFFF00]/25 hover:bg-[#FFFF00]/10 transition-colors"
                >
                  <Wallet className="w-3.5 h-3.5" /> {t("outsourceExpenses")}
                </button>
                <button
                  onClick={() => setAssignCrewOpen(true)}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-[#FFFF00]/80 border border-[#FFFF00]/25 hover:bg-[#FFFF00]/10 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" /> {t("assignCrew")}
                </button>
              </div>
            </div>
            {crewLoading ? (
              <div className="flex items-center gap-2 text-white/60 text-sm py-1">
                <Loader2 className="w-4 h-4 animate-spin" /> {tc("loading")}
              </div>
            ) : jobCrew.length === 0 ? (
              <p className="text-sm text-white/60 italic">{t("noCrewAssigned")}</p>
            ) : (
              <div className="space-y-1">
                {jobCrew.map((c) => (
                  <div key={c.userId} className="group/crew flex items-center gap-3 -mx-1 px-1 py-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                    <div className="w-8 h-8 rounded-full bg-[#FFFF00]/10 flex items-center justify-center text-xs font-bold text-[#FFFF00]/80 flex-shrink-0">
                      {c.initials}
                    </div>
                    <span className="text-sm font-medium text-white/85 flex-1 min-w-0 truncate">{c.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold capitalize text-white/60 bg-white/[0.06] flex-shrink-0">{c.role}</span>
                    {canManage && (
                      <button
                        onClick={() => removeCrew.mutate(c.userId)}
                        disabled={removeCrew.isPending}
                        title={t("removeFromJob")}
                        className="opacity-0 group-hover/crew:opacity-100 p-1.5 rounded text-white/40 hover:text-red-400 hover:bg-white/[0.06] transition-colors disabled:opacity-40 flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sub-Rentals */}
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-[#FFFF00]/60 uppercase tracking-wider flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4" /> {t("subRentalsLabel")}
              </p>
              <button
                onClick={() => setSubRentalsOpen(true)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-[#FFFF00]/80 border border-[#FFFF00]/25 hover:bg-[#FFFF00]/10 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> {t("manageSubRentals")}
              </button>
            </div>
            <p className="text-sm text-white/60 italic">
              {jobSubRentals.length === 0 ? t("noSubRentalsAssigned") : t("subRentalsCount", { count: jobSubRentals.length })}
            </p>
          </div>

          {/* Vehicles */}
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-[#FFFF00]/60 uppercase tracking-wider flex items-center gap-2">
                <Truck className="w-4 h-4" /> {t("vehiclesLabel")}
              </p>
              <button
                onClick={() => setAddVehicleOpen(true)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-[#FFFF00]/80 border border-[#FFFF00]/25 hover:bg-[#FFFF00]/10 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> {t("addVehicle")}
              </button>
            </div>
            {vehiclesLoading ? (
              <div className="flex items-center gap-2 text-white/60 text-sm py-1">
                <Loader2 className="w-4 h-4 animate-spin" /> {tc("loading")}
              </div>
            ) : jobVehicles.length === 0 ? (
              <p className="text-sm text-white/60 italic">{t("noVehiclesAssigned")}</p>
            ) : (
              <div className="space-y-1">
                {jobVehicles.map((v) => (
                  <div key={v.id} className="group/veh flex items-center gap-3 -mx-1 px-1 py-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                    <Truck className="w-4 h-4 text-[#FFFF00]/50 flex-shrink-0" />
                    <span className="text-sm font-medium text-white/85 flex-1 min-w-0 truncate">{v.vehicleType}</span>
                    {v.note && <span className="text-xs text-white/50 truncate max-w-[180px]">{v.note}</span>}
                    {canManage && (
                      <button
                        onClick={() => removeVehicle.mutate(v.id)}
                        disabled={removeVehicle.isPending}
                        title={t("removeVehicle")}
                        className="opacity-0 group-hover/veh:opacity-100 p-1.5 rounded text-white/40 hover:text-red-400 hover:bg-white/[0.06] transition-colors disabled:opacity-40 flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stock — Phase Checklist */}
          <div className="px-6 py-5">
            {isLoading ? (
              <div className="flex items-center gap-2 text-white/60 text-sm py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> {tc("loading")}
              </div>
            ) : grouped.length === 0 ? (
              <p className="text-sm text-white/60 italic py-4 text-center">
                {t("noUnitsAssignedHint", { editUnits: t("editUnits") })}
              </p>
            ) : (
              <>
                {/* Phase summary bar */}
                {(() => {
                  const all = assignedUnits as any[];
                  const planned    = all.filter((u) => u.phase === "planned").length;
                  const prepared   = all.filter((u) => u.phase === "prepared").length;
                  const dispatched = all.filter((u) => u.phase === "dispatched").length;
                  const returned   = all.filter((u) => u.phase === "returned").length;
                  return (
                    <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/[0.06]">
                      <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${planned > 0 ? "bg-white/10 text-white/70" : "bg-white/5 text-white/30"}`}>
                          {t("phasePlanned")} {planned}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${prepared > 0 ? "bg-amber-500/20 text-amber-400" : "bg-white/5 text-white/30"}`}>
                          {t("phasePrepared")} {prepared}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${dispatched > 0 ? "bg-blue-500/20 text-blue-400" : "bg-white/5 text-white/30"}`}>
                          {t("phaseDispatched")} {dispatched}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${returned > 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/30"}`}>
                          {t("phaseReturned")} {returned}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Unit list grouped by item */}
                <div className="space-y-5">
                  {grouped.map(([itemName, units]) => (
                    <div key={itemName}>
                      <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-white/[0.06]">
                        <p className="text-xs font-bold text-[#FFFF00]/60 uppercase tracking-wider flex-1 truncate">{itemName}</p>
                        <span className="text-xs text-white/50 flex-shrink-0">{units.length}</span>
                      </div>
                      {(units as any[]).map((u) => {
                        const phase = u.phase ?? "planned";
                        const nextPhase = phase === "prepared" ? "dispatched" : null;
                        return (
                          <div key={u.id} className="flex items-center gap-3 py-2 border-b border-white/[0.03] last:border-0">
                            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                              phase === "returned"   ? "bg-emerald-400" :
                              phase === "dispatched" ? "bg-blue-400" :
                              phase === "prepared"   ? "bg-amber-400" :
                              "bg-white/20"
                            }`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white/80 truncate">{u.name}</p>
                              {u.serialNumber && (
                                <p className="text-xs text-white/45 font-mono truncate">{t("snLabel", { serial: u.serialNumber })}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                                phase === "returned"   ? "bg-emerald-500/15 text-emerald-400" :
                                phase === "dispatched" ? "bg-blue-500/15 text-blue-400" :
                                phase === "prepared"   ? "bg-amber-500/15 text-amber-400" :
                                "bg-white/5 text-white/40"
                              }`}>
                                {t(`phase_${phase}`)}
                              </span>
                              {nextPhase && canManage && (
                                <button
                                  onClick={() => updatePhase.mutate({ unitIds: [u.id], phase: nextPhase as any })}
                                  disabled={updatePhase.isPending}
                                  title={`Override: ${t(`advanceTo_${nextPhase}`)}`}
                                  className="p-1.5 rounded text-white/25 hover:text-amber-400 hover:bg-amber-400/10 transition-colors disabled:opacity-30"
                                >
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <RackBuildModal
        open={rackBuildOpen}
        onClose={() => setRackBuildOpen(false)}
        jobId={job.id}
        jobName={job.name}
      />
      {assignCrewOpen && (
        <AssignCrewModal jobId={job.id} onClose={() => setAssignCrewOpen(false)} />
      )}
      {addVehicleOpen && (
        <AddVehicleModal jobId={job.id} onClose={() => setAddVehicleOpen(false)} />
      )}
      {expensesOpen && (
        <JobExpensesModal jobId={job.id} jobName={job.name} onClose={() => setExpensesOpen(false)} />
      )}
      {subRentalsOpen && (
        <JobSubRentalsModal jobId={job.id} jobName={job.name} onClose={() => setSubRentalsOpen(false)} />
      )}
    </div>
  );
};
