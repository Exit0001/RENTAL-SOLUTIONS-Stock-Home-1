import { useState } from "react";
import { Users, Truck, Plus, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { crewApi, vehiclesApi, authApi } from "@/api";
import type { CrewType, TeamMember } from "@/api";
import { WorkspaceShell, WSButton } from "@/components/WorkspaceShell";
import { CREW_TYPE_LABEL } from "./AssignCrewModal";

// เพิ่มทีมงาน + รถหลายรายการในหน้าเดียว (เหมือนหน้า "เพิ่มสินค้า")
// การแก้ไขรายคน/รายคัน ยังใช้ modal เดิม (AddCrewMemberModal / AddVehicleRosterModal)

const NAMED_TYPES: CrewType[] = ["own_crew", "freelancer"];
const QUICK_VEH_TYPES = ["รถ 6 ล้อ", "รถ 10 ล้อ", "กระบะ", "รถตู้"];

type CrewRow = { id: number; type: CrewType; name: string; phone: string; role: string; dayRate: string; userId: string; note: string };
type VehRow = { id: number; name: string; type: string; plate: string; capacity: string; note: string };

const inputCls =
  "w-full h-11 md:h-9 px-3 rounded-lg bg-black/40 border border-fg/10 text-sm text-fg placeholder:text-fg/30 focus:outline-none focus:border-brand/40 transition-colors";
const labelCls = "text-[10px] text-fg/50 uppercase tracking-wider font-medium";

interface Props {
  initialTab?: "crew" | "vehicle";
  onClose: () => void;
}

export const AddResourcesModal = ({ initialTab = "crew", onClose }: Props): JSX.Element => {
  const { token } = useAppStore();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"crew" | "vehicle">(initialTab);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: team = [] } = useQuery<TeamMember[]>({ queryKey: ["team"], queryFn: authApi.getTeam, enabled: !!token });

  // ── ค่าเริ่มต้น (เติมให้แถวใหม่) ────────────────────────
  const [defType, setDefType] = useState<CrewType>("own_crew");
  const [defRole, setDefRole] = useState("");
  const [defDayRate, setDefDayRate] = useState("");
  const [defVehType, setDefVehType] = useState("");

  const mkCrew = (id: number): CrewRow => ({ id, type: defType, name: "", phone: "", role: defRole, dayRate: defDayRate, userId: "", note: "" });
  const mkVeh = (id: number): VehRow => ({ id, name: "", type: defVehType, plate: "", capacity: "", note: "" });

  const [crewRows, setCrewRows] = useState<CrewRow[]>([mkCrew(1)]);
  const [vehRows, setVehRows] = useState<VehRow[]>([mkVeh(1)]);

  const addCrewRow = () => setCrewRows((r) => [...r, mkCrew(Date.now())]);
  const addVehRow = () => setVehRows((r) => [...r, mkVeh(Date.now())]);
  const rmCrewRow = (id: number) => setCrewRows((r) => (r.length > 1 ? r.filter((x) => x.id !== id) : r));
  const rmVehRow = (id: number) => setVehRows((r) => (r.length > 1 ? r.filter((x) => x.id !== id) : r));
  const setCrew = (id: number, patch: Partial<CrewRow>) => setCrewRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const setVeh = (id: number, patch: Partial<VehRow>) => setVehRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const validCrew = crewRows.filter((r) => r.name.trim());
  const validVeh = vehRows.filter((r) => r.name.trim());
  const canSave = (validCrew.length > 0 || validVeh.length > 0) && !saving;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        ...validCrew.map((r) =>
          crewApi.create({
            name: r.name.trim(),
            type: r.type,
            phone: r.phone.trim() || null,
            role: r.role.trim() || null,
            note: r.note.trim() || null,
            dayRate: r.dayRate.toString().trim() || null,
            userId: r.type === "own_crew" && r.userId ? r.userId : null,
          }),
        ),
        ...validVeh.map((r) =>
          vehiclesApi.create({
            name: r.name.trim(),
            type: r.type.trim() || null,
            plate: r.plate.trim() || null,
            capacity: r.capacity.trim() || null,
            note: r.note.trim() || null,
          }),
        ),
      ]);
      if (validCrew.length) qc.invalidateQueries({ queryKey: ["crew-members"] });
      if (validVeh.length) qc.invalidateQueries({ queryKey: ["vehicles"] });
      const failed = results.filter((x) => x.status === "rejected").length;
      if (failed > 0) {
        setError(`บันทึกไม่สำเร็จ ${failed} รายการ — ที่เหลือบันทึกแล้ว`);
        setSaving(false);
        return;
      }
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "บันทึกไม่สำเร็จ");
      setSaving(false);
    }
  };

  const tabs = [
    { key: "crew", label: "ทีมงาน", Icon: Users, count: validCrew.length },
    { key: "vehicle", label: "รถ", Icon: Truck, count: validVeh.length },
  ];

  return (
    <WorkspaceShell
      icon={tab === "crew" ? <Users className="w-4 h-4 text-black" /> : <Truck className="w-4 h-4 text-black" />}
      title="เพิ่มทรัพยากร"
      subtitle="เพิ่มทีมงานและรถหลายรายการในหน้าเดียว"
      tabs={tabs}
      activeTab={tab}
      onTabChange={(k) => setTab(k as "crew" | "vehicle")}
      onClose={onClose}
      sidebarTitle="ค่าเริ่มต้น (เติมให้แถวใหม่)"
      sidebar={
        <div className="p-4 flex flex-col gap-3">
          {tab === "crew" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>ประเภท</label>
                <div className="flex gap-1.5">
                  {NAMED_TYPES.map((ty) => (
                    <button
                      key={ty}
                      onClick={() => setDefType(ty)}
                      className={`tap-target flex-1 h-8 rounded-lg text-xs font-bold transition-colors ${defType === ty ? "bg-brand text-black" : "bg-fg/5 text-fg/60 hover:text-fg"}`}
                    >
                      {CREW_TYPE_LABEL[ty]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>ตำแหน่ง</label>
                <input value={defRole} onChange={(e) => setDefRole(e.target.value)} placeholder="เช่น Sound Engineer" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>ค่าตัว/วัน (บาท)</label>
                <input value={defDayRate} onChange={(e) => setDefDayRate(e.target.value)} inputMode="decimal" placeholder="0" className={inputCls} />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>ประเภทรถ</label>
              <input value={defVehType} onChange={(e) => setDefVehType(e.target.value)} placeholder="เช่น รถ 6 ล้อ" className={inputCls} />
              <div className="flex flex-wrap gap-1.5 mt-1">
                {QUICK_VEH_TYPES.map((q) => (
                  <button
                    key={q}
                    onClick={() => setDefVehType(q)}
                    className="tap-target h-6 px-2 rounded-full text-[10px] font-medium border border-fg/10 text-fg/50 hover:border-brand/40 hover:text-brand transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="h-px bg-fg/[0.06] my-1" />
          <p className="text-[10px] text-fg/40">
            ค่านี้จะถูกเติมให้แถวใหม่ที่กด "เพิ่มแถว" ปรับรายแถวได้ตามต้องการ
          </p>
        </div>
      }
      footer={
        <>
          <div className="text-sm text-fg/70 font-medium">
            รวม {validCrew.length} คน · {validVeh.length} รถ
          </div>
          <div className="flex items-center gap-2">
            <WSButton variant="ghost" onClick={onClose}>ยกเลิก</WSButton>
            <WSButton variant="primary" onClick={submit} disabled={!canSave} pending={saving} icon={<Plus className="w-4 h-4" />}>
              บันทึกทั้งหมด
            </WSButton>
          </div>
        </>
      }
    >
      <div className="flex items-center gap-2 px-3 md:px-6 py-2.5 border-b border-fg/[0.06] flex-shrink-0">
        <span className="text-xs font-bold text-fg/50">{tab === "crew" ? "รายชื่อทีมงานที่จะเพิ่ม" : "รายการรถที่จะเพิ่ม"}</span>
        <button
          onClick={tab === "crew" ? addCrewRow : addVehRow}
          className="tap-target ml-auto h-7 px-3 rounded-lg text-[11px] font-bold text-brand border border-brand/30 hover:bg-brand/10 flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-3 h-3" />เพิ่มแถว
        </button>
      </div>

      {error && (
        <div className="mx-3 md:mx-6 mt-3 text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2 flex-shrink-0">{error}</div>
      )}

      <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4 flex flex-col gap-3">
        {tab === "crew"
          ? crewRows.map((r, i) => (
              <div key={r.id} className="rounded-xl border border-fg/[0.08] bg-fg/[0.02] p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    {NAMED_TYPES.map((ty) => (
                      <button
                        key={ty}
                        onClick={() => setCrew(r.id, { type: ty })}
                        className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold border transition-colors ${r.type === ty ? "bg-brand text-black border-brand" : "text-fg/60 border-fg/10 hover:border-fg/30"}`}
                      >
                        {CREW_TYPE_LABEL[ty]}
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] text-fg/30 ml-1">#{i + 1}</span>
                  <button
                    onClick={() => rmCrewRow(r.id)}
                    className="tap-target ml-auto w-8 h-8 flex items-center justify-center rounded-lg text-fg/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input value={r.name} onChange={(e) => setCrew(r.id, { name: e.target.value })} placeholder="ชื่อ-นามสกุล / ชื่อเล่น *" className={inputCls} />
                  <input value={r.role} onChange={(e) => setCrew(r.id, { role: e.target.value })} placeholder="ตำแหน่ง" className={inputCls} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input value={r.phone} onChange={(e) => setCrew(r.id, { phone: e.target.value })} placeholder="เบอร์โทร" className={inputCls} />
                  <input value={r.dayRate} onChange={(e) => setCrew(r.id, { dayRate: e.target.value })} inputMode="decimal" placeholder="ค่าตัว/วัน" className={inputCls} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {r.type === "own_crew" ? (
                    <select
                      value={r.userId}
                      onChange={(e) => setCrew(r.id, { userId: e.target.value })}
                      className={`${inputCls} [color-scheme:dark]`}
                    >
                      <option value="">— ไม่ผูกบัญชี —</option>
                      {team.map((u) => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                      ))}
                    </select>
                  ) : (
                    <span />
                  )}
                  <input value={r.note} onChange={(e) => setCrew(r.id, { note: e.target.value })} placeholder="หมายเหตุ" className={inputCls} />
                </div>
              </div>
            ))
          : vehRows.map((r, i) => (
              <div key={r.id} className="rounded-xl border border-fg/[0.08] bg-fg/[0.02] p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-fg/30">#{i + 1}</span>
                  <button
                    onClick={() => rmVehRow(r.id)}
                    className="tap-target ml-auto w-8 h-8 flex items-center justify-center rounded-lg text-fg/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input value={r.name} onChange={(e) => setVeh(r.id, { name: e.target.value })} placeholder="ชื่อรถ *" className={inputCls} />
                  <input value={r.type} onChange={(e) => setVeh(r.id, { type: e.target.value })} placeholder="ประเภท" className={inputCls} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input value={r.plate} onChange={(e) => setVeh(r.id, { plate: e.target.value })} placeholder="ทะเบียน" className={inputCls} />
                  <input value={r.capacity} onChange={(e) => setVeh(r.id, { capacity: e.target.value })} placeholder="ความจุ" className={inputCls} />
                  <input value={r.note} onChange={(e) => setVeh(r.id, { note: e.target.value })} placeholder="หมายเหตุ" className={inputCls} />
                </div>
              </div>
            ))}

        <button
          onClick={tab === "crew" ? addCrewRow : addVehRow}
          className="tap-target w-full h-11 md:h-10 rounded-xl border border-dashed border-fg/15 hover:border-brand/50 text-fg/60 hover:text-brand text-sm font-medium flex items-center justify-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" />เพิ่มแถว
        </button>
      </div>
    </WorkspaceShell>
  );
};
