import { useState, useMemo } from "react";
import {
  Briefcase,
  ChevronRightIcon,
  Users,
  Package,
  Calendar,
  MapPin,
  FileText,
  Camera,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Send,
  Smartphone,
  Shield,
  ClipboardList,
  ArrowRight,
  Bell,
  Plus,
  ScanLine,
  Loader2,
  Check,
  Layers,
  X,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { jobsApi } from "@/api";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { AddIncidentModal } from "./AddIncidentModal";
import { AddJobModal } from "./AddJobModal";
import { ScanModal } from "./ScanModal";
import { ManageJobStockModal } from "./ManageJobStockModal";
import { AssignContainerModal } from "./AssignContainerModal";
import { AssignCrewModal } from "./AssignCrewModal";
import { CreatePullSheetModal } from "./CreatePullSheetModal";

type JobTab = "jobs" | "pullsheets" | "crew" | "incidents";

const jobTabs: { key: JobTab; labelKey: string; icon: typeof Briefcase }[] = [
  { key: "jobs",       labelKey: "tabJobs",       icon: Briefcase },
  { key: "pullsheets", labelKey: "tabPullSheets", icon: FileText },
  { key: "crew",       labelKey: "tabCrew",       icon: Users },
  { key: "incidents",  labelKey: "tabIncidents",  icon: Camera },
];

const statusStyles: Record<string, string> = {
  Active:     "bg-emerald-950/60 text-emerald-400",
  Scheduled:  "bg-blue-950/60 text-blue-400",
  Completed:  "bg-white/5 text-white/60",
  Pending:    "bg-amber-950/60 text-amber-400",
  Dispatched: "bg-emerald-950/60 text-emerald-400",
  Draft:      "bg-white/5 text-white/60",
  Returned:   "bg-blue-950/60 text-blue-400",
  Open:       "bg-red-950/60 text-red-400",
  Resolved:   "bg-emerald-950/60 text-emerald-400",
};

const severityStyles: Record<string, string> = {
  High:   "bg-red-500/10 text-red-400",
  Medium: "bg-amber-500/10 text-amber-400",
  Low:    "bg-blue-500/10 text-blue-400",
};

const actionColors: Record<string, string> = {
  "Checked Out":    "text-blue-400 bg-blue-500/10",
  Returned:         "text-emerald-400 bg-emerald-500/10",
  "Reported Damage":"text-red-400 bg-red-500/10",
};

const priorityColors: Record<string, string> = {
  High:   "bg-red-500/10 text-red-400",
  Medium: "bg-amber-500/10 text-amber-400",
  Low:    "bg-blue-500/10 text-blue-400",
};

const taskStatusColors: Record<string, string> = {
  "In Progress": "text-[#FFFF00]",
  Pending:       "text-white/60",
  Done:          "text-emerald-400",
};

// Expanded checklist row — shows assigned units grouped by item
const JobDetailRow = ({ job }: { job: any }) => {
  const { t } = useTranslation("jobs");
  const { t: tc } = useTranslation("common");
  const { token } = useAppStore();
  const qc = useQueryClient();
  const [assignContainerOpen, setAssignContainerOpen] = useState(false);
  const [assignCrewOpen, setAssignCrewOpen] = useState(false);

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

  const removeContainer = useMutation({
    mutationFn: (containerId: string) => jobsApi.removeContainer(job.id, containerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-containers", job.id] });
      qc.invalidateQueries({ queryKey: ["containers"] });
    },
  });

  const removeCrew = useMutation({
    mutationFn: (userId: string) => jobsApi.unassignCrew(job.id, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-crew", job.id] });
      qc.invalidateQueries({ queryKey: ["crew"] });
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
    <tr className="animate-slide-down bg-[#0c0c0c] border-b border-white/[0.04]">
      <td colSpan={6} className="p-0">

        {/* Info bar */}
        <div className="flex items-center gap-6 px-6 py-2.5 bg-[#101010] border-b border-white/[0.04] text-[11px] text-white/60">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />{start} → {end}
          </span>
          {job.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3" />{job.location}
            </span>
          )}
          <span className="ml-auto flex items-center gap-2">
            <Package className="w-3 h-3 text-[#FFFF00]/35" />
            <span className="text-[#FFFF00]/50 font-semibold">{assignedUnits.length}</span>
            <span className="text-white/60">{t("unitsAssigned")}</span>
            {checkedOutCount > 0 && (
              <span className="text-blue-400/55 font-medium">{t("checkedOutCount", { count: checkedOutCount })}</span>
            )}
          </span>
        </div>

        {/* Racks / Containers */}
        <div className="px-6 py-3 border-b border-white/[0.04]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-[#FFFF00]/45 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3 h-3" /> {t("racksLabel")}
            </p>
            <button
              onClick={() => setAssignContainerOpen(true)}
              className="flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-semibold text-[#FFFF00]/70 border border-[#FFFF00]/20 hover:bg-[#FFFF00]/10 transition-colors"
            >
              <Plus className="w-3 h-3" /> {t("addRack")}
            </button>
          </div>
          {containersLoading ? (
            <div className="flex items-center gap-2 text-white/60 text-xs py-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> {tc("loading")}
            </div>
          ) : jobContainers.length === 0 ? (
            <p className="text-xs text-white/60 italic">{t("noRacksAssigned")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(jobContainers as any[]).map((c) => (
                <div key={c.id} className="flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <Layers className="w-3.5 h-3.5 text-[#FFFF00]/50 flex-shrink-0" />
                  <span className="text-xs text-white/70">{c.name}</span>
                  <span className="text-[10px] text-white/60">{t("itemsCount", { count: c.itemCount })}</span>
                  <button
                    onClick={() => removeContainer.mutate(c.id)}
                    disabled={removeContainer.isPending}
                    title={t("checkIn")}
                    className="p-1 rounded text-white/60 hover:text-red-400 hover:bg-white/[0.06] transition-colors disabled:opacity-40"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Crew */}
        <div className="px-6 py-3 border-b border-white/[0.04]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-[#FFFF00]/45 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3 h-3" /> {t("crewLabel")}
            </p>
            <button
              onClick={() => setAssignCrewOpen(true)}
              className="flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-semibold text-[#FFFF00]/70 border border-[#FFFF00]/20 hover:bg-[#FFFF00]/10 transition-colors"
            >
              <UserPlus className="w-3 h-3" /> {t("assignCrew")}
            </button>
          </div>
          {crewLoading ? (
            <div className="flex items-center gap-2 text-white/60 text-xs py-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> {tc("loading")}
            </div>
          ) : jobCrew.length === 0 ? (
            <p className="text-xs text-white/60 italic">{t("noCrewAssigned")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {jobCrew.map((c) => (
                <div key={c.userId} className="flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <div className="w-5 h-5 rounded-full bg-[#FFFF00]/10 flex items-center justify-center text-[9px] font-bold text-[#FFFF00]/70 flex-shrink-0">
                    {c.initials}
                  </div>
                  <span className="text-xs text-white/70">{c.name}</span>
                  <span className="text-[10px] text-white/60 capitalize">{c.role}</span>
                  <button
                    onClick={() => removeCrew.mutate(c.userId)}
                    disabled={removeCrew.isPending}
                    title={t("removeFromJob")}
                    className="p-1 rounded text-white/60 hover:text-red-400 hover:bg-white/[0.06] transition-colors disabled:opacity-40"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Checklist */}
        <div className="px-6 py-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-white/60 text-xs py-4">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> {tc("loading")}
            </div>
          ) : grouped.length === 0 ? (
            <p className="text-sm text-white/60 italic py-3 text-center">
              {t("noUnitsAssignedHint", { editUnits: t("editUnits") })}
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-5">
              {grouped.map(([itemName, units]) => (
                <div key={itemName}>
                  <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-white/[0.06]">
                    <p className="text-[10px] font-bold text-[#FFFF00]/45 uppercase tracking-wider flex-1 truncate">
                      {itemName}
                    </p>
                    <span className="text-[9px] text-white/60 flex-shrink-0">{units.length}</span>
                  </div>
                  {(units as any[]).map((u) => {
                    const isOut = u.status === "out";
                    return (
                      <div key={u.id} className="flex items-center gap-2 py-1.5 border-b border-white/[0.03] last:border-0">
                        <div className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center ${
                          isOut ? "bg-emerald-500/20" : "border border-white/10"
                        }`}>
                          {isOut
                            ? <Check className="w-3 h-3 text-emerald-400" strokeWidth={3} />
                            : <div className="w-2 h-2 rounded-sm bg-white/8" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs truncate ${isOut ? "text-white/70" : "text-white/60"}`}>{u.name}</p>
                          {u.serialNumber && (
                            <p className="text-[10px] text-white/40 font-mono truncate">{t("snLabel", { serial: u.serialNumber })}</p>
                          )}
                        </div>
                        <span className={`text-[9px] px-1.5 rounded-full font-medium flex-shrink-0 ${
                          isOut            ? "bg-blue-400/10 text-blue-400/70" :
                          u.status === "maintenance" ? "bg-amber-400/10 text-amber-400/60" :
                          "bg-white/5 text-white/40"
                        }`}>
                          {tc(`statusEnum.${u.status}`, { defaultValue: u.status })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {assignContainerOpen && (
          <AssignContainerModal jobId={job.id} onClose={() => setAssignContainerOpen(false)} />
        )}
        {assignCrewOpen && (
          <AssignCrewModal jobId={job.id} onClose={() => setAssignCrewOpen(false)} />
        )}
      </td>
    </tr>
  );
};

export const JobsPage = (): JSX.Element => {
  const { t } = useTranslation("jobs");
  const { t: tc } = useTranslation("common");
  const [activeTab, setActiveTab]   = useState<JobTab>("jobs");
  const [expandedJobs, setExpandedJobs] = useState<string[]>([]);
  const [addIncidentOpen, setAddIncidentOpen] = useState(false);
  const [addJobOpen, setAddJobOpen] = useState(false);
  const [scanJob, setScanJob]       = useState<any>(null);
  const [manageJob, setManageJob]   = useState<any>(null);
  const [createPullSheetOpen, setCreatePullSheetOpen] = useState(false);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);
  const [deleteJobTarget, setDeleteJobTarget] = useState<any>(null);
  const { token, userRole } = useAppStore();
  const canManage = userRole === "admin" || userRole === "manager";
  const qc = useQueryClient();

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: jobsApi.getAll,
    enabled: !!token,
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ["incidents"],
    queryFn: jobsApi.getIncidents,
    enabled: !!token,
  });

  const createIncident = useMutation({
    mutationFn: ({ jobId, data }: { jobId: string; data: Parameters<typeof jobsApi.createIncident>[1] }) =>
      jobsApi.createIncident(jobId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["incidents"] }),
  });

  const { data: pullSheets = [] } = useQuery({
    queryKey: ["pull-sheets"],
    queryFn: jobsApi.getPullSheets,
    enabled: !!token,
  });

  const { data: crewData } = useQuery({
    queryKey: ["crew"],
    queryFn: jobsApi.getCrew,
    enabled: !!token,
  });

  const crewMembers       = crewData?.crew              ?? [];
  const myTasks           = crewData?.tasks             ?? [];
  const responsibilityLog = crewData?.responsibilityLog ?? [];

  const createJob = useMutation({
    mutationFn: (data: Parameters<typeof jobsApi.create>[0]) => jobsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });

  const createPullSheet = useMutation({
    mutationFn: ({ jobId, data }: { jobId: string; data: Parameters<typeof jobsApi.createPullSheet>[1] }) =>
      jobsApi.createPullSheet(jobId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pull-sheets"] }),
  });

  const deletePullSheet = useMutation({
    mutationFn: (id: string) => jobsApi.deletePullSheet(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pull-sheets"] }),
  });

  const deleteJob = useMutation({
    mutationFn: (id: string) => jobsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["pull-sheets"] });
      setDeleteJobTarget(null);
    },
  });

  const handleExportPdf = async (ps: { id: string; jobId: string | null; job: string }) => {
    if (!ps.jobId) return;
    setDownloadingPdfId(ps.id);
    try {
      const blob = await jobsApi.downloadPullSheetPdf(ps.jobId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pullsheet-${ps.job}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const toggleJob = (id: string) =>
    setExpandedJobs((p) => p.includes(id) ? p.filter((r) => r !== id) : [...p, id]);

  return (
    <div className="flex-1 overflow-auto p-6 space-y-4" data-testid="page-jobs">
      {addJobOpen && (
        <AddJobModal
          onClose={() => setAddJobOpen(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ["jobs"] })}
        />
      )}
      {scanJob && (
        <ScanModal
          jobId={scanJob.id}
          jobName={scanJob.name}
          onClose={() => setScanJob(null)}
        />
      )}
      {manageJob && (
        <ManageJobStockModal
          jobId={manageJob.id}
          jobName={manageJob.name}
          onClose={() => setManageJob(null)}
        />
      )}
      {createPullSheetOpen && (
        <CreatePullSheetModal
          onClose={() => setCreatePullSheetOpen(false)}
          onSubmit={(jobId, data) => createPullSheet.mutate({ jobId, data })}
        />
      )}

      <AlertDialog open={!!deleteJobTarget} onOpenChange={(open) => !open && setDeleteJobTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDeleteJobTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmDeleteJobDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteJob.isPending}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteJobTarget && deleteJob.mutate(deleteJobTarget.id)}
              disabled={deleteJob.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteJob.isPending ? tc("deleting") : tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white" data-testid="text-jobs-title">{t("pageTitle")}</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{t("statusCount", { count: (jobs as any[]).filter((j) => j.status === "active").length, status: tc("statusEnum.active") })}</span>
            <span className="flex items-center gap-1 text-blue-400"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" />{t("statusCount", { count: (jobs as any[]).filter((j) => j.status === "scheduled").length, status: tc("statusEnum.scheduled") })}</span>
            <span className="flex items-center gap-1 text-white/60"><span className="w-1.5 h-1.5 rounded-full bg-white/30" />{t("statusCount", { count: (jobs as any[]).filter((j) => j.status === "completed").length, status: tc("statusEnum.completed") })}</span>
          </div>
          <button
            onClick={() => setAddJobOpen(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#FFFF00" }}
          >
            <Plus className="w-4 h-4" /> {t("addJob")}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-white/[0.06]">
        {jobTabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.key ? "border-[#FFFF00] text-[#FFFF00]" : "border-transparent text-white/60 hover:text-white"
            }`}
            data-testid={`tab-${tab.key}`}>
            <tab.icon className="w-3.5 h-3.5" />{t(tab.labelKey)}
          </button>
        ))}
      </div>

      {activeTab === "jobs" && (
        <div className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] text-[#FFFF00]/50 uppercase tracking-wider">
                <th className="py-2.5 pl-4 text-left font-semibold">{t("colJob")}</th>
                <th className="py-2.5 text-left font-semibold">{t("colClient")}</th>
                <th className="py-2.5 text-left font-semibold">{t("colDates")}</th>
                <th className="py-2.5 text-left font-semibold">{t("colStock")}</th>
                <th className="py-2.5 text-left font-semibold">{tc("status")}</th>
                <th className="py-2.5 pr-4 text-right font-semibold">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {jobsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="animate-pulse border-b border-white/[0.04] bg-[#1a1a1a]">
                    <td className="py-3 pl-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 rounded bg-white/[0.06]" />
                        <div className="h-3 rounded bg-white/[0.06]" style={{ width: `${120 + (i * 31) % 80}px` }} />
                      </div>
                    </td>
                    <td className="py-3"><div className="h-3 rounded bg-white/[0.05] w-24" /></td>
                    <td className="py-3"><div className="h-3 rounded bg-white/[0.04] w-28" /></td>
                    <td className="py-3"><div className="h-3 rounded bg-white/[0.04] w-6" /></td>
                    <td className="py-3"><div className="h-5 rounded-full bg-white/[0.06] w-16" /></td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-7 rounded-lg bg-white/[0.05] w-20" />
                        <div className="h-7 rounded-lg bg-white/[0.08] w-14" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : (jobs as any[]).flatMap((job) => {
                const start = new Date(job.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                const end   = new Date(job.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                const dateStr = start === end ? start : `${start} – ${end}`;
                const exp = expandedJobs.includes(job.id);
                const rows = [
                  <tr
                    key={`j-${job.id}`}
                    onClick={() => toggleJob(job.id)}
                    className="bg-[#1a1a1a] hover:bg-[#202020] cursor-pointer border-b border-white/[0.04] transition-colors"
                    data-testid={`row-job-${job.id}`}
                  >
                    <td className="py-2.5 pl-4">
                      <div className="flex items-center gap-2">
                        <ChevronRightIcon className={`w-3.5 h-3.5 transition-transform duration-200 flex-shrink-0 ${exp ? "rotate-90 text-[#FFFF00]" : "text-white/60"}`} />
                        <span className="font-medium text-white/90">{job.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-white/50">{job.client}</td>
                    <td className="py-2.5 text-white/60 text-xs">{dateStr}</td>
                    <td className="py-2.5"><span className="text-white/60 text-xs">—</span></td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusStyles[job.status] ?? "bg-white/5 text-white/60"}`}>
                        {tc(`statusEnum.${job.status}`, { defaultValue: job.status })}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setManageJob(job); }}
                          className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[10px] font-semibold text-white/60
                            border border-white/[0.08] hover:border-white/20 hover:text-white transition-colors"
                        >
                          <Package className="w-3 h-3" /> {t("editUnits")}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setScanJob(job); }}
                          className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[10px] font-bold text-black transition-opacity hover:opacity-80"
                          style={{ backgroundColor: "#FFFF00" }}
                        >
                          <ScanLine className="w-3 h-3" /> {t("scanButton")}
                        </button>
                        {canManage && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteJobTarget(job); }}
                            className="p-1.5 rounded-lg text-white/60 hover:text-red-400 hover:bg-white/[0.06] transition-colors"
                            title={t("deleteJob")}
                            data-testid={`button-delete-job-${job.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>,
                ];
                if (exp) {
                  rows.push(<JobDetailRow key={`jd-${job.id}`} job={job} />);
                }
                return rows;
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "pullsheets" && (
        <div className="space-y-4">
          <div className="flex flex-row items-center gap-3 w-full px-4 py-3 border-b border-white/10 bg-[#0f0f0f] flex-shrink-0 rounded-lg">
            <Smartphone className="w-4 h-4 text-[#FFFF00]/50 flex-shrink-0" />
            <span className="text-sm text-white/60">{t("pullSheetsHint")}</span>
            <div className="ml-auto">
              <button
                onClick={() => setCreatePullSheetOpen(true)}
                className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#FFFF00" }}
                data-testid="button-create-pullsheet"
              >
                <Plus className="w-4 h-4" /> {t("createPullSheet")}
              </button>
            </div>
          </div>
          <div className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] text-[#FFFF00]/50 uppercase tracking-wider">
                  <th className="py-2.5 pl-4 text-left font-semibold">{t("colPullSheet")}</th>
                  <th className="py-2.5 text-left font-semibold">{t("colJob")}</th>
                  <th className="py-2.5 text-left font-semibold">{tc("items")}</th>
                  <th className="py-2.5 text-left font-semibold">{t("colCreated")}</th>
                  <th className="py-2.5 text-left font-semibold">{t("colAssignee")}</th>
                  <th className="py-2.5 text-left font-semibold">{tc("status")}</th>
                  <th className="py-2.5 pr-4 text-right font-semibold">{tc("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {pullSheets.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm text-white/40">{t("noPullSheetsYet")}</td>
                  </tr>
                )}
                {pullSheets.map((ps) => (
                  <tr key={ps.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors" data-testid={`row-pullsheet-${ps.id}`}>
                    <td className="py-2.5 pl-4 font-mono text-[#FFFF00]/70 text-xs">{ps.id}</td>
                    <td className="py-2.5 text-white/60">{ps.job}</td>
                    <td className="py-2.5"><span className="font-bold text-white">{ps.items}</span></td>
                    <td className="py-2.5 text-white/60 text-xs">{new Date(ps.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className="py-2.5 text-white/50">{ps.assignee}</td>
                    <td className="py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusStyles[ps.status]}`}>{tc(`statusEnum.${ps.status}`, { defaultValue: ps.status })}</span></td>
                    <td className="py-2.5 pr-4 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <button className="p-1 rounded hover:bg-white/5 text-white/60 hover:text-[#FFFF00] transition-colors" title={t("shareViaLine")} data-testid={`button-share-line-${ps.id}`}><MessageSquare className="w-3.5 h-3.5" /></button>
                        <button
                          onClick={() => handleExportPdf(ps)}
                          disabled={downloadingPdfId === ps.id}
                          className="p-1 rounded hover:bg-white/5 text-white/60 hover:text-white transition-colors disabled:opacity-50"
                          title={t("exportPdf")}
                          data-testid={`button-export-pdf-${ps.id}`}
                        >
                          {downloadingPdfId === ps.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <FileText className="w-3.5 h-3.5" />}
                        </button>
                        <button className="p-1 rounded hover:bg-white/5 text-white/60 hover:text-emerald-400 transition-colors" title={t("sendToCrew")} data-testid={`button-send-crew-${ps.id}`}><Send className="w-3.5 h-3.5" /></button>
                        <button
                          onClick={() => deletePullSheet.mutate(ps.id)}
                          className="p-1 rounded hover:bg-white/5 text-white/60 hover:text-red-400 transition-colors"
                          title={t("deletePullSheet")}
                          data-testid={`button-delete-pullsheet-${ps.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "crew" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-[#FFFF00]/5 border border-[#FFFF00]/10 rounded-lg">
            <Bell className="w-4 h-4 text-[#FFFF00]" />
            <span className="text-xs text-[#FFFF00]/70">{t("crewNotificationHint")}</span>
          </div>

          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-7 bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#FFFF00]" />
                <span className="font-bold text-[#FFFF00] text-xs tracking-widest uppercase">{t("crewAndAssignments")}</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {crewMembers.map((crew) => (
                  <div key={crew.id} className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors" data-testid={`crew-${crew.initials.toLowerCase()}`}>
                    <div className="w-8 h-8 rounded-full bg-[#FFFF00]/10 flex items-center justify-center text-xs font-bold text-[#FFFF00]/70">{crew.initials}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><span className="text-sm font-medium text-white/80">{crew.name}</span><span className="text-[10px] text-white/60">{crew.role}</span></div>
                      <div className="flex items-center gap-3 text-[11px] text-white/60 mt-0.5">
                        <span>{t("currentLabel")} <span className={crew.currentJob !== "—" ? "text-emerald-400/70" : "text-white/60"}>{crew.currentJob}</span></span>
                        <span>{t("nextLabel")} <span className="text-white/60">{crew.nextJob}</span></span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-xs"><Package className="w-3 h-3 text-white/60" /><span className="text-white/50 font-medium">{crew.items}</span><span className="text-white/60">{tc("items")}</span></div>
                      <div className="flex items-center gap-1 text-[10px] text-white/60 mt-0.5"><CheckCircle2 className="w-3 h-3" />{t("tasksCount", { count: crew.tasksToday })}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-5 space-y-4">
              <div className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-[#FFFF00]" />
                  <span className="font-bold text-[#FFFF00] text-xs tracking-widest uppercase">{t("myTasksLabel")}</span>
                  <span className="ml-auto text-[10px] text-white/60">{t("pendingCount", { count: myTasks.filter((task) => task.status !== "Done").length })}</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {myTasks.map((task) => (
                    <div key={task.id} className={`flex items-start gap-2.5 px-4 py-2.5 hover:bg-white/[0.02] transition-colors ${task.status === "Done" ? "opacity-50" : ""}`} data-testid={`task-${task.id}`}>
                      <div className="mt-0.5">
                        {task.status === "Done" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : task.status === "In Progress" ? <div className="w-3.5 h-3.5 rounded-full border-2 border-[#FFFF00] border-t-transparent animate-spin" /> : <div className="w-3.5 h-3.5 rounded-full border border-white/20" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5"><span className={`text-xs ${task.status === "Done" ? "line-through text-white/60" : "text-white/70"}`}>{task.title}</span><span className={`px-1 py-0.5 rounded text-[8px] font-semibold ${priorityColors[task.priority]}`}>{tc(`statusEnum.${task.priority.toLowerCase()}`, { defaultValue: task.priority })}</span></div>
                        <span className="text-[10px] text-white/60">{task.due}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#FFFF00]" />
                  <span className="font-bold text-[#FFFF00] text-xs tracking-widest uppercase">{t("responsibilityLog")}</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {responsibilityLog.map((log) => {
                    const actionLabels: Record<string, string> = {
                      "Checked Out": t("actionCheckedOut"),
                      Returned: t("actionReturned"),
                      "Reported Damage": t("actionReportedDamage"),
                    };
                    return (
                      <div key={log.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors" data-testid={`responsibility-${log.id}`}>
                        <div className={`w-6 h-6 rounded flex items-center justify-center ${actionColors[log.action]}`}>
                          {log.action === "Checked Out" ? <ArrowRight className="w-3 h-3" /> : log.action === "Returned" ? <CheckCircle2 className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5"><span className={`text-[10px] font-semibold ${actionColors[log.action]?.split(" ")[0]}`}>{actionLabels[log.action] ?? log.action}</span><span className="text-[9px] text-white/40">{log.time}</span></div>
                          <p className="text-xs text-white/50"><span className="text-white/70">{log.person}</span> — {log.items}</p>
                        </div>
                        {log.signature && <CheckCircle2 className="w-3 h-3 text-emerald-400/40" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "incidents" && (
        <div className="space-y-4">
          {addIncidentOpen && (
            <AddIncidentModal
              onClose={() => setAddIncidentOpen(false)}
              onSubmit={(jobId, data) => createIncident.mutate({ jobId, data })}
            />
          )}
          <div className="flex items-center gap-2 p-3 bg-red-500/5 border border-red-500/15 rounded-lg">
            <Camera className="w-4 h-4 text-red-400" />
            <span className="text-xs text-red-300 flex-1">{t("incidentsHint")}</span>
            <button
              onClick={() => setAddIncidentOpen(true)}
              className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#FFFF00" }}
            >
              <AlertTriangle className="w-4 h-4" /> {t("reportIncident")}
            </button>
          </div>
          <div className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="font-bold text-red-400 text-xs tracking-widest uppercase">{t("incidentReports")}</span>
              <span className="ml-auto text-[10px] text-white/60">{t("openCount", { count: (incidents as any[]).filter((i) => i.status === "open").length })}</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {(incidents as any[]).map((inc) => (
                <div key={inc.id} className="flex items-start gap-4 px-4 py-3.5 hover:bg-white/[0.02] transition-colors" data-testid={`incident-${inc.id}`}>
                  <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center ${inc.status === "open" ? "bg-red-500/10" : "bg-emerald-500/10"}`}>
                    {inc.status === "open" ? <AlertTriangle className="w-4 h-4 text-red-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs text-[#FFFF00]/60">{inc.id.slice(0, 8)}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${severityStyles[inc.severity] ?? "bg-white/5 text-white/60"}`}>{tc(`statusEnum.${inc.severity.toLowerCase()}`, { defaultValue: inc.severity })}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${statusStyles[inc.status] ?? "bg-white/5 text-white/60"}`}>{tc(`statusEnum.${inc.status}`, { defaultValue: inc.status })}</span>
                      {inc.hasPhoto && (
                        inc.photoUrl ? (
                          <a href={inc.photoUrl} target="_blank" rel="noopener noreferrer" title={t("viewPhotoEvidence")} className="text-white/60 hover:text-[#FFFF00] transition-colors">
                            <Camera className="w-3 h-3" />
                          </a>
                        ) : (
                          <span title={t("photoAttached")}><Camera className="w-3 h-3 text-white/60" /></span>
                        )
                      )}
                    </div>
                    <p className="text-sm text-white/60">{inc.description}</p>
                    <div className="flex items-center gap-3 text-[10px] text-white/60 mt-1">
                      <span>{t("assetLabel")} <span className="text-white/60">{inc.stockUnitId ?? "—"}</span></span>
                      <span>{t("jobLabel")} <span className="text-white/60">{inc.jobId ?? "—"}</span></span>
                      <span>{t("byLabel")} <span className="text-white/60">{inc.reporterId}</span></span>
                      <span>{new Date(inc.date).toLocaleDateString("en-GB")}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
