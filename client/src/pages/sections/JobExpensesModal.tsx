import { useState } from "react";
import { X, Wallet, Trash2, Loader2, Users, Truck } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { jobExpensesApi } from "@/api";
import { FileUploadField } from "@/components/FileUploadField";

type Category = "staff" | "transport";

interface JobExpensesModalProps {
  jobId: string;
  jobName: string;
  onClose: () => void;
}

export const JobExpensesModal = ({ jobId, jobName, onClose }: JobExpensesModalProps): JSX.Element => {
  const { t } = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const { companyId } = useAppStore();
  const qc = useQueryClient();

  const [category, setCategory] = useState<Category>("staff");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["job-expenses", jobId],
    queryFn: () => jobExpensesApi.getForJob(jobId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["job-expenses", jobId] });
    qc.invalidateQueries({ queryKey: ["finance-costing"] });
  };

  const createExpense = useMutation({
    mutationFn: () => jobExpensesApi.create(jobId, { category, amount, note: note.trim() || null, receiptUrl }),
    onSuccess: () => {
      setAmount(""); setNote(""); setReceiptUrl(null);
      invalidate();
    },
  });

  const deleteExpense = useMutation({
    mutationFn: (id: string) => jobExpensesApi.delete(id),
    onSuccess: invalidate,
  });

  const categoryIcon = (c: Category) => c === "staff" ? <Users className="w-3.5 h-3.5" /> : <Truck className="w-3.5 h-3.5" />;
  const categoryLabel = (c: Category) => c === "staff" ? t("jobExpenses.categoryStaff") : t("jobExpenses.categoryTransport");

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
              <Wallet className="w-3.5 h-3.5 text-black" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">{t("jobExpenses.title")}</h2>
              <p className="text-[11px] text-white/50">{jobName}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* รายการที่มีอยู่ */}
          <div className="flex flex-col gap-2">
            {isLoading && <p className="text-xs text-white/60">{tc("loading")}</p>}
            {!isLoading && expenses.length === 0 && (
              <p className="text-xs text-white/40">{t("jobExpenses.noExpensesYet")}</p>
            )}
            {expenses.map((e) => (
              <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.02]">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.04] text-[#FFFF00]/70 flex-shrink-0">
                  {categoryIcon(e.category as Category)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white/80">£{Number(e.amount).toLocaleString()}</p>
                  <p className="text-[11px] text-white/50 truncate">{categoryLabel(e.category as Category)}{e.note ? ` — ${e.note}` : ""}</p>
                </div>
                {e.receiptUrl && (
                  <a href={e.receiptUrl} target="_blank" rel="noopener noreferrer"
                    className="text-[11px] text-[#FFFF00]/70 hover:text-[#FFFF00] underline flex-shrink-0">
                    {t("jobExpenses.viewSlip")}
                  </a>
                )}
                <button
                  onClick={() => { if (confirm(t("jobExpenses.deleteConfirm"))) deleteExpense.mutate(e.id); }}
                  disabled={deleteExpense.isPending && deleteExpense.variables === e.id}
                  className="p-1.5 rounded-lg text-white/60 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  {deleteExpense.isPending && deleteExpense.variables === e.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>

          {/* ฟอร์มเพิ่มรายการ */}
          <div className="pt-3 border-t border-white/[0.06] flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-white/60 uppercase tracking-wider font-medium">{t("jobExpenses.categoryLabel")}</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  className="w-full h-9 bg-black/40 border border-white/10 rounded-lg text-sm text-white px-3 focus:outline-none focus:border-[#FFFF00]/40 transition-colors appearance-none cursor-pointer"
                >
                  <option value="staff" className="bg-[#111]">{t("jobExpenses.categoryStaff")}</option>
                  <option value="transport" className="bg-[#111]">{t("jobExpenses.categoryTransport")}</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-white/60 uppercase tracking-wider font-medium">{t("jobExpenses.amountLabel")}</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={t("jobExpenses.amountPlaceholder")}
                  className="w-full h-9 bg-black/40 border border-white/10 rounded-lg text-sm text-white px-3 placeholder:text-white/60 focus:outline-none focus:border-[#FFFF00]/40 transition-colors"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-white/60 uppercase tracking-wider font-medium">{t("jobExpenses.noteLabel")}</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("jobExpenses.notePlaceholder")}
                className="w-full h-9 bg-black/40 border border-white/10 rounded-lg text-sm text-white px-3 placeholder:text-white/60 focus:outline-none focus:border-[#FFFF00]/40 transition-colors"
              />
            </div>

            {companyId && (
              <FileUploadField label={t("shared.receiptBill")} folder="job-expenses" companyId={companyId}
                value={receiptUrl} onChange={setReceiptUrl} />
            )}

            <button
              onClick={() => createExpense.mutate()}
              disabled={!amount || Number(amount) <= 0 || createExpense.isPending}
              className="flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#FFFF00" }}
            >
              {createExpense.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t("jobExpenses.addExpense")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
