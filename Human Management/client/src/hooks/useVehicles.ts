import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import type { Vehicle, VehicleInsert, VehicleUpdate } from "@app/shared/validation/vehicles.schema";

function invalidateVehicleRelated(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["vehicles"] });
  queryClient.invalidateQueries({ queryKey: ["schedule"] });
  queryClient.invalidateQueries({ queryKey: ["dashboard"] });
}

export function useVehicleList(search?: string) {
  return useQuery({
    queryKey: ["vehicles", { search }],
    queryFn: () =>
      apiClient.get<Vehicle[]>(`/vehicles${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: VehicleInsert) => apiClient.post<Vehicle>("/vehicles", input),
    onSuccess: () => invalidateVehicleRelated(queryClient),
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: VehicleUpdate }) =>
      apiClient.patch<Vehicle>(`/vehicles/${id}`, input),
    onSuccess: () => invalidateVehicleRelated(queryClient),
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/vehicles/${id}`),
    onSuccess: () => invalidateVehicleRelated(queryClient),
  });
}
