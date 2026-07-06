import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/layout/AppShell";
import { JobFormDialog } from "@/components/jobs/JobFormDialog";
import { JobDetailDialog } from "@/components/jobs/JobDetailDialog";
import HomePage from "@/pages/HomePage";

export default function App() {
  return (
    <>
      <AppShell>
        <HomePage />
      </AppShell>
      <JobFormDialog />
      <JobDetailDialog />
      <Toaster richColors position="top-right" />
    </>
  );
}
