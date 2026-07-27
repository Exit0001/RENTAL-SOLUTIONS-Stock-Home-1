import { useState } from "react";
import { Lock, Mail, Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/appStore";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

interface LoginPageProps {
  onBack: () => void;
}

export const LoginPage = ({ onBack }: LoginPageProps) => {
  const { setAuth } = useAppStore();
  const { t } = useTranslation("auth");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handleLogin = async () => {
    if (!email || !password) { setError(t("fillEmailPassword")); return; }
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
      if (!res.ok) throw new Error(t("accountNotFound"));
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
        companyLogoUrl: me.companyLogoUrl ?? null,
        avatarUrl:    me.avatarUrl ?? null,
      });
    } catch (err: any) {
      setError(err.message || t("invalidCredentials"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-6">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-sm">

        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-fg/60 hover:text-fg transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t("back", { ns: "common" })}
        </button>

        <div className="bg-surface-1 border border-fg/[0.08] rounded-2xl p-8">
          <div className="mb-6 text-center">
            <p className="text-[10px] text-brand/50 tracking-widest uppercase mb-1">STAK v2.0</p>
            <h1 className="text-xl font-bold text-fg">{t("loginTitle")}</h1>
            <p className="text-xs text-fg/60 mt-1">{t("loginSubtitle")}</p>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg/60" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder={t("emailPlaceholder")}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-fg/[0.04] border border-fg/[0.08] text-sm text-fg placeholder:text-fg/60 focus:outline-none focus:border-brand/40"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg/60" />
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder={t("passwordPlaceholder")}
                className="w-full pl-9 pr-9 py-2.5 rounded-lg bg-fg/[0.04] border border-fg/[0.08] text-sm text-fg placeholder:text-fg/60 focus:outline-none focus:border-brand/40"
              />
              <button
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-fg/60 hover:text-fg transition-colors"
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
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-brand text-black text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />{t("loggingIn")}</>
                : t("login")}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
