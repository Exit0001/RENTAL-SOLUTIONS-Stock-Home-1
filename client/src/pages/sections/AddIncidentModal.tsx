import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { jobsApi, stockApi } from "@/api";
import { FileUploadField } from "@/components/FileUploadField";
import type { InsertIncident } from "@shared/schema";

const SEVERITIES = ["low", "medium", "high"];

const InputField = ({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[10px] text-white/60 uppercase tracking-wider font-medium">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-9 bg-black/40 border border-white/10 rounded-lg text-sm text-white px-3 placeholder:text-white/60 focus:outline-none focus:border-[#FFFF00]/40 transition-colors"
    />
  </div>
);

const SelectField = ({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) => {
  const { t: tc } = useTranslation("common");
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] text-white/60 uppercase tracking-wider font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 bg-black/40 border border-white/10 rounded-lg text-sm text-white px-3 focus:outline-none focus:border-[#FFFF00]/40 transition-colors appearance-none cursor-pointer"
      >
        <option value="" className="bg-[#111]">{tc("selectPlaceholder")}</option>
        {options.map((o) => <option key={o.value} value={o.value} className="bg-[#111]">{o.label}</option>)}
      </select>
    </div>
  );
};

interface AddIncidentModalProps {
  onClose: () => void;
  onSubmit: (jobId: string, data: Omit<InsertIncident, "companyId" | "jobId">) => void;
}

export const AddIncidentModal = ({ onClose, onSubmit }: AddIncidentModalProps): JSX.Element => {
  const { t } = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const { token, companyId, auth } = useAppStore();

  const [jobId, setJobId] = useState("");
  const [stockItemId, setStockItemId] = useState("");
  const [stockUnitId, setStockUnitId] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs"],
    queryFn: jobsApi.getAll,
    enabled: !!token,
  });

  const { data: stockItems = [] } = useQuery({
    queryKey: ["stock"],
    queryFn: stockApi.getAll,
    enabled: !!token,
  });

  const { data: itemDetail } = useQuery({
    queryKey: ["stock", stockItemId],
    queryFn: () => stockApi.getById(stockItemId),
    enabled: !!token && !!stockItemId,
  });

  const handleSave = () => {
    if (!jobId || !description.trim() || !date || !auth?.userId) return;
    onSubmit(jobId, {
      stockUnitId: stockUnitId || null,
      reporterId: auth.userId,
      description: description.trim(),
      severity: severity as InsertIncident["severity"],
      status: "open",
      hasPhoto: !!photoUrl,
      photoUrl,
      date: new Date(date),
    } as Omit<InsertIncident, "companyId" | "jobId">);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-[#0f0f0f] border border-white/[0.08] rounded-2xl shadow-2xl animate-modal-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-500/20">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            </div>
            <h2 className="text-sm font-bold text-white">{t("addIncident.title")}</h2>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <SelectField label={t("addIncident.jobLabel")} value={jobId} onChange={setJobId}
              options={jobs.map((j: any) => ({ value: j.id, label: j.name ?? j.id }))} />
            <SelectField label={t("addIncident.severityLabel")} value={severity} onChange={setSeverity}
              options={SEVERITIES.map((s) => ({ value: s, label: tc(`statusEnum.${s}`, { defaultValue: s }) }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectField label={t("addIncident.stockItemOptional")} value={stockItemId}
              onChange={(v) => { setStockItemId(v); setStockUnitId(""); }}
              options={stockItems.map((i: any) => ({ value: i.id, label: i.itemName ?? i.name ?? i.id }))} />
            <SelectField label={t("addIncident.stockUnitOptional")} value={stockUnitId} onChange={setStockUnitId}
              options={(itemDetail?.units ?? []).map((u: any) => ({ value: u.id, label: u.serialNumber ? `${u.name} (${u.serialNumber})` : u.name }))} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-white/60 uppercase tracking-wider font-medium">{t("addIncident.descriptionLabel")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={t("addIncident.describeWhatHappened")}
              className="w-full bg-black/40 border border-white/10 rounded-lg text-sm text-white px-3 py-2 placeholder:text-white/60 focus:outline-none focus:border-[#FFFF00]/40 transition-colors resize-none"
            />
          </div>

          <InputField label={tc("date")} type="date" value={date} onChange={setDate} />

          {companyId && (
            <FileUploadField label={t("addIncident.photoEvidence")} folder="incidents" companyId={companyId}
              value={photoUrl} onChange={setPhotoUrl} />
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 h-9 rounded-lg border border-white/10 text-sm text-white/60 hover:text-white hover:border-white/20 transition-colors">
            {tc("cancel")}
          </button>
          <button onClick={handleSave} disabled={!jobId || !description.trim() || !date}
            className="flex-1 h-9 rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#FFFF00" }}>
            {t("addIncident.submitReport")}
          </button>
        </div>
      </div>
    </div>
  );
};
