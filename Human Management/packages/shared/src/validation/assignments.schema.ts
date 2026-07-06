import { z } from "zod";

export const conflictsByDateSchema = z.object({
  dates: z.array(z.string()).min(1),
  excludeJobId: z.string().uuid().optional(),
});

export type ConflictsByDateInput = z.infer<typeof conflictsByDateSchema>;

export interface DateConflictInfo {
  jobId: string;
  jobName: string;
}

export interface DateAssignmentStatus {
  staffConflicts: Record<string, DateConflictInfo[]>;
  vehicleConflicts: Record<string, DateConflictInfo[]>;
}

export type ConflictsByDateResult = Record<string, DateAssignmentStatus>;
