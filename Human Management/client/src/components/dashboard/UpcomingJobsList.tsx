import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUpcomingJobs } from "@/hooks/useDashboard";
import { useUiStore } from "@/stores/uiStore";
import { JOB_STATUS_LABELS } from "@/lib/labels";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  tentative: "outline",
  confirmed: "default",
  completed: "secondary",
  cancelled: "destructive",
};

export function UpcomingJobsList() {
  const { data: jobs, isLoading } = useUpcomingJobs(8);
  const openJobDetail = useUiStore((s) => s.openJobDetail);

  return (
    <Card>
      <CardHeader>
        <CardTitle>งานที่กำลังจะมาถึง</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </>
        ) : jobs && jobs.length > 0 ? (
          jobs.map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={() => openJobDetail(job.id)}
              className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
            >
              <div>
                <p className="font-medium">{job.name}</p>
                <p className="text-muted-foreground">
                  {job.clientName} · {job.startDate === job.endDate ? job.startDate : `${job.startDate} - ${job.endDate}`}
                </p>
              </div>
              <Badge variant={statusVariant[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
            </button>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">ยังไม่มีงานที่กำลังจะมาถึง</p>
        )}
      </CardContent>
    </Card>
  );
}
