import { MoreHorizontal, Pencil, Trash2, Users, Truck, MapPin } from "lucide-react";
import { toast } from "sonner";
import type { JobListItem } from "@app/shared/types/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useUpdateJob } from "@/hooks/useJobs";
import { JOB_STATUS_LABELS } from "@/lib/labels";

interface JobCardGridProps {
  jobs: JobListItem[];
  onView: (job: JobListItem) => void;
  onEdit: (job: JobListItem) => void;
  onDelete: (job: JobListItem) => void;
}

function formatShortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

function StatusSelect({ job }: { job: JobListItem }) {
  const updateJob = useUpdateJob();

  function handleChange(value: string) {
    updateJob.mutate(
      { id: job.id, input: { status: value as JobListItem["status"] } },
      {
        onError: (err) => toast.error(err instanceof Error ? err.message : "อัปเดตสถานะไม่สำเร็จ"),
      },
    );
  }

  return (
    <Select value={job.status} onValueChange={handleChange}>
      <SelectTrigger className="h-8 w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(JOB_STATUS_LABELS).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function JobCardGrid({ jobs, onView, onEdit, onDelete }: JobCardGridProps) {
  if (jobs.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">ไม่พบงาน</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((job) => (
        <Card
          key={job.id}
          className="cursor-pointer transition-colors hover:border-primary"
          onClick={() => onView(job)}
        >
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5">
                <p className="font-semibold leading-tight">{job.name}</p>
                <p className="text-sm text-muted-foreground">{job.clientName}</p>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="-mr-2 -mt-1 shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(job)}>
                      <Pencil className="mr-2 h-4 w-4" /> แก้ไข
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(job)} className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" /> ลบ
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <p className="text-sm text-muted-foreground">
              {job.startDate === job.endDate ? job.startDate : `${job.startDate} - ${job.endDate}`}
            </p>
            {job.location && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" /> {job.location}
              </p>
            )}
            <div className="space-y-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
              {job.dayAssignments.length === 0 ? (
                <p className="text-muted-foreground">ยังไม่มอบหมายคน/รถ</p>
              ) : (
                job.dayAssignments.map((day, idx) => (
                  <div key={day.date} className={cn("space-y-1", idx > 0 && "border-t pt-1.5")}>
                    <p className="text-xs font-medium text-muted-foreground">{formatShortDate(day.date)}</p>
                    <div className="flex items-start gap-1.5">
                      <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="font-semibold">
                        {day.staffNames.length > 0 ? day.staffNames.join(", ") : "ไม่มีคน"}
                      </span>
                    </div>
                    {day.vehiclePlates.length > 0 && (
                      <div className="flex items-start gap-1.5">
                        <Truck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="font-semibold">{day.vehiclePlates.join(", ")}</span>
                      </div>
                    )}
                    {(day.outsourceCrewCount > 0 || day.outsourceTruckCount > 0) && (
                      <p className="text-xs text-muted-foreground">
                        {day.outsourceCrewCount > 0 && `+ ทีมโหลด Outsource ${day.outsourceCrewCount} คน`}
                        {day.outsourceCrewCount > 0 && day.outsourceTruckCount > 0 && " · "}
                        {day.outsourceTruckCount > 0 && `+ รถ 6 ล้อ (เช่า) ${day.outsourceTruckCount} คัน`}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <StatusSelect job={job} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
