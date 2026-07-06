import type { ScheduleResource } from "@app/shared/types/api";
import { ScheduleResourceRow, DAY_WIDTH, LABEL_WIDTH } from "./ScheduleResourceRow";

interface ScheduleTimelineGridProps {
  resources: ScheduleResource[];
  rangeStart: Date;
  totalDays: number;
  onJobClick: (jobId: string) => void;
  onCellClick: (resource: ScheduleResource, date: Date) => void;
}

export function ScheduleTimelineGrid({ resources, rangeStart, totalDays, onJobClick, onCellClick }: ScheduleTimelineGridProps) {
  const staffResources = resources.filter((r) => r.type === "staff");
  const vehicleResources = resources.filter((r) => r.type === "vehicle");

  const days = Array.from({ length: totalDays }).map((_, i) => {
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div className="overflow-x-auto rounded-lg border">
      <div className="flex border-b bg-muted/50">
        <div className="shrink-0 border-r" style={{ width: LABEL_WIDTH }} />
        <div className="flex">
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className="shrink-0 border-r text-center text-xs text-muted-foreground py-2"
              style={{ width: DAY_WIDTH }}
            >
              {day.toLocaleDateString("th-TH", { weekday: "short", day: "numeric" })}
            </div>
          ))}
        </div>
      </div>

      <div className="border-b bg-muted/30 px-3 py-1 text-xs font-semibold uppercase text-muted-foreground">พนักงาน</div>
      {staffResources.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">ยังไม่มีพนักงาน</p>
      ) : (
        staffResources.map((resource) => (
          <ScheduleResourceRow
            key={resource.id}
            resource={resource}
            rangeStart={rangeStart}
            totalDays={totalDays}
            onJobClick={onJobClick}
            onCellClick={onCellClick}
          />
        ))
      )}

      <div className="border-b border-t bg-muted/30 px-3 py-1 text-xs font-semibold uppercase text-muted-foreground">รถ</div>
      {vehicleResources.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">ยังไม่มีรถ</p>
      ) : (
        vehicleResources.map((resource) => (
          <ScheduleResourceRow
            key={resource.id}
            resource={resource}
            rangeStart={rangeStart}
            totalDays={totalDays}
            onJobClick={onJobClick}
            onCellClick={onCellClick}
          />
        ))
      )}
    </div>
  );
}
