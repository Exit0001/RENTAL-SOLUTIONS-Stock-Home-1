import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, LayoutList, CalendarDays } from "lucide-react";

const DAY_W = 44;
const LABEL_W = 196;
const TOTAL_DAYS = 14;
const MAX_CHIPS = 3;

type ViewMode = "timeline" | "month";

const JOB_BAR: Record<string, string> = {
  draft:     "bg-white/[0.12] text-white/50",
  scheduled: "bg-blue-500/70 text-white",
  active:    "bg-amber-500/70 text-black",
  completed: "bg-emerald-600/60 text-white",
  cancelled: "bg-red-500/25 text-white/40",
};

const WEEKDAY_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function getMonthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }).map((_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  );
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

interface Props {
  jobs: any[];
}

export function JobScheduleView({ jobs }: Props) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  const [viewMode, setViewMode] = useState<ViewMode>("timeline");

  const [rangeStart, setRangeStart] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [monthCursor, setMonthCursor] = useState<Date>(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const days = useMemo(() => {
    return Array.from({ length: TOTAL_DAYS }).map((_, i) => {
      const d = new Date(rangeStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [rangeStart]);

  const rangeEnd = days[TOTAL_DAYS - 1];

  const timelineJobs = useMemo(() => {
    const startStr = toDateStr(rangeStart);
    const endStr   = toDateStr(rangeEnd);
    return jobs.filter((j) => {
      const js = (j.startDate ?? "").slice(0, 10);
      const je = (j.endDate   ?? "").slice(0, 10);
      return js <= endStr && je >= startStr;
    });
  }, [jobs, rangeStart, rangeEnd]);

  const monthDays = useMemo(() => getMonthGrid(monthCursor), [monthCursor]);

  const prevWeek = () => setRangeStart((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  const nextWeek = () => setRangeStart((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
  const goToday  = () => { const d = new Date(); d.setDate(d.getDate() - 3); d.setHours(0,0,0,0); setRangeStart(d); };

  const prevMonth = () => setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  const goThisMonth = () => setMonthCursor(new Date(today.getFullYear(), today.getMonth(), 1));

  const todayOffset = Math.round((today.getTime() - rangeStart.getTime()) / 86400000);

  return (
    <div className="space-y-3">
      {/* Control bar */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5 bg-white/[0.05] rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("timeline")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              viewMode === "timeline" ? "bg-[#FFFF00] text-black" : "text-white/60 hover:text-white"
            }`}
          >
            <LayoutList className="w-3.5 h-3.5" /> ตาราง
          </button>
          <button
            onClick={() => setViewMode("month")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              viewMode === "month" ? "bg-[#FFFF00] text-black" : "text-white/60 hover:text-white"
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" /> เดือน
          </button>
        </div>

        {viewMode === "timeline" ? (
          <div className="flex items-center gap-1.5">
            <button onClick={prevWeek} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] text-white/50 min-w-[160px] text-center">
              {rangeStart.toLocaleDateString("th-TH", { day: "numeric", month: "short" })} – {rangeEnd.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
            </span>
            <button onClick={nextWeek} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button onClick={goToday} className="text-[11px] text-[#FFFF00]/50 hover:text-[#FFFF00] transition-colors px-1">
              วันนี้
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button onClick={prevMonth} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-sm font-medium text-white/70 min-w-[140px] text-center">
              {monthCursor.toLocaleDateString("th-TH", { month: "long", year: "numeric" })}
            </span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button onClick={goThisMonth} className="text-[11px] text-[#FFFF00]/50 hover:text-[#FFFF00] transition-colors px-1">
              เดือนนี้
            </button>
          </div>
        )}
      </div>

      {/* ── Gantt timeline ── */}
      {viewMode === "timeline" && (
        <div className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            {/* Header row */}
            <div
              className="flex border-b border-white/[0.06] bg-[#0f0f0f] sticky top-0 z-10"
              style={{ minWidth: LABEL_W + DAY_W * TOTAL_DAYS }}
            >
              <div className="shrink-0 border-r border-white/[0.06]" style={{ width: LABEL_W }} />
              {days.map((day) => {
                const isToday = isSameDay(day, today);
                return (
                  <div
                    key={day.toISOString()}
                    className={`shrink-0 border-r border-white/[0.04] text-center py-2 ${isToday ? "bg-[#FFFF00]/[0.06]" : ""}`}
                    style={{ width: DAY_W }}
                  >
                    <div className={`text-[9px] uppercase tracking-wide ${isToday ? "text-[#FFFF00]/70" : "text-white/25"}`}>
                      {WEEKDAY_TH[day.getDay()]}
                    </div>
                    <div className={`text-[11px] font-semibold mt-0.5 ${isToday ? "text-[#FFFF00]" : "text-white/40"}`}>
                      {day.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Job rows */}
            {timelineJobs.length === 0 ? (
              <div className="py-12 text-center text-sm text-white/30" style={{ minWidth: LABEL_W + DAY_W * TOTAL_DAYS }}>
                ไม่มีงานในช่วงเวลานี้
              </div>
            ) : timelineJobs.map((job) => {
              const jobStart = new Date(job.startDate);
              const jobEnd   = new Date(job.endDate);
              jobStart.setHours(0, 0, 0, 0);
              jobEnd.setHours(0, 0, 0, 0);

              const barStart = jobStart < rangeStart ? rangeStart : jobStart;
              const barEnd   = jobEnd   > rangeEnd   ? rangeEnd   : jobEnd;

              const startOff = Math.round((barStart.getTime() - rangeStart.getTime()) / 86400000);
              const spanDays = Math.max(1, Math.round((barEnd.getTime() - barStart.getTime()) / 86400000) + 1);

              return (
                <div
                  key={job.id}
                  className="flex items-center border-b border-white/[0.04] hover:bg-white/[0.015] transition-colors"
                  style={{ minWidth: LABEL_W + DAY_W * TOTAL_DAYS }}
                >
                  <div
                    className="shrink-0 border-r border-white/[0.04] px-3 py-2.5"
                    style={{ width: LABEL_W }}
                  >
                    <p className="text-xs font-medium text-white/80 truncate">{job.name}</p>
                    <p className="text-[10px] text-white/35 truncate">{job.client}</p>
                  </div>
                  <div className="relative" style={{ width: DAY_W * TOTAL_DAYS, height: 44 }}>
                    {/* today column highlight */}
                    {todayOffset >= 0 && todayOffset < TOTAL_DAYS && (
                      <div
                        className="absolute top-0 bottom-0 bg-[#FFFF00]/[0.025]"
                        style={{ left: todayOffset * DAY_W, width: DAY_W }}
                      />
                    )}
                    {/* day column dividers */}
                    {days.map((_, di) => (
                      <div
                        key={di}
                        className="absolute top-0 bottom-0 border-r border-white/[0.03]"
                        style={{ left: di * DAY_W, width: DAY_W }}
                      />
                    ))}
                    {/* job bar */}
                    <div
                      className={`absolute top-2.5 bottom-2.5 rounded flex items-center px-2 text-[10px] font-semibold truncate select-none ${JOB_BAR[job.status] ?? "bg-white/10 text-white/50"}`}
                      style={{ left: startOff * DAY_W + 2, width: Math.max(8, spanDays * DAY_W - 4) }}
                      title={`${job.name} · ${job.status}`}
                    >
                      {spanDays >= 3 ? job.name : ""}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Month calendar ── */}
      {viewMode === "month" && (
        <div className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
          {/* Weekday header */}
          <div className="grid grid-cols-7 border-b border-white/[0.06] bg-[#0f0f0f]">
            {WEEKDAY_TH.map((label) => (
              <div key={label} className="py-2 text-center text-[10px] font-medium text-white/25 uppercase tracking-wide">
                {label}
              </div>
            ))}
          </div>
          {/* Day grid */}
          <div className="grid grid-cols-7">
            {monthDays.map((day, i) => {
              const dateStr   = toDateStr(day);
              const dayJobs   = jobs.filter((j) => {
                const js = (j.startDate ?? "").slice(0, 10);
                const je = (j.endDate   ?? "").slice(0, 10);
                return js <= dateStr && je >= dateStr;
              });
              const visible   = dayJobs.slice(0, MAX_CHIPS);
              const overflow  = dayJobs.length - visible.length;
              const inMonth   = day.getMonth() === monthCursor.getMonth();
              const isToday   = isSameDay(day, today);

              return (
                <div
                  key={i}
                  className={`flex min-h-[84px] flex-col gap-0.5 border-b border-r border-white/[0.04] p-1 ${
                    !inMonth ? "opacity-30" : ""
                  }`}
                >
                  <span
                    className={`self-end text-[11px] mb-0.5 leading-none ${
                      isToday
                        ? "flex h-5 w-5 items-center justify-center rounded-full bg-[#FFFF00] font-bold text-black"
                        : "text-white/35"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    {visible.map((job) => (
                      <div
                        key={job.id}
                        title={job.name}
                        className={`truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight ${JOB_BAR[job.status] ?? "bg-white/10 text-white/50"}`}
                      >
                        {job.name}
                      </div>
                    ))}
                    {overflow > 0 && (
                      <span className="text-[10px] text-white/25">+{overflow} เพิ่มเติม</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
