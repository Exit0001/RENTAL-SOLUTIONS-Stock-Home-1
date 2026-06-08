// หน้านี้แสดงเมื่อพนักงานคลิก link จาก email คำเชิญ
// Supabase จะส่ง token มาใน URL hash → เราใช้ token นั้น set password
import { useState, useEffect } from "react";
import { User, Lock, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/appStore";

export const InvitePage = () => {
  const { setAuth } = useAppStore();
  const [name, setName]         = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [done, setDone]         = useState(false);

  // ตรวจสอบว่า Supabase ตั้ง session จาก invite token แล้ว
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setError("Link ไม่ถูกต้องหรือหมดอายุแล้ว");
      }
    });
  }, []);

  const handleAccept = async () => {
    if (!name.trim())              { setError("กรุณากรอกชื่อ"); return; }
    if (password.length < 6)       { setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัว"); return; }
    if (password !== confirm)      { setError("รหัสผ่านไม่ตรงกัน"); return; }

    setLoading(true); setError("");

    try {
      // 1. ตั้ง password ใหม่ให้ Supabase auth user
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) throw updateErr;

      // 2. ดึง session ที่ Supabase ตั้งให้แล้ว
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("ไม่พบ session");

      // 3. สร้าง DB user record + ดึงข้อมูล company
      const res = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, token: session.access_token }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }

      const me = await res.json();

      // 4. เก็บ auth state
      setAuth({
        token:        session.access_token,
        userId:       me.userId,
        userName:     name,
        userInitials: name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2),
        userRole:     me.role,
        companyId:    me.companyId,
        companyName:  me.companyName,
      });

      setDone(true);
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white">เข้าร่วมสำเร็จ!</h2>
          <p className="text-sm text-white/40 mt-1">กำลังเข้าสู่ระบบ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-[#111] border border-white/[0.08] rounded-2xl p-8">
        <div className="mb-6 text-center">
          <p className="text-[10px] text-[#FFFF00]/50 tracking-widest uppercase mb-1">STAK v2.0</p>
          <h1 className="text-xl font-bold text-white">ยืนยันการเข้าร่วม</h1>
          <p className="text-xs text-white/30 mt-1">ตั้งชื่อและรหัสผ่านเพื่อเริ่มใช้งาน</p>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="ชื่อ-สกุลของคุณ"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#FFFF00]/40" />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="ตั้งรหัสผ่าน (อย่างน้อย 6 ตัว)"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#FFFF00]/40" />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              placeholder="ยืนยันรหัสผ่าน"
              onKeyDown={(e) => e.key === "Enter" && handleAccept()}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#FFFF00]/40" />
          </div>

          {error && <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}

          <button onClick={handleAccept} disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#FFFF00] text-black text-sm font-bold hover:opacity-90 disabled:opacity-50">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />กำลังยืนยัน...</> : "เริ่มใช้งาน"}
          </button>
        </div>
      </div>
    </div>
  );
};
