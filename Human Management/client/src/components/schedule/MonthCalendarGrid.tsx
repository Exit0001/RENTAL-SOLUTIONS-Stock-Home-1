import { cn } from "@/lib/utils";
import type { Job } from "@app/shared/validation/jobs.schema";

const WEEKDAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const MAX_CHIPS_PER_DAY = 3;

const statusColor: Record<string, string> = {
  tentative: "bg-muted-foreground/40",
  confirmed: "bg-primary",
  completed: "bg-secondary-foreground/60",
  cancelled: "bg-destructive/50",
};

function getMonthGridDays(month: Date) {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 42 }).map((_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

interface MonthCalendarGridProps {
  month: Date;
  jobs: Job[];
  onDayClick: (date: Date) => void;
  onJobClick: (jobId: string) => void;
}

export function MonthCalendarGrid({ month, jobs, onDayClick, onJobClick }: MonthCalendarGridProps) {
  const days = getMonthGridDays(month);
  const today = new Date();

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="grid grid-cols-7 border-b bg-muted/50">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-2 text-center text-xs font-medium text-muted-foreground">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const dateStr = toDateInput(day);
          const dayJobs = jobs.filter((job) => job.startDate <= dateStr && job.endDate >= dateStr);
          const visible = dayJobs.slice(0, MAX_CHIPS_PER_DAY);
          const overflow = dayJobs.length - visible.length;
          const isCurrentMonth = day.getMonth() === month.getMonth();
          const isToday = isSameDay(day, today);

          return (
            <div
              key={i}
              onClick={() => onDayClick(day)}
              className={cn(
                "flex min-h-[96px] cursor-pointer flex-col gap-1 border-b border-r p-1 hover:bg-accent/40",
                !isCurrentMonth && "bg-muted/20 text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "self-end text-xs",
                  isToday && "flex h-5 w-5 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground",
                )}
              >
                {day.getDate()}
              </span>
              <div className="flex flex-col gap-0.5">
                {visible.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    title={job.name}
                    onClick={(e) => {
                      e.stopPropagation();
                      onJobClick(job.id);
                    }}
                    className={cn(
                      "truncate rounded px-1 py-0.5 text-left text-[11px] text-white",
                      statusColor[job.status] ?? "bg-primary",
                    )}
                  >
                    {job.name}
                  </button>
                ))}
                {overflow > 0 && <span className="text-[11px] text-muted-foreground">+{overflow} เพิ่มเติม</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
