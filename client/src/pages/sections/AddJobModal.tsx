import React, { useState } from "react";
import { X, Briefcase, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { jobsApi } from "@/api";
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

  const [name,      setName]      = useState("");
  const [client,    setClient]    = useState("");
  const [location,  setLocation]  = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate,   setEndDate]   = useState("");
  const [status,    setStatus]    = useState<"draft" | "scheduled">("draft");

  const valid = name.trim() && client.trim() && startDate && endDate;

  const handleCreate = async () => {
    if (!valid) return;
    setError(null);
    setSaving(true);
    try {
      const data: Omit<InsertJob, "companyId"> = {
        name:      name.trim(),
        client:    client.trim(),
        location:  location.trim() || undefined,
        startDate: new Date(startDate),
        endDate:   new Date(endDate),
        status,
      };
      await jobsApi.create(data);
      onCreated();
      onClose();
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
          <InputField label={t("addJob.jobName")} required placeholder={t("addJob.jobNamePlaceholder")}
            value={name} onChange={(e) => setName(e.target.value)} />
          <InputField label={t("addJob.clientLabel")} required placeholder={t("addJob.clientPlaceholder")}
            value={client} onChange={(e) => setClient(e.target.value)} />
          <InputField label={tc("location")} placeholder={t("addJob.locationPlaceholder")}
            value={location} onChange={(e) => setLocation(e.target.value)} />
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

          {error && <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06] gap-3">
          <button onClick={onClose}
            className="h-9 px-4 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors">
            {tc("cancel")}
          </button>
          <button
            onClick={handleCreate}
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
  );
};
