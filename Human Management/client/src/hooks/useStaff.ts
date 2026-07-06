import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import type { Staff, StaffInsert, StaffUpdate } from "@app/shared/validation/staff.schema";

function invalidateStaffRelated(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["staff"] });
  queryClient.invalidateQueries({ queryKey: ["schedule"] });
  queryClient.invalidateQueries({ queryKey: ["dashboard"] });
}

export function useCreateManyStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rows: StaffInsert[]) => apiClient.post<Staff[]>("/staff/bulk", { staff: rows }),
    onSuccess: () => invalidateStaffRelated(queryClient),
  });
}

export function useStaffList(search?: string) {
  return useQuery({
    queryKey: ["staff", { search }],
    queryFn: () => apiClient.get<Staff[]>(`/staff${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StaffInsert) => apiClient.post<Staff>("/staff", input),
    onSuccess: () => invalidateStaffRelated(queryClient),
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: StaffUpdate }) =>
      apiClient.patch<Staff>(`/staff/${id}`, input),
    onSuccess: () => invalidateStaffRelated(queryClient),
  });
}

export function useDeleteStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/staff/${id}`),
    onSuccess: () => invalidateStaffRelated(queryClient),
  });
}
