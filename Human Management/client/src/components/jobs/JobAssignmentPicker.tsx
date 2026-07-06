import { useEffect, useMemo, useState } from "react";
import type { ConflictsByDateResult } from "@app/shared/validation/assignments.schema";
import type { DayAssignment } from "@app/shared/validation/jobs.schema";
import { useStaffList } from "@/hooks/useStaff";
import { useVehicleList } from "@/hooks/useVehicles";
import { useConflictsByDate } from "@/hooks/useConflictCheck";
import { MultiSelectCombobox } from "./MultiSelectCombobox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface JobAssignmentPickerProps {
  dayAssignments: DayAssignment[];
  excludeJobId?: string;
  onChange: (dayAssignments: DayAssignment[]) => void;
}

function formatDateLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function JobAssignmentPicker({ dayAssignments, excludeJobId, onChange }: JobAssignmentPickerProps) {
  const { data: staff } = useStaffList();
  const { data: vehicles } = useVehicleList();
  const conflictsByDate = useConflictsByDate();
  const [conflicts, setConflicts] = useState<ConflictsByDateResult>({});

  const dates = useMemo(() => dayAssignments.map((d) => d.date), [dayAssignments]);
  const datesKey = dates.join(",");

  useEffect(() => {
    if (dates.length === 0) {
      setConflicts({});
      return;
    }
    const timeout = setTimeout(() => {
      conflictsByDate.mutate({ dates, excludeJobId }, { onSuccess: setConflicts });
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datesKey, excludeJobId]);

  function updateDay(date: string, patch: Partial<DayAssignment>) {
    onChange(dayAssignments.map((d) => (d.date === date ? { ...d, ...patch } : d)));
  }

  if (dayAssignments.length === 0) {
    return <p className="text-sm text-muted-foreground">กรุณาเลือกวันที่ของงานก่อนมอบหมายคน/รถ</p>;
  }

  return (
    <div className="space-y-2">
      <Label>มอบหมายคน/รถรายวัน</Label>
      <p className="text-xs text-muted-foreground">แต่ละวันในงานนี้สามารถเลือกคน/รถได้ไม่เหมือนกัน เช่น วันเซ็ทอัพ วันซ้อม วันโชว์ — คนหรือรถที่ติดงานอื่นอยู่แล้ววันนั้นจะเลือกไม่ได้ และจะบอกว่าติดงานอะไร</p>
      <div className="space-y-3 rounded-md border p-3">
        {dayAssignments.map((day) => {
          const dateStatus = conflicts[day.date];

          const staffOptions = (staff ?? []).map((s) => {
            const isSelected = day.staffIds.includes(s.id);
            const conflictJobs = dateStatus?.staffConflicts[s.id];
            const conflictReason = conflictJobs?.length ? `ติดงาน ${conflictJobs.map((c) => c.jobName).join(", ")}` : undefined;
            return {
              id: s.id,
              label: `${s.name} — ${s.role}`,
              disabled: !isSelected && !!conflictReason,
              conflictReason,
            };
          });

          const vehicleOptions = (vehicles ?? []).map((v) => {
            const isSelected = day.vehicleIds.includes(v.id);
            const conflictJobs = dateStatus?.vehicleConflicts[v.id];
            const conflictReason = conflictJobs?.length ? `ติดงาน ${conflictJobs.map((c) => c.jobName).join(", ")}` : undefined;
            return {
              id: v.id,
              label: `${v.plateNumber} (${v.vehicleType})`,
              disabled: !isSelected && !!conflictReason,
              conflictReason,
            };
          });

          return (
            <div key={day.date} className="space-y-2 border-b pb-3 last:border-b-0 last:pb-0">
              <p className="text-sm font-medium">{formatDateLabel(day.date)}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">พนักงาน</Label>
                  <MultiSelectCombobox
                    options={staffOptions}
                    selected={day.staffIds}
                    onChange={(ids) => updateDay(day.date, { staffIds: ids })}
                    placeholder="เลือกพนักงาน..."
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">รถ</Label>
                  <MultiSelectCombobox
                    options={vehicleOptions}
                    selected={day.vehicleIds}
                    onChange={(ids) => updateDay(day.date, { vehicleIds: ids })}
                    placeholder="เลือกรถ..."
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">ทีมโหลด Outsource (คน)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={day.outsourceCrewCount}
                    onChange={(e) => updateDay(day.date, { outsourceCrewCount: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">รถบรรทุก 6 ล้อ (เช่า) (คัน)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={day.outsourceTruckCount}
                    onChange={(e) => updateDay(day.date, { outsourceTruckCount: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
