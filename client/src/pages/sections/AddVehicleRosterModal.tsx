import { useState } from "react";
import { X, Truck, Loader2, Save } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { vehiclesApi } from "@/api";
import type { VehicleRow } from "@/api";

interface Props {
  vehicle?: VehicleRow | null;   // มี → แก้ไข
  onClose: () => void;
}

const QUICK_TYPES = ["รถ 6 ล้อ", "รถ 10 ล้อ", "กระบะ", "รถตู้"];

export const AddVehicleRosterModal = ({ vehicle, onClose }: Props): JSX.Element => {
  const qc = useQueryClient();
  const [name, setName]         = useState(vehicle?.name ?? "");
  const [type, setType]         = useState(vehicle?.type ?? "");
  const [plate, setPlate]       = useState(vehicle?.plate ?? "");
  const [capacity, setCapacity] = useState(vehicle?.capacity ?? "");
  const [note, setNote]         = useState(vehicle?.note ?? "");
  const [error, setError]       = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () => {
      const data = { name: name.trim(), type: type.trim() || null, plate: plate.trim() || null, capacity: capacity.trim() || null, note: note.trim() || null };
      return vehicle ? vehiclesApi.update(vehicle.id, data) : vehiclesApi.create(data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicles"] }); onClose(); },
    onError: (err: any) => setError(err?.message ?? "บันทึกไม่สำเร็จ"),
  });

  const handleSave = () => { if (!name.trim()) { setError("กรุณาระบุชื่อรถ"); return; } setError(null); saveMutation.mutate(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md bg-[#0f0f0f] border border-white/[0.08] rounded-2xl shadow-2xl animate-modal-up flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FFFF00]/10 flex items-center justify-center"><Truck className="w-4 h-4 text-[#FFFF00]" /></div>
            <h2 className="font-bold text-white text-sm">{vehicle ? "แก้ไขรถ" : "เพิ่มรถ"}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-white/70 mb-1">ชื่อรถ *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น รถ 6 ล้อ คันที่ 1"
              className="w-full h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FFFF00]/50" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-white/70 mb-1">ประเภท</label>
            <input value={type} onChange={(e) => setType(e.target.value)} placeholder="เช่น รถ 6 ล้อ"
              className="w-full h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FFFF00]/50" />
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {QUICK_TYPES.map((q) => (
                <button key={q} onClick={() => setType(q)}
                  className="h-6 px-2 rounded-full text-[10px] font-medium border border-white/10 text-white/50 hover:border-[#FFFF00]/40 hover:text-[#FFFF00] transition-colors">{q}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-white/70 mb-1">ทะเบียน</label>
              <input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="1กก 1234"
                className="w-full h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FFFF00]/50" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-white/70 mb-1">ความจุ</label>
              <input value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="เช่น 5 ตัน"
                className="w-full h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FFFF00]/50" />
            </div>
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
          <button onClick={handleSave} disabled={saveMutation.isPending}
            className="flex items-center gap-2 h-9 px-5 rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-80 disabled:opacity-40" style={{ backgroundColor: "#FFFF00" }}>
            {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saveMutation.isPending ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
};
