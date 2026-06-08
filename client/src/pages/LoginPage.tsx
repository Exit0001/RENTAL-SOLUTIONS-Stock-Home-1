import { useState } from "react";
import { Lock, Mail, Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/appStore";

interface LoginPageProps {
  onBack: () => void;
}

export const LoginPage = ({ onBack }: LoginPageProps) => {
  const { setAuth } = useAppStore();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handleLogin = async () => {
    if (!email || !password) { setError("กรุณากรอกอีเมลและรหัสผ่าน"); return; }
    setLoading(true); setError("");

    try {
      // 1. Login กับ Supabase Auth
      const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
      if (authErr) throw authErr;

      const session  = data.session!;

      // 2. ดึงข้อมูล user + company จาก API
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error("ไม่พบบัญชีนี้ในระบบ");
      const me = await res.json();

      // 3. เก็บ auth state
      setAuth({
        token:        session.access_token,
        userId:       me.id,
        userName:     me.name,
        userInitials: me.initials,
        userRole:     me.role,
        companyId:    me.companyId,
        companyName:  me.companyName,
      });
    } catch (err: any) {
      setError(err.message || "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          กลับ
        </button>

        <div className="bg-[#111] border border-white/[0.08] rounded-2xl p-8">
          <div className="mb-6 text-center">
            <p className="text-[10px] text-[#FFFF00]/50 tracking-widest uppercase mb-1">STAK v2.0</p>
            <h1 className="text-xl font-bold text-white">เข้าสู่ระบบ</h1>
            <p className="text-xs text-white/25 mt-1">ใช้ได้ทั้ง Admin, Manager และ Crew</p>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="อีเมล"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#FFFF00]/40"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="รหัสผ่าน"
                className="w-full pl-9 pr-9 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#FFFF00]/40"
              />
              <button
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#FFFF00] text-black text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />กำลังเข้าสู่ระบบ...</>
                : "เข้าสู่ระบบ"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
