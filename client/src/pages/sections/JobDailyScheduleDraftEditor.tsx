import { useMemo, useState } from "react";
import { Clock, Users, ChevronDown, ChevronUp, StickyNote } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toDateStr, enumerateDays, TimeField, NoteField } from "./JobDailyScheduleSection";

export type DraftDaySchedule = { departureTime: string | null; arrivalTime: string | null; endTime: string | null; note: string | null };
export type DraftDayCrewEntry = { crewMemberId: string; role: string | null };

interface Props {
  startDate: string;
  endDate: string;
  crew: { crewMemberId: string; name: string }[];
  schedules: Record<string, DraftDaySchedule>;
  dayCrew: Record<string, DraftDayCrewEntry[]>;
  onScheduleChange: (date: string, patch: Partial<DraftDaySchedule>) => void;
  onDayCrewChange: (date: string, entries: DraftDayCrewEntry[]) => void;
}

// เวอร์ชัน "ร่าง" ของ JobDailyScheduleSection — ใช้ตอนสร้างงานใหม่ (ยังไม่มี jobId จริง)
// ทำงานบน local state ที่ parent (AddJobsModal) ถืออยู่ ไม่มีการเรียก API ใดๆ ในนี้
export const JobDailyScheduleDraftEditor = ({ startDate, endDate, crew, schedules, dayCrew, onScheduleChange, onDayCrewChange }: Props): JSX.Element => {
  const { t } = useTranslation("jobs");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const days = useMemo(() => {
    if (!startDate || !endDate) return [];
    return enumerateDays(new Date(startDate), new Date(endDate));
  }, [startDate, endDate]);

  const toggleExpand = (date: string) => setExpanded((s) => {
    const n = new Set(s);
    if (n.has(date)) n.delete(date); else n.add(date);
    return n;
  });

  if (days.length === 0) {
    return <p className="text-xs text-fg/40 italic">{t("dayScheduleNeedDates")}</p>;
  }

  return (
    <div className="space-y-2">
      {days.map((date) => {
        const sched = schedules[date];
        const workingToday = dayCrew[date] ?? [];
        const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" });
        const isOpen = expanded.has(date);

        return (
          <div key={date} className="rounded-xl border border-fg/[0.06] bg-fg/[0.02] overflow-hidden">
            <button type="button" onClick={() => toggleExpand(date)} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-fg/[0.02] transition-colors text-left">
              <span className="text-xs font-semibold text-fg/85 flex-shrink-0">{dateLabel}</span>
              {(sched?.departureTime || sched?.arrivalTime || sched?.endTime) && (
                <span className="text-[10px] text-fg/50 flex items-center gap-1 truncate">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  {[
                    sched?.departureTime && t("dayScheduleDepartureShort", { time: sched.departureTime }),
                    sched?.arrivalTime && t("dayScheduleArrivalShort", { time: sched.arrivalTime }),
                    sched?.endTime && t("dayScheduleEndShort", { time: sched.endTime }),
                  ].filter(Boolean).join(" · ")}
                </span>
              )}
              {workingToday.length > 0 && (
                <span className="text-[10px] text-brand/70 flex items-center gap-1 flex-shrink-0">
                  <Users className="w-3 h-3" />{workingToday.length}
                </span>
              )}
              {sched?.note && (
                <span className="text-fg/40 flex-shrink-0" title={sched.note}>
                  <StickyNote className="w-3 h-3" />
                </span>
              )}
              <span className="ml-auto flex-shrink-0">{isOpen ? <ChevronUp className="w-3.5 h-3.5 text-fg/40" /> : <ChevronDown className="w-3.5 h-3.5 text-fg/40" />}</span>
            </button>

            {isOpen && (
              <div className="px-3 pb-3 pt-1 border-t border-fg/[0.06] space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <TimeField label={t("dayScheduleDeparture")} value={sched?.departureTime ?? ""}
                    onCommit={(v) => onScheduleChange(date, { departureTime: v || null })} />
                  <TimeField label={t("dayScheduleArrival")} value={sched?.arrivalTime ?? ""}
                    onCommit={(v) => onScheduleChange(date, { arrivalTime: v || null })} />
                  <TimeField label={t("dayScheduleEnd")} value={sched?.endTime ?? ""}
                    onCommit={(v) => onScheduleChange(date, { endTime: v || null })} />
                </div>

                <NoteField label={t("dayScheduleNote")} placeholder={t("dayScheduleNotePlaceholder")} value={sched?.note ?? ""}
                  onCommit={(v) => onScheduleChange(date, { note: v || null })} />

                <div>
                  <p className="text-[10px] font-bold text-fg/40 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Users className="w-3 h-3" />{t("dayScheduleCrewToday")}</p>
                  {crew.length === 0 ? (
                    <p className="text-xs text-fg/40 italic">{t("dayScheduleNoJobCrew")}</p>
                  ) : (
                    <div className="space-y-1">
                      {crew.map((c) => {
                        const entry = workingToday.find((w) => w.crewMemberId === c.crewMemberId);
                        const isChecked = !!entry;
                        return (
                          <div key={c.crewMemberId} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const next = isChecked
                                  ? workingToday.filter((w) => w.crewMemberId !== c.crewMemberId)
                                  : [...workingToday, { crewMemberId: c.crewMemberId, role: null }];
                                onDayCrewChange(date, next);
                              }}
                              className={`w-4 h-4 rounded border flex-shrink-0 transition-colors ${isChecked ? "bg-brand border-brand" : "border-fg/20 hover:border-fg/40"}`}
                            />
                            <span className="text-xs text-fg/75 flex-1 truncate">{c.name}</span>
                            {isChecked && (
                              <input
                                key={`${c.crewMemberId}-${entry?.role ?? ""}`}
                                defaultValue={entry?.role ?? ""}
                                placeholder={t("dayScheduleRolePlaceholder")}
                                onBlur={(e) => {
                                  const next = workingToday.map((w) => w.crewMemberId === c.crewMemberId ? { ...w, role: e.target.value || null } : w);
                                  onDayCrewChange(date, next);
                                }}
                                className="h-6 w-32 px-2 text-[11px] rounded bg-black/30 border border-fg/10 text-fg/80 focus:outline-none focus:border-brand/40"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
