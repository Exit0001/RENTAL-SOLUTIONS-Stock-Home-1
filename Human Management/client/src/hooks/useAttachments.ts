import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import type { JobAttachment } from "@app/shared/types/api";

export function useUploadAttachment(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => apiClient.upload<JobAttachment>(`/jobs/${jobId}/attachments`, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["jobs", jobId] }),
  });
}

export function useDeleteAttachment(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => apiClient.delete(`/attachments/${attachmentId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["jobs", jobId] }),
  });
}

export function attachmentDownloadUrl(attachmentId: string) {
  return `${import.meta.env.VITE_API_BASE_URL}/attachments/${attachmentId}/download`;
}
