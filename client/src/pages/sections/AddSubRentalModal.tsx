import { useState } from "react";
import { X, ArrowRightLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { jobsApi } from "@/api";
import { FileUploadField } from "@/components/FileUploadField";
import type { InsertSubRental } from "@shared/schema";

const STATUSES = ["pending", "active", "returned"];

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

interface AddSubRentalModalProps {
  onClose: () => void;
  onSubmit: (data: Omit<InsertSubRental, "companyId">) => void;
}

export const AddSubRentalModal = ({ onClose, onSubmit }: AddSubRentalModalProps): JSX.Element => {
  const { t } = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const { token, companyId } = useAppStore();

  const [itemName, setItemName] = useState("");
  const [partner, setPartner] = useState("");
  const [dueBack, setDueBack] = useState(() => new Date().toISOString().slice(0, 10));
  const [dailyRate, setDailyRate] = useState("");
  const [status, setStatus] = useState("pending");
  const [jobId, setJobId] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs"],
    queryFn: jobsApi.getAll,
    enabled: !!token,
  });

  const handleSave = () => {
    if (!itemName.trim() || !partner.trim() || !dueBack) return;
    onSubmit({
      itemName: itemName.trim(),
      partner: partner.trim(),
      dueBack: new Date(dueBack),
      dailyRate: dailyRate ? dailyRate : null,
      status: status as InsertSubRental["status"],
      jobId: jobId || null,
      receiptUrl,
    } as Omit<InsertSubRental, "companyId">);
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
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#FFFF00" }}>
              <ArrowRightLeft className="w-3.5 h-3.5 text-black" />
            </div>
            <h2 className="text-sm font-bold text-white">{t("addSubRental.title")}</h2>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <InputField label={t("addSubRental.itemNameLabel")} value={itemName} onChange={setItemName} placeholder={t("addSubRental.itemNamePlaceholder")} />
            <InputField label={t("addSubRental.partnerCompany")} value={partner} onChange={setPartner} placeholder={t("addSubRental.partnerCompanyPlaceholder")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InputField label={t("addSubRental.dueBack")} type="date" value={dueBack} onChange={setDueBack} />
            <InputField label={t("addSubRental.dailyRateLabel")} type="number" value={dailyRate} onChange={setDailyRate} placeholder={t("addSubRental.dailyRatePlaceholder")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectField label={tc("status")} value={status} onChange={setStatus}
              options={STATUSES.map((s) => ({ value: s, label: tc(`statusEnum.${s}`, { defaultValue: s }) }))} />
            <SelectField label={t("addSubRental.linkedJobOptional")} value={jobId} onChange={setJobId}
              options={jobs.map((j: any) => ({ value: j.id, label: j.name ?? j.title ?? j.id }))} />
          </div>

          {companyId && (
            <FileUploadField label={t("shared.receiptBill")} folder="subrentals" companyId={companyId}
              value={receiptUrl} onChange={setReceiptUrl} />
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 h-9 rounded-lg border border-white/10 text-sm text-white/60 hover:text-white hover:border-white/20 transition-colors">
            {tc("cancel")}
          </button>
          <button onClick={handleSave} disabled={!itemName.trim() || !partner.trim() || !dueBack}
            className="flex-1 h-9 rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#FFFF00" }}>
            {t("addSubRental.saveSubRental")}
          </button>
        </div>
      </div>
    </div>
  );
};
