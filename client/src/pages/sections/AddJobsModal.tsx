import { useMemo, useState } from "react";
import { Briefcase, Plus, Trash2, LayoutTemplate, ChevronDown, ChevronUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { jobsApi, jobTemplatesApi, crewApi, vehiclesApi, jobVehiclesApi } from "@/api";
import type { CrewMemberRow, VehicleRow } from "@/api";
import { useAppStore } from "@/store/appStore";
import { WorkspaceShell, WSButton } from "@/components/WorkspaceShell";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { JobDailyScheduleDraftEditor, type DraftDaySchedule, type DraftDayCrewEntry } from "./JobDailyScheduleDraftEditor";
import type { InsertJob } from "@shared/schema";

// เพิ่มงานหลายงานในหน้าเดียว (เหมือนหน้า "เพิ่มสินค้า")
// ค่าร่วม (ลูกค้า/สถานที่/สถานะ/เทมเพลต) อยู่แถบซ้าย, แต่ละงานกรอกชื่อ+วันที่ทางขวา
// เลือกชุดอุปกรณ์เข้างานทำทีหลังผ่านหน้า "แก้ไขอุปกรณ์" (ManageJobStockModal) แทน — ไม่ต้องเลือกตอนสร้างงาน
// ทีมงาน/รถ/ตารางรายวัน ตั้งได้ตอนสร้างเลย (ไม่บังคับ) — เก็บเป็น draft ต่อแถว แล้วยิง API ตามหลังการสร้างงานจริง

type JobRow = {
  id: number; name: string; client: string; startDate: string; endDate: string; rehearsalDate: string;
  crewMemberIds: string[];
  vehicleIds: string[];
  daySchedules: Record<string, DraftDaySchedule>;
  dayCrew: Record<string, DraftDayCrewEntry[]>;
  detailsOpen: boolean;
};

const inputCls =
  "w-full h-11 md:h-9 px-3 rounded-lg bg-black/40 border border-fg/10 text-sm text-fg placeholder:text-fg/30 focus:outline-none focus:border-brand/40 transition-colors";
const dateCls = `${inputCls} [color-scheme:dark]`;
const labelCls = "text-[10px] text-fg/50 uppercase tracking-wider font-medium";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export const AddJobsModal = ({ onClose, onCreated }: Props): JSX.Element => {
  const { token } = useAppStore();
  const { isMobile } = useBreakpoint();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shortfallWarn, setShortfallWarn] = useState<number | null>(null);

  // ── ค่าร่วม (ใช้กับทุกงาน) ──────────────────────────────
  const [defClient, setDefClient] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<"draft" | "scheduled">("draft");
  const [templateId, setTemplateId] = useState("");

  const { data: templates = [] } = useQuery({ queryKey: ["job-templates"], queryFn: jobTemplatesApi.getAll, enabled: !!token });
  const { data: crewRoster = [] } = useQuery<CrewMemberRow[]>({ queryKey: ["crew-members"], queryFn: () => crewApi.getRoster(), enabled: !!token });
  const { data: vehicleRoster = [] } = useQuery<VehicleRow[]>({ queryKey: ["vehicles"], queryFn: vehiclesApi.getRoster, enabled: !!token });
  const namedCrew = useMemo(() => crewRoster.filter((c) => c.active && (c.type === "own_crew" || c.type === "freelancer")), [crewRoster]);
  const activeVehicles = useMemo(() => vehicleRoster.filter((v) => v.active), [vehicleRoster]);

  const mkRow = (id: number): JobRow => ({
    id, name: "", client: "", startDate: "", endDate: "", rehearsalDate: "",
    crewMemberIds: [], vehicleIds: [], daySchedules: {}, dayCrew: {}, detailsOpen: false,
  });
  const [rows, setRows] = useState<JobRow[]>([mkRow(1)]);

  const addRow = () => setRows((r) => [...r, mkRow(Date.now())]);
  const rmRow = (id: number) => setRows((r) => (r.length > 1 ? r.filter((x) => x.id !== id) : r));
  const setRow = (id: number, patch: Partial<JobRow>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const toggleRowCrew = (rowId: number, crewMemberId: string) => setRows((rs) => rs.map((r) => r.id !== rowId ? r : {
    ...r,
    crewMemberIds: r.crewMemberIds.includes(crewMemberId) ? r.crewMemberIds.filter((x) => x !== crewMemberId) : [...r.crewMemberIds, crewMemberId],
  }));
  const toggleRowVehicle = (rowId: number, vehicleId: string) => setRows((rs) => rs.map((r) => r.id !== rowId ? r : {
    ...r,
    vehicleIds: r.vehicleIds.includes(vehicleId) ? r.vehicleIds.filter((x) => x !== vehicleId) : [...r.vehicleIds, vehicleId],
  }));
  const emptyDaySchedule: DraftDaySchedule = { departureTime: null, arrivalTime: null, endTime: null, note: null };
  const setRowSchedule = (rowId: number, date: string, patch: Partial<DraftDaySchedule>) => setRows((rs) => rs.map((r) => r.id !== rowId ? r : {
    ...r,
    daySchedules: { ...r.daySchedules, [date]: { ...(r.daySchedules[date] ?? emptyDaySchedule), ...patch } },
  }));
  const setRowDayCrew = (rowId: number, date: string, entries: DraftDayCrewEntry[]) => setRows((rs) => rs.map((r) => r.id !== rowId ? r : {
    ...r,
    dayCrew: { ...r.dayCrew, [date]: entries },
  }));

  // งานถูกต้อง = มีชื่อ + ลูกค้า (ของแถวหรือค่าร่วม) + วันที่เริ่ม + วันที่สิ้นสุด
  const clientOf = (r: JobRow) => (r.client.trim() || defClient.trim());
  const validRows = rows.filter((r) => r.name.trim() && clientOf(r) && r.startDate && r.endDate);
  const canSave = validRows.length > 0 && !saving;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    setShortfallWarn(null);
    try {
      let shortfall = 0;
      let failed = 0;
      for (const r of validRows) {
        const data: Omit<InsertJob, "companyId"> = {
          name: r.name.trim(),
          client: clientOf(r),
          location: location.trim() || undefined,
          rehearsalDate: r.rehearsalDate ? new Date(r.rehearsalDate) : null,
          startDate: new Date(r.startDate),
          endDate: new Date(r.endDate),
          status,
        };
        try {
          let createdJob: { id: string };
          if (templateId) {
            const res = await jobTemplatesApi.createJob(templateId, data);
            shortfall += res.shortfall?.length ?? 0;
            createdJob = res;
          } else {
            createdJob = await jobsApi.create(data);
          }

          const jobId = createdJob.id;
          await Promise.all(r.crewMemberIds.map((crewMemberId) => jobsApi.assignCrew(jobId, crewMemberId)));
          await Promise.all(r.vehicleIds.map((vehicleId) => jobVehiclesApi.create(jobId, { vehicleId })));
          await Promise.all(
            Object.entries(r.daySchedules)
              .filter(([, s]) => s.departureTime || s.arrivalTime || s.endTime || s.note)
              .map(([date, s]) => jobsApi.setDaySchedule(jobId, { date, ...s }))
          );
          await Promise.all(
            Object.entries(r.dayCrew)
              .filter(([, entries]) => entries.length > 0)
              .map(([date, entries]) => jobsApi.setDayCrew(jobId, date, entries.map((e) => ({ crewMemberId: e.crewMemberId, role: e.role }))))
          );
        } catch {
          failed += 1;
        }
      }
      onCreated();
      if (failed > 0) {
        setError(`สร้างงานไม่สำเร็จ ${failed} งาน — ที่เหลือสร้างแล้ว`);
        setSaving(false);
        return;
      }
      if (shortfall > 0) {
        setShortfallWarn(shortfall);
        setSaving(false);
        return;
      }
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "สร้างงานไม่สำเร็จ");
      setSaving(false);
    }
  };

  const mainContent = (
    <>
      <div className="flex items-center gap-2 px-3 md:px-6 py-2.5 border-b border-fg/[0.06] flex-shrink-0">
        <span className="text-xs font-bold text-fg/50">รายการงานที่จะสร้าง</span>
        <button
          onClick={addRow}
          className="tap-target ml-auto h-7 px-3 rounded-lg text-[11px] font-bold text-brand border border-brand/30 hover:bg-brand/10 flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-3 h-3" />เพิ่มงาน
        </button>
      </div>

      {error && <div className="mx-3 md:mx-6 mt-3 text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2 flex-shrink-0">{error}</div>}

      <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4 flex flex-col gap-3">
        {rows.map((r, i) => (
          <div key={r.id} className="rounded-xl border border-fg/[0.08] bg-fg/[0.02] p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-fg/30">#{i + 1}</span>
              <button
                onClick={() => rmRow(r.id)}
                className="tap-target ml-auto w-8 h-8 flex items-center justify-center rounded-lg text-fg/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input value={r.name} onChange={(e) => setRow(r.id, { name: e.target.value })} placeholder="ชื่องาน *" className={inputCls} />
              <input value={r.client} onChange={(e) => setRow(r.id, { client: e.target.value })} placeholder={defClient.trim() ? `ลูกค้า (${defClient.trim()})` : "ลูกค้า *"} className={inputCls} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-fg/40">วันซ้อม</span>
                <input type="date" value={r.rehearsalDate} onChange={(e) => setRow(r.id, { rehearsalDate: e.target.value })} className={dateCls} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-fg/40">วันที่เริ่ม *</span>
                <input type="date" value={r.startDate} onChange={(e) => setRow(r.id, { startDate: e.target.value })} className={dateCls} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-fg/40">วันที่สิ้นสุด *</span>
                <input type="date" value={r.endDate} onChange={(e) => setRow(r.id, { endDate: e.target.value })} className={dateCls} />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setRow(r.id, { detailsOpen: !r.detailsOpen })}
              className="tap-target flex items-center gap-1.5 text-[11px] font-semibold text-brand/70 hover:text-brand self-start mt-0.5"
            >
              {r.detailsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              ทีมงาน / รถ / ตารางรายวัน
              {!r.detailsOpen && (r.crewMemberIds.length + r.vehicleIds.length > 0) && (
                <span className="text-fg/40 font-normal">({r.crewMemberIds.length} คน · {r.vehicleIds.length} รถ)</span>
              )}
            </button>

            {r.detailsOpen && (
              <div className="mt-1 pt-2 border-t border-fg/[0.06] flex flex-col gap-3">
                <div>
                  <p className="text-[9px] text-fg/40 uppercase tracking-wider mb-1">ทีมงาน</p>
                  <div className="flex flex-wrap gap-1.5">
                    {namedCrew.length === 0 ? <span className="text-[11px] text-fg/30">ไม่มีทีมงานในคลัง</span> : namedCrew.map((c) => {
                      const on = r.crewMemberIds.includes(c.id);
                      return (
                        <button key={c.id} type="button" onClick={() => toggleRowCrew(r.id, c.id)}
                          className={`tap-target h-6 px-2 rounded-full text-[11px] font-semibold border transition-colors ${on ? "bg-brand text-black border-brand" : "text-fg/60 border-fg/10 hover:border-fg/30"}`}>
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-[9px] text-fg/40 uppercase tracking-wider mb-1">รถ</p>
                  <div className="flex flex-wrap gap-1.5">
                    {activeVehicles.length === 0 ? <span className="text-[11px] text-fg/30">ไม่มีรถในคลัง</span> : activeVehicles.map((v) => {
                      const on = r.vehicleIds.includes(v.id);
                      return (
                        <button key={v.id} type="button" onClick={() => toggleRowVehicle(r.id, v.id)}
                          className={`tap-target h-6 px-2 rounded-full text-[11px] font-semibold border transition-colors ${on ? "bg-brand text-black border-brand" : "text-fg/60 border-fg/10 hover:border-fg/30"}`}>
                          {v.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-[9px] text-fg/40 uppercase tracking-wider mb-1">ตารางรายวัน</p>
                  <JobDailyScheduleDraftEditor
                    startDate={r.startDate}
                    endDate={r.endDate}
                    crew={r.crewMemberIds.map((id) => ({ crewMemberId: id, name: namedCrew.find((c) => c.id === id)?.name ?? "?" }))}
                    schedules={r.daySchedules}
                    dayCrew={r.dayCrew}
                    onScheduleChange={(date, patch) => setRowSchedule(r.id, date, patch)}
                    onDayCrewChange={(date, entries) => setRowDayCrew(r.id, date, entries)}
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        <button
          onClick={addRow}
          className="tap-target w-full h-11 md:h-10 rounded-xl border border-dashed border-fg/15 hover:border-brand/50 text-fg/60 hover:text-brand text-sm font-medium flex items-center justify-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" />เพิ่มงาน
        </button>
      </div>
    </>
  );

  return (
    <WorkspaceShell
      icon={<Briefcase className="w-4 h-4 text-black" />}
      title="เพิ่มงาน"
      subtitle="สร้างงานหลายงานในหน้าเดียว — ใช้ค่าร่วมจากแถบซ้าย"
      onClose={onClose}
      sidebarTitle="ค่าร่วม (ใช้กับทุกงาน)"
      sidebar={
        <div className="p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>ลูกค้า (ค่าเริ่มต้น)</label>
            <input value={defClient} onChange={(e) => setDefClient(e.target.value)} placeholder="เช่น Event Co. Ltd." className={inputCls} />
            <p className="text-[9px] text-fg/30">ใส่ต่อแถวได้ถ้าลูกค้าต่างกัน</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>สถานที่</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="เช่น BITEC Bangkok" className={inputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>สถานะ</label>
            <div className="flex gap-1.5">
              {(["draft", "scheduled"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`tap-target flex-1 h-8 rounded-lg text-xs font-bold capitalize transition-colors ${status === s ? "bg-brand text-black" : "bg-fg/5 text-fg/60 hover:text-fg"}`}
                >
                  {s === "draft" ? "ฉบับร่าง" : "กำหนดการแล้ว"}
                </button>
              ))}
            </div>
          </div>
          {templates.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className={`${labelCls} flex items-center gap-1.5`}>
                <LayoutTemplate className="w-3 h-3 text-brand/60" /> จากเทมเพลต
              </label>
              <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={`${inputCls} [color-scheme:dark]`}>
                <option value="">ไม่ใช้เทมเพลต</option>
                {templates.map((tp) => (
                  <option key={tp.id} value={tp.id}>{tp.name} ({tp.totalQty})</option>
                ))}
              </select>
            </div>
          )}
          {templateId && (
            <p className="text-[10px] text-brand/70">อุปกรณ์จากเทมเพลตจะถูกเพิ่มให้ทุกงานที่สร้าง</p>
          )}
        </div>
      }
      footer={
        <>
          <div className="flex flex-col gap-1">
            <div className="text-sm text-fg/70 font-medium">รวม {validRows.length} งาน</div>
            {shortfallWarn !== null && shortfallWarn > 0 && (
              <span className="text-[11px] text-amber-400">อุปกรณ์ไม่พอ {shortfallWarn} รายการ (สร้างงานแล้ว)</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <WSButton variant="ghost" onClick={onClose}>ยกเลิก</WSButton>
            <WSButton variant="primary" onClick={submit} disabled={!canSave} pending={saving} icon={<Briefcase className="w-4 h-4" />}>
              สร้างงานทั้งหมด
            </WSButton>
          </div>
        </>
      }
      // Mobile has no way to reach `children` when only `sidebar` is set (no `tabs`) —
      // expose the job-rows list as its own mobilePane tab instead; desktop keeps
      // rendering it via `children` in the row next to the sidebar, unchanged.
      mobilePanes={[
        { key: "form", label: "รายการงาน", Icon: Briefcase, keepMounted: true, content: mainContent },
      ]}
    >
      {!isMobile && mainContent}
    </WorkspaceShell>
  );
};
