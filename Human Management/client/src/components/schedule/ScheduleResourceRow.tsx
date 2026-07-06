import { cn } from "@/lib/utils";
import type { ScheduleResource } from "@app/shared/types/api";

const DAY_WIDTH = 48;
const LABEL_WIDTH = 180;

const statusColor: Record<string, string> = {
  tentative: "bg-muted-foreground/40",
  confirmed: "bg-primary",
  completed: "bg-secondary-foreground/60",
  cancelled: "bg-destructive/50",
};

function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

interface ScheduleResourceRowProps {
  resource: ScheduleResource;
  rangeStart: Date;
  totalDays: number;
  onJobClick: (jobId: string) => void;
  onCellClick: (resource: ScheduleResource, date: Date) => void;
}

export function ScheduleResourceRow({ resource, rangeStart, totalDays, onJobClick, onCellClick }: ScheduleResourceRowProps) {
  return (
    <div className="flex border-b last:border-b-0">
      <div
        className="flex shrink-0 items-center border-r px-3 py-2 text-sm font-medium"
        style={{ width: LABEL_WIDTH }}
      >
        {resource.name}
      </div>
      <div className="relative" style={{ width: totalDays * DAY_WIDTH, height: 44 }}>
        {Array.from({ length: totalDays }).map((_, i) => {
          const date = new Date(rangeStart);
          date.setDate(date.getDate() + i);
          return (
            <button
              key={i}
              type="button"
              title="คลิกเพื่อเพิ่มงาน"
              onClick={() => onCellClick(resource, date)}
              className="absolute top-0 h-full border-r border-dashed hover:bg-accent/60"
              style={{ left: i * DAY_WIDTH, width: DAY_WIDTH }}
            />
          );
        })}
        {resource.jobs.map((job) => {
          const jobStart = new Date(job.startDate);
          const jobEnd = new Date(job.endDate);
          const startOffset = Math.max(0, daysBetween(rangeStart, jobStart));
          const endOffset = Math.min(totalDays, daysBetween(rangeStart, jobEnd) + 1);
          const width = Math.max(endOffset - startOffset, 1) * DAY_WIDTH - 4;

          return (
            <button
              key={job.jobId}
              onClick={() => onJobClick(job.jobId)}
              title={job.jobName}
              className={cn(
                "absolute top-1.5 truncate rounded px-2 py-1 text-left text-xs text-white shadow-sm",
                statusColor[job.status] ?? "bg-primary",
              )}
              style={{ left: startOffset * DAY_WIDTH + 2, width }}
            >
              {job.jobName}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { DAY_WIDTH, LABEL_WIDTH };
