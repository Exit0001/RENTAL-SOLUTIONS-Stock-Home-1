import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import type { Job, JobWithAssignmentsInput } from "@app/shared/validation/jobs.schema";
import type { JobListItem, JobWithAssignments } from "@app/shared/types/api";

interface JobListFilters {
  from?: string;
  to?: string;
  status?: string;
  search?: string;
}

function buildQuery(filters: JobListFilters) {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function useJobsList(filters: JobListFilters = {}) {
  return useQuery({
    queryKey: ["jobs", filters],
    queryFn: () => apiClient.get<JobListItem[]>(`/jobs${buildQuery(filters)}`),
  });
}

export function useJob(id: string | undefined) {
  return useQuery({
    queryKey: ["jobs", id],
    queryFn: () => apiClient.get<JobWithAssignments>(`/jobs/${id}`),
    enabled: !!id,
  });
}

function invalidateJobQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["jobs"] });
  queryClient.invalidateQueries({ queryKey: ["schedule"] });
  queryClient.invalidateQueries({ queryKey: ["dashboard"] });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: JobWithAssignmentsInput) => apiClient.post<Job>("/jobs", input),
    onSuccess: () => invalidateJobQueries(queryClient),
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<JobWithAssignmentsInput> }) =>
      apiClient.patch<Job>(`/jobs/${id}`, input),
    onSuccess: () => invalidateJobQueries(queryClient),
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/jobs/${id}`),
    onSuccess: () => invalidateJobQueries(queryClient),
  });
}
