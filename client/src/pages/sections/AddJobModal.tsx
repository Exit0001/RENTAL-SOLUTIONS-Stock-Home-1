import React, { useState } from "react";
import { X, Briefcase, Loader2, Plus, LayoutTemplate, Boxes } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { jobsApi, jobTemplatesApi, equipmentSetsApi } from "@/api";
import { useAppStore } from "@/store/appStore";
import type { InsertJob } from "@shared/schema";

interface Props {
  onClose:   () => void;
  onCreated: () => void;
}

const InputField = ({
  label, required, ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; required?: boolean }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[10px] text-white/60 uppercase tracking-wider font-medium">
      {label}{required && <span className="text-[#FFFF00]/60 ml-0.5">*</span>}
    </label>
    <input
      {...props}
      className="h-9 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white
        placeholder-white/20 focus:outline-none focus:border-[#FFFF00]/40 focus:bg-white/[0.06] transition-all"
    />
  </div>
);

export const AddJobModal = ({ onClose, onCreated }: Props): JSX.Element => {
  const { t } = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const [name,          setName]          = useState("");
  const [client,        setClient]        = useState("");
  const [location,      setLocation]      = useState("");
  const [rehearsalDate, setRehearsalDate] = useState("");
  const [startDate,     setStartDate]     = useState("");
  const [endDate,       setEndDate]       = useState("");
  const [status,        setStatus]        = useState<"draft" | "scheduled">("draft");

  const [savedHint, setSavedHint] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [setId, setSetId] = useState("");
  const [shortfallWarn, setShortfallWarn] = useState<number | null>(null);

  const { token } = useAppStore();
  const { data: templates = [] } = useQuery({
    queryKey: ["job-templates"],
    queryFn:  jobTemplatesApi.getAll,
    enabled:  !!token,
  });
  const { data: sets = [] } = useQuery({
    queryKey: ["equipment-sets"],
    queryFn:  equipmentSetsApi.getAll,
    enabled:  !!token,
  });

  const valid = name.trim() && client.trim() && startDate && endDate;

  const handleCreate = async (keepOpen = false) => {
    if (!valid) return;
    setError(null);
    setSavedHint(false);
    setShortfallWarn(null);
    setSaving(true);
    try {
      const data: Omit<InsertJob, "companyId"> = {
        name:          name.trim(),
        client:        client.trim(),
        location:      location.trim() || undefined,
        rehearsalDate: rehearsalDate ? new Date(rehearsalDate) : null,
        startDate:     new Date(startDate),
        endDate:       new Date(endDate),
        status,
      };
      let shortfallCount = 0;
      let createdJobId: string;
      if (templateId) {
        const res = await jobTemplatesApi.createJob(templateId, data);
        createdJobId = res.id;
        shortfallCount += res.shortfall?.length ?? 0;
      } else {
        const job = await jobsApi.create(data);
        createdJobId = job.id;
      }
      // เพิ่มชุดอุปกรณ์เข้างานที่เพิ่งสร้าง (ถ้าเลือกไว้)
      if (setId) {
        const res = await jobsApi.applySet(createdJobId, setId);
        shortfallCount += res.shortfall?.length ?? 0;
      }
      if (shortfallCount > 0) setShortfallWarn(shortfallCount);
      onCreated();
      if (keepOpen) {
        // เก็บ ลูกค้า/สถานที่/วันที่/สถานะ ไว้ — ล้างแค่ชื่องาน แล้ว focus ช่องชื่อ
        setName("");
        setSavedHint(true);
        setTimeout(() => document.getElementById("add-job-name-input")?.focus(), 30);
      } else {
        onClose();
      }
    } catch (err: any) {
      setError(err.message ?? t("addJob.errorCreateFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-[#0f0f0f] border border-white/[0.08] rounded-2xl shadow-2xl animate-modal-up flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FFFF00]/10 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-[#FFFF00]" />
            </div>
            <div>
              <h2 className="font-bold text-white text-sm">{t("addJob.title")}</h2>
              <p className="text-[10px] text-white/60">{t("addJob.subtitle")}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {templates.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-white/60 uppercase tracking-wider font-medium flex items-center gap-1.5">
                <LayoutTemplate className="w-3 h-3 text-[#FFFF00]/60" /> {t("addJob.fromTemplate")}
              </label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="h-9 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white
                  focus:outline-none focus:border-[#FFFF00]/40 focus:bg-white/[0.06] transition-all"
              >
                <option value="">{t("addJob.noTemplate")}</option>
                {templates.map((tp) => (
                  <option key={tp.id} value={tp.id}>{tp.name} ({tp.totalQty})</option>
                ))}
              </select>
              {templateId && (
                <p className="text-[10px] text-[#FFFF00]/70">
                  {t("addJob.templateWillAdd", { count: templates.find((tp) => tp.id === templateId)?.totalQty ?? 0 })}
                </p>
              )}
            </div>
          )}
          {sets.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-white/60 uppercase tracking-wider font-medium flex items-center gap-1.5">
                <Boxes className="w-3 h-3 text-[#FFFF00]/60" /> จากชุดอุปกรณ์
              </label>
              <select
                value={setId}
                onChange={(e) => setSetId(e.target.value)}
                className="h-9 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white
                  focus:outline-none focus:border-[#FFFF00]/40 focus:bg-white/[0.06] transition-all"
              >
                <option value="">ไม่ใช้ชุด</option>
                {sets.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.totalQty})</option>
                ))}
              </select>
              {setId && (
                <p className="text-[10px] text-[#FFFF00]/70">
                  จะเพิ่มของ {sets.find((s) => s.id === setId)?.totalQty ?? 0} ชิ้นเข้างานอัตโนมัติ
                </p>
              )}
            </div>
          )}
          <InputField id="add-job-name-input" label={t("addJob.jobName")} required placeholder={t("addJob.jobNamePlaceholder")}
            value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && valid && !saving) handleCreate(true); }} />
          <InputField label={t("addJob.clientLabel")} required placeholder={t("addJob.clientPlaceholder")}
            value={client} onChange={(e) => setClient(e.target.value)} />
          <InputField label={tc("location")} placeholder={t("addJob.locationPlaceholder")}
            value={location} onChange={(e) => setLocation(e.target.value)} />
          <InputField label={t("addJob.rehearsalDate")} type="date"
            value={rehearsalDate} onChange={(e) => setRehearsalDate(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <InputField label={t("addJob.startDate")} required type="date"
              value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <InputField label={t("addJob.endDate")} required type="date"
              value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-white/60 uppercase tracking-wider font-medium">{tc("status")}</label>
            <div className="flex gap-2">
              {(["draft", "scheduled"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`flex-1 h-9 rounded-lg text-xs font-semibold border transition-all capitalize ${
                    status === s
                      ? "border-[#FFFF00]/40 bg-[#FFFF00]/10 text-[#FFFF00]"
                      : "border-white/[0.08] text-white/60 hover:text-white"
                  }`}
                >
                  {tc(`statusEnum.${s}`, { defaultValue: s })}
                </button>
              ))}
            </div>
          </div>

          {savedHint && !error && (
            <p className="text-xs text-emerald-400 bg-emerald-400/10 rounded-lg px-3 py-2">{t("addJob.savedAddNext")}</p>
          )}
          {shortfallWarn !== null && shortfallWarn > 0 && !error && (
            <p className="text-xs text-amber-400 bg-amber-400/10 rounded-lg px-3 py-2">{t("addJob.shortfallWarn", { count: shortfallWarn })}</p>
          )}
          {error && <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06] gap-2">
          <button onClick={onClose}
            className="h-9 px-4 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors flex-shrink-0">
            {tc("cancel")}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCreate(true)}
              disabled={!valid || saving}
              className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold text-[#FFFF00] border border-[#FFFF00]/30 hover:bg-[#FFFF00]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {t("addJob.saveAndAdd")}
            </button>
            <button
              onClick={() => handleCreate(false)}
              disabled={!valid || saving}
              className="flex items-center gap-2 h-9 px-6 rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#FFFF00" }}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Briefcase className="w-3.5 h-3.5" />}
              {saving ? tc("creating") : t("addJob.createJob")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
