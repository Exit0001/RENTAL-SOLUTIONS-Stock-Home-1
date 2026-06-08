import { useState } from "react";
import { Building2, Users, User, LogOut, Shield, Trash2, Send, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/appStore";

type SettingsTab = "general" | "team" | "profile";

const tabs: { key: SettingsTab; label: string; icon: typeof Building2 }[] = [
  { key: "general", label: "บริษัท",  icon: Building2 },
  { key: "team",    label: "ทีมงาน",  icon: Users },
  { key: "profile", label: "โปรไฟล์", icon: User },
];

const roleLabels: Record<string, string> = {
  admin:   "Admin",
  manager: "Manager",
  crew:    "Crew",
};

const roleColors: Record<string, string> = {
  admin:   "bg-[#FFFF00]/10 text-[#FFFF00]",
  manager: "bg-blue-500/10 text-blue-400",
  crew:    "bg-white/5 text-white/40",
};

// Mock team data — จะเชื่อมกับ API จริงใน Step ถัดไป
const mockTeam = [
  { id: "1", name: "Yossapon T.",  initials: "YT", role: "admin",   email: "admin@tyaa.com" },
  { id: "2", name: "James Wilson", initials: "JW", role: "manager", email: "james@tyaa.com" },
  { id: "3", name: "Sarah Chen",   initials: "SC", role: "crew",    email: "sarah@tyaa.com" },
];

export const SettingsPage = (): JSX.Element => {
  const { companyName, userName, userInitials, userRole, token, clearAuth } = useAppStore();
  const [activeTab, setActiveTab]   = useState<SettingsTab>("general");
  const [editName, setEditName]     = useState(companyName || "");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName]   = useState("");
  const [inviteRole, setInviteRole]   = useState<"manager" | "crew">("crew");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMsg, setInviteMsg]     = useState("");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearAuth();
  };

  const handleInvite = async () => {
    if (!inviteEmail) { setInviteMsg("กรุณากรอก email"); return; }
    setInviteLoading(true); setInviteMsg("");
    try {
      const res = await fetch("/api/auth/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: inviteEmail, name: inviteName, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setInviteMsg(`✓ ${data.message}`);
      setInviteEmail(""); setInviteName("");
    } catch (err: any) {
      setInviteMsg(`✗ ${err.message}`);
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6 max-w-3xl" data-testid="page-settings">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Settings</h1>
          <p className="text-xs text-white/30 mt-0.5">จัดการบริษัท ทีมงาน และโปรไฟล์</p>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.08] text-xs text-white/40 hover:text-red-400 hover:border-red-400/20 transition-all">
          <LogOut className="w-3.5 h-3.5" /> ออกจากระบบ
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/[0.06] mb-6">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === t.key ? "border-[#FFFF00] text-[#FFFF00]" : "border-transparent text-white/30 hover:text-white/50"
            }`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {/* ─── General ─────────────────────────────────────── */}
      {activeTab === "general" && (
        <div className="space-y-4">
          <div className="bg-[#111] border border-white/[0.06] rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white/70">ข้อมูลบริษัท</h3>
            <div>
              <label className="block text-xs text-white/40 mb-1.5">ชื่อบริษัท</label>
              <input value={editName} onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#FFFF00]/40" />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5">แพลน</label>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FFFF00]/10 text-[#FFFF00]">FREE</span>
                <span className="text-xs text-white/25">อัปเกรดเป็น Pro เพื่อ feature เพิ่มเติม</span>
              </div>
            </div>
            <button className="px-4 py-2 rounded-lg bg-[#FFFF00]/10 text-[#FFFF00] text-xs font-semibold hover:bg-[#FFFF00]/20 transition-colors">
              บันทึกการเปลี่ยนแปลง
            </button>
          </div>
        </div>
      )}

      {/* ─── Team ────────────────────────────────────────── */}
      {activeTab === "team" && (
        <div className="space-y-4">
          {/* Invite */}
          {userRole === "admin" && (
            <div className="bg-[#111] border border-white/[0.06] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white/70 mb-3">เชิญสมาชิกใหม่</h3>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input value={inviteName} onChange={(e) => setInviteName(e.target.value)}
                    placeholder="ชื่อสมาชิก (optional)"
                    className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#FFFF00]/40" />
                </div>
                <div className="flex gap-2">
                  <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="อีเมลสมาชิก"
                    type="email"
                    className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#FFFF00]/40" />
                  <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)}
                    className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/70 focus:outline-none">
                    <option value="crew">Crew</option>
                    <option value="manager">Manager</option>
                  </select>
                  <button onClick={handleInvite} disabled={inviteLoading}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#FFFF00] text-black text-xs font-bold hover:opacity-90 disabled:opacity-50">
                    {inviteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    ส่ง
                  </button>
                </div>
                {inviteMsg && (
                  <p className={`text-xs px-3 py-2 rounded-lg ${inviteMsg.startsWith("✓") ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"}`}>
                    {inviteMsg}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Team list */}
          <div className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#FFFF00]" />
              <span className="text-xs font-bold text-[#FFFF00] tracking-widest uppercase">สมาชิกทั้งหมด</span>
              <span className="ml-auto text-[10px] text-white/20">{mockTeam.length} คน</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {mockTeam.map((member) => (
                <div key={member.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-[#FFFF00]/10 flex items-center justify-center text-xs font-bold text-[#FFFF00]/70">
                    {member.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/80">{member.name}</p>
                    <p className="text-xs text-white/25">{member.email}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${roleColors[member.role]}`}>
                    {roleLabels[member.role]}
                  </span>
                  {userRole === "admin" && member.role !== "admin" && (
                    <button className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Role guide */}
          <div className="bg-[#111] border border-white/[0.06] rounded-xl p-4">
            <p className="text-xs font-semibold text-white/50 mb-2">สิทธิ์แต่ละ Role</p>
            <div className="space-y-1.5 text-xs text-white/30">
              <div className="flex gap-2"><span className="text-[#FFFF00] font-semibold w-16">Admin</span>เข้าถึงทุกอย่าง รวมถึง Settings และจัดการทีม</div>
              <div className="flex gap-2"><span className="text-blue-400 font-semibold w-16">Manager</span>Stock, Jobs, Finance — ไม่สามารถจัดการ Settings</div>
              <div className="flex gap-2"><span className="text-white/40 font-semibold w-16">Crew</span>เฉพาะหน้า Jobs — Check in/out และรายงาน Incident</div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Profile ─────────────────────────────────────── */}
      {activeTab === "profile" && (
        <div className="space-y-4">
          <div className="bg-[#111] border border-white/[0.06] rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[#FFFF00]/10 flex items-center justify-center text-lg font-bold text-[#FFFF00]">
                {userInitials || "?"}
              </div>
              <div>
                <p className="font-semibold text-white">{userName}</p>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${roleColors[userRole || "crew"]}`}>
                  {roleLabels[userRole || "crew"]}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs text-white/40 mb-1.5">ชื่อ-สกุล</label>
              <input defaultValue={userName || ""}
                className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#FFFF00]/40" />
            </div>

            <div className="pt-3 border-t border-white/[0.06]">
              <label className="block text-xs text-white/40 mb-1.5">เปลี่ยนรหัสผ่าน</label>
              <div className="space-y-2">
                <input type="password" placeholder="รหัสผ่านใหม่"
                  className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#FFFF00]/40" />
                <input type="password" placeholder="ยืนยันรหัสผ่านใหม่"
                  className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#FFFF00]/40" />
              </div>
            </div>

            <button className="px-4 py-2 rounded-lg bg-[#FFFF00]/10 text-[#FFFF00] text-xs font-semibold hover:bg-[#FFFF00]/20 transition-colors">
              บันทึก
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
