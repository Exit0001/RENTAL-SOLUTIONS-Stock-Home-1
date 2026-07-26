import { useEffect, useMemo, useState } from "react";
import { Clock, Users, ChevronDown, ChevronUp, StickyNote } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { jobsApi } from "@/api";
import type { JobCrewMember, JobDayCrewEntry } from "@/api";

interface Props {
  jobId: string;
  startDate: string | Date;
  endDate: string | Date;
  jobCrew: JobCrewMember[];
  canManage: boolean;
}

export function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function enumerateDays(start: Date, end: Date): string[] {
  const days: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cur <= last) {
    days.push(toDateStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export const TimeField = ({ label, value, disabled, onCommit }: {
  label: string; value: string; disabled?: boolean; onCommit: (v: string) => void;
}) => {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[9px] text-white/40 uppercase tracking-wider">{label}</label>
      <input
        type="time"
        value={local}
        disabled={disabled}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { if (local !== value) onCommit(local); }}
        className="h-8 px-2 rounded-lg bg-black/30 border border-white/10 text-xs text-white [color-scheme:dark] focus:outline-none focus:border-[#FFFF00]/40 disabled:opacity-50"
      />
    </div>
  );
};

export const NoteField = ({ label, placeholder, value, disabled, onCommit }: {
  label: string; placeholder?: string; value: string; disabled?: boolean; onCommit: (v: string) => void;
}) => {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[9px] text-white/40 uppercase tracking-wider">{label}</label>
      <textarea
        value={local}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { if (local !== value) onCommit(local); }}
        rows={2}
        className="px-2 py-1.5 rounded-lg bg-black/30 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FFFF00]/40 disabled:opacity-50 resize-none"
      />
    </div>
  );
};

export const JobDailyScheduleSection = ({ jobId, startDate, endDate, jobCrew, canManage }: Props): JSX.Element => {
  const { t } = useTranslation("jobs");
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([toDateStr(new Date(startDate))]));

  const { data: schedules = [] } = useQuery({ queryKey: ["job-day-schedules", jobId], queryFn: () => jobsApi.getDaySchedules(jobId) });
  const { data: dayCrew = [] } = useQuery({ queryKey: ["job-day-crew", jobId], queryFn: () => jobsApi.getDayCrew(jobId) });

  const days = useMemo(() => enumerateDays(new Date(startDate), new Date(endDate)), [startDate, endDate]);
  const scheduleByDate = useMemo(
    () => Object.fromEntries(schedules.map((s) => [toDateStr(new Date(s.date)), s])),
    [schedules],
  );
  const crewByDate = useMemo(() => {
    const map: Record<string, JobDayCrewEntry[]> = {};
    for (const c of dayCrew) {
      const key = toDateStr(new Date(c.date));
      (map[key] ??= []).push(c);
    }
    return map;
  }, [dayCrew]);

  const saveSchedule = useMutation({
    mutationFn: (data: { date: string; departureTime?: string | null; arrivalTime?: string | null; endTime?: string | null; note?: string | null }) =>
      jobsApi.setDaySchedule(jobId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job-day-schedules", jobId] }),
  });

  const saveDayCrew = useMutation({
    mutationFn: ({ date, entries }: { date: string; entries: { crewMemberId: string; role?: string | null }[] }) =>
      jobsApi.setDayCrew(jobId, date, entries),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job-day-crew", jobId] }),
  });

  const toggleExpand = (date: string) => setExpanded((s) => {
    const n = new Set(s);
    if (n.has(date)) n.delete(date); else n.add(date);
    return n;
  });

  return (
    <div className="space-y-2">
      {days.map((date) => {
        const sched = scheduleByDate[date];
        const workingToday = crewByDate[date] ?? [];
        const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" });
        const isOpen = expanded.has(date);

        return (
          <div key={date} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <button onClick={() => toggleExpand(date)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.02] transition-colors text-left">
              <span className="text-sm font-semibold text-white/85 flex-shrink-0">{dateLabel}</span>
              {(sched?.departureTime || sched?.arrivalTime || sched?.endTime) && (
                <span className="text-[11px] text-white/50 flex items-center gap-1 truncate">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  {[
                    sched?.departureTime && t("dayScheduleDepartureShort", { time: sched.departureTime }),
                    sched?.arrivalTime && t("dayScheduleArrivalShort", { time: sched.arrivalTime }),
                    sched?.endTime && t("dayScheduleEndShort", { time: sched.endTime }),
                  ].filter(Boolean).join(" · ")}
                </span>
              )}
              {workingToday.length > 0 && (
                <span className="text-[11px] text-[#FFFF00]/70 flex items-center gap-1 flex-shrink-0">
                  <Users className="w-3 h-3" />{workingToday.length}
                </span>
              )}
              {sched?.note && (
                <span className="text-white/40 flex-shrink-0" title={sched.note}>
                  <StickyNote className="w-3 h-3" />
                </span>
              )}
              <span className="ml-auto flex-shrink-0">{isOpen ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}</span>
            </button>

            {isOpen && (
              <div className="px-3 pb-3 pt-1 border-t border-white/[0.06] space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <TimeField
                    label={t("dayScheduleDeparture")}
                    value={sched?.departureTime ?? ""}
                    disabled={!canManage}
                    onCommit={(v) => saveSchedule.mutate({ date, departureTime: v || null, arrivalTime: sched?.arrivalTime ?? null, endTime: sched?.endTime ?? null, note: sched?.note ?? null })}
                  />
                  <TimeField
                    label={t("dayScheduleArrival")}
                    value={sched?.arrivalTime ?? ""}
                    disabled={!canManage}
                    onCommit={(v) => saveSchedule.mutate({ date, departureTime: sched?.departureTime ?? null, arrivalTime: v || null, endTime: sched?.endTime ?? null, note: sched?.note ?? null })}
                  />
                  <TimeField
                    label={t("dayScheduleEnd")}
                    value={sched?.endTime ?? ""}
                    disabled={!canManage}
                    onCommit={(v) => saveSchedule.mutate({ date, departureTime: sched?.departureTime ?? null, arrivalTime: sched?.arrivalTime ?? null, endTime: v || null, note: sched?.note ?? null })}
                  />
                </div>

                <NoteField
                  label={t("dayScheduleNote")}
                  placeholder={t("dayScheduleNotePlaceholder")}
                  value={sched?.note ?? ""}
                  disabled={!canManage}
                  onCommit={(v) => saveSchedule.mutate({ date, departureTime: sched?.departureTime ?? null, arrivalTime: sched?.arrivalTime ?? null, endTime: sched?.endTime ?? null, note: v || null })}
                />

                <div>
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Users className="w-3 h-3" />{t("dayScheduleCrewToday")}</p>
                  {jobCrew.length === 0 ? (
                    <p className="text-xs text-white/40 italic">{t("dayScheduleNoJobCrew")}</p>
                  ) : (
                    <div className="space-y-1">
                      {jobCrew.map((c) => {
                        const entry = workingToday.find((w) => w.crewMemberId === c.crewMemberId);
                        const isChecked = !!entry;
                        return (
                          <div key={c.crewMemberId} className="flex items-center gap-2">
                            <button
                              disabled={!canManage}
                              onClick={() => {
                                const next = isChecked
                                  ? workingToday.filter((w) => w.crewMemberId !== c.crewMemberId)
                                  : [...workingToday, { crewMemberId: c.crewMemberId, role: null } as JobDayCrewEntry];
                                saveDayCrew.mutate({ date, entries: next.map((n) => ({ crewMemberId: n.crewMemberId, role: n.role })) });
                              }}
                              className={`w-4 h-4 rounded border flex-shrink-0 transition-colors disabled:opacity-40 ${isChecked ? "bg-[#FFFF00] border-[#FFFF00]" : "border-white/20 hover:border-white/40"}`}
                            />
                            <span className="text-xs text-white/75 flex-1 truncate">{c.name}</span>
                            {isChecked && (
                              <input
                                key={`${c.crewMemberId}-${entry?.role ?? ""}`}
                                defaultValue={entry?.role ?? ""}
                                disabled={!canManage}
                                placeholder={t("dayScheduleRolePlaceholder")}
                                onBlur={(e) => {
                                  const next = workingToday.map((w) => w.crewMemberId === c.crewMemberId ? { ...w, role: e.target.value || null } : w);
                                  saveDayCrew.mutate({ date, entries: next.map((n) => ({ crewMemberId: n.crewMemberId, role: n.role })) });
                                }}
                                className="h-6 w-32 px-2 text-[11px] rounded bg-black/30 border border-white/10 text-white/80 focus:outline-none focus:border-[#FFFF00]/40 disabled:opacity-40"
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
