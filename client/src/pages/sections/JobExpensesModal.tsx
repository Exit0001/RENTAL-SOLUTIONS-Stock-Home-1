import { useRef, useState } from "react";
import { X, Wallet, Trash2, Loader2, Users, Truck, Paperclip, ExternalLink, Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { jobExpensesApi } from "@/api";
import { uploadAttachment } from "@/components/FileUploadField";

type Category = "staff" | "transport";

interface Props {
  jobId:   string;
  jobName: string;
  onClose: () => void;
}

export const JobExpensesModal = ({ jobId, jobName, onClose }: Props): JSX.Element => {
  const { t }  = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const { companyId } = useAppStore();
  const qc = useQueryClient();

  const [category, setCategory]     = useState<Category>("staff");
  const [amount, setAmount]         = useState("");
  const [note, setNote]             = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [uploading, setUploading]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["job-expenses", jobId],
    queryFn:  () => jobExpensesApi.getForJob(jobId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["job-expenses", jobId] });
    qc.invalidateQueries({ queryKey: ["finance-costing"] });
  };

  const createExpense = useMutation({
    mutationFn: () => jobExpensesApi.create(jobId, { category, amount, note: note.trim() || null, receiptUrl }),
    onSuccess: () => { setAmount(""); setNote(""); setReceiptUrl(null); invalidate(); },
  });

  const deleteExpense = useMutation({
    mutationFn: (id: string) => jobExpensesApi.delete(id),
    onSuccess: invalidate,
  });

  const handleFile = async (file: File | undefined) => {
    if (!file || !companyId) return;
    setUploading(true);
    try {
      const url = await uploadAttachment(file, "job-expenses", companyId);
      setReceiptUrl(url);
    } catch {}
    setUploading(false);
  };

  const staffTotal     = expenses.filter((e) => e.category === "staff").reduce((s, e) => s + Number(e.amount), 0);
  const transportTotal = expenses.filter((e) => e.category === "transport").reduce((s, e) => s + Number(e.amount), 0);
  const grandTotal     = staffTotal + transportTotal;

  const canAdd = !!amount && Number(amount) > 0 && !createExpense.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-xl bg-[#0f0f0f] border border-white/[0.08] rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: "min(85vh, 640px)" }}>

        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FFFF00" }}>
              <Wallet className="w-3.5 h-3.5 text-black" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">{t("jobExpenses.title")}</h2>
              <p className="text-[11px] text-white/40">{jobName}</p>
            </div>
          </div>
          {grandTotal > 0 && (
            <div className="flex items-center gap-3 text-[11px] mr-3">
              {staffTotal > 0 && (
                <span className="flex items-center gap-1 text-white/50">
                  <Users className="w-3 h-3" /> ฿{staffTotal.toLocaleString()}
                </span>
              )}
              {transportTotal > 0 && (
                <span className="flex items-center gap-1 text-white/50">
                  <Truck className="w-3 h-3" /> ฿{transportTotal.toLocaleString()}
                </span>
              )}
              <span className="font-bold text-[#FFFF00]/80">฿{grandTotal.toLocaleString()}</span>
            </div>
          )}
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Expense list (scrollable) ───────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
          {isLoading && (
            <div className="flex items-center gap-2 py-6 justify-center text-white/40 text-xs">
              <Loader2 className="w-4 h-4 animate-spin" /> {tc("loading")}
            </div>
          )}
          {!isLoading && expenses.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-xs text-white/30">{t("jobExpenses.noExpensesYet")}</p>
            </div>
          )}
          {!isLoading && expenses.length > 0 && (
            <div className="space-y-1.5">
              {expenses.map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] group hover:bg-white/[0.035] transition-colors">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${e.category === "staff" ? "bg-blue-500/10 text-blue-400" : "bg-amber-500/10 text-amber-400"}`}>
                    {e.category === "staff" ? <Users className="w-3.5 h-3.5" /> : <Truck className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">฿{Number(e.amount).toLocaleString()}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-white/50">
                        {e.category === "staff" ? t("jobExpenses.categoryStaff") : t("jobExpenses.categoryTransport")}
                      </span>
                    </div>
                    {e.note && <p className="text-[11px] text-white/50 truncate mt-0.5">{e.note}</p>}
                  </div>
                  {e.receiptUrl && (
                    <a href={e.receiptUrl} target="_blank" rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] text-[#FFFF00]/60 hover:text-[#FFFF00] transition-all flex-shrink-0">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <button
                    onClick={() => { if (confirm(t("jobExpenses.deleteConfirm"))) deleteExpense.mutate(e.id); }}
                    disabled={deleteExpense.isPending && deleteExpense.variables === e.id}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-white/30 hover:text-red-400 transition-all disabled:opacity-50 flex-shrink-0"
                  >
                    {deleteExpense.isPending && deleteExpense.variables === e.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Add form (fixed bottom) ─────────────────────── */}
        <div className="border-t border-white/[0.06] px-5 py-4 flex-shrink-0 space-y-3 bg-[#0c0c0c] rounded-b-2xl">
          {/* Row 1: Category + Amount */}
          <div className="flex items-center gap-2">
            {/* Category pills */}
            <div className="flex rounded-lg border border-white/10 overflow-hidden flex-shrink-0">
              <button
                onClick={() => setCategory("staff")}
                className={`flex items-center gap-1.5 px-3 h-8 text-xs font-bold transition-colors
                  ${category === "staff" ? "bg-blue-500/20 text-blue-300" : "text-white/40 hover:text-white"}`}
              >
                <Users className="w-3.5 h-3.5" /> ค่าแรง
              </button>
              <div className="w-px bg-white/10" />
              <button
                onClick={() => setCategory("transport")}
                className={`flex items-center gap-1.5 px-3 h-8 text-xs font-bold transition-colors
                  ${category === "transport" ? "bg-amber-500/20 text-amber-300" : "text-white/40 hover:text-white"}`}
              >
                <Truck className="w-3.5 h-3.5" /> ขนส่ง
              </button>
            </div>

            {/* Amount */}
            <div className="relative flex-shrink-0 w-32">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white/30 pointer-events-none">฿</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canAdd && createExpense.mutate()}
                placeholder="0"
                className="w-full h-8 bg-black/40 border border-white/10 rounded-lg text-sm text-white pl-6 pr-3 placeholder:text-white/25 focus:outline-none focus:border-[#FFFF00]/40 transition-colors"
              />
            </div>

            {/* Note */}
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canAdd && createExpense.mutate()}
              placeholder={t("jobExpenses.notePlaceholder")}
              className="flex-1 h-8 bg-black/40 border border-white/10 rounded-lg text-xs text-white px-3 placeholder:text-white/25 focus:outline-none focus:border-[#FFFF00]/40 transition-colors min-w-0"
            />

            {/* Receipt upload icon */}
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              title="แนบใบเสร็จ / ใบกำกับภาษี"
              className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 transition-colors
                ${receiptUrl ? "border-[#FFFF00]/40 bg-[#FFFF00]/10 text-[#FFFF00]" : "border-white/10 text-white/40 hover:text-white hover:border-white/30"}`}
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
            </button>

            {/* Add button */}
            <button
              onClick={() => createExpense.mutate()}
              disabled={!canAdd}
              className="flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-bold text-black flex-shrink-0 transition-opacity hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#FFFF00" }}
            >
              {createExpense.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {t("jobExpenses.addExpense")}
            </button>
          </div>

          {/* Receipt preview (when attached) */}
          {receiptUrl && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FFFF00]/5 border border-[#FFFF00]/15">
              <Paperclip className="w-3.5 h-3.5 text-[#FFFF00]/60 flex-shrink-0" />
              <a href={receiptUrl} target="_blank" rel="noopener noreferrer"
                className="text-[11px] text-[#FFFF00]/70 hover:text-[#FFFF00] underline truncate flex-1">
                ดูไฟล์ที่แนบ
              </a>
              <button onClick={() => setReceiptUrl(null)}
                className="w-4 h-4 rounded-full bg-white/10 hover:bg-red-500/20 text-white/40 hover:text-red-400 flex items-center justify-center transition-colors flex-shrink-0">
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
