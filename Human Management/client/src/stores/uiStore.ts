import { create } from "zustand";
import type { JobWithAssignmentsInput } from "@app/shared/validation/jobs.schema";

type JobPrefill = Partial<JobWithAssignmentsInput>;

interface UiState {
  isJobDialogOpen: boolean;
  jobDialogJobId: string | undefined;
  jobDialogPrefill: JobPrefill | undefined;
  openJobDialog: (jobId?: string, prefill?: JobPrefill) => void;
  closeJobDialog: () => void;
  viewJobId: string | undefined;
  openJobDetail: (jobId: string) => void;
  closeJobDetail: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  isJobDialogOpen: false,
  jobDialogJobId: undefined,
  jobDialogPrefill: undefined,
  openJobDialog: (jobId, prefill) => set({ isJobDialogOpen: true, jobDialogJobId: jobId, jobDialogPrefill: prefill }),
  closeJobDialog: () => set({ isJobDialogOpen: false, jobDialogJobId: undefined, jobDialogPrefill: undefined }),
  viewJobId: undefined,
  openJobDetail: (jobId) => set({ viewJobId: jobId }),
  closeJobDetail: () => set({ viewJobId: undefined }),
}));
