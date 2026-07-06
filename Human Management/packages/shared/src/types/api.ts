import type { Job } from "../validation/jobs.schema";
import type { Staff } from "../validation/staff.schema";
import type { Vehicle } from "../validation/vehicles.schema";

export interface JobDayAssignment {
  date: string;
  staff: Staff[];
  vehicles: Vehicle[];
  outsourceCrewCount: number;
  outsourceTruckCount: number;
}

export interface JobAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

export interface JobWithAssignments extends Job {
  dayAssignments: JobDayAssignment[];
  attachments: JobAttachment[];
}

export interface JobListDaySummary {
  date: string;
  staffNames: string[];
  vehiclePlates: string[];
  outsourceCrewCount: number;
  outsourceTruckCount: number;
}

export interface JobListItem extends Job {
  dayAssignments: JobListDaySummary[];
}

export interface DashboardSummary {
  jobsThisWeek: number;
  upcomingJobsCount: number;
  staffAvailable: number;
  staffAssigned: number;
  vehiclesAvailable: number;
  vehiclesAssigned: number;
}

export interface ScheduleResource {
  id: string;
  name: string;
  type: "staff" | "vehicle";
  jobs: {
    jobId: string;
    jobName: string;
    startDate: string;
    endDate: string;
    status: Job["status"];
  }[];
}
