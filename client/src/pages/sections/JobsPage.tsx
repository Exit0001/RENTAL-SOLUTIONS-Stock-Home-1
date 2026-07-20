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
import { AddIncidentModal } from "./AddIncidentModal";
import { AddJobModal } from "./AddJobModal";
import { ManageJobStockModal } from "./ManageJobStockModal";
import { AssignCrewModal } from "./AssignCrewModal";
import { CreatePullSheetModal } from "./CreatePullSheetModal";
import { JobOperationsModal } from "./JobOperationsModal";
import { JobDetailModal } from "./JobDetailModal";
import { JobDetailPanel } from "./JobDetailPanel";

type JobTab = "jobs" | "pullsheets" | "incidents" | "schedule";

const jobTabs: { key: JobTab; labelKey: string; icon: typeof Briefcase }[] = [
  { key: "jobs",       labelKey: "tabJobs",       icon: Briefcase },
  { key: "pullsheets", labelKey: "tabPullSheets", icon: FileText },
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
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [createPullSheetOpen, setCreatePullSheetOpen] = useState(false);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);
  const [deleteJobTarget, setDeleteJobTarget] = useState<any>(null);
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

  // งานที่เลือกในโหมด master-detail — derive จาก list สดเสมอ (สถานะอัปเดตทันที)
  const selectedJob = (jobs as any[]).find((j) => j.id === selectedJobId) ?? null;

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
    <div className="flex flex-col h-full overflow-hidden p-4 gap-3" data-testid="page-jobs">
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

      {activeTab === "jobs" && (
        <div className="flex flex-1 min-h-0 border border-white/[0.06] rounded-xl overflow-hidden bg-[#0d0d0d]">
          {/* LEFT: job list */}
          <aside className="w-[280px] flex-shrink-0 flex flex-col border-r border-white/[0.06] bg-[#0b0b0b]">
            <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center gap-2 flex-shrink-0">
              <span className="text-xs font-bold text-white/50">รายการงาน</span>
              <span className="text-[11px] text-white/40">{(jobs as any[]).length}</span>
            </div>
            <div className="p-2 border-b border-white/[0.04] flex-shrink-0">
              <button onClick={() => setSelectedJobId(null)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${!selectedJobId ? "bg-[#FFFF00]/[0.1] text-[#FFFF00] border border-[#FFFF00]/30" : "text-white/60 border border-white/[0.08] hover:text-white hover:border-white/20"}`}>
                <CalendarRange className="w-4 h-4" /> ปฏิทินรวม
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {jobsLoading ? (
                Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-lg bg-white/[0.03] animate-pulse" />)
              ) : (jobs as any[]).length === 0 ? (
                <p className="text-center text-xs text-white/40 py-8">{t("noJobsYet", { defaultValue: "ยังไม่มีงาน" })}</p>
              ) : (jobs as any[]).map((job) => {
                const s = new Date(job.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                const e = new Date(job.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                const active = selectedJobId === job.id;
                const dot = job.status === "active" ? "bg-emerald-400" : job.status === "scheduled" ? "bg-blue-400" : job.status === "completed" ? "bg-white/40" : job.status === "cancelled" ? "bg-red-400" : "bg-white/25";
                return (
                  <button key={job.id} onClick={() => setSelectedJobId(job.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${active ? "border-[#FFFF00]/50 bg-[#FFFF00]/[0.06]" : "border-transparent hover:bg-white/[0.03]"}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                      <p className={`text-sm font-medium truncate flex-1 ${active ? "text-[#FFFF00]" : "text-white/85"}`}>{job.name}</p>
                    </div>
                    <p className="text-[10px] text-white/40 mt-0.5 pl-3.5 truncate">{job.client} · {s === e ? s : `${s}–${e}`}</p>
                  </button>
                );
              })}
            </div>
          </aside>
          {/* RIGHT: detail or schedule overview */}
          <div className="flex-1 min-w-0">
            {selectedJob ? (
              <JobDetailPanel job={selectedJob} onDeleted={() => setSelectedJobId(null)} />
            ) : (
              <div className="h-full overflow-y-auto p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarRange className="w-3.5 h-3.5 text-[#FFFF00]/40" />
                  <span className="text-[10px] font-bold text-[#FFFF00]/40 uppercase tracking-wider">ตารางงาน — เลือกงานจากรายการซ้ายเพื่อจัดการ</span>
                </div>
                <JobScheduleView jobs={jobs as any[]} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
