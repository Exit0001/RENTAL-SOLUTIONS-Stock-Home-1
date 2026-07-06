import { CalendarClock, Users, Truck, ClipboardList } from "lucide-react";
import { useDashboardSummary } from "@/hooks/useDashboard";
import { StatCard } from "./StatCard";
import { UpcomingJobsList } from "./UpcomingJobsList";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardView() {
  const { data: summary, isLoading } = useDashboardSummary();

  return (
    <div className="space-y-6">
      {isLoading || !summary ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="งานสัปดาห์นี้" value={summary.jobsThisWeek} icon={CalendarClock} />
          <StatCard label="งานที่กำลังจะมาถึง" value={summary.upcomingJobsCount} icon={ClipboardList} />
          <StatCard label="พนักงานว่าง" value={`${summary.staffAvailable} / ${summary.staffAvailable + summary.staffAssigned}`} icon={Users} />
          <StatCard label="รถว่าง" value={`${summary.vehiclesAvailable} / ${summary.vehiclesAvailable + summary.vehiclesAssigned}`} icon={Truck} />
        </div>
      )}
      <UpcomingJobsList />
    </div>
  );
}
