import { create } from "zustand";

interface FilterState {
  jobSearch: string;
  jobStatus: string | undefined;
  setJobSearch: (value: string) => void;
  setJobStatus: (value: string | undefined) => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  jobSearch: "",
  jobStatus: undefined,
  setJobSearch: (jobSearch) => set({ jobSearch }),
  setJobStatus: (jobStatus) => set({ jobStatus }),
}));
