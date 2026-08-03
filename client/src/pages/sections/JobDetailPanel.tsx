import { useState, useMemo, type ReactNode } from "react";
import {
  Calendar, MapPin, Package, Layers, ScanLine, Plus, Loader2, Users, Wallet,
  UserPlus, ArrowRightLeft, Truck, ChevronRight, FileText, Camera, Copy, Trash2,
  LayoutTemplate, X, Clock, Download, Pencil, Check,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useAppStore } from "@/store/appStore";
import { ScrollTabs } from "@/components/ScrollTabs";
import { toDateInput, fromDateInput } from "@/lib/dateUtils";
import { jobColor, PALETTE } from "@/lib/jobColors";
import { useToast } from "@/hooks/use-toast";
import { jobsApi, jobVehiclesApi, jobSubRentalsApi, stockApi, jobTemplatesApi } from "@/api";
import { FileUploadField } from "@/components/FileUploadField";
import { ManageJobStockModal } from "./ManageJobStockModal";
import { JobOperationsModal } from "./JobOperationsModal";
import { RackBuildModal } from "./RackBuildModal";
import { AssignCrewModal, CREW_TYPE_LABEL } from "./AssignCrewModal";
import { AssignVehicleModal } from "./AssignVehicleModal";
import { JobExpensesModal } from "./JobExpensesModal";
import { JobSubRentalsModal } from "./JobSubRentalsModal";
import { CreatePullSheetModal } from "./CreatePullSheetModal";
import { AddIncidentModal } from "./AddIncidentModal";
import { JobDailyScheduleSection } from "./JobDailyScheduleSection";
import { JobUnitEventsSection } from "./JobUnitEventsSection";

interface Props {
  job: any;
  onDeleted: () => void;
}

type DetailTab = "overview" | "stock" | "crew" | "pullsheets" | "incidents" | "finance";

const statusStyles: Record<string, string> = {
  draft: "bg-fg/5 text-fg/60", scheduled: "bg-blue-950/60 text-blue-400",
  active: "bg-emerald-950/60 text-emerald-400", completed: "bg-fg/5 text-fg/60",
  cancelled: "bg-red-950/60 text-red-400",
};

export const JobDetailPanel = ({ job, onDeleted }: Props): JSX.Element => {
  const { t } = useTranslation("jobs");
  const { t: tc } = useTranslation("common");
  const { token, userRole, companyId } = useAppStore();
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
  // pull-sheet PDF download (the button that went missing when this page became a panel)
  const [sheetTitle, setSheetTitle] = useState("");
  const [downloadingSheet, setDownloadingSheet] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [colorOpen, setColorOpen] = useState(false);
  // inline job-info editing (name/client/location/dates)
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [infoForm, setInfoForm] = useState({ name: "", client: "", location: "", startDate: "", endDate: "", rehearsalDate: "" });

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["job-units", job.id] }); qc.invalidateQueries({ queryKey: ["stock"] }); qc.invalidateQueries({ queryKey: ["containers"] }); },
  });
  const updateStatus = useMutation({ mutationFn: (status: string) => jobsApi.update(job.id, { status: status as any }), onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }) });
  const updateImage = useMutation({ mutationFn: (url: string | null) => jobsApi.update(job.id, { imageUrl: url } as any), onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }) });
  // null = back to the automatic hash colour
  const updateColor = useMutation({ mutationFn: (color: string | null) => jobsApi.update(job.id, { color } as any), onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }) });
  const duplicateJob = useMutation({ mutationFn: () => jobsApi.duplicate(job.id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["jobs"] }); qc.invalidateQueries({ queryKey: ["stock"] }); toast({ title: t("jobDuplicated") }); }, onError: (e: any) => toast({ title: t("jobDuplicateFailed"), description: e?.message, variant: "destructive" }) });
  const deleteJob = useMutation({ mutationFn: () => jobsApi.delete(job.id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["jobs"] }); qc.invalidateQueries({ queryKey: ["pull-sheets"] }); qc.invalidateQueries({ queryKey: ["stock"] }); qc.invalidateQueries({ queryKey: ["containers"] }); setDeleteOpen(false); onDeleted(); } });
  const saveTemplate = useMutation({ mutationFn: (name: string) => jobTemplatesApi.saveFromJob(job.id, { name }), onSuccess: (res) => { qc.invalidateQueries({ queryKey: ["job-templates"] }); setTplOpen(false); setTplName(""); toast({ title: t("templateSaved"), description: t("templateSavedDesc", { count: res.itemCount }) }); } });
  const createPullSheet = useMutation({ mutationFn: (data: any) => jobsApi.createPullSheet(job.id, data), onSuccess: () => qc.invalidateQueries({ queryKey: ["pull-sheets"] }) });
  const createIncident = useMutation({ mutationFn: (data: any) => jobsApi.createIncident(job.id, data), onSuccess: () => qc.invalidateQueries({ queryKey: ["incidents"] }) });

  const startEditInfo = () => {
    setInfoError(null);
    setInfoForm({
      name: job.name ?? "",
      client: job.client ?? "",
      location: (job as any).location ?? "",
      startDate: toDateInput(job.startDate),
      endDate: toDateInput(job.endDate),
      rehearsalDate: toDateInput((job as any).rehearsalDate),
    });
    setEditingInfo(true);
  };

  const updateInfo = useMutation({
    mutationFn: () => {
      if (!infoForm.name.trim()) throw new Error("ต้องระบุชื่องาน");
      if (!infoForm.client.trim()) throw new Error("ต้องระบุลูกค้า");
      if (!infoForm.startDate || !infoForm.endDate) throw new Error("ต้องระบุวันเริ่มและวันจบ");
      const s = fromDateInput(infoForm.startDate);
      const e = fromDateInput(infoForm.endDate);
      if (!s || !e) throw new Error("วันที่ไม่ถูกต้อง");
      if (e < s) throw new Error("วันจบต้องไม่มาก่อนวันเริ่ม");
      const reh = fromDateInput(infoForm.rehearsalDate);
      return jobsApi.update(job.id, {
        name: infoForm.name.trim(),
        client: infoForm.client.trim(),
        location: infoForm.location.trim() || null,
        // local midnight, matching how jobs are stored elsewhere
        startDate: s.toISOString(),
        endDate: e.toISOString(),
        rehearsalDate: reh ? reh.toISOString() : null,
      } as any);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["jobs"] }); setEditingInfo(false); setInfoError(null); },
    onError: (e: any) => setInfoError(e?.message ?? "บันทึกไม่สำเร็จ"),
  });

  // ชื่อไฟล์คงอักขระไทยไว้ ตัดเฉพาะตัวที่ใช้ในชื่อไฟล์ไม่ได้
  const saveBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename.replace(/[\\/:*?"<>|]+/g, "_").trim()}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // "ฉบับล่าสุด" — สร้างสดจากอุปกรณ์ปัจจุบันของงาน ไม่ผูกกับเวอร์ชันใด
  const handleDownloadSheet = async () => {
    setDownloadingSheet(true);
    setSheetError(null);
    try {
      const blob = await jobsApi.downloadPullSheetPdf(job.id, sheetTitle);
      saveBlob(blob, sheetTitle.trim() ? `${job.name} - ${sheetTitle.trim()}` : job.name);
    } catch (e: any) {
      setSheetError(e?.message ?? "ดาวน์โหลดไม่สำเร็จ");
    } finally {
      setDownloadingSheet(false);
    }
  };

  // เวอร์ชันที่บันทึกไว้ — ใช้สแนปช็อตของใบนั้น
  const handleDownloadVersion = async (sheetId: string, filename: string) => {
    setDownloadingId(sheetId);
    setSheetError(null);
    try {
      saveBlob(await jobsApi.downloadPullSheetVersionPdf(sheetId), filename);
    } catch (e: any) {
      setSheetError(e?.message ?? "ดาวน์โหลดไม่สำเร็จ");
    } finally {
      setDownloadingId(null);
    }
  };

  const renameSheet = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => jobsApi.updatePullSheet(id, { name: name.trim() || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pull-sheets"] }); setRenamingId(null); },
    onError: (e: any) => { setSheetError(e?.message ?? "เปลี่ยนชื่อไม่สำเร็จ"); setRenamingId(null); },
  });

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

  const SectionHint = ({ children }: { children: ReactNode }) => <p className="text-sm text-fg/50 italic">{children}</p>;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-3 md:px-5 py-3 border-b border-fg/[0.06] flex-shrink-0">
        <div className="flex items-start gap-3">
          {/* Job colour — drives this job's bars in the calendar and both Gantts */}
          {canManage && (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setColorOpen((v) => !v)}
                aria-label="เปลี่ยนสีงาน"
                title="เปลี่ยนสีงาน"
                className="w-7 h-7 rounded-lg border-2 border-fg/15 hover:border-fg/35 transition-colors"
                style={{ backgroundColor: jobColor(job.id, (job as any).color).bg }}
              />
              {colorOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setColorOpen(false)} />
                  <div className="absolute left-0 top-9 z-50 w-[212px] p-2.5 rounded-xl bg-surface-1 border border-fg/[0.12] shadow-2xl">
                    <p className="text-[10px] text-fg/40 uppercase tracking-wider mb-2">สีของงาน</p>
                    <div className="grid grid-cols-6 gap-1.5">
                      {PALETTE.map((c) => {
                        const picked = ((job as any).color ?? "").toLowerCase() === c.bg.toLowerCase();
                        return (
                          <button
                            key={c.bg}
                            onClick={() => { updateColor.mutate(c.bg); setColorOpen(false); }}
                            aria-label={c.bg}
                            className={`w-7 h-7 rounded-md transition-transform hover:scale-110 ${picked ? "ring-2 ring-fg/70 ring-offset-2 ring-offset-surface-1" : ""}`}
                            style={{ backgroundColor: c.bg }}
                          />
                        );
                      })}
                    </div>
                    <button
                      onClick={() => { updateColor.mutate(null); setColorOpen(false); }}
                      className="mt-2.5 w-full h-8 rounded-lg text-[11px] font-semibold text-fg/60 border border-fg/[0.12] hover:text-fg hover:border-fg/25"
                    >
                      อัตโนมัติ
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-fg text-base truncate">{job.name}</h2>
            <div className="flex items-center gap-3 mt-1 text-xs text-fg/60 flex-wrap">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{start} → {end}</span>
              {job.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>}
              <span className="text-fg/50">{job.client}</span>
              {checkedOutCount > 0 && <span className="text-blue-400/70">{t("checkedOutCount", { count: checkedOutCount })}</span>}
            </div>
          </div>
          {canManage ? (
            <select value={job.status} onChange={(e) => updateStatus.mutate(e.target.value)}
              className={`px-2 py-1 rounded-full text-[11px] font-semibold border-0 cursor-pointer focus:outline-none ${statusStyles[job.status] ?? "bg-fg/5 text-fg/60"}`}>
              {["draft", "scheduled", "active", "completed", "cancelled"].map((s) => <option key={s} value={s} className="bg-surface-1 text-fg">{tc(`statusEnum.${s}`, { defaultValue: s })}</option>)}
            </select>
          ) : <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${statusStyles[job.status]}`}>{tc(`statusEnum.${job.status}`, { defaultValue: job.status })}</span>}
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <button onClick={() => setOpsOpen(true)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold text-black hover:opacity-80" style={{ backgroundColor: "var(--brand)" }}><Layers className="w-3.5 h-3.5" /> Operations</button>
          <button onClick={() => setManageStockOpen(true)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-fg/70 border border-fg/[0.12] hover:text-fg hover:border-fg/25"><Package className="w-3.5 h-3.5" /> {t("editUnits")}</button>
          {canManage && <>
            <button onClick={() => { setTplName(job.name); setTplOpen(true); }} aria-label={t("saveAsTemplate")} title={t("saveAsTemplate")} className="tap-target p-1.5 rounded-lg text-fg/50 hover:text-brand hover:bg-fg/[0.06]"><LayoutTemplate className="w-4 h-4" aria-hidden="true" /></button>
            <button onClick={() => duplicateJob.mutate()} disabled={duplicateJob.isPending} aria-label={t("duplicateJob")} title={t("duplicateJob")} className="tap-target p-1.5 rounded-lg text-fg/50 hover:text-brand hover:bg-fg/[0.06] disabled:opacity-40">{duplicateJob.isPending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}</button>
            <button onClick={() => setDeleteOpen(true)} aria-label={t("deleteJob")} title={t("deleteJob")} className="tap-target p-1.5 rounded-lg text-fg/50 hover:text-red-400 hover:bg-fg/[0.06]"><Trash2 className="w-4 h-4" aria-hidden="true" /></button>
          </>}
        </div>
      </div>

      {/* Sub-tabs */}
      <ScrollTabs
        tabs={tabs.map((tb) => ({ key: tb.key, label: tb.label, badge: tb.badge ? <span className="text-[10px] text-fg/40">{tb.badge}</span> : undefined }))}
        active={tab}
        onChange={(k) => setTab(k as typeof tab)}
        variant="underline"
        className="px-2 md:px-4 border-b border-fg/[0.06] flex-shrink-0"
        testIdPrefix="tab-job"
      />

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3 md:p-5">
        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <div className="space-y-4">
            {/* รายละเอียดงานแก้ไขได้ในที่ — ก่อนหน้านี้เป็นข้อความอ่านอย่างเดียว
                ทำให้แก้สถานที่/ลูกค้า/วันงานหลังสร้างงานไปแล้วไม่ได้เลย */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-fg/40 uppercase tracking-wider">รายละเอียดงาน</span>
              {canManage && (editingInfo ? (
                <div className="ml-auto flex items-center gap-1.5">
                  <button onClick={() => setEditingInfo(false)} disabled={updateInfo.isPending}
                    className="flex items-center gap-1 h-8 px-2.5 rounded-lg text-[11px] font-semibold text-fg/60 border border-fg/[0.12] hover:text-fg disabled:opacity-40">
                    <X className="w-3 h-3" aria-hidden="true" /> {tc("cancel")}
                  </button>
                  <button onClick={() => updateInfo.mutate()} disabled={updateInfo.isPending}
                    className="flex items-center gap-1 h-8 px-2.5 rounded-lg text-[11px] font-bold text-black hover:opacity-90 disabled:opacity-40"
                    style={{ backgroundColor: "var(--brand)" }}>
                    {updateInfo.isPending ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> : <Check className="w-3 h-3" aria-hidden="true" />} {tc("save")}
                  </button>
                </div>
              ) : (
                <button onClick={startEditInfo}
                  className="ml-auto flex items-center gap-1 h-8 px-2.5 rounded-lg text-[11px] font-semibold text-fg/60 border border-fg/[0.12] hover:text-fg hover:border-fg/25">
                  <Pencil className="w-3 h-3" aria-hidden="true" /> {tc("edit")}
                </button>
              ))}
            </div>
            {infoError && <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{infoError}</p>}

            {editingInfo ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 md:gap-3">
                {([
                  { key: "name", label: "ชื่องาน", type: "text", full: true },
                  { key: "client", label: "ลูกค้า", type: "text" },
                  { key: "location", label: "สถานที่", type: "text" },
                  { key: "startDate", label: "วันเริ่ม", type: "date" },
                  { key: "endDate", label: "วันจบ", type: "date" },
                  { key: "rehearsalDate", label: "วันซ้อม", type: "date" },
                ] as const).map((f) => (
                  <div key={f.key} className={`rounded-xl border border-fg/[0.06] bg-fg/[0.02] px-3 py-2.5 ${"full" in f && f.full ? "sm:col-span-2" : ""}`}>
                    <label htmlFor={`job-${f.key}`} className="text-[10px] text-fg/40 uppercase tracking-wider">{f.label}</label>
                    <input
                      id={`job-${f.key}`}
                      type={f.type}
                      value={infoForm[f.key]}
                      onChange={(e) => setInfoForm((p) => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full mt-1 h-10 md:h-8 px-2 rounded-lg bg-fg/[0.04] border border-fg/[0.1] text-sm text-fg/90 focus:outline-none focus:border-brand/50"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 md:gap-3">
                {[
                  { label: "ลูกค้า", value: job.client },
                  { label: "วันงาน", value: `${start} → ${end}` },
                  { label: "สถานที่", value: job.location || "—" },
                  { label: "วันซ้อม", value: job.rehearsalDate ? new Date(job.rehearsalDate).toLocaleDateString("th-TH") : "—" },
                ].map((f) => (
                  <div key={f.label} className="rounded-xl border border-fg/[0.06] bg-fg/[0.02] px-3 py-2.5">
                    <p className="text-[10px] text-fg/40 uppercase tracking-wider">{f.label}</p>
                    <p className="text-sm text-fg/85 truncate mt-0.5">{f.value}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {[
                { label: "อุปกรณ์", n: assignedUnits.length, icon: Package },
                { label: "แร็ค", n: jobContainers.length, icon: Layers },
                { label: "ทีม", n: jobCrew.length, icon: Users },
                { label: "รถ", n: jobVehicles.length, icon: Truck },
                { label: "เช่านอก", n: jobSubRentals.length, icon: ArrowRightLeft },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-fg/[0.06] bg-fg/[0.02] px-3 py-2.5 text-center">
                  <s.icon className="w-4 h-4 text-brand/50 mx-auto" />
                  <p className="text-lg font-bold text-fg mt-1 tabular-nums">{s.n}</p>
                  <p className="text-[10px] text-fg/40">{s.label}</p>
                </div>
              ))}
            </div>
            {canManage && (
              <div className="max-w-xs">
                <FileUploadField label="รูปงาน / หน้างาน" folder="jobs" companyId={companyId ?? ""}
                  value={(job as any).imageUrl ?? null} onChange={(url) => updateImage.mutate(url)} />
              </div>
            )}
          </div>
        )}

        {/* ── STOCK ── */}
        {tab === "stock" && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setRackBuildOpen(true)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-brand/80 border border-brand/25 hover:bg-brand/10"><ScanLine className="w-3.5 h-3.5" /> Build Racks</button>
            </div>
            {/* Racks */}
            <div>
              <p className="text-[10px] font-bold text-brand/60 uppercase tracking-wider flex items-center gap-2 mb-2"><Layers className="w-3.5 h-3.5" /> {t("racksLabel")}</p>
              {containersLoading ? <Loader2 className="w-4 h-4 animate-spin text-fg/40" /> : jobContainers.length === 0 ? <SectionHint>{t("noRacksAssigned")}</SectionHint> : (
                <div className="flex flex-wrap gap-2">
                  {(jobContainers as any[]).map((c) => (
                    <div key={c.id} className="flex items-center gap-2 pl-3 pr-2 py-2 rounded-lg border border-fg/[0.08] bg-fg/[0.03]">
                      <Layers className="w-4 h-4 text-brand/60" /><span className="text-sm text-fg/80">{c.name}</span><span className="text-xs text-fg/50">{t("itemsCount", { count: c.itemCount })}</span>
                      <button onClick={() => removeContainer.mutate(c.id)} disabled={removeContainer.isPending} className="p-1 rounded text-fg/50 hover:text-red-400 disabled:opacity-40"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Stock phase checklist */}
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-fg/40" /> : grouped.length === 0 ? <SectionHint>{t("noUnitsAssignedHint", { editUnits: t("editUnits") })}</SectionHint> : (
              <div>
                {(() => {
                  const all = assignedUnits as any[];
                  const c = (p: string) => all.filter((u) => (u.phase ?? "planned") === p).length;
                  const cells = [["phasePlanned", c("planned"), "bg-fg/10 text-fg/70"], ["phasePrepared", c("prepared"), "bg-amber-500/20 text-amber-400"], ["phaseDispatched", c("dispatched"), "bg-blue-500/20 text-blue-400"], ["phaseReturned", c("returned"), "bg-emerald-500/20 text-emerald-400"]] as const;
                  return (
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-fg/[0.06] flex-wrap">
                      {cells.map(([k, n, cls], i) => (<span key={k} className="flex items-center gap-2">{i > 0 && <ChevronRight className="w-3 h-3 text-fg/25" />}<span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${n > 0 ? cls : "bg-fg/5 text-fg/30"}`}>{t(k)} {n}</span></span>))}
                    </div>
                  );
                })()}
                <div className="space-y-4">
                  {grouped.map(([itemName, units]) => (
                    <div key={itemName}>
                      <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-fg/[0.06]"><p className="text-xs font-bold text-brand/60 uppercase tracking-wider flex-1 truncate">{itemName}</p><span className="text-xs text-fg/50">{units.length}</span></div>
                      {units.map((u: any) => {
                        const phase = u.phase ?? "planned";
                        const next = phase === "prepared" ? "dispatched" : null;
                        return (
                          <div key={u.id} className="flex items-center gap-3 py-1.5 border-b border-fg/[0.03] last:border-0">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${phase === "returned" ? "bg-emerald-400" : phase === "dispatched" ? "bg-blue-400" : phase === "prepared" ? "bg-amber-400" : "bg-fg/20"}`} />
                            <div className="flex-1 min-w-0"><p className="text-sm text-fg/80 truncate">{u.name}</p>{u.serialNumber && <p className="text-[11px] text-fg/45 font-mono truncate">{t("snLabel", { serial: u.serialNumber })}</p>}</div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${phase === "returned" ? "bg-emerald-500/15 text-emerald-400" : phase === "dispatched" ? "bg-blue-500/15 text-blue-400" : phase === "prepared" ? "bg-amber-500/15 text-amber-400" : "bg-fg/5 text-fg/40"}`}>{t(`phase_${phase}`)}</span>
                            {next && canManage && <button onClick={() => updatePhase.mutate({ unitIds: [u.id], phase: next as any })} disabled={updatePhase.isPending} className="p-1 rounded text-fg/25 hover:text-amber-400 disabled:opacity-30"><ChevronRight className="w-3.5 h-3.5" /></button>}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Unit event history */}
            <div>
              <p className="text-[10px] font-bold text-brand/60 uppercase tracking-wider flex items-center gap-2 mb-2"><Clock className="w-3.5 h-3.5" /> {t("unitEventsLabel")}</p>
              <JobUnitEventsSection jobId={job.id} startDate={job.startDate} endDate={job.endDate} />
            </div>
          </div>
        )}

        {/* ── CREW & VEHICLES ── */}
        {tab === "crew" && (
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-brand/60 uppercase tracking-wider flex items-center gap-2"><Users className="w-3.5 h-3.5" /> {t("crewLabel")}</p>
                <button onClick={() => setAssignCrewOpen(true)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-brand/80 border border-brand/25 hover:bg-brand/10"><UserPlus className="w-3.5 h-3.5" /> {t("assignCrew")}</button>
              </div>
              {crewLoading ? <Loader2 className="w-4 h-4 animate-spin text-fg/40" /> : jobCrew.length === 0 ? <SectionHint>{t("noCrewAssigned")}</SectionHint> : (
                <div className="space-y-1">{jobCrew.map((c) => (
                  <div key={c.crewMemberId} className="group/c flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-fg/[0.03]">
                    <div className="w-7 h-7 rounded-full bg-brand/10 flex items-center justify-center text-[10px] font-bold text-brand/80 flex-shrink-0">{c.initials}</div>
                    <span className="text-sm text-fg/85 flex-1 truncate">{c.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold text-fg/60 bg-fg/[0.06]">{CREW_TYPE_LABEL[c.type]}</span>
                    {canManage && <button onClick={() => removeCrew.mutate(c.crewMemberId)} disabled={removeCrew.isPending} className="opacity-0 group-hover/c:opacity-100 p-1 text-fg/40 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>}
                  </div>
                ))}</div>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-brand/60 uppercase tracking-wider flex items-center gap-2"><Truck className="w-3.5 h-3.5" /> {t("vehiclesLabel")}</p>
                <button onClick={() => setAddVehicleOpen(true)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-brand/80 border border-brand/25 hover:bg-brand/10"><Plus className="w-3.5 h-3.5" /> {t("addVehicle")}</button>
              </div>
              {vehiclesLoading ? <Loader2 className="w-4 h-4 animate-spin text-fg/40" /> : jobVehicles.length === 0 ? <SectionHint>{t("noVehiclesAssigned")}</SectionHint> : (
                <div className="space-y-1">{jobVehicles.map((v) => (
                  <div key={v.id} className="group/v flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-fg/[0.03]">
                    <Truck className="w-4 h-4 text-brand/50 flex-shrink-0" />
                    <span className="text-sm text-fg/85 flex-1 truncate">{v.vehicleType}{v.plate && <span className="text-fg/40"> · {v.plate}</span>}</span>
                    {v.driverName && <span className="text-xs text-fg/50 truncate max-w-[120px]">🧑‍✈️ {v.driverName}</span>}
                    {canManage && <button onClick={() => removeVehicle.mutate(v.id)} disabled={removeVehicle.isPending} className="opacity-0 group-hover/v:opacity-100 p-1 text-fg/40 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>}
                  </div>
                ))}</div>
              )}
              <p className="text-[11px] text-fg/30 mt-2">จัดทีม/รถแบบละเอียด (ตำแหน่ง/คนขับ/เหมา) ได้ที่เมนู "ทีมงาน"</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-brand/60 uppercase tracking-wider flex items-center gap-2 mb-2"><Calendar className="w-3.5 h-3.5" /> {t("dailyScheduleLabel")}</p>
              <JobDailyScheduleSection jobId={job.id} startDate={job.startDate} endDate={job.endDate} jobCrew={jobCrew} canManage={canManage} />
            </div>
          </div>
        )}

        {/* ── PULL SHEETS ── */}
        {tab === "pullsheets" && (
          <div className="space-y-3">
            {/* ใบเบิกเป็น PDF ไฟล์เดียวเสมอ — รวมอุปกรณ์ทั้งงาน แบ่งตามโซน ขึ้นหน้าใหม่เมื่อล้น
                หัวเอกสาร/ชื่อไฟล์ตั้งเองได้จากช่องด้านล่าง (ไม่ได้เก็บลง DB) */}
            <div className="rounded-xl border border-fg/[0.06] bg-fg/[0.02] p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand/60 flex-shrink-0" aria-hidden="true" />
                <span className="text-xs font-bold text-fg/70">ใบเบิกอุปกรณ์ (PDF)</span>
                <span className="ml-auto text-[11px] text-fg/40">{assignedUnits.length} รายการ</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={sheetTitle}
                  onChange={(e) => setSheetTitle(e.target.value)}
                  placeholder="ชื่อเอกสาร (เว้นว่าง = PULL SHEET)"
                  maxLength={80}
                  aria-label="ชื่อเอกสารใบเบิก"
                  className="flex-1 min-w-0 h-11 md:h-9 px-3 rounded-xl md:rounded-lg bg-fg/[0.04] border border-fg/[0.08] text-sm text-fg/85 placeholder:text-fg/35 focus:outline-none focus:border-brand/40"
                />
                <button
                  onClick={handleDownloadSheet}
                  disabled={downloadingSheet}
                  className="flex items-center justify-center gap-2 h-11 md:h-9 px-4 rounded-xl md:rounded-lg text-sm font-bold text-black hover:opacity-90 disabled:opacity-40 flex-shrink-0"
                  style={{ backgroundColor: "var(--brand)" }}
                >
                  {downloadingSheet ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Download className="w-4 h-4" aria-hidden="true" />}
                  ดาวน์โหลด PDF
                </button>
              </div>
              {sheetError && <p className="text-xs text-red-400">{sheetError}</p>}
            </div>

            <button onClick={() => setPullSheetOpen(true)} className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold text-brand/80 border border-brand/25 hover:bg-brand/10"><Plus className="w-3.5 h-3.5" aria-hidden="true" /> {t("createPullSheet")}</button>
            {pullSheets.length === 0 ? <SectionHint>{t("noPullSheetsYet")}</SectionHint> : (
              <div className="space-y-1.5">{pullSheets.map((ps: any) => {
                const label = ps.name?.trim() || `v${ps.version}`;
                const isEditing = renamingId === ps.id;
                return (
                <div key={ps.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-lg border border-fg/[0.06] bg-fg/[0.02]">
                  <FileText className="w-4 h-4 text-brand/50 flex-shrink-0" aria-hidden="true" />
                  {isEditing ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") renameSheet.mutate({ id: ps.id, name: renameValue });
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      onBlur={() => renameSheet.mutate({ id: ps.id, name: renameValue })}
                      placeholder={`v${ps.version}`}
                      maxLength={80}
                      className="flex-1 min-w-[120px] h-8 px-2 rounded-lg bg-fg/[0.06] border border-brand/40 text-sm text-fg focus:outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => { setRenamingId(ps.id); setRenameValue(ps.name ?? ""); }}
                      title="แก้ชื่อเวอร์ชัน"
                      className="flex items-center gap-1.5 text-sm font-semibold text-fg/85 hover:text-brand transition-colors min-w-0"
                    >
                      <span className="truncate">{label}</span>
                      <Pencil className="w-3 h-3 opacity-40 flex-shrink-0" aria-hidden="true" />
                    </button>
                  )}
                  <span className="text-xs text-fg/50 flex-shrink-0">{ps.items} รายการ</span>
                  <span className="text-[10px] text-fg/35 flex-shrink-0">
                    {new Date(ps.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                  </span>
                  {!ps.hasSnapshot && (
                    <span title="ใบนี้สร้างก่อนมีระบบเก็บเวอร์ชัน — PDF จะใช้อุปกรณ์ปัจจุบันของงาน"
                      className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/15 text-amber-400 flex-shrink-0">
                      ไม่มีสแนปช็อต
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${statusStyles[ps.status] ?? "bg-fg/5 text-fg/60"}`}>{tc(`statusEnum.${ps.status}`, { defaultValue: ps.status })}</span>
                  <button
                    onClick={() => handleDownloadVersion(ps.id, `${job.name} - ${label}`)}
                    disabled={downloadingId === ps.id}
                    className="ml-auto flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-bold text-black hover:opacity-90 disabled:opacity-40 flex-shrink-0"
                    style={{ backgroundColor: "var(--brand)" }}
                  >
                    {downloadingId === ps.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Download className="w-3.5 h-3.5" aria-hidden="true" />}
                    PDF
                  </button>
                </div>
                );
              })}</div>
            )}
          </div>
        )}

        {/* ── INCIDENTS ── */}
        {tab === "incidents" && (
          <div className="space-y-3">
            <button onClick={() => setIncidentOpen(true)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-brand/80 border border-brand/25 hover:bg-brand/10"><Camera className="w-3.5 h-3.5" /> {t("reportIncident")}</button>
            {incidents.length === 0 ? <SectionHint>{t("noIncidentsYet", { defaultValue: "ยังไม่มีเหตุการณ์สำหรับงานนี้" })}</SectionHint> : (
              <div className="space-y-1.5">{incidents.map((inc: any) => (
                <div key={inc.id} className="px-3 py-2 rounded-lg border border-fg/[0.06] bg-fg/[0.02]">
                  <div className="flex items-center gap-2"><span className="text-sm text-fg/85 flex-1 truncate">{inc.description || inc.title || "—"}</span><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${inc.status === "resolved" ? "bg-emerald-950/60 text-emerald-400" : "bg-red-950/60 text-red-400"}`}>{tc(`statusEnum.${inc.status}`, { defaultValue: inc.status })}</span></div>
                </div>
              ))}</div>
            )}
          </div>
        )}

        {/* ── FINANCE ── */}
        {tab === "finance" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setExpensesOpen(true)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-brand/80 border border-brand/25 hover:bg-brand/10"><Wallet className="w-3.5 h-3.5" /> {t("outsourceExpenses")}</button>
              <button onClick={() => setSubRentalsOpen(true)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-brand/80 border border-brand/25 hover:bg-brand/10"><ArrowRightLeft className="w-3.5 h-3.5" /> {t("manageSubRentals")}</button>
            </div>
            <div className="rounded-xl border border-fg/[0.06] bg-fg/[0.02] px-3 py-2.5 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-brand/50" />
              <span className="text-sm text-fg/70 flex-1">{t("subRentalsLabel")}</span>
              <span className="text-sm text-fg/50">{jobSubRentals.length === 0 ? t("noSubRentalsAssigned") : t("subRentalsCount", { count: jobSubRentals.length })}</span>
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
      {pullSheetOpen && <CreatePullSheetModal onClose={() => setPullSheetOpen(false)} onSubmit={(_jobId, data) => createPullSheet.mutate(data)} fixedJobId={job.id} fixedJobName={job.name} />}
      {incidentOpen && <AddIncidentModal onClose={() => setIncidentOpen(false)} onSubmit={(data) => createIncident.mutate(data)} jobName={job.name} />}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("confirmDeleteJobTitle")}</AlertDialogTitle><AlertDialogDescription>{t("confirmDeleteJobDesc")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteJob.isPending}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteJob.mutate()} disabled={deleteJob.isPending} className="bg-red-600 hover:bg-red-700 text-fg">{deleteJob.isPending ? tc("deleting") : tc("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={tplOpen} onOpenChange={setTplOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("saveAsTemplate")}</AlertDialogTitle><AlertDialogDescription>{t("saveTemplateDesc", { defaultValue: "บันทึกรายการอุปกรณ์ของงานนี้เป็นเทมเพลตเพื่อใช้ซ้ำในงานถัดไป" })}</AlertDialogDescription></AlertDialogHeader>
          <input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder={t("templateNamePlaceholder")}
            className="w-full h-9 px-3 rounded-lg bg-fg/[0.04] border border-fg/10 text-sm text-fg focus:outline-none focus:border-brand/50" />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saveTemplate.isPending}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => tplName.trim() && saveTemplate.mutate(tplName.trim())} disabled={saveTemplate.isPending || !tplName.trim()} className="bg-brand text-black hover:opacity-80">{saveTemplate.isPending ? tc("saving") : tc("save")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
