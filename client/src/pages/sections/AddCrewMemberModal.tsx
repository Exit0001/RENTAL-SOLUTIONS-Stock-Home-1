import { useState } from "react";
import { X, Users, Loader2, Save } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { crewApi, authApi } from "@/api";
import type { CrewMemberRow, CrewType, TeamMember } from "@/api";
import { CREW_TYPE_LABEL } from "./AssignCrewModal";

interface Props {
  member?: CrewMemberRow | null;   // มี → แก้ไข
  onClose: () => void;
}

// outsource/loader เป็นจำนวนคนต่องาน (ไม่ใช่รายชื่อ) — roster เก็บเฉพาะคนที่มีชื่อ
const TYPES: CrewType[] = ["own_crew", "freelancer"];

export const AddCrewMemberModal = ({ member, onClose }: Props): JSX.Element => {
  const { token } = useAppStore();
  const qc = useQueryClient();

  const [name, setName]       = useState(member?.name ?? "");
  const [type, setType]       = useState<CrewType>(member?.type ?? "own_crew");
  const [phone, setPhone]     = useState(member?.phone ?? "");
  const [role, setRole]       = useState(member?.role ?? "");
  const [dayRate, setDayRate] = useState(member?.dayRate ?? "");
  const [note, setNote]       = useState(member?.note ?? "");
  const [userId, setUserId]   = useState<string>(member?.userId ?? "");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const { data: team = [] } = useQuery<TeamMember[]>({
    queryKey: ["team"], queryFn: authApi.getTeam, enabled: !!token,
  });

  const handleSave = async () => {
    if (!name.trim()) { setError("กรุณาระบุชื่อ"); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        name: name.trim(), type,
        phone: phone.trim() || null,
        role: role.trim() || null,
        note: note.trim() || null,
        dayRate: dayRate.toString().trim() || null,
        userId: type === "own_crew" && userId ? userId : null,
      };
      if (member) await crewApi.update(member.id, payload);
      else await crewApi.create(payload);
      qc.invalidateQueries({ queryKey: ["crew-members"] });
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "บันทึกไม่สำเร็จ");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md bg-[#0f0f0f] border border-white/[0.08] rounded-2xl shadow-2xl animate-modal-up flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FFFF00]/10 flex items-center justify-center"><Users className="w-4 h-4 text-[#FFFF00]" /></div>
            <h2 className="font-bold text-white text-sm">{member ? "แก้ไขทีมงาน" : "เพิ่มทีมงาน"}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {/* Type pills */}
          <div>
            <label className="block text-[11px] font-bold text-white/70 mb-1.5">ประเภท</label>
            <div className="flex flex-wrap gap-1.5">
              {TYPES.map((ty) => (
                <button key={ty} onClick={() => setType(ty)}
                  className={`h-8 px-3 rounded-lg text-xs font-semibold border transition-colors ${type === ty ? "bg-[#FFFF00] text-black border-[#FFFF00]" : "text-white/60 border-white/10 hover:border-white/30"}`}>{CREW_TYPE_LABEL[ty]}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-white/70 mb-1">ชื่อ *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อ-นามสกุล / ชื่อเล่น"
              className="w-full h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FFFF00]/50" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-white/70 mb-1">เบอร์โทร</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08x-xxx-xxxx"
                className="w-full h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FFFF00]/50" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-white/70 mb-1">ค่าตัว/วัน (บาท)</label>
              <input value={dayRate} onChange={(e) => setDayRate(e.target.value)} inputMode="decimal" placeholder="0"
                className="w-full h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FFFF00]/50" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-white/70 mb-1">ตำแหน่ง</label>
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="เช่น Sound Engineer, ช่างไฟ"
              className="w-full h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FFFF00]/50" />
          </div>

          {/* Link user account (own-crew only) */}
          {type === "own_crew" && (
            <div>
              <label className="block text-[11px] font-bold text-white/70 mb-1">ผูกกับบัญชีผู้ใช้ (optional)</label>
              <select value={userId} onChange={(e) => setUserId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white focus:outline-none focus:border-[#FFFF00]/50">
                <option value="">— ไม่ผูกบัญชี —</option>
                {team.map((u) => (<option key={u.id} value={u.id}>{u.name} ({u.role})</option>))}
              </select>
              <p className="text-[10px] text-white/40 mt-1">ผูกบัญชีเพื่อให้คนนี้ได้รับแจ้งเตือนเมื่อถูก assign เข้างาน</p>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-white/70 mb-1">หมายเหตุ</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder=""
              className="w-full h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FFFF00]/50" />
          </div>
        </div>

        {error && <div className="mx-5 mb-2 text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2 flex-shrink-0">{error}</div>}

        <div className="flex items-center justify-between px-5 py-4 border-t border-white/[0.06] flex-shrink-0 gap-3">
          <button onClick={onClose} className="h-9 px-4 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors">ยกเลิก</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 h-9 px-5 rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-80 disabled:opacity-40" style={{ backgroundColor: "#FFFF00" }}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
};
