import { useState } from "react";
import { Building2, User, Mail, Lock, Loader2, ArrowLeft, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/appStore";

interface RegisterPageProps {
  onBack: () => void;
}

export const RegisterPage = ({ onBack }: RegisterPageProps) => {
  const { setAuth } = useAppStore();
  const [companyName, setCompanyName] = useState("");
  const [slug, setSlug]               = useState("");
  const [name, setName]               = useState("");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");

  const handleRegister = async () => {
    if (!companyName || !slug || !name || !email || !password) {
      setError("กรุณากรอกข้อมูลให้ครบ"); return;
    }
    if (password.length < 6) { setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    setLoading(true); setError("");

    try {
      // 1. สร้าง Supabase auth user
      const { data, error: authErr } = await supabase.auth.signUp({ email, password });
      if (authErr) throw authErr;

      const authUser = data.user!;
      const token    = data.session?.access_token;

      // ถ้า Supabase ยัง require email confirmation — session จะเป็น null
      if (!token) {
        setError("กรุณาปิด 'Confirm email' ใน Supabase Authentication Settings แล้วลองใหม่");
        return;
      }

      // 2. สร้าง company + user ใน DB
      const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authId: authUser.id, companyName, slug, userName: name, initials, email, token }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }

      const me = await res.json();

      // 3. เก็บ state
      setAuth({
        token,
        userId:       me.userId,
        userName:     name,
        userInitials: initials,
        userRole:     "admin",
        companyId:    me.companyId,
        companyName,
      });
    } catch (err: any) {
      setError(err.message || "สร้างบัญชีไม่สำเร็จ");
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
            <h1 className="text-xl font-bold text-white">สร้างบริษัทใหม่</h1>
          </div>

          {/* Admin-only badge */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FFFF00]/5 border border-[#FFFF00]/10 mb-5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#FFFF00]/50 flex-shrink-0" />
            <p className="text-[11px] text-[#FFFF00]/50">
              สำหรับ<span className="font-semibold"> เจ้าของ / Admin </span>เท่านั้น — พนักงานเข้าร่วมผ่านอีเมลคำเชิญ
            </p>
          </div>

          <div className="space-y-3">
            {/* Company info */}
            <div className="space-y-3 pb-3 border-b border-white/[0.06]">
              <p className="text-[10px] text-white/25 uppercase tracking-wider">ข้อมูลบริษัท</p>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="ชื่อบริษัท"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#FFFF00]/40"
                />
              </div>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="slug (เช่น tyaa-rental)"
                className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#FFFF00]/40"
              />
            </div>

            {/* Admin user info */}
            <div className="space-y-3">
              <p className="text-[10px] text-white/25 uppercase tracking-wider">ข้อมูลผู้ดูแล (Admin)</p>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ชื่อ-สกุล"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#FFFF00]/40"
                />
              </div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="อีเมล"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#FFFF00]/40"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                  placeholder="รหัสผ่าน (อย่างน้อย 6 ตัว)"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#FFFF00]/40"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              onClick={handleRegister}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#FFFF00] text-black text-sm font-bold hover:opacity-90 disabled:opacity-50"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />กำลังสร้าง...</>
                : "สร้างบัญชีและเริ่มใช้งาน"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
