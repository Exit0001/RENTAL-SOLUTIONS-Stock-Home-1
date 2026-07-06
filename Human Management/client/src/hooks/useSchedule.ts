import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import type { ScheduleResource } from "@app/shared/types/api";

export function useSchedule(from: string, to: string) {
  return useQuery({
    queryKey: ["schedule", { from, to }],
    queryFn: () => apiClient.get<ScheduleResource[]>(`/schedule?from=${from}&to=${to}`),
  });
}
