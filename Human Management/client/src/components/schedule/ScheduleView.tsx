import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, LayoutGrid, CalendarRange } from "lucide-react";
import type { ScheduleResource } from "@app/shared/types/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSchedule } from "@/hooks/useSchedule";
import { useJobsList } from "@/hooks/useJobs";
import { useUiStore } from "@/stores/uiStore";
import { ScheduleTimelineGrid } from "./ScheduleTimelineGrid";
import { MonthCalendarGrid } from "./MonthCalendarGrid";

const TOTAL_DAYS = 14;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function ScheduleView() {
  const [viewMode, setViewMode] = useState<"table" | "month">("table");
  const [rangeStart, setRangeStart] = useState(startOfToday());
  const [monthCursor, setMonthCursor] = useState(startOfMonth(new Date()));
  const openJobDialog = useUiStore((s) => s.openJobDialog);

  const rangeEnd = new Date(rangeStart);
  rangeEnd.setDate(rangeEnd.getDate() + TOTAL_DAYS - 1);

  const { data: resources, isLoading: isTableLoading } = useSchedule(toDateInput(rangeStart), toDateInput(rangeEnd));

  // ดึงงานครอบคลุมทั้งตารางเดือน (รวมวันท้าย/ต้นเดือนก่อน-หลังที่โผล่มาในกริด 6 สัปดาห์)
  const monthGridStart = new Date(monthCursor);
  monthGridStart.setDate(monthGridStart.getDate() - monthGridStart.getDay());
  const monthGridEnd = new Date(monthGridStart);
  monthGridEnd.setDate(monthGridEnd.getDate() + 41);
  const { data: monthJobs, isLoading: isMonthLoading } = useJobsList({
    from: toDateInput(monthGridStart),
    to: toDateInput(monthGridEnd),
  });

  function shiftRange(deltaDays: number) {
    const next = new Date(rangeStart);
    next.setDate(next.getDate() + deltaDays);
    setRangeStart(next);
  }

  function shiftMonth(deltaMonths: number) {
    setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + deltaMonths, 1));
  }

  function handleCellClick(resource: ScheduleResource, date: Date) {
    const dateStr = toDateInput(date);
    openJobDialog(undefined, {
      startDate: dateStr,
      endDate: dateStr,
      dayAssignments: [
        {
          date: dateStr,
          staffIds: resource.type === "staff" ? [resource.id] : [],
          vehicleIds: resource.type === "vehicle" ? [resource.id] : [],
          outsourceCrewCount: 0,
          outsourceTruckCount: 0,
        },
      ],
    });
  }

  function handleDayClick(date: Date) {
    const dateStr = toDateInput(date);
    openJobDialog(undefined, { startDate: dateStr, endDate: dateStr });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">ตารางจัดสรร</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border p-0.5">
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
            >
              <LayoutGrid className="mr-1.5 h-4 w-4" /> ตาราง
            </Button>
            <Button
              variant={viewMode === "month" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("month")}
            >
              <CalendarRange className="mr-1.5 h-4 w-4" /> เดือน
            </Button>
          </div>

          {viewMode === "table" ? (
            <>
              <Button variant="outline" size="icon" onClick={() => shiftRange(-7)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[180px] text-center text-sm font-medium">
                {rangeStart.toLocaleDateString("th-TH", { month: "short", day: "numeric" })} -{" "}
                {rangeEnd.toLocaleDateString("th-TH", { month: "short", day: "numeric" })}
              </span>
              <Button variant="outline" size="icon" onClick={() => shiftRange(7)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="icon" onClick={() => shiftMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[140px] text-center text-sm font-medium">
                {monthCursor.toLocaleDateString("th-TH", { month: "long", year: "numeric" })}
              </span>
              <Button variant="outline" size="icon" onClick={() => shiftMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}

          <Button onClick={() => openJobDialog()}>
            <Plus className="mr-2 h-4 w-4" /> เพิ่มงาน
          </Button>
        </div>
      </div>

      {viewMode === "table" ? (
        <>
          <p className="text-xs text-muted-foreground">คลิกช่องว่างในตารางเพื่อเพิ่มงานให้คน/รถแถวนั้นในวันนั้นได้ทันที</p>
          {isTableLoading ? (
            <Skeleton className="h-[400px] w-full" />
          ) : (
            <ScheduleTimelineGrid
              resources={resources ?? []}
              rangeStart={rangeStart}
              totalDays={TOTAL_DAYS}
              onJobClick={(jobId) => openJobDialog(jobId)}
              onCellClick={handleCellClick}
            />
          )}
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">คลิกวันที่เพื่อเพิ่มงาน หรือคลิกชื่องานเพื่อแก้ไข</p>
          {isMonthLoading ? (
            <Skeleton className="h-[500px] w-full" />
          ) : (
            <MonthCalendarGrid
              month={monthCursor}
              jobs={monthJobs ?? []}
              onDayClick={handleDayClick}
              onJobClick={(jobId) => openJobDialog(jobId)}
            />
          )}
        </>
      )}
    </div>
  );
}
