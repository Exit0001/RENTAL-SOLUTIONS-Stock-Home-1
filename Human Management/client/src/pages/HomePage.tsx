import { Separator } from "@/components/ui/separator";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { ScheduleView } from "@/components/schedule/ScheduleView";
import { JobListView } from "@/components/jobs/JobListView";
import { StaffListView } from "@/components/staff/StaffListView";
import { VehicleListView } from "@/components/vehicles/VehicleListView";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <DashboardView />
      <Separator />
      <ScheduleView />
      <Separator />
      <JobListView />
      <Separator />
      <StaffListView />
      <Separator />
      <VehicleListView />
    </div>
  );
}
