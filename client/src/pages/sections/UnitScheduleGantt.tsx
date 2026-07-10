import React, { useMemo, useState, useRef } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { StockUnitWithPlan } from "@/api";
import { useResponsiveDayCount } from "@/hooks/use-responsive-day-count";

const COL_W     = 34;  // px per day column
const ROW_H     = 46;  // px per unit row
const LEFT_W    = 160; // px for sticky left unit label
const MIN_DAYS = 14;      // อย่างน้อย 2 สัปดาห์แม้จอแคบ
const FALLBACK_DAYS = 35; // 5 สัปดาห์ — ใช้ก่อน ResizeObserver วัดความกว้างจริงได้

const STATUS_BAR: Record<string, { bg: string; border: string; text: string }> = {
  draft:     { bg: "rgba(255,255,255,0.07)",  border: "rgba(255,255,255,0.12)", text: "rgba(255,255,255,0.45)" },
  scheduled: { bg: "rgba(59,130,246,0.28)",   border: "rgba(99,160,255,0.35)",  text: "rgba(147,197,253,0.9)" },
  active:    { bg: "rgba(245,158,11,0.30)",   border: "rgba(251,191,36,0.40)",  text: "rgba(253,230,138,0.9)" },
  completed: { bg: "rgba(16,185,129,0.25)",   border: "rgba(52,211,153,0.35)",  text: "rgba(167,243,208,0.9)" },
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

interface Props {
  units: StockUnitWithPlan[];
}

export const UnitScheduleGantt = ({ units }: Props): JSX.Element => {
  const { t } = useTranslation("stock");
  const today = useMemo(() => startOfDay(new Date()), []);
  const gridRef = useRef<HTMLDivElement>(null);
  const VIEW_DAYS = useResponsiveDayCount(gridRef, COL_W, LEFT_W, MIN_DAYS, FALLBACK_DAYS);

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
    }), [viewStart, VIEW_DAYS]);

  const monthGroups = useMemo(() => {
    const groups: { label: string; span: number }[] = [];
    days.forEach((d) => {
      const label = d.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
      const last  = groups[groups.length - 1];
      if (!last || last.label !== label) groups.push({ label, span: 1 });
      else last.span++;
    });
    return groups;
  }, [days]);

  const todayOffset = diffDays(viewStart, today);

  const navigate = (weeks: number) => setViewStart((prev) => {
    const d = new Date(prev);
    d.setDate(d.getDate() + weeks * 7);
    return d;
  });
  const goToday = () => {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() - 4);
    setViewStart(d);
  };

  const totalW = LEFT_W + VIEW_DAYS * COL_W;

  return (
    <div className="flex flex-col">

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={() => navigate(-1)}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => navigate(1)}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <button type="button" onClick={goToday}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-white/[0.08] text-[10px] text-white/50 hover:text-white/80 hover:border-white/[0.15] transition-colors">
          <CalendarDays className="w-3 h-3" />
          วันนี้
        </button>
        <span className="text-[10px] text-white/25 ml-1">
          {days[0].toLocaleDateString("th-TH", { day: "numeric", month: "short" })} –{" "}
          {days[VIEW_DAYS - 1].toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
        </span>
      </div>

      {/* Scrollable grid */}
      <div ref={gridRef} className="overflow-auto max-h-[380px]">
        <div style={{ minWidth: totalW }}>

          {/* Month header */}
          <div className="flex sticky top-0 z-30 bg-[#0d0d0d]">
            <div className="flex-shrink-0 sticky left-0 z-40 bg-[#0d0d0d] border-b border-r border-white/[0.06]"
              style={{ width: LEFT_W, height: 22 }} />
            {monthGroups.map((mg, i) => (
              <div key={i} className="flex-shrink-0 flex items-center px-2 border-b border-r border-white/[0.06]"
                style={{ width: mg.span * COL_W, height: 22 }}>
                <span className="text-[9px] font-semibold text-white/40 truncate">{mg.label}</span>
              </div>
            ))}
          </div>

          {/* Day header */}
          <div className="flex sticky top-[22px] z-30 bg-[#0d0d0d]">
            <div className="flex-shrink-0 sticky left-0 z-40 bg-[#0d0d0d] border-b border-r border-white/[0.06] flex items-center px-3"
              style={{ width: LEFT_W, height: 34 }}>
              <span className="text-[9px] font-bold text-[#FFFF00]/40 uppercase tracking-widest">{t("colUnit")}</span>
            </div>
            {days.map((d, i) => {
              const isToday   = i === todayOffset;
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div key={i}
                  className={`flex-shrink-0 flex flex-col items-center justify-center border-b border-r border-white/[0.06] ${isWeekend ? "bg-white/[0.015]" : ""}`}
                  style={{ width: COL_W, height: 34 }}>
                  <span className={`text-[8px] font-medium leading-none ${isToday ? "text-[#FFFF00]/70" : "text-white/25"}`}>
                    {DOW_TH[d.getDay()]}
                  </span>
                  <div className={`mt-0.5 w-[18px] h-[18px] flex items-center justify-center rounded-full ${isToday ? "bg-[#FFFF00]" : ""}`}>
                    <span className={`text-[10px] font-bold leading-none ${isToday ? "text-black" : isWeekend ? "text-white/30" : "text-white/55"}`}>
                      {d.getDate()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Unit rows */}
          {units.map((u, ri) => (
            <div key={u.id} className="flex" style={{ height: ROW_H }}>

              <div
                className={`flex-shrink-0 sticky left-0 z-10 flex flex-col justify-center px-3 border-b border-r border-white/[0.04] ${ri % 2 === 1 ? "bg-[#0f0f0f]" : "bg-[#0d0d0d]"}`}
                style={{ width: LEFT_W }}
              >
                <p className="text-[11px] font-medium text-white/75 truncate leading-tight">{u.name}</p>
                <p className="text-[9px] text-white/25 truncate leading-tight mt-0.5 font-mono">{u.serialNumber || u.barcode || "—"}</p>
              </div>

              <div
                className={`relative flex-shrink-0 border-b border-white/[0.04] ${ri % 2 === 1 ? "bg-[#0f0f0f]" : ""}`}
                style={{ width: VIEW_DAYS * COL_W, height: ROW_H }}
              >
                {days.map((d, di) => {
                  const isToday   = di === todayOffset;
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <div key={di} className="absolute top-0 bottom-0 border-r border-white/[0.04]"
                      style={{
                        left: di * COL_W, width: COL_W,
                        background: isToday ? "rgba(255,255,0,0.04)" : isWeekend ? "rgba(255,255,255,0.008)" : undefined,
                      }} />
                  );
                })}

                {todayOffset >= 0 && todayOffset < VIEW_DAYS && (
                  <div className="absolute top-0 bottom-0 w-px bg-[#FFFF00]/20 pointer-events-none z-10"
                    style={{ left: todayOffset * COL_W + COL_W / 2 }} />
                )}

                {(u.bookings ?? []).map((b, bi) => {
                  if (!b.startDate) return null;
                  const jobStart = startOfDay(new Date(b.startDate));
                  const jobEnd   = startOfDay(new Date(b.endDate ?? b.startDate));

                  const s = diffDays(viewStart, jobStart);
                  const e = diffDays(viewStart, jobEnd) + 1;
                  if (e <= 0 || s >= VIEW_DAYS) return null;

                  const cs = Math.max(0, s);
                  const ce = Math.min(VIEW_DAYS, e);
                  const left  = cs * COL_W + 2;
                  const width = (ce - cs) * COL_W - 4;
                  if (width < 1) return null;

                  const style = STATUS_BAR[b.status] ?? STATUS_BAR.draft;
                  const clippedL = s < 0;
                  const clippedR = e > VIEW_DAYS;
                  const radius   = clippedL && clippedR ? "0" : clippedL ? "0 5px 5px 0" : clippedR ? "5px 0 0 5px" : "5px";

                  const BAR_H = 22;
                  const BAR_Y = (ROW_H - BAR_H) / 2;

                  return (
                    <div key={`${b.jobId}-${bi}`}
                      title={`${b.jobName}  •  ${new Date(b.startDate).toLocaleDateString("th-TH")} – ${b.endDate ? new Date(b.endDate).toLocaleDateString("th-TH") : ""}`}
                      className="absolute flex items-center gap-1 px-1.5 overflow-hidden z-20"
                      style={{ left, width, top: BAR_Y, height: BAR_H, background: style.bg, border: `1px solid ${style.border}`, borderRadius: radius }}
                    >
                      <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: style.border }} />
                      <span className="text-[9px] font-semibold truncate leading-none" style={{ color: style.text }}>{b.jobName}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {units.length === 0 && (
            <div className="flex items-center justify-center py-14 text-white/30 text-sm">
              {t("noUnitsYetPanel")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
