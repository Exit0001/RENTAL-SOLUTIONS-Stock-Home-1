import { useState } from "react";
import { Briefcase, Plus, Trash2, LayoutTemplate, Boxes } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { jobsApi, jobTemplatesApi, equipmentSetsApi } from "@/api";
import { useAppStore } from "@/store/appStore";
import { WorkspaceShell, WSButton } from "@/components/WorkspaceShell";
import type { InsertJob } from "@shared/schema";

// เพิ่มงานหลายงานในหน้าเดียว (เหมือนหน้า "เพิ่มสินค้า")
// ค่าร่วม (ลูกค้า/สถานที่/สถานะ/เทมเพลต/ชุดอุปกรณ์) อยู่แถบซ้าย, แต่ละงานกรอกชื่อ+วันที่ทางขวา

type JobRow = { id: number; name: string; client: string; startDate: string; endDate: string; rehearsalDate: string };

const inputCls =
  "w-full h-9 px-3 rounded-lg bg-black/40 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FFFF00]/40 transition-colors";
const dateCls = `${inputCls} [color-scheme:dark]`;
const labelCls = "text-[10px] text-white/50 uppercase tracking-wider font-medium";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export const AddJobsModal = ({ onClose, onCreated }: Props): JSX.Element => {
  const { token } = useAppStore();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shortfallWarn, setShortfallWarn] = useState<number | null>(null);

  // ── ค่าร่วม (ใช้กับทุกงาน) ──────────────────────────────
  const [defClient, setDefClient] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<"draft" | "scheduled">("draft");
  const [templateId, setTemplateId] = useState("");
  const [setId, setSetId] = useState("");

  const { data: templates = [] } = useQuery({ queryKey: ["job-templates"], queryFn: jobTemplatesApi.getAll, enabled: !!token });
  const { data: sets = [] } = useQuery({ queryKey: ["equipment-sets"], queryFn: equipmentSetsApi.getAll, enabled: !!token });

  const mkRow = (id: number): JobRow => ({ id, name: "", client: "", startDate: "", endDate: "", rehearsalDate: "" });
  const [rows, setRows] = useState<JobRow[]>([mkRow(1)]);

  const addRow = () => setRows((r) => [...r, mkRow(Date.now())]);
  const rmRow = (id: number) => setRows((r) => (r.length > 1 ? r.filter((x) => x.id !== id) : r));
  const setRow = (id: number, patch: Partial<JobRow>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

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
          let jobId: string;
          if (templateId) {
            const res = await jobTemplatesApi.createJob(templateId, data);
            jobId = res.id;
            shortfall += res.shortfall?.length ?? 0;
          } else {
            const job = await jobsApi.create(data);
            jobId = job.id;
          }
          if (setId) {
            const res = await jobsApi.applySet(jobId, setId);
            shortfall += res.shortfall?.length ?? 0;
          }
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
            <p className="text-[9px] text-white/30">ใส่ต่อแถวได้ถ้าลูกค้าต่างกัน</p>
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
                  className={`flex-1 h-8 rounded-lg text-xs font-bold capitalize transition-colors ${status === s ? "bg-[#FFFF00] text-black" : "bg-white/5 text-white/60 hover:text-white"}`}
                >
                  {s === "draft" ? "ฉบับร่าง" : "กำหนดการแล้ว"}
                </button>
              ))}
            </div>
          </div>
          {templates.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className={`${labelCls} flex items-center gap-1.5`}>
                <LayoutTemplate className="w-3 h-3 text-[#FFFF00]/60" /> จากเทมเพลต
              </label>
              <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={`${inputCls} [color-scheme:dark]`}>
                <option value="">ไม่ใช้เทมเพลต</option>
                {templates.map((tp) => (
                  <option key={tp.id} value={tp.id}>{tp.name} ({tp.totalQty})</option>
                ))}
              </select>
            </div>
          )}
          {sets.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className={`${labelCls} flex items-center gap-1.5`}>
                <Boxes className="w-3 h-3 text-[#FFFF00]/60" /> จากชุดอุปกรณ์
              </label>
              <select value={setId} onChange={(e) => setSetId(e.target.value)} className={`${inputCls} [color-scheme:dark]`}>
                <option value="">ไม่ใช้ชุด</option>
                {sets.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.totalQty})</option>
                ))}
              </select>
            </div>
          )}
          {(templateId || setId) && (
            <p className="text-[10px] text-[#FFFF00]/70">อุปกรณ์จากเทมเพลต/ชุดจะถูกเพิ่มให้ทุกงานที่สร้าง</p>
          )}
        </div>
      }
      footer={
        <>
          <div className="flex flex-col gap-1">
            <div className="text-sm text-white/70 font-medium">รวม {validRows.length} งาน</div>
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
    >
      <div className="flex items-center gap-2 px-6 py-2.5 border-b border-white/[0.06] flex-shrink-0">
        <span className="text-xs font-bold text-white/50">รายการงานที่จะสร้าง</span>
        <button
          onClick={addRow}
          className="ml-auto h-7 px-3 rounded-lg text-[11px] font-bold text-[#FFFF00] border border-[#FFFF00]/30 hover:bg-[#FFFF00]/10 flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-3 h-3" />เพิ่มงาน
        </button>
      </div>

      {error && <div className="mx-6 mt-3 text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2 flex-shrink-0">{error}</div>}

      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
        {rows.map((r, i) => (
          <div key={r.id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-white/30">#{i + 1}</span>
              <button
                onClick={() => rmRow(r.id)}
                className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={r.name} onChange={(e) => setRow(r.id, { name: e.target.value })} placeholder="ชื่องาน *" className={inputCls} />
              <input value={r.client} onChange={(e) => setRow(r.id, { client: e.target.value })} placeholder={defClient.trim() ? `ลูกค้า (${defClient.trim()})` : "ลูกค้า *"} className={inputCls} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-white/40">วันซ้อม</span>
                <input type="date" value={r.rehearsalDate} onChange={(e) => setRow(r.id, { rehearsalDate: e.target.value })} className={dateCls} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-white/40">วันที่เริ่ม *</span>
                <input type="date" value={r.startDate} onChange={(e) => setRow(r.id, { startDate: e.target.value })} className={dateCls} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-white/40">วันที่สิ้นสุด *</span>
                <input type="date" value={r.endDate} onChange={(e) => setRow(r.id, { endDate: e.target.value })} className={dateCls} />
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={addRow}
          className="w-full h-10 rounded-xl border border-dashed border-white/15 hover:border-[#FFFF00]/50 text-white/60 hover:text-[#FFFF00] text-sm font-medium flex items-center justify-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" />เพิ่มงาน
        </button>
      </div>
    </WorkspaceShell>
  );
};
