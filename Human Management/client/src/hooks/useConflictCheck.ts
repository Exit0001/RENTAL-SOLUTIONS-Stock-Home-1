import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import type { ConflictsByDateInput, ConflictsByDateResult } from "@app/shared/validation/assignments.schema";

export function useConflictsByDate() {
  return useMutation({
    mutationFn: (input: ConflictsByDateInput) =>
      apiClient.post<ConflictsByDateResult>("/conflicts/by-date", input),
  });
}
