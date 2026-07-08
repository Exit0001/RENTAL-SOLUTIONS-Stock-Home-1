import { useRef, useState } from "react";
import { X, ArrowRightLeft, Trash2, Loader2, Paperclip, ExternalLink, Plus, Check, Clock } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { jobSubRentalsApi, maintenanceApi } from "@/api";
import { uploadAttachment } from "@/components/FileUploadField";

interface Props {
  jobId:   string;
  jobName: string;
  onClose: () => void;
}

export const JobSubRentalsModal = ({ jobId, jobName, onClose }: Props): JSX.Element => {
  const { t }  = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const { companyId, userRole } = useAppStore();
  const qc = useQueryClient();
  const canManage = userRole === "admin" || userRole === "manager";

  const [itemName, setItemName]     = useState("");
  const [partner, setPartner]       = useState("");
  const [dueBack, setDueBack]       = useState(() => new Date().toISOString().slice(0, 10));
  const [dailyRate, setDailyRate]   = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [uploading, setUploading]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: rentals = [], isLoading } = useQuery({
    queryKey: ["job-subrentals", jobId],
    queryFn:  () => jobSubRentalsApi.getForJob(jobId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["job-subrentals", jobId] });
    qc.invalidateQueries({ queryKey: ["subrentals"] });
    qc.invalidateQueries({ queryKey: ["finance-costing"] });
  };

  const createRental = useMutation({
    mutationFn: () => jobSubRentalsApi.create(jobId, {
      itemName: itemName.trim(),
      partner:  partner.trim(),
      dueBack:  new Date(dueBack),
      dailyRate: dailyRate || null,
      status:   "active",
      receiptUrl,
    }),
    onSuccess: () => { setItemName(""); setPartner(""); setDailyRate(""); setReceiptUrl(null); invalidate(); },
  });

  const deleteRental = useMutation({
    mutationFn: (id: string) => jobSubRentalsApi.delete(id),
    onSuccess: invalidate,
  });

  const returnRental = useMutation({
    mutationFn: (id: string) => maintenanceApi.updateSubRental(id, { status: "returned" }),
    onSuccess: invalidate,
  });

  const handleFile = async (file: File | undefined) => {
    if (!file || !companyId) return;
    setUploading(true);
    try {
      const url = await uploadAttachment(file, "subrentals", companyId);
      setReceiptUrl(url);
    } catch {}
    setUploading(false);
  };

  const totalCost = rentals.reduce((s, r) => s + Number(r.dailyRate ?? 0), 0);
  const canAdd = !!itemName.trim() && !!partner.trim() && !!dueBack && !createRental.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-xl bg-[#0f0f0f] border border-white/[0.08] rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: "min(85vh, 640px)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FFFF00" }}>
              <ArrowRightLeft className="w-3.5 h-3.5 text-black" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">{t("jobSubRentals.title")}</h2>
              <p className="text-[11px] text-white/40">{jobName}</p>
            </div>
          </div>
          {totalCost > 0 && (
            <span className="font-bold text-[#FFFF00]/80 text-[11px] mr-3">฿{totalCost.toLocaleString()}/{t("jobSubRentals.perDay")}</span>
          )}
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
          {isLoading && (
            <div className="flex items-center gap-2 py-6 justify-center text-white/40 text-xs">
              <Loader2 className="w-4 h-4 animate-spin" /> {tc("loading")}
            </div>
          )}
          {!isLoading && rentals.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-xs text-white/30">{t("jobSubRentals.noRentalsYet")}</p>
            </div>
          )}
          {!isLoading && rentals.length > 0 && (
            <div className="space-y-1.5">
              {rentals.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] group hover:bg-white/[0.035] transition-colors">
                  <div className="w-1 h-8 rounded-full bg-purple-400/60 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white/85 truncate">{r.itemName}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold flex-shrink-0 ${
                        r.status === "active" ? "bg-purple-500/15 text-purple-400" :
                        r.status === "returned" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
                        {tc(`statusEnum.${r.status}`, { defaultValue: r.status })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-white/50 mt-0.5">
                      <span>{t("jobSubRentals.fromPartner", { partner: r.partner })}</span>
                      <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{t("jobSubRentals.dueLabel", { date: new Date(r.dueBack).toLocaleDateString("en-GB") })}</span>
                      {r.dailyRate && <span>฿{Number(r.dailyRate).toLocaleString()}/{t("jobSubRentals.perDay")}</span>}
                    </div>
                  </div>
                  {r.receiptUrl && (
                    <a href={r.receiptUrl} target="_blank" rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] text-[#FFFF00]/60 hover:text-[#FFFF00] transition-all flex-shrink-0">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {canManage && r.status !== "returned" && (
                    <button
                      onClick={() => returnRental.mutate(r.id)}
                      disabled={returnRental.isPending && returnRental.variables === r.id}
                      title={t("jobSubRentals.markReturned")}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-white/30 hover:text-emerald-400 transition-all disabled:opacity-50 flex-shrink-0"
                    >
                      {returnRental.isPending && returnRental.variables === r.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Check className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  {canManage && (
                    <button
                      onClick={() => { if (confirm(t("jobSubRentals.deleteConfirm"))) deleteRental.mutate(r.id); }}
                      disabled={deleteRental.isPending && deleteRental.variables === r.id}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-white/30 hover:text-red-400 transition-all disabled:opacity-50 flex-shrink-0"
                    >
                      {deleteRental.isPending && deleteRental.variables === r.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add form */}
        {canManage && (
          <div className="border-t border-white/[0.06] px-5 py-4 flex-shrink-0 space-y-2 bg-[#0c0c0c] rounded-b-2xl">
            <div className="grid grid-cols-2 gap-2">
              <input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder={t("jobSubRentals.itemNamePlaceholder")}
                className="h-8 bg-black/40 border border-white/10 rounded-lg text-xs text-white px-3 placeholder:text-white/25 focus:outline-none focus:border-[#FFFF00]/40 transition-colors"
              />
              <input
                value={partner}
                onChange={(e) => setPartner(e.target.value)}
                placeholder={t("jobSubRentals.partnerCompanyPlaceholder")}
                className="h-8 bg-black/40 border border-white/10 rounded-lg text-xs text-white px-3 placeholder:text-white/25 focus:outline-none focus:border-[#FFFF00]/40 transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dueBack}
                onChange={(e) => setDueBack(e.target.value)}
                className="h-8 bg-black/40 border border-white/10 rounded-lg text-xs text-white px-2 flex-shrink-0 focus:outline-none focus:border-[#FFFF00]/40 transition-colors"
              />
              <div className="relative w-28 flex-shrink-0">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white/30 pointer-events-none">฿</span>
                <input
                  type="number"
                  value={dailyRate}
                  onChange={(e) => setDailyRate(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && canAdd && createRental.mutate()}
                  placeholder="0/day"
                  className="w-full h-8 bg-black/40 border border-white/10 rounded-lg text-xs text-white pl-6 pr-2 placeholder:text-white/25 focus:outline-none focus:border-[#FFFF00]/40 transition-colors"
                />
              </div>

              <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                title={t("shared.receiptBill")}
                className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 transition-colors
                  ${receiptUrl ? "border-[#FFFF00]/40 bg-[#FFFF00]/10 text-[#FFFF00]" : "border-white/10 text-white/40 hover:text-white hover:border-white/30"}`}
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => createRental.mutate()}
                disabled={!canAdd}
                className="flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-bold text-black flex-shrink-0 transition-opacity hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed ml-auto"
                style={{ backgroundColor: "#FFFF00" }}
              >
                {createRental.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                {t("jobSubRentals.addRental")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
