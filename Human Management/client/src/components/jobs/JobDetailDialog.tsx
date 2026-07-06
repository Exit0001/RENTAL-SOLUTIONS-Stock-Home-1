import { CalendarDays, Clock, MapPin, Users, Truck, StickyNote, Phone, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useJob } from "@/hooks/useJobs";
import { attachmentDownloadUrl } from "@/hooks/useAttachments";
import { useUiStore } from "@/stores/uiStore";
import { JOB_STATUS_LABELS } from "@/lib/labels";
import { formatFileSize } from "@/lib/utils";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  tentative: "outline",
  confirmed: "default",
  completed: "secondary",
  cancelled: "destructive",
};

function formatDateLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function groupVehiclesByType(vehicles: { plateNumber: string; vehicleType: string }[]) {
  const map = new Map<string, string[]>();
  for (const v of vehicles) {
    if (!map.has(v.vehicleType)) map.set(v.vehicleType, []);
    map.get(v.vehicleType)!.push(v.plateNumber);
  }
  return [...map.entries()].map(([vehicleType, plates]) => ({ vehicleType, plates }));
}

export function JobDetailDialog() {
  const jobId = useUiStore((s) => s.viewJobId);
  const closeJobDetail = useUiStore((s) => s.closeJobDetail);
  const { data: job, isLoading } = useJob(jobId);

  return (
    <Dialog open={!!jobId} onOpenChange={(open) => !open && closeJobDetail()}>
      <DialogContent className="max-w-xl">
        {isLoading || !job ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-2 pr-6">
                <div>
                  <DialogTitle>{job.name}</DialogTitle>
                  <p className="text-sm text-muted-foreground">{job.clientName}</p>
                </div>
                <Badge variant={statusVariant[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
              </div>
            </DialogHeader>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="h-4 w-4 shrink-0" />
                {job.startDate === job.endDate ? job.startDate : `${job.startDate} - ${job.endDate}`}
              </div>
              {(job.startTime || job.endTime) && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 shrink-0" />
                  {job.startTime ?? "?"} - {job.endTime ?? "?"}
                </div>
              )}
              {job.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {job.location}
                </div>
              )}
              {(job.contactName || job.contactPhone) && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0" />
                  ผู้ติดต่อหน้างาน: {job.contactName ?? "-"} {job.contactPhone ? `(${job.contactPhone})` : ""}
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-sm font-semibold">รายละเอียดการมอบหมายแต่ละวัน</p>
              {job.dayAssignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">ยังไม่มอบหมายคน/รถ</p>
              ) : (
                <div className="space-y-3 rounded-md border p-3">
                  {job.dayAssignments.map((day, idx) => (
                    <div key={day.date} className={idx > 0 ? "space-y-1.5 border-t pt-3" : "space-y-1.5"}>
                      <p className="text-sm font-medium">{formatDateLabel(day.date)}</p>
                      <div className="flex items-start gap-2 text-sm">
                        <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        {day.staff.length > 0 ? (
                          <div className="space-y-0.5">
                            {day.staff.map((s) => (
                              <p key={s.id}>
                                {s.name} ({s.role}){s.phone ? ` · ${s.phone}` : ""}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <span>ไม่มีคน</span>
                        )}
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <Truck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        {day.vehicles.length > 0 ? (
                          <div className="space-y-0.5">
                            {groupVehiclesByType(day.vehicles).map(({ vehicleType, plates }) => (
                              <p key={vehicleType}>
                                {vehicleType} ({plates.length} คัน): {plates.join(", ")}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <span>ไม่มีรถ</span>
                        )}
                      </div>
                      {(day.outsourceCrewCount > 0 || day.outsourceTruckCount > 0) && (
                        <div className="space-y-0.5 text-sm text-muted-foreground">
                          {day.outsourceCrewCount > 0 && <p>+ ทีมโหลด Outsource {day.outsourceCrewCount} คน</p>}
                          {day.outsourceTruckCount > 0 && <p>+ รถบรรทุก 6 ล้อ (เช่า) {day.outsourceTruckCount} คัน</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {job.attachments.length > 0 && (
              <>
                <Separator />
                <div className="space-y-1.5">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <FileText className="h-4 w-4" /> เอกสารแนบ
                  </p>
                  <ul className="space-y-1">
                    {job.attachments.map((a) => (
                      <li key={a.id}>
                        <a
                          href={attachmentDownloadUrl(a.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          {a.fileName}
                        </a>
                        <span className="ml-2 text-xs text-muted-foreground">({formatFileSize(a.fileSize)})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {job.notes && (
              <>
                <Separator />
                <div className="space-y-1.5">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <StickyNote className="h-4 w-4" /> หมายเหตุ
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{job.notes}</p>
                </div>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
