import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { JobListItem } from "@app/shared/types/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useJobsList, useDeleteJob } from "@/hooks/useJobs";
import { useFilterStore } from "@/stores/filterStore";
import { useUiStore } from "@/stores/uiStore";
import { JobFiltersBar } from "./JobFiltersBar";
import { JobCardGrid } from "./JobCardGrid";

export function JobListView() {
  const jobSearch = useFilterStore((s) => s.jobSearch);
  const jobStatus = useFilterStore((s) => s.jobStatus);
  const openJobDialog = useUiStore((s) => s.openJobDialog);
  const openJobDetail = useUiStore((s) => s.openJobDetail);

  const { data: jobs, isLoading } = useJobsList({ search: jobSearch || undefined, status: jobStatus });
  const deleteJob = useDeleteJob();

  async function handleDelete(job: JobListItem) {
    if (!confirm(`ลบงาน "${job.name}" หรือไม่?`)) return;
    try {
      await deleteJob.mutateAsync(job.id);
      toast.success("ลบงานแล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ลบงานไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">รายการงาน</h2>
        <Button onClick={() => openJobDialog()}>
          <Plus className="mr-2 h-4 w-4" /> เพิ่มงานใหม่
        </Button>
      </div>
      <JobFiltersBar />
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <JobCardGrid
          jobs={jobs ?? []}
          onView={(job) => openJobDetail(job.id)}
          onEdit={(job) => openJobDialog(job.id)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
