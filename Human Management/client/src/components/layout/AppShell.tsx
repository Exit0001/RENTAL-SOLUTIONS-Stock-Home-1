export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-card px-4 py-3 sm:px-6">
        <h1 className="text-lg font-semibold">ระบบจัดคน-รถ Audio Production</h1>
      </header>
      <main className="mx-auto max-w-6xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
