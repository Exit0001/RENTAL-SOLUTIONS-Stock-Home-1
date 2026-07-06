import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { jobsApi } from "@/api";

const COL_W    = 38;   // px per day column
const ROW_H    = 54;   // px per crew row
const LEFT_W   = 200;  // px for sticky left crew label
const VIEW_DAYS = 35;  // 5 weeks

const STATUS_BAR: Record<string, { bg: string; border: string; text: string }> = {
  draft:     { bg: "rgba(255,255,255,0.07)",  border: "rgba(255,255,255,0.12)", text: "rgba(255,255,255,0.45)" },
  scheduled: { bg: "rgba(59,130,246,0.28)",   border: "rgba(99,160,255,0.35)",  text: "rgba(147,197,253,0.9)" },
  active:    { bg: "rgba(245,158,11,0.30)",   border: "rgba(251,191,36,0.40)",  text: "rgba(253,230,138,0.9)" },
  completed: { bg: "rgba(16,185,129,0.25)",   border: "rgba(52,211,153,0.35)",  text: "rgba(167,243,208,0.9)" },
  cancelled: { bg: "rgba(239,68,68,0.08)",    border: "rgba(239,68,68,0.12)",   text: "rgba(239,68,68,0.3)"  },
};

const STATUS_TH: Record<string, string> = {
  draft: "ร่าง", scheduled: "กำหนด", active: "ดำเนิน", completed: "เสร็จ", cancelled: "ยกเลิก",
};

const DOW_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}
function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

interface CrewMember { id: string; name: string; initials: string; role: string; currentJob: string; nextJob: string }
interface Props      { jobs: any[]; crewMembers: CrewMember[]; onAssignCrew: (job: any) => void }

export function CrewScheduleView({ jobs, crewMembers, onAssignCrew }: Props) {
  const { token } = useAppStore();
  const today = useMemo(() => startOfDay(new Date()), []);

  const [viewStart, setViewStart] = useState<Date>(() => {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() - 4);
    return d;
  });

  const days = useMemo(() =>
    Array.from({ length: VIEW_DAYS }, (_, i) => {
      const d = new Date(viewStart);
      d.setDate(d.getDate() + i);
      return d;
    }), [viewStart]);

  // Group days by month for the header row
  const monthGroups = useMemo(() => {
    const groups: { label: string; span: number; startIdx: number }[] = [];
    days.forEach((d, i) => {
      const label = d.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
      const last  = groups[groups.length - 1];
      if (!last || last.label !== label) groups.push({ label, span: 1, startIdx: i });
      else last.span++;
    });
    return groups;
  }, [days]);

  const { data: matrixRows = [] } = useQuery({
    queryKey:  ["crew-matrix"],
    queryFn:   jobsApi.getCrewMatrix,
    enabled:   !!token,
  });

  // userId → Set<jobId>
  const crewJobMap = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const r of matrixRows) {
      if (!m.has(r.userId)) m.set(r.userId, new Set());
      m.get(r.userId)!.add(r.jobId);
    }
    return m;
  }, [matrixRows]);

  const jobById = useMemo(() => {
    const m = new Map<string, any>();
    for (const j of jobs) m.set(j.id, j);
    return m;
  }, [jobs]);

  const todayOffset = diffDays(viewStart, today); // column index of today

  function navigate(weeks: number) {
    setViewStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + weeks * 7);
      return d;
    });
  }
  function goToday() {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() - 4);
    setViewStart(d);
  }

  const totalW = LEFT_W + VIEW_DAYS * COL_W;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0a0a0a]">

      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={() => navigate(-1)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => navigate(1)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <button type="button" onClick={goToday}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/[0.08] text-[11px] text-white/50 hover:text-white/80 hover:border-white/[0.15] transition-colors">
          <CalendarDays className="w-3 h-3" />
          วันนี้
        </button>
        <span className="text-[11px] text-white/25 ml-2">
          {days[0].toLocaleDateString("th-TH", { day: "numeric", month: "short" })} –{" "}
          {days[VIEW_DAYS - 1].toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
        </span>

        {/* Legend */}
        <div className="ml-auto flex items-center gap-3">
          {Object.entries(STATUS_TH).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: STATUS_BAR[key]?.bg, border: `1px solid ${STATUS_BAR[key]?.border}` }} />
              <span className="text-[10px] text-white/30">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Scrollable grid ──────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div style={{ minWidth: totalW }}>

          {/* Month header */}
          <div className="flex sticky top-0 z-30 bg-[#0a0a0a]">
            <div
              className="flex-shrink-0 sticky left-0 z-40 bg-[#0a0a0a] border-b border-r border-white/[0.06] flex items-center px-4"
              style={{ width: LEFT_W, height: 26 }}
            >
              <span className="text-[9px] font-bold text-[#FFFF00]/50 uppercase tracking-widest">ทีมงาน</span>
            </div>
            {monthGroups.map((mg, i) => (
              <div key={i} className="flex-shrink-0 flex items-center px-2 border-b border-r border-white/[0.06]"
                style={{ width: mg.span * COL_W, height: 26 }}>
                <span className="text-[10px] font-semibold text-white/40 truncate">{mg.label}</span>
              </div>
            ))}
          </div>

          {/* Day-of-week + date header */}
          <div className="flex sticky top-[26px] z-30 bg-[#0a0a0a]">
            <div
              className="flex-shrink-0 sticky left-0 z-40 bg-[#0a0a0a] border-b border-r border-white/[0.06]"
              style={{ width: LEFT_W, height: 42 }}
            />
            {days.map((d, i) => {
              const isToday   = i === todayOffset;
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div key={i}
                  className={`flex-shrink-0 flex flex-col items-center justify-center border-b border-r border-white/[0.06] ${isWeekend ? "bg-white/[0.015]" : ""}`}
                  style={{ width: COL_W, height: 42 }}>
                  <span className={`text-[9px] font-medium leading-none ${isToday ? "text-[#FFFF00]/70" : "text-white/25"}`}>
                    {DOW_TH[d.getDay()]}
                  </span>
                  <div className={`mt-1 w-[22px] h-[22px] flex items-center justify-center rounded-full ${
                    isToday ? "bg-[#FFFF00]" : ""}`}>
                    <span className={`text-[11px] font-bold leading-none ${
                      isToday ? "text-black" : isWeekend ? "text-white/30" : "text-white/55"}`}>
                      {d.getDate()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Crew rows */}
          {crewMembers.map((c, ri) => {
            const crewJobIds = crewJobMap.get(c.id) ?? new Set<string>();
            const crewJobs   = Array.from(crewJobIds).map(id => jobById.get(id)).filter(Boolean);

            return (
              <div key={c.id} className="flex" style={{ height: ROW_H }}>

                {/* Sticky left label */}
                <div
                  className={`flex-shrink-0 sticky left-0 z-10 flex items-center gap-2.5 px-3 border-b border-r border-white/[0.04] ${ri % 2 === 1 ? "bg-[#0d0d0d]" : "bg-[#0a0a0a]"}`}
                  style={{ width: LEFT_W }}
                >
                  <div className="w-7 h-7 rounded-full bg-white/[0.08] flex items-center justify-center text-[10px] font-bold text-white/50 flex-shrink-0">
                    {c.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white/75 truncate leading-tight">{c.name}</p>
                    <p className="text-[10px] text-white/25 truncate leading-tight mt-0.5">{c.role}</p>
                  </div>
                </div>

                {/* Timeline cells */}
                <div
                  className={`relative flex-shrink-0 border-b border-white/[0.04] ${ri % 2 === 1 ? "bg-[#0d0d0d]" : ""}`}
                  style={{ width: VIEW_DAYS * COL_W, height: ROW_H }}
                >
                  {/* Background day columns */}
                  {days.map((d, di) => {
                    const isToday   = di === todayOffset;
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <div key={di} className="absolute top-0 bottom-0 border-r border-white/[0.04]"
                        style={{
                          left:    di * COL_W,
                          width:   COL_W,
                          background: isToday
                            ? "rgba(255,255,0,0.04)"
                            : isWeekend
                            ? "rgba(255,255,255,0.008)"
                            : undefined,
                        }}
                      />
                    );
                  })}

                  {/* Today vertical line */}
                  {todayOffset >= 0 && todayOffset < VIEW_DAYS && (
                    <div className="absolute top-0 bottom-0 w-px bg-[#FFFF00]/20 pointer-events-none z-10"
                      style={{ left: todayOffset * COL_W + COL_W / 2 }} />
                  )}

                  {/* Job bars */}
                  {crewJobs.map((job, ji) => {
                    const jobStart = startOfDay(new Date(job.startDate));
                    const jobEnd   = startOfDay(new Date(job.endDate ?? job.startDate));

                    const s = diffDays(viewStart, jobStart);
                    const e = diffDays(viewStart, jobEnd) + 1;

                    if (e <= 0 || s >= VIEW_DAYS) return null;

                    const cs = Math.max(0, s);
                    const ce = Math.min(VIEW_DAYS, e);
                    const left  = cs * COL_W + 3;
                    const width = (ce - cs) * COL_W - 6;
                    if (width < 1) return null;

                    const style = STATUS_BAR[job.status] ?? STATUS_BAR.draft;
                    const clippedL = s < 0;
                    const clippedR = e > VIEW_DAYS;
                    const radius   = clippedL && clippedR ? "0" : clippedL ? "0 6px 6px 0" : clippedR ? "6px 0 0 6px" : "6px";

                    const BAR_H  = 26;
                    const BAR_Y  = (ROW_H - BAR_H) / 2;

                    return (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => onAssignCrew(job)}
                        title={`${job.name}  •  ${new Date(job.startDate).toLocaleDateString("th-TH")} – ${new Date(job.endDate ?? job.startDate).toLocaleDateString("th-TH")}`}
                        className="absolute flex items-center gap-1.5 px-2 overflow-hidden hover:brightness-125 active:brightness-90 transition-all cursor-pointer z-20"
                        style={{
                          left, width, top: BAR_Y, height: BAR_H,
                          background:   style.bg,
                          border:       `1px solid ${style.border}`,
                          borderRadius: radius,
                        }}
                      >
                        {/* Status dot */}
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: style.border }} />
                        <span
                          className="text-[10px] font-semibold truncate leading-none"
                          style={{ color: style.text }}
                        >
                          {job.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Empty state */}
          {crewMembers.length === 0 && (
            <div className="flex items-center justify-center py-16 text-white/30 text-sm">
              ยังไม่มีทีมงาน
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
