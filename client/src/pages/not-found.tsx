import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a0a]">
      <div className="flex flex-col items-center text-center gap-3 px-6">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#FFFF00" }}>
          <AlertCircle className="w-6 h-6 text-black" />
        </div>
        <h1 className="text-2xl font-bold text-white">404 — Page Not Found</h1>
        <p className="text-sm text-white/60 max-w-sm">
          The page you're looking for doesn't exist or has been moved.
        </p>
      </div>
    </div>
  );
}
