import { useMemo } from "react";
import { Plus, Trash2, Truck, RotateCcw, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { jobsApi } from "@/api";
import type { JobUnitEvent } from "@/api";

interface Props {
  jobId: string;
  startDate: string | Date;
  endDate: string | Date;
}

const EVENT_ICON: Record<JobUnitEvent["eventType"], typeof Plus> = {
  added: Plus, removed: Trash2, dispatched: Truck, returned: RotateCcw,
};
const EVENT_COLOR: Record<JobUnitEvent["eventType"], string> = {
  added:      "text-emerald-400 bg-emerald-500/10",
  removed:    "text-red-400 bg-red-500/10",
  dispatched: "text-blue-400 bg-blue-500/10",
  returned:   "text-[#FFFF00] bg-[#FFFF00]/10",
};

// ประวัติการเปลี่ยนแปลงอุปกรณ์ของงาน (เพิ่ม/เอาออกจากแผน/ดิสแพตช์/คืน) — ใช้ตรวจจับ
// "ของกลับมาก่อนวันเก็บ" / "มีของเพิ่มเข้ามาทีหลัง" โดยเทียบ createdAt กับ startDate/endDate ของงาน
// (heuristic ตามปฏิทินอย่างง่าย — งานที่กำหนดอุปกรณ์เสร็จวันเริ่มงานเลยจะติด badge นี้ด้วย เป็นข้อจำกัดที่รับได้)
export const JobUnitEventsSection = ({ jobId, startDate, endDate }: Props): JSX.Element => {
  const { t } = useTranslation("jobs");
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["job-unit-events", jobId],
    queryFn:  () => jobsApi.getUnitEvents(jobId),
  });

  const start = useMemo(() => new Date(startDate).getTime(), [startDate]);
  const end = useMemo(() => new Date(endDate).getTime(), [endDate]);

  if (isLoading) return <Loader2 className="w-4 h-4 animate-spin text-white/40" />;
  if (events.length === 0) return <p className="text-xs text-white/40 italic">{t("noUnitEventsYet")}</p>;

  return (
    <div className="space-y-1 max-h-72 overflow-y-auto">
      {events.map((ev) => {
        const Icon = EVENT_ICON[ev.eventType];
        const ts = new Date(ev.createdAt).getTime();
        const isLate = ev.eventType === "added" && ts > start;
        const isEarly = ev.eventType === "returned" && ts < end;
        return (
          <div key={ev.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/[0.02] transition-colors">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${EVENT_COLOR[ev.eventType]}`}>
              <Icon className="w-3 h-3" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/80 truncate">
                {ev.itemName ?? ev.unitName}
                {ev.serialNumber && <span className="text-white/40 font-mono ml-1.5">SN:{ev.serialNumber}</span>}
              </p>
              <p className="text-[10px] text-white/40 truncate">
                {t(`unitEvent_${ev.eventType}`)} · {new Date(ev.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                {ev.actorName ? ` · ${ev.actorName}` : ""}
                {ev.note ? ` · ${ev.note}` : ""}
              </p>
            </div>
            {isLate && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex-shrink-0">{t("addedLateBadge")}</span>
            )}
            {isEarly && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex-shrink-0">{t("returnedEarlyBadge")}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};
