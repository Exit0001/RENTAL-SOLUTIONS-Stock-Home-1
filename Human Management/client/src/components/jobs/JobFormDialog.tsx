import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  jobWithAssignmentsSchema,
  type JobWithAssignmentsInput,
} from "@app/shared/validation/jobs.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useCreateJob, useUpdateJob, useJob } from "@/hooks/useJobs";
import { useUiStore } from "@/stores/uiStore";
import { syncDayAssignments } from "@/lib/dateRange";
import { apiClient } from "@/lib/apiClient";
import { JobAssignmentPicker } from "./JobAssignmentPicker";
import { JobAttachmentsField } from "./JobAttachmentsField";

const defaultValues: JobWithAssignmentsInput = {
  name: "",
  clientName: "",
  location: "",
  contactName: "",
  contactPhone: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  startTime: null,
  endTime: null,
  status: "tentative",
  notes: "",
  dayAssignments: [],
};

export function JobFormDialog() {
  const isOpen = useUiStore((s) => s.isJobDialogOpen);
  const jobId = useUiStore((s) => s.jobDialogJobId);
  const prefill = useUiStore((s) => s.jobDialogPrefill);
  const closeJobDialog = useUiStore((s) => s.closeJobDialog);

  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const { data: job } = useJob(isOpen ? jobId : undefined);
  const isEditing = !!jobId;
  const queryClient = useQueryClient();
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const form = useForm<JobWithAssignmentsInput>({
    resolver: zodResolver(jobWithAssignmentsSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!isOpen) return;
    setPendingFiles([]);

    if (job) {
      const dayAssignments = job.dayAssignments.map((d) => ({
        date: d.date,
        staffIds: d.staff.map((s) => s.id),
        vehicleIds: d.vehicles.map((v) => v.id),
        outsourceCrewCount: d.outsourceCrewCount,
        outsourceTruckCount: d.outsourceTruckCount,
      }));
      form.reset({
        name: job.name,
        clientName: job.clientName,
        location: job.location ?? "",
        contactName: job.contactName ?? "",
        contactPhone: job.contactPhone ?? "",
        startDate: job.startDate,
        endDate: job.endDate,
        startTime: job.startTime,
        endTime: job.endTime,
        status: job.status,
        notes: job.notes ?? "",
        dayAssignments: syncDayAssignments(dayAssignments, job.startDate, job.endDate),
      });
    } else {
      const base = { ...defaultValues, ...prefill };
      form.reset({
        ...base,
        dayAssignments: syncDayAssignments(prefill?.dayAssignments ?? [], base.startDate, base.endDate),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, job]);

  const startDate = form.watch("startDate");
  const endDate = form.watch("endDate");

  useEffect(() => {
    if (!startDate || !endDate) return;
    const current = form.getValues("dayAssignments");
    const synced = syncDayAssignments(current, startDate, endDate);
    if (JSON.stringify(synced) !== JSON.stringify(current)) {
      form.setValue("dayAssignments", synced);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  async function onSubmit(values: JobWithAssignmentsInput) {
    try {
      let resolvedJobId = jobId;
      if (isEditing && jobId) {
        await updateJob.mutateAsync({ id: jobId, input: values });
      } else {
        const created = await createJob.mutateAsync(values);
        resolvedJobId = created.id;
      }

      if (pendingFiles.length > 0 && resolvedJobId) {
        await Promise.all(
          pendingFiles.map((file) => apiClient.upload(`/jobs/${resolvedJobId}/attachments`, file)),
        );
        queryClient.invalidateQueries({ queryKey: ["jobs", resolvedJobId] });
      }

      toast.success(isEditing ? "บันทึกงานแล้ว" : "สร้างงานแล้ว");
      closeJobDialog();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    }
  }

  const dayAssignments = form.watch("dayAssignments");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeJobDialog()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "แก้ไขงาน" : "เพิ่มงานใหม่"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>ชื่องาน</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="เช่น งานแต่งคุณเอ-คุณบี" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ลูกค้า</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>สถานที่</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ชื่อผู้ติดต่อหน้างาน</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="เช่น พี่เอ ผู้จัดการสถานที่" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>เบอร์โทรผู้ติดต่อหน้างาน</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="เบอร์ที่โทรถามงานได้เมื่อไปถึง" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>วันที่เริ่ม</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>วันที่สิ้นสุด</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>เวลาเริ่ม</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>เวลาสิ้นสุด</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>สถานะ</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="tentative">ยังไม่ยืนยัน</SelectItem>
                        <SelectItem value="confirmed">ยืนยันแล้ว</SelectItem>
                        <SelectItem value="completed">เสร็จสิ้น</SelectItem>
                        <SelectItem value="cancelled">ยกเลิก</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>หมายเหตุ</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <JobAssignmentPicker
              dayAssignments={dayAssignments}
              excludeJobId={jobId}
              onChange={(value) => form.setValue("dayAssignments", value)}
            />

            <Separator />

            <JobAttachmentsField
              jobId={jobId}
              attachments={job?.attachments ?? []}
              pendingFiles={pendingFiles}
              onPendingFilesChange={setPendingFiles}
            />

            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {isEditing ? "บันทึกการแก้ไข" : "สร้างงาน"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
