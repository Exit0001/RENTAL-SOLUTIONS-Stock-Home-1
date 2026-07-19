import { useState } from "react";
import { X, Truck, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { vehiclesApi, crewApi, jobVehiclesApi } from "@/api";
import type { VehicleRow, CrewMemberRow } from "@/api";

interface Props {
  jobId:   string;
  onClose: () => void;
}

export const AssignVehicleModal = ({ jobId, onClose }: Props): JSX.Element => {
  const { token } = useAppStore();
  const qc = useQueryClient();

  const [vehicleId, setVehicleId] = useState("");     // "" = จากคลัง (ยังไม่เลือก), "adhoc" = พิมพ์เอง
  const [adhocType, setAdhocType] = useState("");
  const [driverId, setDriverId]   = useState("");
  const [note, setNote]           = useState("");
  const [error, setError]         = useState<string | null>(null);

  const { data: vehicles = [] } = useQuery<VehicleRow[]>({ queryKey: ["vehicles"], queryFn: vehiclesApi.getRoster, enabled: !!token });
  const { data: crew = [] } = useQuery<CrewMemberRow[]>({ queryKey: ["crew-members"], queryFn: () => crewApi.getRoster(), enabled: !!token });

  const assignMutation = useMutation({
    mutationFn: () => {
      const isAdhoc = vehicleId === "adhoc";
      return jobVehiclesApi.create(jobId, {
        vehicleId: isAdhoc || !vehicleId ? null : vehicleId,
        vehicleType: isAdhoc ? adhocType.trim() : undefined,
        driverCrewMemberId: driverId || null,
        note: note.trim() || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-vehicles", jobId] });
      qc.invalidateQueries({ queryKey: ["vehicle-matrix"] });
      onClose();
    },
    onError: (err: any) => setError(err?.message ?? "เพิ่มรถไม่สำเร็จ"),
  });

  const canSave = vehicleId === "adhoc" ? !!adhocType.trim() : !!vehicleId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md bg-[#0f0f0f] border border-white/[0.08] rounded-2xl shadow-2xl animate-modal-up flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FFFF00]/10 flex items-center justify-center"><Truck className="w-4 h-4 text-[#FFFF00]" /></div>
            <h2 className="font-bold text-white text-sm">เพิ่มรถเข้างาน</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-white/70 mb-1">รถ *</label>
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white focus:outline-none focus:border-[#FFFF00]/50">
              <option value="">— เลือกรถจากคลัง —</option>
              {vehicles.filter((v) => v.active).map((v) => (
                <option key={v.id} value={v.id}>{v.name}{v.plate ? ` (${v.plate})` : ""}</option>
              ))}
              <option value="adhoc">+ พิมพ์เอง (ไม่อยู่ในคลัง)</option>
            </select>
          </div>

          {vehicleId === "adhoc" && (
            <div>
              <label className="block text-[11px] font-bold text-white/70 mb-1">ประเภทรถ</label>
              <input value={adhocType} onChange={(e) => setAdhocType(e.target.value)} placeholder="เช่น รถ 6 ล้อ"
                className="w-full h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FFFF00]/50" />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-white/70 mb-1">คนขับ (optional)</label>
            <select value={driverId} onChange={(e) => setDriverId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white focus:outline-none focus:border-[#FFFF00]/50">
              <option value="">— ไม่ระบุ —</option>
              {crew.filter((c) => c.active).map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-white/70 mb-1">หมายเหตุ</label>
            <input value={note} onChange={(e) => setNote(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FFFF00]/50" />
          </div>
        </div>

        {error && <div className="mx-5 mb-2 text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2 flex-shrink-0">{error}</div>}

        <div className="flex items-center justify-between px-5 py-4 border-t border-white/[0.06] flex-shrink-0 gap-3">
          <button onClick={onClose} className="h-9 px-4 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors">ยกเลิก</button>
          <button onClick={() => { setError(null); assignMutation.mutate(); }} disabled={!canSave || assignMutation.isPending}
            className="flex items-center gap-2 h-9 px-5 rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-80 disabled:opacity-40" style={{ backgroundColor: "#FFFF00" }}>
            {assignMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            เพิ่มรถ
          </button>
        </div>
      </div>
    </div>
  );
};
