import { useState } from "react";
import { X, Truck } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { jobVehiclesApi } from "@/api";

const QUICK_TYPES = ["รถ 6 ล้อ", "รถ 10 ล้อ", "กระบะ", "รถตู้"];

interface AddVehicleModalProps {
  jobId: string;
  onClose: () => void;
}

export const AddVehicleModal = ({ jobId, onClose }: AddVehicleModalProps): JSX.Element => {
  const { t } = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const qc = useQueryClient();

  const [vehicleType, setVehicleType] = useState("");
  const [note, setNote] = useState("");

  const createVehicle = useMutation({
    mutationFn: () => jobVehiclesApi.create(jobId, { vehicleType: vehicleType.trim(), note: note.trim() || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-vehicles", jobId] });
      onClose();
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-surface-1 border border-fg/[0.08] rounded-2xl shadow-2xl animate-modal-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-fg/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--brand)" }}>
              <Truck className="w-3.5 h-3.5 text-black" />
            </div>
            <h2 className="text-sm font-bold text-fg">{t("addVehicle.title")}</h2>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-fg/60 hover:text-fg hover:bg-fg/[0.06] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-fg/60 uppercase tracking-wider font-medium">{t("addVehicle.vehicleTypeLabel")}</label>
            <input
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              placeholder={t("addVehicle.vehicleTypePlaceholder")}
              className="w-full h-9 bg-black/40 border border-fg/10 rounded-lg text-sm text-fg px-3 placeholder:text-fg/60 focus:outline-none focus:border-brand/40 transition-colors"
            />
            <div className="flex flex-wrap gap-1.5 mt-1">
              {QUICK_TYPES.map((qt) => (
                <button
                  key={qt}
                  type="button"
                  onClick={() => setVehicleType(qt)}
                  className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                    vehicleType === qt
                      ? "border-brand/50 bg-brand/10 text-brand"
                      : "border-fg/10 text-fg/60 hover:border-fg/20 hover:text-fg"
                  }`}
                >
                  {qt}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-fg/60 uppercase tracking-wider font-medium">{t("addVehicle.noteLabel")}</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("addVehicle.notePlaceholder")}
              className="w-full h-9 bg-black/40 border border-fg/10 rounded-lg text-sm text-fg px-3 placeholder:text-fg/60 focus:outline-none focus:border-brand/40 transition-colors"
            />
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 h-9 rounded-lg border border-fg/10 text-sm text-fg/60 hover:text-fg hover:border-fg/20 transition-colors">
            {tc("cancel")}
          </button>
          <button onClick={() => createVehicle.mutate()} disabled={!vehicleType.trim() || createVehicle.isPending}
            className="flex-1 h-9 rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: "var(--brand)" }}>
            {t("addVehicle.saveVehicle")}
          </button>
        </div>
      </div>
    </div>
  );
};
