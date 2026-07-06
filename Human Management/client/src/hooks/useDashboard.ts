import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import type { DashboardSummary } from "@app/shared/types/api";
import type { Job } from "@app/shared/validation/jobs.schema";

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => apiClient.get<DashboardSummary>("/dashboard/summary"),
  });
}

export function useUpcomingJobs(limit = 10) {
  return useQuery({
    queryKey: ["dashboard", "upcoming-jobs", limit],
    queryFn: () => apiClient.get<Job[]>(`/dashboard/upcoming-jobs?limit=${limit}`),
  });
}
