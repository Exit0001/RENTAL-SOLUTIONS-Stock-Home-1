import { Building2, LogIn, Mail, ChevronRight } from "lucide-react";

interface AuthEntryPageProps {
  onLogin:    () => void;
  onRegister: () => void;
}

export const AuthEntryPage = ({ onLogin, onRegister }: AuthEntryPageProps) => {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">

        {/* Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#FFFF00]/10 border border-[#FFFF00]/20 mb-2">
            <span className="text-3xl font-black text-[#FFFF00] leading-none">S</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">STAK</h1>
          <p className="text-xs text-white/25">AV Rental Management · v2.0</p>
        </div>

        {/* ─── ฝั่งบริษัท ─── */}
        <div className="space-y-3">
          <p className="text-[10px] text-white/20 uppercase tracking-widest text-center">มีบัญชีอยู่แล้ว</p>

          <button
            onClick={onLogin}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-[#FFFF00] text-black text-sm font-bold hover:opacity-90 active:scale-[0.99] transition-all"
          >
            <span className="flex items-center gap-2.5">
              <LogIn className="w-4 h-4" />
              เข้าสู่ระบบ
            </span>
            <ChevronRight className="w-4 h-4 opacity-50" />
          </button>

          <button
            onClick={onRegister}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-transparent border border-white/[0.08] text-white/60 text-sm font-medium hover:border-white/20 hover:text-white/80 active:scale-[0.99] transition-all"
          >
            <span className="flex items-center gap-2.5">
              <Building2 className="w-4 h-4" />
              สร้างบริษัทใหม่
            </span>
            <ChevronRight className="w-4 h-4 opacity-30" />
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/[0.05]" />
          <span className="text-[10px] text-white/15 uppercase tracking-widest">พนักงาน</span>
          <div className="flex-1 h-px bg-white/[0.05]" />
        </div>

        {/* ─── ฝั่งพนักงาน ─── */}
        <div className="flex items-start gap-3.5 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="w-8 h-8 rounded-lg bg-[#FFFF00]/8 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Mail className="w-4 h-4 text-[#FFFF00]/50" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-white/50">ได้รับคำเชิญเข้าร่วมทีม?</p>
            <p className="text-[11px] text-white/25 leading-relaxed">
              ตรวจสอบอีเมลแล้วคลิก{" "}
              <span className="text-[#FFFF00]/40 font-medium">"Accept Invite"</span>
              {" "}เพื่อตั้งค่าบัญชีและเริ่มใช้งาน
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
