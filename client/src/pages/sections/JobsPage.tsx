import { useState } from "react";
import {
  Briefcase,
  ChevronRightIcon,
  Users,
  Package,
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
  Loader2,
  Check,
  Layers,
  X,
  Trash2,
  Copy,
  LayoutTemplate,
  CalendarRange,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { useToast } from "@/hooks/use-toast";
import { jobsApi, jobVehiclesApi, jobSubRentalsApi, stockApi, jobTemplatesApi } from "@/api";
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
import { JobScheduleView } from "./JobScheduleView";
import { CrewScheduleView } from "./CrewScheduleView";
import { AddIncidentModal } from "./AddIncidentModal";
import { AddJobModal } from "./AddJobModal";
import { ManageJobStockModal } from "./ManageJobStockModal";
import { AssignContainerModal } from "./AssignContainerModal";
import { AddSetToJobModal } from "./AddSetToJobModal";
import { AssignCrewModal } from "./AssignCrewModal";
import { CreatePullSheetModal } from "./CreatePullSheetModal";
import { AddVehicleModal } from "./AddVehicleModal";
import { JobExpensesModal } from "./JobExpensesModal";
import { JobSubRentalsModal } from "./JobSubRentalsModal";
import { RackBuildModal } from "./RackBuildModal";
import { JobOperationsModal } from "./JobOperationsModal";
import { JobDetailModal } from "./JobDetailModal";

type JobTab = "jobs" | "pullsheets" | "crew" | "incidents" | "schedule";

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

export const JobsPage = (): JSX.Element => {
  const { t } = useTranslation("jobs");
  const { t: tc } = useTranslation("common");
  const [activeTab, setActiveTab]   = useState<JobTab>("jobs");
  const [jobDetailTarget, setJobDetailTarget] = useState<any>(null);
  const [addIncidentOpen, setAddIncidentOpen] = useState(false);
  const [addJobOpen, setAddJobOpen] = useState(false);
  const [manageJob, setManageJob]   = useState<any>(null);
  const [opsJob, setOpsJob]         = useState<any>(null);
  const [createPullSheetOpen, setCreatePullSheetOpen] = useState(false);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);
  const [deleteJobTarget, setDeleteJobTarget] = useState<any>(null);
  const [assignCrewTabJob, setAssignCrewTabJob] = useState<any>(null);
  const { token, userRole } = useAppStore();
  const canManage = userRole === "admin" || userRole === "manager";
  const qc = useQueryClient();
  const { toast } = useToast();

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

  const resolveIncident = useMutation({
    mutationFn: (incidentId: string) => jobsApi.resolveIncident(incidentId),
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

  const updateJobStatus = useMutation({
    mutationFn: ({ jobId, status }: { jobId: string; status: string }) => jobsApi.update(jobId, { status: status as any }),
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
      qc.invalidateQueries({ queryKey: ["stock"] });
      setDeleteJobTarget(null);
    },
  });

  const duplicateJob = useMutation({
    mutationFn: (id: string) => jobsApi.duplicate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      toast({ title: t("jobDuplicated") });
    },
    onError: (err: any) => toast({ title: t("jobDuplicateFailed"), description: err?.message, variant: "destructive" }),
  });

  // Save an existing job's equipment set as a reusable template
  const [saveTplJob, setSaveTplJob] = useState<any>(null);
  const [tplName, setTplName]       = useState("");
  const saveTemplate = useMutation({
    mutationFn: ({ jobId, name }: { jobId: string; name: string }) => jobTemplatesApi.saveFromJob(jobId, { name }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["job-templates"] });
      setSaveTplJob(null); setTplName("");
      toast({ title: t("templateSaved"), description: t("templateSavedDesc", { count: res.itemCount }) });
    },
    onError: (err: any) => toast({ title: t("templateSaveFailed"), description: err?.message, variant: "destructive" }),
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

  return (
    <div className="flex-1 overflow-auto p-6 space-y-4" data-testid="page-jobs">
      {addJobOpen && (
        <AddJobModal
          onClose={() => setAddJobOpen(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["jobs"] });
            qc.invalidateQueries({ queryKey: ["stock"] });
          }}
        />
      )}
      {opsJob && (
        <JobOperationsModal
          open={!!opsJob}
          onClose={() => setOpsJob(null)}
          job={opsJob}
        />
      )}
      {jobDetailTarget && (
        <JobDetailModal job={jobDetailTarget} onClose={() => setJobDetailTarget(null)} />
      )}
      {manageJob && (
        <ManageJobStockModal
          jobId={manageJob.id}
          jobName={manageJob.name}
          onClose={() => setManageJob(null)}
        />
      )}
      {assignCrewTabJob && (
        <AssignCrewModal
          jobId={assignCrewTabJob.id}
          onClose={() => setAssignCrewTabJob(null)}
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

      {/* Save-as-template name prompt */}
      {saveTplJob && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
          onClick={(e) => e.target === e.currentTarget && setSaveTplJob(null)}
        >
          <div className="w-full max-w-sm bg-[#0f0f0f] border border-white/[0.08] rounded-2xl shadow-2xl animate-modal-up flex flex-col">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.06]">
              <div className="w-8 h-8 rounded-lg bg-[#FFFF00]/10 flex items-center justify-center">
                <LayoutTemplate className="w-4 h-4 text-[#FFFF00]" />
              </div>
              <div>
                <h2 className="font-bold text-white text-sm">{t("saveAsTemplate")}</h2>
                <p className="text-[10px] text-white/60 truncate max-w-[240px]">{saveTplJob.name}</p>
              </div>
            </div>
            <div className="px-6 py-5 space-y-3">
              <label className="text-[10px] text-white/60 uppercase tracking-wider font-medium">{t("templateName")}</label>
              <input
                autoFocus
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && tplName.trim() && !saveTemplate.isPending) saveTemplate.mutate({ jobId: saveTplJob.id, name: tplName.trim() }); }}
                placeholder={t("templateNamePlaceholder")}
                className="w-full h-9 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#FFFF00]/40"
              />
              <p className="text-[10px] text-white/40">{t("templateSaveHint")}</p>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/[0.06]">
              <button onClick={() => setSaveTplJob(null)}
                className="h-9 px-4 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors">
                {tc("cancel")}
              </button>
              <button
                onClick={() => saveTemplate.mutate({ jobId: saveTplJob.id, name: tplName.trim() })}
                disabled={!tplName.trim() || saveTemplate.isPending}
                className="flex items-center gap-2 h-9 px-5 rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-80 disabled:opacity-30"
                style={{ backgroundColor: "#FFFF00" }}
              >
                {saveTemplate.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LayoutTemplate className="w-3.5 h-3.5" />}
                {tc("save")}
              </button>
            </div>
          </div>
        </div>
      )}

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
        <div className="space-y-6">
        {/* Schedule view */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CalendarRange className="w-3.5 h-3.5 text-[#FFFF00]/40" />
            <span className="text-[10px] font-bold text-[#FFFF00]/40 uppercase tracking-wider">ตารางงาน</span>
          </div>
          <JobScheduleView jobs={jobs as any[]} />
        </div>

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
              ) : (jobs as any[]).map((job) => {
                const start = new Date(job.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                const end   = new Date(job.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                const dateStr = start === end ? start : `${start} – ${end}`;
                return (
                  <tr
                    key={`j-${job.id}`}
                    onClick={() => setJobDetailTarget(job)}
                    className="bg-[#1a1a1a] hover:bg-[#202020] cursor-pointer border-b border-white/[0.04] transition-colors"
                    data-testid={`row-job-${job.id}`}
                  >
                    <td className="py-2.5 pl-4">
                      <div className="flex items-center gap-2">
                        <ChevronRightIcon className="w-3.5 h-3.5 flex-shrink-0 text-white/60" />
                        <span className="font-medium text-white/90">{job.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-white/50">{job.client}</td>
                    <td className="py-2.5 text-white/60 text-xs">{dateStr}</td>
                    <td className="py-2.5"><span className="text-white/60 text-xs">—</span></td>
                    <td className="py-2.5">
                      {canManage ? (
                        <select
                          value={job.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => { e.stopPropagation(); updateJobStatus.mutate({ jobId: job.id, status: e.target.value }); }}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#FFFF00]/40 ${statusStyles[job.status] ?? "bg-white/5 text-white/60"}`}
                        >
                          {["draft", "scheduled", "active", "completed", "cancelled"].map((s) => (
                            <option key={s} value={s} className="bg-[#111] text-white">
                              {tc(`statusEnum.${s}`, { defaultValue: s })}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusStyles[job.status] ?? "bg-white/5 text-white/60"}`}>
                          {tc(`statusEnum.${job.status}`, { defaultValue: job.status })}
                        </span>
                      )}
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
                          onClick={(e) => { e.stopPropagation(); setOpsJob(job); }}
                          className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[10px] font-bold text-black transition-opacity hover:opacity-80"
                          style={{ backgroundColor: "#FFFF00" }}
                        >
                          <Layers className="w-3 h-3" /> Operations
                        </button>
                        {canManage && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setSaveTplJob(job); setTplName(`${job.name}`); }}
                            className="p-1.5 rounded-lg text-white/60 hover:text-[#FFFF00] hover:bg-white/[0.06] transition-colors"
                            title={t("saveAsTemplate")}
                            data-testid={`button-save-template-${job.id}`}
                          >
                            <LayoutTemplate className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canManage && (
                          <button
                            onClick={(e) => { e.stopPropagation(); duplicateJob.mutate(job.id); }}
                            disabled={duplicateJob.isPending}
                            className="p-1.5 rounded-lg text-white/60 hover:text-[#FFFF00] hover:bg-white/[0.06] transition-colors disabled:opacity-40"
                            title={t("duplicateJob")}
                            data-testid={`button-duplicate-job-${job.id}`}
                          >
                            {duplicateJob.isPending && duplicateJob.variables === job.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

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
        <div className="-m-6 border border-white/[0.06] rounded-xl overflow-hidden bg-[#0a0a0a]" style={{ height: "calc(100vh - 160px)" }}>
          <CrewScheduleView
            jobs={jobs}
            crewMembers={crewMembers}
            onAssignCrew={(job) => setAssignCrewTabJob(job)}
          />
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
                  {canManage && inc.status === "open" && (
                    <button
                      onClick={() => resolveIncident.mutate(inc.id)}
                      disabled={resolveIncident.isPending && resolveIncident.variables === inc.id}
                      className="flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-semibold text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 transition-colors flex-shrink-0 disabled:opacity-40"
                    >
                      {resolveIncident.isPending && resolveIncident.variables === inc.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <CheckCircle2 className="w-3 h-3" />}
                      {t("markResolved")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
