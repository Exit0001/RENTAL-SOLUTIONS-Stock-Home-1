import { useEffect, useState } from "react";
import { X, FileText, Calculator } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { jobsApi } from "@/api";
import type { InsertQuote } from "@shared/schema";

const STATUSES = ["draft", "sent", "accepted", "declined"];

const InputField = ({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[10px] text-fg/60 uppercase tracking-wider font-medium">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-9 bg-black/40 border border-fg/10 rounded-lg text-sm text-fg px-3 placeholder:text-fg/60 focus:outline-none focus:border-brand/40 transition-colors"
    />
  </div>
);

const SelectField = ({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) => {
  const { t: tc } = useTranslation("common");
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] text-fg/60 uppercase tracking-wider font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 bg-black/40 border border-fg/10 rounded-lg text-sm text-fg px-3 focus:outline-none focus:border-brand/40 transition-colors appearance-none cursor-pointer"
      >
        <option value="" className="bg-surface-1">{tc("selectPlaceholder")}</option>
        {options.map((o) => <option key={o.value} value={o.value} className="bg-surface-1">{o.label}</option>)}
      </select>
    </div>
  );
};

interface AddQuoteModalProps {
  suggestedNumber: string;
  onClose: () => void;
  onSubmit: (data: Omit<InsertQuote, "companyId">) => void;
}

export const AddQuoteModal = ({ suggestedNumber, onClose, onSubmit }: AddQuoteModalProps): JSX.Element => {
  const { t } = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const { token } = useAppStore();

  const [quoteNumber, setQuoteNumber] = useState(suggestedNumber);
  const [client, setClient] = useState("");
  const [jobId, setJobId] = useState("");
  const [totalValue, setTotalValue] = useState("");
  const [status, setStatus] = useState("draft");

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs"],
    queryFn: jobsApi.getAll,
    enabled: !!token,
  });

  const { data: estimate } = useQuery({
    queryKey: ["job-estimate", jobId],
    queryFn: () => jobsApi.getEstimate(jobId),
    enabled: !!token && !!jobId,
  });

  // เติมมูลค่าอัตโนมัติจากอุปกรณ์ในงาน (เฉพาะตอนช่องยังว่าง — ไม่ทับค่าที่ผู้ใช้กรอกเอง)
  useEffect(() => {
    if (estimate && estimate.total > 0 && !totalValue) {
      setTotalValue(estimate.total.toFixed(2));
    }
  }, [estimate]);

  const handleSave = () => {
    if (!quoteNumber.trim() || !client.trim() || !totalValue) return;
    onSubmit({
      quoteNumber: quoteNumber.trim(),
      client: client.trim(),
      jobId: jobId || null,
      totalValue,
      status: status as InsertQuote["status"],
    } as Omit<InsertQuote, "companyId">);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-surface-1 border border-fg/[0.08] rounded-2xl shadow-2xl animate-modal-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-fg/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--brand)" }}>
              <FileText className="w-3.5 h-3.5 text-black" />
            </div>
            <h2 className="text-sm font-bold text-fg">{t("addQuote.title")}</h2>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-fg/60 hover:text-fg hover:bg-fg/[0.06] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <InputField label={t("addQuote.quoteNumberLabel")} value={quoteNumber} onChange={setQuoteNumber} />
            <InputField label={t("addQuote.clientLabel")} value={client} onChange={setClient} placeholder={t("addQuote.clientPlaceholder")} />
          </div>

          <SelectField label={t("addQuote.linkedJobOptional")} value={jobId} onChange={setJobId}
            options={jobs.map((j: any) => ({ value: j.id, label: j.name ?? j.id }))} />

          <div className="grid grid-cols-2 gap-3">
            <InputField label={t("addQuote.totalValueLabel")} type="number" value={totalValue} onChange={setTotalValue} placeholder={t("addQuote.totalValuePlaceholder")} />
            <SelectField label={tc("status")} value={status} onChange={setStatus}
              options={STATUSES.map((s) => ({ value: s, label: tc(`statusEnum.${s}`, { defaultValue: s }) }))} />
          </div>

          {jobId && (
            <div className="flex items-center gap-2 -mt-1 text-[11px] text-fg/50">
              <Calculator className="w-3 h-3 text-brand/60 flex-shrink-0" />
              {estimate && estimate.ratedItemCount > 0 ? (
                <>
                  <span>{t("addQuote.estimateHint", { days: estimate.days, total: estimate.total.toLocaleString() })}</span>
                  <button type="button" onClick={() => setTotalValue(estimate.total.toFixed(2))}
                    className="text-brand/80 hover:text-brand underline underline-offset-2">
                    {t("addQuote.useEstimate")}
                  </button>
                </>
              ) : (
                <span>{t("addQuote.estimateNoRates")}</span>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 h-9 rounded-lg border border-fg/10 text-sm text-fg/60 hover:text-fg hover:border-fg/20 transition-colors">
            {tc("cancel")}
          </button>
          <button onClick={handleSave} disabled={!quoteNumber.trim() || !client.trim() || !totalValue}
            className="flex-1 h-9 rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: "var(--brand)" }}>
            {t("addQuote.saveQuote")}
          </button>
        </div>
      </div>
    </div>
  );
};
